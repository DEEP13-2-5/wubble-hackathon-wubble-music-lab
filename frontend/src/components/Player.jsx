import { useEffect, useRef, useState } from 'react';
import { useStore, A } from '../lib/store.jsx';
import { fmtTime, clamp, toPlayableAudioUrl } from '../lib/utils.js';

export default function Player() {
  const { state, dispatch, toast } = useStore();
  const { playlist, currentIndex, isPlaying, volume, isShuffle } = state;
  const audioRef = useRef(null);
  const seekRef = useRef(null);
  const [showLyrics, setShowLyrics] = useState(false);

  const current = playlist[currentIndex] || null;

  // ── sync src ───────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current) { audio.pause(); audio.src = ''; return; }
    const playableUrl = toPlayableAudioUrl(current.audioUrl);
    audio.preload = 'metadata';
    if (audio.src !== playableUrl) {
      audio.src = playableUrl;
      audio.load();
    }
    if (isPlaying) audio.play().catch((error) => {
      toast(error?.message || 'Audio playback failed', 'error');
      dispatch({ type: A.SET_IS_PLAYING, payload: false });
    });
    else audio.pause();
  }, [current, currentIndex, isPlaying, dispatch, toast]);

  // ── play/pause changes ─────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) audio.play().catch((error) => {
      toast(error?.message || 'Audio playback failed', 'error');
      dispatch({ type: A.SET_IS_PLAYING, payload: false });
    });
    else audio.pause();
  }, [isPlaying, current, dispatch, toast]);

  // ── volume ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── audio events ────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (!seekRef.current || !audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      seekRef.current.value = pct;
      seekRef.current.style.setProperty('--pct', `${pct}%`);
      document.getElementById('player-current').textContent = fmtTime(audio.currentTime);
    };
    const onLoadedMeta = () => {
      document.getElementById('player-duration').textContent = fmtTime(audio.duration);
    };
    const onError = () => {
      const code = audio.error?.code;
      const message = code === 4
        ? 'Audio file could not be loaded. The generated audio URL is not reachable.'
        : code === 2
          ? 'Network error while loading audio.'
          : code === 3
            ? 'Audio decoding failed.'
            : 'Audio playback failed.';
      toast(message, 'error');
      dispatch({ type: A.SET_IS_PLAYING, payload: false });
      document.getElementById('player-duration').textContent = '0:00';
      document.getElementById('player-current').textContent = '0:00';
    };
    const onEnded = () => handleNext();
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMeta);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [playlist, currentIndex, isShuffle]);

  // ── controls ───────────────────────────────────────────────────────────
  const togglePlay = () => dispatch({ type: A.SET_IS_PLAYING, payload: !isPlaying });

  const handlePrev = () => {
    if (!playlist.length) return;
    const idx = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
    dispatch({ type: A.SET_CURRENT_INDEX, payload: idx });
    dispatch({ type: A.SET_IS_PLAYING, payload: true });
  };

  const handleNext = () => {
    if (!playlist.length) return;
    let idx;
    if (isShuffle) {
      do { idx = Math.floor(Math.random() * playlist.length); } while (idx === currentIndex && playlist.length > 1);
    } else {
      idx = (currentIndex + 1) % playlist.length;
    }
    dispatch({ type: A.SET_CURRENT_INDEX, payload: idx });
    dispatch({ type: A.SET_IS_PLAYING, payload: true });
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const pct = parseFloat(e.target.value) / 100;
    audio.currentTime = pct * audio.duration;
  };

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    dispatch({ type: A.SET_VOLUME, payload: v });
    e.target.style.setProperty('--pct', `${v * 100}%`);
  };

  return (
    <footer className="player-dock">
      <audio ref={audioRef} />

      {/* Lyrics Drawer */}
      <div className={`player-lyrics-drawer ${showLyrics ? 'visible' : ''}`}>
        <div className="lyrics-drawer-header">
          <h3>Lyrics</h3>
          <button className="icon-btn" onClick={() => setShowLyrics(false)}>
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
               <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
             </svg>
          </button>
        </div>
        <div className="lyrics-scroll">
          {current?.lyrics ? (
            current.lyrics
          ) : (
            <div className="no-lyrics-msg">No lyrics available for this track.</div>
          )}
        </div>
      </div>

      {/* Track info */}
      <div className="player-track-info">
        <div className="player-thumb">{current ? '♪' : '○'}</div>
        <div style={{ minWidth: 0 }}>
          <div className="now-playing-title">{current?.title || 'Nothing playing'}</div>
          {current?.artist && <div className="now-playing-artist muted text-xs">{current.artist}</div>}
        </div>
      </div>

      {/* Center controls */}
      <div className="player-center">
        <div className="player-ctrl">
          <button
            className={`player-btn${isShuffle ? ' active' : ''}`}
            onClick={() => dispatch({ type: A.TOGGLE_SHUFFLE })}
            title="Shuffle"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
          </button>
          <button className="player-btn" onClick={handlePrev} title="Previous">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <polygon points="19,20 9,12 19,4"/><rect x="5" y="4" width="2" height="16"/>
            </svg>
          </button>
          <button className="player-btn player-btn-play" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying
              ? <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5,3 19,12 5,21"/></svg>
            }
          </button>
          <button className="player-btn" onClick={handleNext} title="Next">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <polygon points="5,4 15,12 5,20"/><rect x="17" y="4" width="2" height="16"/>
            </svg>
          </button>
        </div>
        <div className="seek-row">
          <span className="time-label" id="player-current">0:00</span>
          <input
            ref={seekRef}
            type="range" min="0" max="100" step="0.1" defaultValue="0"
            className="range-input seek-bar"
            style={{ '--pct': '0%' }}
            onChange={handleSeek}
          />
          <span className="time-label" id="player-duration">0:00</span>
        </div>
      </div>

      {/* Right: volume */}
      <div className="player-right">
        <div className="vol-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" style={{ color: 'var(--muted)', flexShrink: 0 }}>
            <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
            <path d="M15.54,8.46a5,5,0,0,1,0,7.07"/>
          </svg>
          <input
            type="range" min="0" max="1" step="0.01" defaultValue={volume}
            className="range-input vol-slider"
            style={{ '--pct': `${volume * 100}%` }}
            onChange={handleVolume}
          />
        </div>
        <button 
          className={`lyrics-toggle ${showLyrics ? 'active' : ''}`} 
          onClick={() => setShowLyrics(!showLyrics)}
          title="Toggle Lyrics"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="16" height="16">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      </div>
    </footer>
  );
}
