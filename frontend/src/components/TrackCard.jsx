import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, A } from '../lib/store.jsx';
import { publicApi } from '../lib/api.js';
import { relativeTime, copyToClipboard, buildShareUrl, sanitize } from '../lib/utils.js';

export default function TrackCard({ track, showPlayBtn = true }) {
  const { state, dispatch, toast } = useStore();
  const navigate = useNavigate();
  const [localTrack, setLocalTrack] = useState(track);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [voting, setVoting] = useState(false);
  const commentRef = useRef(null);

  useEffect(() => {
    setLocalTrack(track);
  }, [track]);

  const t = localTrack;
  const trackId = t._id || t.id;
  const trackData = t.track || {
    title: t.title,
    audioUrl: t.audioUrl,
    prompt: t.prompt,
    emotion: t.emotion,
    lyrics: t.lyrics || t.track?.lyrics,
  };
  const title = trackData?.title || t.title || 'Untitled Track';
  const lyricsText = trackData?.lyrics || t.lyrics || '';
  const publisherName = t.publisherName || t.sourceLabel || 'Anonymous';
  const publisherType = t.publisherType || (t.sourceKind === 'team-version' ? 'team' : 'solo');
  const creatorId = t.createdBy || t.creatorId || null;
  const sourceTeamId = t.sourceTeamId || '';
  const promptText = trackData?.prompt || t.prompt || '';
  const userId = state.user?._id || state.user?.id || '';
  const isLiked = t.likeUserIds && t.likeUserIds.includes(userId);
  const isDisliked = t.dislikeUserIds && t.dislikeUserIds.includes(userId);
  const likes = t.likeCount ?? t.likes ?? 0;
  const dislikes = t.dislikeCount ?? t.dislikes ?? 0;
  const comments = Array.isArray(t.comments) ? t.comments : [];

  const vote = async (voteType) => {
    if (!state.token) return toast('Log in to vote', 'error');
    if (voting) return;
    setVoting(true);

    // Optimistic update
    const prev = localTrack;
    setLocalTrack(lt => {
      const newLt = { ...lt };
      if (!newLt.likeUserIds) newLt.likeUserIds = [];
      if (!newLt.dislikeUserIds) newLt.dislikeUserIds = [];
      
      const inLikes = newLt.likeUserIds.includes(userId);
      const inDislikes = newLt.dislikeUserIds.includes(userId);
      
      if (voteType === 'like') {
        if (inLikes) { newLt.likeUserIds = newLt.likeUserIds.filter(id => id !== userId); newLt.likeCount = Math.max(0, (newLt.likeCount || 0) - 1); }
        else { 
          newLt.likeUserIds.push(userId); newLt.likeCount = (newLt.likeCount || 0) + 1;
          if (inDislikes) { newLt.dislikeUserIds = newLt.dislikeUserIds.filter(id => id !== userId); newLt.dislikeCount = Math.max(0, (newLt.dislikeCount || 0) - 1); }
        }
      } else {
        if (inDislikes) { newLt.dislikeUserIds = newLt.dislikeUserIds.filter(id => id !== userId); newLt.dislikeCount = Math.max(0, (newLt.dislikeCount || 0) - 1); }
        else {
          newLt.dislikeUserIds.push(userId); newLt.dislikeCount = (newLt.dislikeCount || 0) + 1;
          if (inLikes) { newLt.likeUserIds = newLt.likeUserIds.filter(id => id !== userId); newLt.likeCount = Math.max(0, (newLt.likeCount || 0) - 1); }
        }
      }
      return newLt;
    });

    try {
      const res = await publicApi.vote({ trackId, voteType, token: state.token });
      const updated = res.publicTrack;
      setLocalTrack(updated);
      dispatch({ type: A.UPDATE_FEED_TRACK, payload: updated });
    } catch (e) {
      setLocalTrack(prev);
      toast(e.message, 'error');
    } finally {
      setVoting(false);
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!state.token) return toast('Log in to comment', 'error');
    setCommenting(true);
    try {
      const res = await publicApi.comment({ trackId, text: commentText.trim(), token: state.token });
      setLocalTrack(res.publicTrack);
      dispatch({ type: A.UPDATE_FEED_TRACK, payload: res.publicTrack });
      setCommentText('');
      toast('Comment added', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setCommenting(false);
    }
  };

  const share = async () => {
    const shareUrl = buildShareUrl(trackId);
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      toast('Link copied!', 'success');
      return;
    }

    window.prompt('Copy this track link:', shareUrl);
    toast('Sharing link ready', 'success');
  };

  const deleteTrack = async () => {
    if (!window.confirm('Are you sure you want to delete this track? This action cannot be undone.')) return;
    try {
      await publicApi.delete({ trackId, token: state.token });
      dispatch({ type: A.REMOVE_FEED_TRACK, payload: trackId });
      toast('Track deleted successfully', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const playTrack = () => {
    const audioUrl = t.track?.audioUrl || t.audioUrl;
    if (!audioUrl) return toast('No audio available', 'error');
    const item = { id: trackId, title, audioUrl, artist: publisherName, lyrics: t.lyrics || t.track?.lyrics };
    dispatch({ type: A.ENQUEUE_TRACK, payload: item });
    dispatch({ type: A.SET_IS_PLAYING, payload: true });
  };

  const trackAudio = t.track?.audioUrl || t.audioUrl;

  const openPublisherProfile = () => {
    if (publisherType === 'team') {
      navigate(`/team-profile/${encodeURIComponent(sourceTeamId || publisherName)}`, {
        state: { teamName: publisherName, teamId: sourceTeamId || null }
      });
      return;
    }

    if (publisherType === 'solo' && creatorId) {
      const selfId = state.user?._id || state.user?.id;
      if (selfId && String(selfId) === String(creatorId)) {
        navigate('/profile');
        return;
      }
      navigate(`/creator/${creatorId}`);
    }
  };

  return (
    <li className="track-card">
      {/* Header */}
      <div className="track-header">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div className="track-thumb" onClick={playTrack} title="Play Track">
            {trackAudio ? '▶' : '🎵'}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>
              {title}
            </h3>
            <div className="track-meta">
              {(publisherType === 'team' || (publisherType === 'solo' && creatorId)) ? (
                <button
                  type="button"
                  onClick={openPublisherProfile}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-lt)',
                    fontWeight: 600,
                    padding: 0,
                    cursor: 'pointer'
                  }}
                  title={publisherType === 'team' ? `Open ${publisherName} team profile` : `Open ${publisherName} profile`}
                >
                  {publisherName}
                </button>
              ) : (
                <span>{publisherName}</span>
              )}
              <div className="meta-dot" />
              <span className={`badge${publisherType === 'team' ? ' badge-team' : ''}`}>
                {publisherType === 'team' ? '👥 Team' : '🎤 Solo'}
              </span>
              {(t.track?.emotion || t.emotion) && <><div className="meta-dot" /><span>{t.track?.emotion || t.emotion}</span></>}
              <div className="meta-dot" />
              <span>{relativeTime(t.createdAt || t.publishedAt)}</span>
            </div>
            {promptText && (
              <p className="muted text-xs" style={{ marginTop: 6, lineClamp: 2, overflow: 'hidden' }}>
                {promptText.slice(0, 120)}{promptText.length > 120 ? '…' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="track-actions">
        <button type="button" className={`vote-btn${isLiked ? ' liked' : ''}`} onClick={() => vote('like')} disabled={voting}>
          <svg viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
          {likes}
        </button>
        <button type="button" className={`vote-btn${isDisliked ? ' disliked' : ''}`} onClick={() => vote('dislike')} disabled={voting}>
          <svg viewBox="0 0 24 24" fill={isDisliked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
          </svg>
          {dislikes}
        </button>
        <button
          type="button"
          className="vote-btn"
          onClick={() => { setShowComments(s => !s); setTimeout(() => commentRef.current?.focus(), 100); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {comments.length || 0}
        </button>
        {showPlayBtn && trackAudio && (
          <button type="button" className="vote-btn" onClick={playTrack}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5,3 19,12 5,21"/></svg>
            Queue
          </button>
        )}
        {lyricsText && (
          <button
            type="button"
            className={`vote-btn${showLyrics ? ' active' : ''}`}
            onClick={() => setShowLyrics(s => !s)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="19" y2="13" />
            </svg>
            Lyrics
          </button>
        )}
        <button type="button" className="vote-btn share-btn" onClick={share}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>
        {String(creatorId) === String(userId) && (
          <button type="button" className="vote-btn delete-btn" onClick={deleteTrack} style={{ color: '#ff4d4f' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
            </svg>
            Delete
          </button>
        )}
      </div>

      {/* Lyrics Dropdown */}
      {showLyrics && lyricsText && (
        <div className="lyrics-section" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border-s)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent-lt)', marginBottom: 8 }}>Track Lyrics</h4>
          {lyricsText}
        </div>
      )}

      {/* Comments */}
      {showComments && (
        <div className="comments-section">
          {comments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {comments.map((c, i) => (
                <div key={i} className="comment-item">
                  <div className="comment-author">{c.userName || 'User'}</div>
                  <div className="comment-text" dangerouslySetInnerHTML={{ __html: sanitize(c.text) }} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted text-xs" style={{ marginBottom: 10 }}>No comments yet. Be first!</p>
          )}
          <form onSubmit={submitComment} className="comment-input-row">
            <input
              ref={commentRef}
              className="input"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              maxLength={500}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={commenting || !commentText.trim()}>
              {commenting ? <span className="spin" /> : 'Post'}
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
