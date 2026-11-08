import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { errMsg } from '../api.js';
import { Alert } from '../components/ui.jsx';
import '../styles/auth.css';
export default function Login() {
  const { login } = useAuth();
  const [f, setF] = useState({ email: 'owner@servora.test', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await login(f.email, f.password); } catch (x) { setErr(errMsg(x)); setBusy(false); } };
  return (
    <div className="auth-page">
      <aside className="auth-hero"><span className="brand__word auth-hero__brand">SERVORA</span><h1 className="serif">Every order.<br />Every table.<br />One system.</h1></aside>
      <form className="auth-card" onSubmit={submit}>
        <h2 className="serif">Welcome back</h2><p className="muted">Sign in to your restaurant.</p>
        <Alert error={err} />
        <label className="field">Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="field">Password<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <button className="btn btn--block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
