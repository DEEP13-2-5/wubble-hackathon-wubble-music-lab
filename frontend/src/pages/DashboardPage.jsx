import { useEffect } from 'react';
import { useStore, A } from '../lib/store.jsx';
import { publicApi } from '../lib/api.js';
import TrackCard from '../components/TrackCard.jsx';

function SkeletonCard() {
  return (
    <div className="skel-card" style={{ height: 200, borderRadius: 20 }} />
  );
}

export default function DashboardPage() {
  const { state, dispatch, toast } = useStore();
  const { feedStatus, feedTracks, feedError } = state;

  const load = async () => {
    dispatch({ type: A.SET_FEED_STATUS, payload: 'loading' });
    try {
      const data = await publicApi.list();
      dispatch({ type: A.SET_FEED_TRACKS, payload: data.tracks || [] });
    } catch (err) {
      dispatch({ type: A.SET_FEED_ERROR, payload: err.message });
      toast(err.message, 'error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="page-eyebrow">Public Feed</p>
          <h2 className="page-title">ReelTok Music World</h2>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={feedStatus === 'loading'}>
          {feedStatus === 'loading' ? <span className="spin" /> : '↻ Refresh'}
        </button>
      </div>

      {/* Loading skeletons */}
      {feedStatus === 'loading' && feedTracks.length === 0 && (
        <div className="skel-list">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}

      {/* Error */}
      {feedStatus === 'error' && (
        <div className="error-state">
          <span style={{ fontSize: 32 }}>⚠</span>
          <p style={{ fontWeight: 600 }}>Failed to load feed</p>
          <p className="muted text-sm">{feedError}</p>
          <button className="btn btn-ghost btn-sm" onClick={load}>Retry</button>
        </div>
      )}

      {/* Empty */}
      {feedStatus === 'success' && feedTracks.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🎧</div>
          <p style={{ fontWeight: 600 }}>No tracks published yet</p>
          <p className="muted">Be the first to publish from Studio!</p>
        </div>
      )}

      {/* Feed */}
      {feedTracks.length > 0 && (
        <ul className="feed-list">
          {feedTracks.map(track => (
            <TrackCard key={track._id || track.id} track={track} />
          ))}
        </ul>
      )}

      {/* Loading more indicator */}
      {feedStatus === 'loading' && feedTracks.length > 0 && (
        <div className="mini-spinner" style={{ marginTop: 16 }}>
          <span className="spin" />
        </div>
      )}
    </div>
  );
}
