import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, A } from '../lib/store.jsx';
import { publicApi, teamApi } from '../lib/api.js';
import { initials, relativeTime } from '../lib/utils.js';

export default function ProfilePage() {
  const { state, dispatch, toast } = useStore();
  const { user, token, feedTracks, teams } = state;
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('wubble_token');
    dispatch({ type: A.LOGOUT });
    toast('Logged out successfully', 'success');
    navigate('/studio', { replace: true });
  };

  // My published tracks (from feed)
  const myTracks = feedTracks.filter(t => t.createdBy === (user?._id || user?.id));
  const playableTracks = myTracks
    .map((t) => {
      const audioUrl = t.track?.audioUrl || t.audioUrl;
      if (!audioUrl) return null;
      return {
        id: t._id || t.id,
        title: t.track?.title || t.title || 'Untitled Track',
        artist: user?.name || 'You',
        audioUrl,
        likes: t.likeCount || 0,
        when: relativeTime(t.createdAt || t.publishedAt),
      };
    })
    .filter(Boolean);

  // Load feed if not yet loaded
  useEffect(() => {
    if (state.feedStatus === 'idle') {
      dispatch({ type: A.SET_FEED_STATUS, payload: 'loading' });
      publicApi.list()
        .then(d => dispatch({ type: A.SET_FEED_TRACKS, payload: d.tracks || [] }))
        .catch((err) => {
          dispatch({ type: A.SET_FEED_STATUS, payload: 'error' });
          toast(err.message, 'error');
        });
    }
    if (state.teamsStatus === 'idle') {
      dispatch({ type: A.SET_TEAMS_STATUS, payload: 'loading' });
      teamApi.mine(token)
        .then(d => dispatch({ type: A.SET_TEAMS, payload: d.teams || [] }))
        .catch((err) => {
          dispatch({ type: A.SET_TEAMS_STATUS, payload: 'error' });
          toast(err.message, 'error');
        });
    }
  }, [dispatch, state.feedStatus, state.teamsStatus, token, toast]);

  const playTrack = (track, enqueueOnly = false) => {
    dispatch({ type: A.ENQUEUE_TRACK, payload: track });
    if (!enqueueOnly) {
      dispatch({ type: A.SET_IS_PLAYING, payload: true });
    }
  };

  if (!user) {
    return (
      <div className="empty-state" style={{ minHeight: 220 }}>
        <span className="spin" />
        <p className="muted" style={{ marginTop: 8 }}>Loading profile…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="page-eyebrow">My Account</p>
          <h2 className="page-title">Profile</h2>
        </div>
      </div>

      {/* Hero */}
      <div className="profile-hero card" style={{ marginBottom: 16 }}>
        <div className="avatar-xl">{initials(user.name)}</div>
        <div className="profile-meta" style={{ flex: 1 }}>
          <h2>{user.name}</h2>
          <p className="muted text-sm" style={{ marginTop: 4 }}>{user.email}</p>
        </div>
        <div className="profile-quick">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/studio')}>Open Studio</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/team')}>My Teams</button>
          <button className="btn btn-danger btn-sm" onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-label">Published Tracks</span>
          <strong className="stat-val">{myTracks.length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Teams</span>
          <strong className="stat-val">{teams.length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Likes</span>
          <strong className="stat-val">
            {myTracks.reduce((acc, t) => acc + (t.likeCount || 0), 0)}
          </strong>
        </div>
      </div>

      {/* My tracks */}
      <div className="card card-pad">
        <div className="section-head">
          <h3>My Published Tracks</h3>
          <button className="btn btn-ghost btn-xs" onClick={() => navigate('/studio')}>+ Create New</button>
        </div>

        {state.feedStatus === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2].map(i => <div key={i} className="skel-card" style={{ height: 70, borderRadius: 12 }} />)}
          </div>
        )}

        {state.feedStatus !== 'loading' && myTracks.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="empty-icon">🎵</div>
            <p style={{ fontWeight: 600 }}>No tracks published yet</p>
            <p className="muted text-sm">Generate a track in Studio and publish it to the Dashboard.</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/studio')} style={{ marginTop: 8 }}>
              Go to Studio
            </button>
          </div>
        )}

        {myTracks.length > 0 && (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myTracks.map(t => (
              <li key={t._id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border-s)',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), var(--pink))',
                  display: 'grid', placeItems: 'center', fontSize: 16,
                }}>🎵</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.track?.title || t.title || 'Untitled'}</div>
                  <div className="muted text-xs">
                    {t.likeCount || 0} likes · {relativeTime(t.createdAt || t.publishedAt)}
                  </div>
                </div>
                {t.track?.audioUrl && (
                  <audio controls src={t.track.audioUrl} preload="none" style={{ height: 32, width: 200 }} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bottom playable list */}
      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="section-head">
          <h3>My Song List</h3>
          <span className="muted text-xs">Play directly from Profile</span>
        </div>

        {playableTracks.length === 0 ? (
          <p className="muted text-sm">No playable songs yet. Publish tracks and they will appear here.</p>
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {playableTracks.map((song) => (
              <li
                key={song.id}
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
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{song.title}</div>
                  <div className="muted text-xs">{song.likes} likes · {song.when}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-xs" onClick={() => playTrack(song, true)}>Queue</button>
                  <button className="btn btn-primary btn-xs" onClick={() => playTrack(song, false)}>Play</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
