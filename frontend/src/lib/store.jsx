import { createContext, useContext, useReducer, useCallback } from 'react';

// ── Initial State ──────────────────────────────────────────────────────────
const init = {
  // auth
  token: localStorage.getItem('wubble_token') || '',
  user: null,
  authStatus: 'restoring', // 'restoring' | 'authenticated' | 'unauthenticated'

  // studio
  studioStatus: 'idle',  // idle | loading | success | error
  studioTrack: null,
  studioError: null,
  studioRequestId: null,  // for async polling

  // dashboard
  feedStatus: 'idle',
  feedTracks: [],
  feedError: null,
  feedPage: 1,

  // teams
  teamsStatus: 'idle',
  teams: [],
  activeTeam: null,  // full team object (with versions, chat, members)

  // player
  playlist: [],     // [{ id, title, audioUrl, artist }]
  currentIndex: -1,
  isPlaying: false,
  volume: 0.8,
  isShuffle: false,

  // ui
  toasts: [],
};

// ── Actions ────────────────────────────────────────────────────────────────
export const A = {
  SET_AUTH_STATUS: 'SET_AUTH_STATUS',
  SET_USER: 'SET_USER',
  SET_TOKEN: 'SET_TOKEN',
  LOGOUT: 'LOGOUT',

  SET_STUDIO_STATUS: 'SET_STUDIO_STATUS',
  SET_STUDIO_TRACK: 'SET_STUDIO_TRACK',
  SET_STUDIO_ERROR: 'SET_STUDIO_ERROR',
  SET_STUDIO_REQUEST_ID: 'SET_STUDIO_REQUEST_ID',
  RESET_STUDIO: 'RESET_STUDIO',

  SET_FEED_STATUS: 'SET_FEED_STATUS',
  SET_FEED_TRACKS: 'SET_FEED_TRACKS',
  PREPEND_FEED_TRACK: 'PREPEND_FEED_TRACK',
  UPDATE_FEED_TRACK: 'UPDATE_FEED_TRACK',
  REMOVE_FEED_TRACK: 'REMOVE_FEED_TRACK',
  SET_FEED_ERROR: 'SET_FEED_ERROR',

  SET_TEAMS_STATUS: 'SET_TEAMS_STATUS',
  SET_TEAMS: 'SET_TEAMS',
  ADD_TEAM: 'ADD_TEAM',
  SET_ACTIVE_TEAM: 'SET_ACTIVE_TEAM',
  UPDATE_ACTIVE_TEAM: 'UPDATE_ACTIVE_TEAM',

  SET_PLAYLIST: 'SET_PLAYLIST',
  SET_CURRENT_INDEX: 'SET_CURRENT_INDEX',
  SET_IS_PLAYING: 'SET_IS_PLAYING',
  SET_VOLUME: 'SET_VOLUME',
  TOGGLE_SHUFFLE: 'TOGGLE_SHUFFLE',
  ENQUEUE_TRACK: 'ENQUEUE_TRACK',

  ADD_TOAST: 'ADD_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
};

// ── Reducer ────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case A.SET_AUTH_STATUS:
      return { ...state, authStatus: action.payload };
    case A.SET_USER:
      return { ...state, user: action.payload, authStatus: 'authenticated' };
    case A.SET_TOKEN:
      return { ...state, token: action.payload };
    case A.LOGOUT:
      return {
        ...init,
        token: '',
        authStatus: 'unauthenticated',
        toasts: state.toasts,
      };

    case A.SET_STUDIO_STATUS:
      return { ...state, studioStatus: action.payload };
    case A.SET_STUDIO_TRACK:
      return { ...state, studioTrack: action.payload, studioStatus: 'success', studioError: null };
    case A.SET_STUDIO_ERROR:
      return { ...state, studioError: action.payload, studioStatus: 'error' };
    case A.SET_STUDIO_REQUEST_ID:
      return { ...state, studioRequestId: action.payload };
    case A.RESET_STUDIO:
      return { ...state, studioStatus: 'idle', studioTrack: null, studioError: null, studioRequestId: null };

    case A.SET_FEED_STATUS:
      return { ...state, feedStatus: action.payload };
    case A.SET_FEED_TRACKS:
      return { ...state, feedTracks: action.payload, feedStatus: 'success', feedError: null };
    case A.PREPEND_FEED_TRACK:
      return { ...state, feedTracks: [action.payload, ...state.feedTracks] };
    case A.UPDATE_FEED_TRACK:
      return {
        ...state,
        feedTracks: state.feedTracks.map(t =>
          (t.id || t._id) === (action.payload.id || action.payload._id) ? action.payload : t
        ),
      };
    case A.REMOVE_FEED_TRACK:
      return {
        ...state,
        feedTracks: state.feedTracks.filter(t => (t.id || t._id) !== action.payload),
      };
    case A.SET_FEED_ERROR:
      return { ...state, feedError: action.payload, feedStatus: 'error' };

    case A.SET_TEAMS_STATUS:
      return { ...state, teamsStatus: action.payload };
    case A.SET_TEAMS:
      return { ...state, teams: action.payload, teamsStatus: 'success' };
    case A.ADD_TEAM:
      return { ...state, teams: [action.payload, ...state.teams] };
    case A.SET_ACTIVE_TEAM:
      return { ...state, activeTeam: action.payload };
    case A.UPDATE_ACTIVE_TEAM:
      return { ...state, activeTeam: action.payload };

    case A.SET_PLAYLIST:
      return { ...state, playlist: action.payload, currentIndex: 0 };
    case A.SET_CURRENT_INDEX:
      return { ...state, currentIndex: action.payload };
    case A.SET_IS_PLAYING:
      return { ...state, isPlaying: action.payload };
    case A.SET_VOLUME:
      return { ...state, volume: action.payload };
    case A.TOGGLE_SHUFFLE:
      return { ...state, isShuffle: !state.isShuffle };
    case A.ENQUEUE_TRACK: {
      const exists = state.playlist.findIndex(t => t.id === action.payload.id);
      if (exists >= 0) return { ...state, currentIndex: exists };
      return {
        ...state,
        playlist: [...state.playlist, action.payload],
        currentIndex: state.playlist.length,
      };
    }

    case A.ADD_TOAST:
      return { ...state, toasts: [...state.toasts, action.payload] };
    case A.REMOVE_TOAST:
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };

    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────
const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init);

  const toast = useCallback((message, type = 'default') => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: A.ADD_TOAST, payload: { id, message, type } });
    setTimeout(() => dispatch({ type: A.REMOVE_TOAST, payload: id }), 3800);
  }, []);

  return (
    <StoreCtx.Provider value={{ state, dispatch, toast }}>
      {children}
    </StoreCtx.Provider>
  );
}

export const useStore = () => useContext(StoreCtx);
