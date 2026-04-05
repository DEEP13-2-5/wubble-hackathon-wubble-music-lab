import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, A } from '../lib/store.jsx';
import { authApi } from '../lib/api.js';

function validate(fields) {
  const errs = {};
  if ('name' in fields && !fields.name.trim()) errs.name = 'Name is required';
  if (!fields.email.trim()) errs.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(fields.email)) errs.email = 'Enter a valid email';
  if (!fields.password) errs.password = 'Password is required';
  else if ('name' in fields && fields.password.length < 6) errs.password = 'Min 6 characters';
  return errs;
}

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errs, setErrs] = useState({});
  const [formErr, setFormErr] = useState('');
  const [loading, setLoading] = useState(false);
  const { dispatch, toast } = useStore();
  const navigate = useNavigate();

  const onChange = (f) => (e) => { setForm(p => ({ ...p, [f]: e.target.value })); setErrs(p => ({ ...p, [f]: '' })); setFormErr(''); };

  const switchTab = (t) => { setTab(t); setErrs({}); setFormErr(''); };

  const onSuccess = ({ token, user }) => {
    localStorage.setItem('wubble_token', token);
    dispatch({ type: A.SET_USER, payload: user });
    dispatch({ type: A.SET_AUTH_STATUS, payload: 'authenticated' });
    // store token in state for api calls
    dispatch({ type: 'SET_TOKEN', payload: token });
    toast(`Welcome, ${user.name}! 🎵`, 'success');
    navigate('/studio', { replace: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const fields = { email: form.email, password: form.password };
    const v = validate(fields);
    if (Object.keys(v).length) { setErrs(v); return; }
    setLoading(true); setFormErr('');
    try {
      const res = await authApi.login(fields);
      onSuccess(res);
    } catch (err) {
      setFormErr(err.message);
    } finally { setLoading(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const fields = { name: form.name, email: form.email, password: form.password };
    const v = validate(fields);
    if (Object.keys(v).length) { setErrs(v); return; }
    setLoading(true); setFormErr('');
    try {
      const res = await authApi.signup(fields);
      onSuccess(res);
    } catch (err) {
      setFormErr(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-screen">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-card">
        <div className="auth-logo">
          <div className="brand-mark-lg">W</div>
          <div>
            <div className="auth-app-name">Wubble Music Lab</div>
            <div className="muted text-xs" style={{ marginTop: 2 }}>AI creation · Team collab · Public releases</div>
          </div>
        </div>
        <div style={{ marginBottom: 24 }} />

        <div className="auth-tabs">
          <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>Log In</button>
          <button className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => switchTab('signup')}>Sign Up</button>
        </div>

        {/* LOGIN */}
        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin} noValidate>
            <div className="field-group">
              <label>Email</label>
              <input className={`input${errs.email ? ' input-err' : ''}`} type="email" value={form.email} onChange={onChange('email')} placeholder="you@example.com" autoComplete="email" />
              {errs.email && <span className="field-err">{errs.email}</span>}
            </div>
            <div className="field-group">
              <label>Password</label>
              <input className={`input${errs.password ? ' input-err' : ''}`} type="password" value={form.password} onChange={onChange('password')} placeholder="••••••••" autoComplete="current-password" />
              {errs.password && <span className="field-err">{errs.password}</span>}
            </div>
            {formErr && <div className="form-err show">{formErr}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <span className="spin" /> : 'Log In'}
            </button>
          </form>
        )}

        {/* SIGNUP */}
        {tab === 'signup' && (
          <form className="auth-form" onSubmit={handleSignup} noValidate>
            <div className="field-group">
              <label>Name</label>
              <input className={`input${errs.name ? ' input-err' : ''}`} type="text" value={form.name} onChange={onChange('name')} placeholder="Your name" autoComplete="name" />
              {errs.name && <span className="field-err">{errs.name}</span>}
            </div>
            <div className="field-group">
              <label>Email</label>
              <input className={`input${errs.email ? ' input-err' : ''}`} type="email" value={form.email} onChange={onChange('email')} placeholder="you@example.com" autoComplete="email" />
              {errs.email && <span className="field-err">{errs.email}</span>}
            </div>
            <div className="field-group">
              <label>Password</label>
              <input className={`input${errs.password ? ' input-err' : ''}`} type="password" value={form.password} onChange={onChange('password')} placeholder="Min 6 characters" autoComplete="new-password" />
              {errs.password && <span className="field-err">{errs.password}</span>}
            </div>
            {formErr && <div className="form-err show">{formErr}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <span className="spin" /> : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
