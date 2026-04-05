import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useStore, A } from './lib/store.jsx';
import { authApi } from './lib/api.js';

import Sidebar from './components/Sidebar.jsx';
import Player from './components/Player.jsx';
import Toast from './components/Toast.jsx';

import AuthPage from './pages/AuthPage.jsx';
import StudioPage from './pages/StudioPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TeamPage from './pages/TeamPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import CreatorProfilePage from './pages/CreatorProfilePage.jsx';
import TeamProfilePage from './pages/TeamProfilePage.jsx';
function clearSession(dispatch, toast) {
  localStorage.removeItem('wubble_token');
  dispatch({ type: A.LOGOUT });
  toast('Logged out successfully', 'success');
}

// ── Page titles ─────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  '/profile': 'Profile',
  '/studio': 'Studio',
  '/dashboard': 'ReelTok World',
  '/team': 'Team',
};

// ── Protected route wrapper ──────────────────────────────────────────────────
function Protected({ children }) {
  const { state } = useStore();
  if (state.authStatus === 'restoring') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spin" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 16px' }} />
          <p className="muted">Restoring session…</p>
        </div>
      </div>
    );
  }
  if (state.authStatus === 'unauthenticated') {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

// ── App shell (layout with sidebar + player) ─────────────────────────────────
function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { state, dispatch, toast } = useStore();
  const navigate = useNavigate();
  const isAuthed = state.authStatus === 'authenticated';
  const title = location.pathname.startsWith('/creator/')
    ? 'Creator Profile'
    : location.pathname.startsWith('/team-profile/')
      ? 'Team Profile'
    : (PAGE_TITLES[location.pathname] || 'Wubble');

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <div className="shell">
      <div className="app-bg" />
      <div className="app-grid" />

      {/* Desktop sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Overlay for mobile sidebar */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Mobile topbar */}
      <header className="mobile-topbar">
        <button
          className="icon-btn"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 13, borderRadius: 8 }}>W</div>
          <span className="mobile-page-title">{title}</span>
        </div>
        <div className="mobile-topbar-actions">
          {isAuthed ? (
            <>
              <button className="btn btn-ghost btn-xs mobile-action-btn" onClick={() => navigate('/profile')}>Profile</button>
              <button className="btn btn-danger btn-xs mobile-action-btn" onClick={() => clearSession(dispatch, toast)}>Logout</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-xs mobile-action-btn" onClick={() => navigate('/auth?origin=studio&tab=login')}>Log in</button>
              <button className="btn btn-primary btn-xs mobile-action-btn" onClick={() => navigate('/auth?origin=studio&tab=signup')}>Sign up</button>
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

      {/* Persistent player */}
      <Player />
    </div>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { state, dispatch, toast } = useStore();

  // ── Session restore on mount ───────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('wubble_token');
    if (!token) {
      dispatch({ type: A.SET_AUTH_STATUS, payload: 'unauthenticated' });
      return;
    }

    authApi.me(token)
      .then(data => {
        if (!data?.user) {
          throw new Error('Invalid session response');
        }
        dispatch({ type: A.SET_USER, payload: data.user });
        // Also store token in state
        dispatch({ type: 'SET_TOKEN', payload: token });
      })
      .catch(() => {
        localStorage.removeItem('wubble_token');
        dispatch({ type: A.SET_AUTH_STATUS, payload: 'unauthenticated' });
        toast('Session expired. Please log in again.', 'error');
      });
  }, []);

  // ── Network banner ─────────────────────────────────────────────────────
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => { setOffline(true); toast('Network connection lost', 'error'); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <>
      {offline && (
        <div className="network-banner">
          <span>⚠ No internet connection — some features may be unavailable</span>
          <button className="btn btn-ghost btn-xs" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      <Routes>
        {/* Auth */}
        <Route path="/auth" element={
          state.authStatus === 'authenticated'
            ? <Navigate to="/studio" replace />
            : <AuthPage />
        } />

        {/* Public studio */}
        <Route path="/studio" element={<AppShell><StudioPage /></AppShell>} />

        {/* Protected pages */}
        <Route path="/profile" element={<Protected><AppShell><ProfilePage /></AppShell></Protected>} />
        <Route path="/creator/:creatorId" element={<Protected><AppShell><CreatorProfilePage /></AppShell></Protected>} />
        <Route path="/team-profile/:teamName" element={<Protected><AppShell><TeamProfilePage /></AppShell></Protected>} />
        <Route path="/dashboard" element={<Protected><AppShell><DashboardPage /></AppShell></Protected>} />
        <Route path="/team"    element={<Protected><AppShell><TeamPage /></AppShell></Protected>} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/studio" replace />} />
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Routes>

      <Toast />
    </>
  );
}
