import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useStore, A } from '../lib/store.jsx';
import { publicApi } from '../lib/api.js';
import { relativeTime } from '../lib/utils.js';

function shortId(id = '') {
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

function displayCreatorName(track, fallbackMap) {
  const explicit = (track.creatorName || '').trim();
  if (explicit) return explicit;
  const id = String(track.createdBy || track.creatorId || '');
  if (!id) return 'Unknown Creator';
  return fallbackMap.get(id) || `Creator ${shortId(id)}`;
}

export default function TeamProfilePage() {
  const { teamName: teamKey } = useParams();
  const location = useLocation();
  const decodedTeamKey = decodeURIComponent(teamKey || '');
  const { state, dispatch, toast } = useStore();
  const navigate = useNavigate();

  const teamIdFromState = location.state?.teamId || '';
  const teamNameFromState = location.state?.teamName || '';
  const looksLikeMongoId = /^[a-f0-9]{24}$/i.test(decodedTeamKey);
  const resolvedTeamId = looksLikeMongoId ? decodedTeamKey : (teamIdFromState || '');
  const resolvedTeamName = (teamNameFromState || decodedTeamKey || '').trim();

  useEffect(() => {
    if (state.feedStatus !== 'idle') return;
    dispatch({ type: A.SET_FEED_STATUS, payload: 'loading' });
    publicApi.list()
      .then((d) => dispatch({ type: A.SET_FEED_TRACKS, payload: d.tracks || [] }))
      .catch((err) => {
        dispatch({ type: A.SET_FEED_ERROR, payload: err.message });
        toast(err.message, 'error');
      });
  }, [state.feedStatus, dispatch, toast]);

  const teamTracks = useMemo(() => {
    const targetName = resolvedTeamName.toLowerCase();
    const targetId = String(resolvedTeamId || '').trim();

    return state.feedTracks.filter((t) => {
      const isTeam = (t.publisherType === 'team') || (t.sourceKind === 'team-version');

      if (!isTeam) return false;

      const trackTeamId = String(t.sourceTeamId || '').trim();
      if (targetId && trackTeamId) {
        return trackTeamId === targetId;
      }

      const label = String(t.publisherName || t.sourceLabel || '').trim().toLowerCase();
      return targetName ? label === targetName : false;
    });
  }, [state.feedTracks, resolvedTeamId, resolvedTeamName]);

  const creatorStats = useMemo(() => {
    const map = new Map();
    teamTracks.forEach((t) => {
      const id = String(t.createdBy || t.creatorId || '');
      if (!id) return;
      map.set(id, (map.get(id) || 0) + 1);
    });
    const stats = [...map.entries()].map(([id, count]) => ({ id, count }));
    stats.sort((a, b) => b.count - a.count);
    return stats;
  }, [teamTracks]);

  const topCreator = creatorStats[0] || null;

  const creatorNameById = useMemo(() => {
    const lookup = new Map();
    state.feedTracks.forEach((t) => {
      const id = String(t.createdBy || t.creatorId || '');
      if (!id) return;

      if (t.creatorName) {
        lookup.set(id, t.creatorName);
      }

      if (t.publisherType === 'solo' && t.publisherName) {
        lookup.set(id, t.publisherName);
      }
    });
    return lookup;
  }, [state.feedTracks]);

  const allCreators = useMemo(() => {
    return creatorStats.map((item) => ({
      id: item.id,
      name: creatorNameById.get(item.id) || `Creator ${shortId(item.id)}`,
      count: item.count,
    }));
  }, [creatorStats, creatorNameById]);

  const totalLikes = teamTracks.reduce((acc, t) => acc + (t.likeCount || 0), 0);

  const playTrack = (t, enqueueOnly = false) => {
    const audioUrl = t.track?.audioUrl || t.audioUrl;
    if (!audioUrl) return;
    const item = {
      id: t._id || t.id,
      title: t.track?.title || t.title || 'Untitled Track',
      audioUrl,
      artist: resolvedTeamName || 'Team',
    };
    dispatch({ type: A.ENQUEUE_TRACK, payload: item });
    if (!enqueueOnly) dispatch({ type: A.SET_IS_PLAYING, payload: true });
  };

  const gotoCreator = (creatorId) => {
    if (!creatorId) return;
    const selfId = state.user?._id || state.user?.id;
    if (selfId && String(selfId) === String(creatorId)) {
      navigate('/profile');
      return;
    }
    navigate(`/creator/${creatorId}`);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="page-eyebrow">Team Publisher</p>
          <h2 className="page-title">{resolvedTeamName || 'Team'} Profile</h2>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>Back to Feed</button>
      </div>

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <span className="stat-label">Team Tracks</span>
          <strong className="stat-val">{teamTracks.length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Likes</span>
          <strong className="stat-val">{totalLikes}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Contributors</span>
          <strong className="stat-val">{creatorStats.length}</strong>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="section-head">
          <h3>All Creators</h3>
        </div>
        {!topCreator ? (
          <p className="muted text-sm">No creator data available yet.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allCreators.map((creator, index) => (
              <button
                key={creator.id}
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => gotoCreator(creator.id)}
                title="Open creator profile"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {index === 0 ? <span className="badge badge-team" style={{ marginRight: 2 }}>👑</span> : null}
                <span>{creator.name}</span>
                <span className="muted text-xs">({creator.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="section-head">
          <h3>Team Published Songs</h3>
          <span className="muted text-xs">{teamTracks.length} track{teamTracks.length === 1 ? '' : 's'}</span>
        </div>

        {state.feedStatus === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2].map((i) => <div key={i} className="skel-card" style={{ height: 72, borderRadius: 12 }} />)}
          </div>
        )}

        {state.feedStatus !== 'loading' && teamTracks.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <div className="empty-icon">👥</div>
            <p style={{ fontWeight: 600 }}>No team tracks found</p>
            <p className="muted text-sm">No published tracks found for this team yet.</p>
          </div>
        )}

        {teamTracks.length > 0 && (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {teamTracks.map((t) => {
              const audioUrl = t.track?.audioUrl || t.audioUrl;
              const cId = String(t.createdBy || t.creatorId || '');
              return (
                <li
                  key={t._id || t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 12,
                    border: '1px solid var(--border-s)',
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--accent), var(--pink))',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 16,
                  }}>🎶</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.track?.title || t.title || 'Untitled Track'}</div>
                    <div className="muted text-xs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{t.likeCount || 0} likes · {relativeTime(t.createdAt || t.publishedAt)}</span>
                      {cId && (
                        <button
                          type="button"
                          onClick={() => gotoCreator(cId)}
                          className="btn btn-ghost btn-xs"
                          style={{ padding: '2px 8px' }}
                          title="Open creator profile"
                        >
                          {displayCreatorName(t, creatorNameById)}
                        </button>
                      )}
                    </div>
                  </div>
                  {audioUrl && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => playTrack(t, true)}>Queue</button>
                      <button className="btn btn-primary btn-xs" onClick={() => playTrack(t, false)}>Play</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
