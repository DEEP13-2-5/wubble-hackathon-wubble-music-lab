import { useEffect, useState, useRef, useCallback } from 'react';
import { useStore, A } from '../lib/store.jsx';
import { teamApi, musicApi, pollStatus } from '../lib/api.js';
import { relativeTime, copyToClipboard, sanitize, SOCKET_URL } from '../lib/utils.js';

const SOCKET_CDN = 'https://cdn.socket.io/4.7.5/socket.io.min.js';

function loadSocketIO() {
  return new Promise((res, rej) => {
    if (window.io) { res(window.io); return; }
    const s = document.createElement('script');
    s.src = SOCKET_CDN;
    s.onload = () => res(window.io);
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

function normalizeTeamPayload(team) {
  if (!team || typeof team !== 'object') return team;
  return {
    ...team,
    _id: team._id || team.id,
    id: team.id || team._id,
    members: team.members || team.memberIds || [],
    memberIds: team.memberIds || team.members || [],
    messages: team.messages || team.chat || [],
    chat: team.chat || team.messages || [],
    versions: (team.versions || []).map((version) => {
      const votes = version.votes || version.voterIds || [];
      return {
        ...version,
        _id: version._id || version.id,
        id: version.id || version._id,
        votes,
        voterIds: version.voterIds || votes,
      };
    }),
  };
}

export default function TeamPage() {
  const { state, dispatch, toast } = useStore();
  const { teams, activeTeam, teamsStatus, token, user } = state;

  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [chatMsg, setChatMsg] = useState('');
  const [versionName, setVersionName] = useState('');
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [addVersionMode, setAddVersionMode] = useState('upload');
  
  const [genPrompt, setGenPrompt] = useState('');
  const [genEmotion, setGenEmotion] = useState('');
  const [genInstrumental, setGenInstrumental] = useState(false);
  const [genStatus, setGenStatus] = useState('idle');
  const [genError, setGenError] = useState('');
  const [versionFile, setVersionFile] = useState(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingPublish, setLoadingPublish] = useState(false);
  const socketRef = useRef(null);
  const chatBottomRef = useRef(null);

  // ── Load teams ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (teamsStatus === 'idle') loadTeams();
  }, []);

  const loadTeams = async () => {
    dispatch({ type: A.SET_TEAMS_STATUS, payload: 'loading' });
    try {
      const data = await teamApi.mine(token);
      dispatch({ type: A.SET_TEAMS, payload: data.teams || [] });
    } catch (e) {
      dispatch({ type: A.SET_TEAMS_STATUS, payload: 'error' });
      toast(e.message, 'error');
    }
  };

  // ── Socket connection ──────────────────────────────────────────────────
  const connectSocket = useCallback(async (teamId) => {
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    const io = await loadSocketIO();
    const url = SOCKET_URL || window.location.origin;
    const sock = io(url, { transports: ['websocket', 'polling'] });
    socketRef.current = sock;

    sock.on('connect', () => {
      sock.emit('joinTeam', { teamId, token });
    });
    sock.on('teamStateUpdated', ({ team }) => {
      dispatch({ type: A.UPDATE_ACTIVE_TEAM, payload: normalizeTeamPayload(team) });
    });
    sock.on('teamError', ({ message }) => toast(message, 'error'));
    sock.on('connect_error', (error) => {
      toast(error?.message || 'Socket connection failed', 'error');
    });
    sock.on('disconnect', () => {});
  }, [token, dispatch, toast]);

  useEffect(() => {
    if (activeTeam?._id || activeTeam?.id) {
      const id = activeTeam._id || activeTeam.id;
      connectSocket(id);
    }
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, [activeTeam?._id || activeTeam?.id]);

  // ── Scroll chat ───────────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTeam?.messages?.length]);

  // ── Select team ────────────────────────────────────────────────────────
  const selectTeam = async (team) => {
    dispatch({ type: A.SET_ACTIVE_TEAM, payload: team });
    try {
      const data = await teamApi.get({ teamId: team._id || team.id, token });
      dispatch({ type: A.UPDATE_ACTIVE_TEAM, payload: normalizeTeamPayload(data.team) });
    } catch (e) { toast(e.message, 'error'); }
  };

  // ── Create team ────────────────────────────────────────────────────────
  const createTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return toast('Enter a team name', 'error');
    setLoadingCreate(true);
    try {
      const data = await teamApi.create({ name: teamName.trim(), token });
      dispatch({ type: A.ADD_TEAM, payload: data.team });
      setTeamName('');
      toast(`Team "${data.team.name}" created!`, 'success');
      selectTeam(data.team);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoadingCreate(false); }
  };

  // ── Join team ───────────────────────────────────────────────────────────
  const joinTeam = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return toast('Enter an invite code', 'error');
    setLoadingJoin(true);
    try {
      const data = await teamApi.join({ inviteCode: inviteCode.trim(), token });
      dispatch({ type: A.ADD_TEAM, payload: data.team });
      setInviteCode('');
      toast(`Joined "${data.team.name}"!`, 'success');
      selectTeam(data.team);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoadingJoin(false); }
  };

  // ── Send chat ──────────────────────────────────────────────────────────
  const sendChat = (e) => {
    e.preventDefault();
    if (!chatMsg.trim() || !socketRef.current) return;
    const teamId = activeTeam?._id || activeTeam?.id;
    socketRef.current.emit('teamMessage', { teamId, token, text: chatMsg.trim() });
    setChatMsg('');
  };

  // ── Upload version ─────────────────────────────────────────────────────
  const uploadVersion = async (e) => {
    e.preventDefault();
    if (!versionName.trim()) return toast('Enter a version name', 'error');
    if (!versionFile) return toast('Select an audio file', 'error');
    const teamId = activeTeam?._id || activeTeam?.id;
    setLoadingUpload(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        socketRef.current?.emit('createVersion', {
          teamId, token,
          name: versionName.trim(),
          track: { audioUrl: reader.result, title: versionName.trim() },
        });
        setVersionName(''); setVersionFile(null); setShowAddVersion(false);
        toast('Version uploaded!', 'success');
        setLoadingUpload(false);
      };
      reader.onerror = () => { toast('Failed to read file', 'error'); setLoadingUpload(false); };
      reader.readAsDataURL(versionFile);
    } catch (e) { toast(e.message, 'error'); setLoadingUpload(false); }
  };

  // ── Generate AI version ────────────────────────────────────────────────
  const generateVersion = async (e) => {
    e.preventDefault();
    if (!genPrompt.trim()) return toast('Describe your sound first', 'error');
    const sourceTeamId = activeTeam?._id || activeTeam?.id;
    const sourceTeamName = activeTeam?.name || 'team';
    if (!sourceTeamId) return toast('Select a team first', 'error');
    if (!socketRef.current) return toast('Team connection not ready. Please wait a moment and retry.', 'error');

    setGenStatus('loading'); setGenError('');
    try {
      let result = await musicApi.generate({
        prompt: genPrompt.trim(),
        emotion: genEmotion,
        instrumental: genInstrumental,
        vocals: !genInstrumental,
        token,
      });
      
      if (!result.track && result.requestId) {
        const polled = await pollStatus({ requestId: result.requestId, token });
        const audioUrl = polled.audioUrls?.[0];
        if (!audioUrl) throw new Error('Generation did not return audio');
        result = {
          track: {
            title: polled.title || 'Generated Track',
            audioUrl,
            prompt: genPrompt.trim(),
            emotion: genEmotion,
            lyrics: polled.lyrics || ''
          }
        };
      }

      const finalTitle = versionName.trim() || result.track.title;
      socketRef.current?.emit('createVersion', {
        teamId: sourceTeamId, token,
        name: finalTitle,
        track: { ...result.track, title: finalTitle }
      });
      
      setGenPrompt(''); setVersionName(''); setShowAddVersion(false);
      toast(`Generated version added to ${sourceTeamName}!`, 'success');
      setGenStatus('idle');
    } catch (err) {
      setGenError(err.message);
      setGenStatus('error');
      toast(err.message, 'error');
    }
  };

  // ── Vote version ───────────────────────────────────────────────────────
  const voteVersion = (versionId) => {
    const teamId = activeTeam?._id || activeTeam?.id;
    if (!socketRef.current) return;
    socketRef.current.emit('voteVersion', { teamId, token, versionId });
  };

  // ── Publish top voted ──────────────────────────────────────────────────
  const publishTop = async () => {
    const teamId = activeTeam?._id || activeTeam?.id;
    const versions = activeTeam?.versions || [];
    if (!versions.length) return toast('No versions to publish', 'error');
    const top = [...versions].sort((a, b) => ((b.votes || b.voterIds || []).length) - ((a.votes || a.voterIds || []).length))[0];
    const targetVersionId = top._id || top.id;
    if (!targetVersionId) return toast('Selected version is invalid', 'error');

    setLoadingPublish(true);
    try {
      await teamApi.publish({ teamId, versionId: targetVersionId, token });
      toast('Published to Dashboard!', 'success');
      dispatch({ type: A.SET_FEED_STATUS, payload: 'idle' });
      const data = await teamApi.get({ teamId, token });
      dispatch({ type: A.UPDATE_ACTIVE_TEAM, payload: normalizeTeamPayload(data.team) });
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoadingPublish(false); }
  };

  const publishVersionById = async (versionId) => {
    const teamId = activeTeam?._id || activeTeam?.id;
    if (!teamId || !versionId) return;
    setLoadingPublish(true);
    try {
      await teamApi.publish({ teamId, versionId, token });
      toast('Published to Dashboard!', 'success');
      dispatch({ type: A.SET_FEED_STATUS, payload: 'idle' });
      const data = await teamApi.get({ teamId, token });
      dispatch({ type: A.UPDATE_ACTIVE_TEAM, payload: normalizeTeamPayload(data.team) });
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoadingPublish(false); }
  };

  // ── Copy invite code ───────────────────────────────────────────────────
  const copyInvite = async () => {
    const code = activeTeam?.inviteCode;
    if (!code) return;
    const ok = await copyToClipboard(code);
    toast(ok ? 'Invite code copied!' : 'Failed to copy', ok ? 'success' : 'error');
  };

  const teamId = activeTeam?._id || activeTeam?.id;
  const versions = activeTeam?.versions || [];
  const messages = activeTeam?.messages || activeTeam?.chat || [];
  const userId = user?._id || user?.id;

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="page-eyebrow">Collaborative</p>
          <h2 className="page-title">Team Playground</h2>
        </div>
        {activeTeam && versions.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={publishTop} disabled={loadingPublish}>
            {loadingPublish ? <span className="spin" /> : '🚀 Publish Top Voted'}
          </button>
        )}
      </div>

      <div className="team-layout">
        {/* ── Left panel ── */}
        <div className="team-panel">
          {/* Create & Join */}
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Your Teams</h3>

            <form onSubmit={createTeam} className="input-row">
              <input className="input" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="New team name" />
              <button type="submit" className="btn btn-primary btn-sm" disabled={loadingCreate}>
                {loadingCreate ? <span className="spin" /> : 'Create'}
              </button>
            </form>
            <form onSubmit={joinTeam} className="input-row">
              <input className="input" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Invite code" />
              <button type="submit" className="btn btn-ghost btn-sm" disabled={loadingJoin}>
                {loadingJoin ? <span className="spin" /> : 'Join'}
              </button>
            </form>

            {/* Teams list */}
            {teamsStatus === 'loading' && <div className="mini-loading" style={{ padding: 16, textAlign: 'center' }}><span className="spin" /></div>}
            {teamsStatus === 'success' && teams.length === 0 && (
              <p className="empty-state-sm">No teams yet. Create or join one above.</p>
            )}
            {teams.length > 0 && (
              <ul className="teams-list">
                {teams.map(t => (
                  <li
                    key={t._id || t.id}
                    className={`team-item${(activeTeam?._id || activeTeam?.id) === (t._id || t.id) ? ' active' : ''}`}
                    onClick={() => selectTeam(t)}
                  >
                    <div>
                      <div className="team-item-name">{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(t.members || t.memberIds || []).length || 1} member{(((t.members || t.memberIds || []).length || 1) !== 1) ? 's' : ''}</div>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active team info */}
          {activeTeam && (
            <div className="card card-pad" style={{ borderColor: 'var(--border)' }}>
              <p className="page-eyebrow" style={{ marginBottom: 6 }}>Active Team</p>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{activeTeam.name}</h3>
              {activeTeam.inviteCode && (
                <div className="invite-row">
                  <span className="muted text-xs">Invite:</span>
                  <code className="invite-code">{activeTeam.inviteCode}</code>
                  <button className="icon-btn" onClick={copyInvite} title="Copy">📋</button>
                </div>
              )}
              <p className="muted text-xs" style={{ marginTop: 8 }}>
                {(activeTeam.members || activeTeam.memberIds || []).length || 1} member{(((activeTeam.members || activeTeam.memberIds || []).length || 1) !== 1) ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* ── Right workspace ── */}
        <div className="team-workspace">
          {!activeTeam ? (
            <div className="empty-state card card-pad">
              <div className="empty-icon">👥</div>
              <p style={{ fontWeight: 600 }}>No team selected</p>
              <p className="muted">Create or join a team to start collaborating.</p>
            </div>
          ) : (
            <>
              {/* Versions */}
              <div className="card card-pad">
                <div className="section-head">
                  <h3>Versions</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {versions.length > 0 && (
                      <button className="btn btn-primary btn-xs" onClick={publishTop} disabled={loadingPublish}>
                        {loadingPublish ? <span className="spin" /> : 'Publish Top'}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-xs" onClick={() => setShowAddVersion(v => !v)}>
                      {showAddVersion ? 'Cancel' : '+ Add Version'}
                    </button>
                  </div>
                </div>

                {showAddVersion && (
                  <div style={{ marginBottom: 16, padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border-s)' }}>
                    <div className="tab-buttons" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button className={`btn btn-sm ${addVersionMode === 'upload' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAddVersionMode('upload')}>Upload File</button>
                      <button className={`btn btn-sm ${addVersionMode === 'generate' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAddVersionMode('generate')}>✨ Generate with AI</button>
                    </div>

                    {addVersionMode === 'upload' ? (
                      <form onSubmit={uploadVersion} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input className="input" value={versionName} onChange={e => setVersionName(e.target.value)} placeholder="Version name (e.g. V1 Mix)" />
                        <input type="file" accept="audio/*" className="input" onChange={e => setVersionFile(e.target.files[0])} />
                        <div className="action-row">
                          <button type="submit" className="btn btn-primary btn-sm" disabled={loadingUpload}>
                            {loadingUpload ? <span className="spin" /> : 'Upload Version'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={generateVersion} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input className="input" value={versionName} onChange={e => setVersionName(e.target.value)} placeholder="Version name (Optional)" />
                        <div className="field-group" style={{ marginBottom: 0 }}>
                          <textarea className="input" rows={3} value={genPrompt} onChange={e => setGenPrompt(e.target.value)} placeholder="Describe your track... (e.g. cinematic dubstep)" />
                        </div>
                        
                        <div className="emotion-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                          {[{label:'Any',v:''}, {label:'Happy',v:'happy'}, {label:'Sad',v:'sad'}, {label:'Dark',v:'dark'}].map(em => (
                            <button key={em.v} type="button" className={`emotion-chip${genEmotion === em.v ? ' active' : ''}`} style={{ padding: '6px' }} onClick={() => setGenEmotion(em.v)}>{em.label}</button>
                          ))}
                        </div>

                        <div className="toggle-row" style={{ marginTop: 4, marginBottom: 4 }}>
                          <label style={{ margin: 0, fontSize: 13 }}>Instrumental Only (No Vocals)</label>
                          <div className={`toggle-switch${genInstrumental ? ' active' : ''}`} onClick={() => setGenInstrumental(!genInstrumental)} />
                        </div>

                        {genError && <span className="field-err">{genError}</span>}
                        <div className="action-row">
                          <button type="submit" className="btn btn-primary btn-sm" disabled={genStatus === 'loading'}>
                            {genStatus === 'loading' ? <><span className="spin" /> Composing...</> : '✦ Generate & Save'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {versions.length === 0
                  ? <p className="empty-state-sm">No versions yet. Generate a track in Studio and save it here.</p>
                  : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[...versions].sort((a, b) => ((b.votes || b.voterIds || []).length) - ((a.votes || a.voterIds || []).length)).map(v => {
                        const vId = v._id || v.id;
                        const votes = v.votes || v.voterIds || [];
                        const voted = votes.includes?.(userId) || votes.some?.(x => x === userId || x?.userId === userId);
                        return (
                          <div key={vId} className="version-item">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="version-name">{v.name}</div>
                              <div className="version-meta">by {v.creatorId} · {relativeTime(v.createdAt)}</div>
                              {v.track?.audioUrl && (
                                <audio controls src={v.track.audioUrl} preload="none" style={{ width: '100%', marginTop: 8, height: 36 }} />
                              )}
                            </div>
                            <button
                              className={`version-vote-btn${voted ? ' voted' : ''}`}
                              onClick={() => voteVersion(vId)}
                            >
                              <svg viewBox="0 0 24 24" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="13" height="13">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                              </svg>
                              {votes.length || 0}
                            </button>
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => publishVersionById(vId)}
                              disabled={loadingPublish}
                              style={{ marginLeft: 8 }}
                            >
                              Publish
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                }
              </div>

              {/* Chat */}
              <div className="card card-pad">
                <h3 style={{ marginBottom: 12 }}>Team Chat</h3>
                <div className="chat-messages">
                  {messages.length === 0
                    ? <div className="empty-state-sm">No messages yet. Say hello! 👋</div>
                    : messages.map((m, i) => {
                      const mine = m.userId === userId;
                      const authorName = m.userName || (mine ? (user?.name || 'You') : 'Teammate');
                      return (
                        <div key={i} className={`chat-msg${mine ? ' mine' : ''}`}>
                          {!mine && <div className="chat-author">{authorName}</div>}
                          <div className="chat-bubble" dangerouslySetInnerHTML={{ __html: sanitize(m.text) }} />
                        </div>
                      );
                    })
                  }
                  <div ref={chatBottomRef} />
                </div>
                <form onSubmit={sendChat} className="chat-input-row">
                  <input
                    className="input"
                    value={chatMsg}
                    onChange={e => setChatMsg(e.target.value)}
                    placeholder="Write a message…"
                    autoComplete="off"
                    maxLength={500}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!chatMsg.trim()}>Send</button>
                </form>
              </div>

              {/* Published winner */}
              {activeTeam.publishedVersionId && (
                <div className="card card-pad" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>🏆</span>
                    <h3>Published Winner</h3>
                  </div>
                  {(() => {
                    const winner = versions.find(v => (v._id || v.id) === activeTeam.publishedVersionId);
                    return winner
                      ? <div>
                          <p style={{ fontWeight: 600 }}>{winner.name}</p>
                          <p className="muted text-sm">{winner.votes?.length || 0} votes · published to Dashboard</p>
                        </div>
                      : <p className="muted text-sm">Published to the Dashboard successfully.</p>;
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
