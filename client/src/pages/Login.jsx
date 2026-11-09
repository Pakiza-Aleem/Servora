import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMsg } from '../api.js';
import { Alert } from '../components/ui.jsx';
import '../styles/auth.css';
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ email: 'owner@servora.test', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await login(f.email, f.password); navigate('/'); } catch (x) { setErr(errMsg(x)); setBusy(false); } };
  return (
    <main className="auth-page auth-page--welcome">
      <section className="welcome-panel login-panel">
        <Link className="brand__word auth-hero__brand welcome-brand-link" to="/">SERVORA</Link>
        <form className="auth-card" onSubmit={submit}>
          <p className="welcome-eyebrow">Welcome back</p>
          <h1 className="serif">Good to see you.</h1>
          <p className="muted">Sign in to your restaurant.</p>
          <Alert error={err} />
          <label className="field">Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="field">Password<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
          <button className="btn btn--block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="login-signup">Need an account? <Link to="/signup">Ask your owner for access</Link></p>
        </form>
        <p className="welcome-footer">Made for gracious service.</p>
      </section>
    </main>
  );
}
