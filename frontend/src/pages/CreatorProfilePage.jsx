import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore, A } from '../lib/store.jsx';
import { publicApi } from '../lib/api.js';
import { relativeTime } from '../lib/utils.js';

export default function CreatorProfilePage() {
  const { creatorId } = useParams();
  const { state, dispatch, toast } = useStore();
  const navigate = useNavigate();

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

  const tracks = state.feedTracks.filter((t) => String(t.createdBy || '') === String(creatorId || ''));
  const displayName = tracks[0]?.publisherName || 'Creator';

  const playTrack = (t, enqueueOnly = false) => {
    const audioUrl = t.track?.audioUrl || t.audioUrl;
    if (!audioUrl) return;
    const item = {
      id: t._id || t.id,
      title: t.track?.title || t.title || 'Untitled Track',
      audioUrl,
      artist: t.publisherName || 'Creator',
    };
    dispatch({ type: A.ENQUEUE_TRACK, payload: item });
    if (!enqueueOnly) dispatch({ type: A.SET_IS_PLAYING, payload: true });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="page-eyebrow">Public Creator</p>
          <h2 className="page-title">{displayName} Profile</h2>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>Back to Feed</button>
      </div>

      <div className="card card-pad">
        <div className="section-head">
          <h3>Created Songs</h3>
          <span className="muted text-xs">{tracks.length} track{tracks.length === 1 ? '' : 's'}</span>
        </div>

        {state.feedStatus === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2].map((i) => <div key={i} className="skel-card" style={{ height: 72, borderRadius: 12 }} />)}
          </div>
        )}

        {state.feedStatus !== 'loading' && tracks.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <div className="empty-icon">🎵</div>
            <p style={{ fontWeight: 600 }}>No published tracks found</p>
            <p className="muted text-sm">This creator has not published any track yet.</p>
          </div>
        )}

        {tracks.length > 0 && (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tracks.map((t) => {
              const audioUrl = t.track?.audioUrl || t.audioUrl;
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
                    <div className="muted text-xs">{t.likeCount || 0} likes · {relativeTime(t.createdAt || t.publishedAt)}</div>
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
