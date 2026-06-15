import { useState } from 'react';
import Card from '../components/Card';

export default function AuthPage({ onLogin, onNavigate }) {
  const [tab, setTab]           = useState('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  const validate = () => {
    if (!email || !password) return 'Please fill in all fields.';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (tab === 'signup' && !name.trim()) return 'Please enter your name.';
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    const displayName = tab === 'signup' ? name.trim() : email.split('@')[0];
    onLogin({ email, name: displayName });
    onNavigate('landing');
  };

  const switchTab = (t) => { setTab(t); setError(''); };

  return (
    <div className="auth-root">
      <Card className="auth-card fade-up">
        <div className="auth-inner">
          <div className="auth-brand">⚡ OptiCloud</div>

          <div className="auth-tab-row">
            <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>
              Sign In
            </button>
            <button className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => switchTab('signup')}>
              Sign Up
            </button>
          </div>

          <h2 className="auth-title">
            {tab === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          {tab === 'signup' && (
            <div className="input-wrap">
              <label>Full Name</label>
              <input
                className="input-field"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          )}

          <div className="input-wrap">
            <label>Email Address</label>
            <input
              className="input-field"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="input-wrap">
            <label>Password</label>
            <input
              className="input-field"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && <div className="auth-error">⚠ {error}</div>}

          <button className="btn btn-primary w-full" style={{ justifyContent: 'center' }} onClick={handleSubmit}>
            {tab === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>

          <p className="auth-footer">
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button className="auth-link" onClick={() => switchTab(tab === 'login' ? 'signup' : 'login')}>
              {tab === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
}