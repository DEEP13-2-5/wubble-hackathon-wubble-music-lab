import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, A } from '../lib/store.jsx';
import { musicApi, publicApi, pollStatus } from '../lib/api.js';
import { validateAudioFile } from '../lib/utils.js';
import GenerationVisualizer from '../components/GenerationVisualizer.jsx';

const EMOTIONS = [
  { label: 'Any', value: '' },
  { label: '😊 Happy', value: 'happy' },
  { label: '😔 Sad', value: 'sad' },
  { label: '⚡ Energetic', value: 'energetic' },
  { label: '🌿 Calm', value: 'calm' },
  { label: '🌑 Dark', value: 'dark' },
  { label: '💕 Romantic', value: 'romantic' },
  { label: '🔥 Epic', value: 'epic' },
];

export default function StudioPage() {
  const { state, dispatch, toast } = useStore();
  const isAuthed = state.authStatus === 'authenticated';
  const [prompt, setPrompt] = useState('');
  const [emotion, setEmotion] = useState('');
  const [voiceFile, setVoiceFile] = useState(null);
  const [voiceErr, setVoiceErr] = useState('');
  const [promptErr, setPromptErr] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const { studioStatus, studioTrack, studioError } = state;

  const openAuth = (tab = 'login') => {
    navigate(`/auth?origin=studio&tab=${tab}`);
  };

  const requireAuth = () => {
    const message = 'Login or sign up is required to generate and publish tracks.';
    setAuthErr(message);
    toast(message, 'error');
    return false;
  };

  // ── Voice file handling ────────────────────────────────────────────────
  const handleVoiceFile = (file) => {
    if (!file) return;
    const err = validateAudioFile(file);
    if (err) { setVoiceErr(err); return; }
    setVoiceErr('');
    setVoiceFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    handleVoiceFile(e.dataTransfer.files[0]);
  };

  // ── Generate ───────────────────────────────────────────────────────────
  const generate = async (e) => {
    e.preventDefault();
    if (!isAuthed) {
      requireAuth();
      return;
    }
    if (!prompt.trim()) { setPromptErr('Describe your sound first'); return; }
    setPromptErr('');
    setAuthErr('');
    dispatch({ type: A.SET_STUDIO_STATUS, payload: 'loading' });

    try {
      let result;

      if (voiceFile) {
        const fd = new FormData();
        fd.append('file', voiceFile);
        fd.append('prompt', prompt.trim());
        if (emotion) fd.append('emotion', emotion);
        if (instrumental) {
          fd.append('instrumental', 'true');
          fd.append('vocals', 'false');
        } else {
          fd.append('instrumental', 'false');
          fd.append('vocals', 'true');
        }
        result = await musicApi.generateWithVoice({ formData: fd, token: state.token });
      } else {
        result = await musicApi.generate({ prompt: prompt.trim(), emotion, instrumental, vocals: !instrumental, token: state.token });
      }

      // If still processing → poll
      if (!result.track && result.requestId) {
        dispatch({ type: A.SET_STUDIO_REQUEST_ID, payload: result.requestId });
        const polled = await pollStatus({
          requestId: result.requestId,
          token: state.token,
          onTick: (d) => console.log('polling…', d.status),
        });
        const audioUrl = polled.audioUrls?.[0];
        if (!audioUrl) throw new Error('Generation did not return audio');

        result = { 
          track: { 
            title: polled.title || 'Generated Track', 
            audioUrl, 
            prompt: prompt.trim(), 
            emotion,
            lyrics: polled.lyrics 
          } 
        };
      }

      dispatch({ type: A.SET_STUDIO_TRACK, payload: result.track });
      toast('Track generated! ✨', 'success');
    } catch (err) {
      dispatch({ type: A.SET_STUDIO_ERROR, payload: err.message });
      toast(err.message, 'error');
    }
  };

  // ── Publish ────────────────────────────────────────────────────────────
  const publish = async () => {
    if (!studioTrack) return;
    if (!isAuthed) {
      requireAuth();
      return;
    }
    try {
      const res = await publicApi.publish({
        track: studioTrack,
        sourceKind: 'solo-generation',
        sourceId: studioTrack.requestId || Date.now().toString(),
        sourceLabel: studioTrack.title,
        publisherName: state.user?.name,
        publisherType: 'solo',
        token: state.token,
      });
      dispatch({ type: A.PREPEND_FEED_TRACK, payload: res.publicTrack });
      toast('Published to Dashboard!', 'success');
      navigate('/dashboard');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────
  const reset = () => {
    dispatch({ type: A.RESET_STUDIO });
    setPromptErr('');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="page-eyebrow">AI Creation</p>
          <h2 className="page-title">Studio</h2>
        </div>
        {isAuthed ? (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/profile')}>My Profile</button>
        ) : (
          <div className="action-row">
            <button className="btn btn-ghost btn-sm" onClick={() => openAuth('login')}>Log in</button>
            <button className="btn btn-primary btn-sm" onClick={() => openAuth('signup')}>Sign up</button>
          </div>
        )}
      </div>

      {!isAuthed && (
        <div className="card studio-auth-banner" style={{ marginBottom: 20 }}>
          <div>
            <p className="page-eyebrow">Account required</p>
            <h3 style={{ fontSize: 18, marginTop: 2 }}>Login or sign up to generate music</h3>
            <p className="muted text-sm" style={{ marginTop: 6 }}>
              You can explore Studio first, but track generation and publishing need an account.
            </p>
          </div>
          <div className="action-row">
            <button className="btn btn-ghost btn-sm" onClick={() => openAuth('login')}>Log in</button>
            <button className="btn btn-primary btn-sm" onClick={() => openAuth('signup')}>Sign up</button>
          </div>
        </div>
      )}

      <div className="studio-layout">
        {/* ── Left: Controls ── */}
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>Generate a Track</h3>

          <form onSubmit={generate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Prompt */}
            <div className="field-group">
              <label>Describe your sound</label>
              <textarea
                className="input"
                rows={5}
                value={prompt}
                onChange={e => { setPrompt(e.target.value); setPromptErr(''); }}
                placeholder="e.g. Cinematic orchestral build with soft piano and rising strings… late-night lo-fi beats… dark techno with 808s…"
              />
              {promptErr && <span className="field-err">{promptErr}</span>}
            </div>

            {/* Emotion */}
            <div className="field-group">
              <label>Emotion / Mood</label>
              <div className="emotion-grid">
                {EMOTIONS.map(em => (
                  <button
                    key={em.value}
                    type="button"
                    className={`emotion-chip${emotion === em.value ? ' active' : ''}`}
                    onClick={() => setEmotion(em.value)}
                  >
                    {em.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrumental Toggle */}
            <div className="field-group">
              <div className="toggle-row">
                <label style={{ margin: 0 }}>Instrumental Only (No Vocals)</label>
                <div 
                  className={`toggle-switch${instrumental ? ' active' : ''}`} 
                  onClick={() => setInstrumental(!instrumental)}
                />
              </div>
            </div>

            {/* Voice Reference */}
            <div className="field-group">
              <label>Voice Reference <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
              {voiceFile ? (
                <div className="voice-preview">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  </svg>
                  <span className="voice-file-name text-sm">{voiceFile.name}</span>
                  <button type="button" className="icon-btn" onClick={() => { setVoiceFile(null); setVoiceErr(''); }}>✕</button>
                </div>
              ) : (
                <div
                  className={`voice-drop${isDragging ? ' drag-over' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                >
                  <input
                    ref={fileInputRef} type="file" accept="audio/*"
                    style={{ display: 'none' }}
                    onChange={e => handleVoiceFile(e.target.files[0])}
                  />
                  <div className="voice-drop-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  </div>
                  <div className="voice-drop-label">Click or drag audio file</div>
                  <div className="muted text-xs">MP3, WAV, M4A · max 25MB</div>
                </div>
              )}
              {voiceErr && <span className="field-err">{voiceErr}</span>}
            </div>

            <div className="action-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={studioStatus === 'loading'}
              >
                {!isAuthed
                  ? 'Login required'
                  : studioStatus === 'loading'
                  ? <><span className="spin" /> Generating…</>
                  : <>✦ Generate</>
                }
              </button>
              {studioStatus !== 'idle' && (
                <button type="button" className="btn btn-ghost" onClick={reset}>Reset</button>
              )}
            </div>
            {!isAuthed && (
              <div className="muted text-xs" style={{ marginTop: -4 }}>
                {authErr || 'Login or sign up to unlock generation.'}
              </div>
            )}
          </form>
        </div>

        {/* ── Right: Visualizer + Result ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card viz-card">
            <GenerationVisualizer status={studioStatus} />
          </div>

          {/* Idle hint */}
          {studioStatus === 'idle' && (
            <div className="card card-sm" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{isAuthed ? '🎹' : '🔒'}</div>
              {isAuthed ? (
                <>
                  <p className="muted">Write a prompt above and press <strong style={{ color: 'var(--text)' }}>Generate</strong></p>
                  <p className="muted text-xs" style={{ marginTop: 6 }}>Add an emotion or voice reference for better results</p>
                </>
              ) : (
                <>
                  <p className="muted">Login or sign up to start generating tracks</p>
                  <p className="muted text-xs" style={{ marginTop: 6 }}>You can still browse Studio and preview the layout first.</p>
                </>
              )}
            </div>
          )}

          {/* Loading */}
          {studioStatus === 'loading' && (
            <div className="card card-sm gen-loading-box">
              <div className="pulse-rings">
                <div /><div /><div />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Composing your track…</p>
              <p className="muted text-sm">This can take up to 60 seconds</p>
            </div>
          )}

          {/* Error */}
          {studioStatus === 'error' && (
            <div className="card card-sm err-box">
              <div className="err-icon-lg">⚠</div>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>{studioError || 'Generation failed'}</p>
              <button className="btn btn-ghost btn-sm" onClick={reset}>Try Again</button>
            </div>
          )}

          {/* Success */}
          {studioStatus === 'success' && studioTrack && (
            <div className="card result-card">
              <div className="result-track-header">
                <div className="result-dot">🎵</div>
                <div>
                  <p className="result-label">Generated Track</p>
                  <p className="result-title">{studioTrack.title || 'Untitled Track'}</p>
                  {studioTrack.emotion && <p className="muted text-xs" style={{ marginTop: 2 }}>{studioTrack.emotion}</p>}
                </div>
              </div>
              {studioTrack.audioUrl && (
                <div style={{ marginBottom: 20 }}>
                  <button 
                    className="btn btn-primary btn-full" 
                    style={{ height: 52, fontSize: 16 }}
                    onClick={() => {
                       dispatch({ 
                         type: A.ENQUEUE_TRACK, 
                         payload: { 
                           id: studioTrack.requestId || Date.now(), 
                           title: studioTrack.title, 
                           audioUrl: studioTrack.audioUrl, 
                           artist: state.user?.name || 'Me',
                           lyrics: studioTrack.lyrics
                         }
                       });
                       dispatch({ type: A.SET_IS_PLAYING, payload: true });
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style={{ marginRight: 8 }}>
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                    Play Now
                  </button>
                </div>
              )}
              <div className="result-actions">
                <button className="btn btn-primary btn-sm" onClick={publish}>
                  Publish to Dashboard
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/team')}>
                  Save to Team
                </button>
                <button className="btn btn-ghost btn-sm" onClick={reset}>
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
