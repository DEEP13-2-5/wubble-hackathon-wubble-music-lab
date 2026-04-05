import { NavLink, useNavigate } from 'react-router-dom';
import { useStore, A } from '../lib/store.jsx';
import { initials } from '../lib/utils.js';

const NAV = [
  {
    to: '/profile', label: 'Profile',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  },
  {
    to: '/studio', label: 'Studio',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  },
  {
    to: '/dashboard', label: 'ReelTok World',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    to: '/team', label: 'Team',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
];

export default function Sidebar({ onClose }) {
  const { state, dispatch, toast } = useStore();
  const { user } = state;
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('wubble_token');
    dispatch({ type: A.LOGOUT });
    navigate('/auth', { replace: true });
    toast('Logged out successfully');
    onClose?.();
  };

  return (
    <>
      <div className="sidebar-brand">
        <div className="brand-mark">W</div>
        <span className="brand-name">Wubble</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to} to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <span className="nav-icon">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="avatar-sm">{initials(user?.name)}</div>
          <span className="user-name muted text-sm">{user?.name || '—'}</span>
        </div>
        <button className="logout-btn icon-btn" onClick={logout} title="Log out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </>
  );
}
