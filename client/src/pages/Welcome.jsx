import { ArrowRight, KeyRound, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import '../styles/auth.css';

export default function Welcome({ onContinue = () => {} }) {
  const { user } = useAuth();
  return (
    <main className="auth-page auth-page--welcome">
      <section className="welcome-panel">
        <span className="brand__word auth-hero__brand">SERVORA</span>
        <div className="welcome-panel__content">
          <p className="welcome-eyebrow">A better way to host</p>
          <h1 className="serif">Make every<br />service memorable.</h1>
          <p className="welcome-copy">
            Thoughtful tools for the people who make every meal feel special.
          </p>
          <div className="welcome-actions">
            <Link className="welcome-action welcome-action--primary" to={user ? '/app' : '/login'} onClick={onContinue}>
              <KeyRound size={19} />
              <span><strong>{user ? 'Open Servora' : 'Log in'}</strong><small>{user ? 'Go to your workspace' : 'Access your restaurant'}</small></span>
              <ArrowRight className="welcome-action__arrow" size={18} />
            </Link>
            <Link className="welcome-action" to="/signup" onClick={onContinue}>
              <UserPlus size={19} />
              <span><strong>Sign up</strong><small>Get access to Servora</small></span>
              <ArrowRight className="welcome-action__arrow" size={18} />
            </Link>
          </div>
        </div>
        <p className="welcome-footer">Made for gracious service.</p>
      </section>
    </main>
  );
}

export function SignupInfo() {
  return (
    <main className="auth-page auth-page--welcome">
      <section className="welcome-panel signup-panel">
        <Link className="brand__word auth-hero__brand welcome-brand-link" to="/">SERVORA</Link>
        <div className="signup-info">
          <span className="signup-info__icon"><UserPlus size={22} /></span>
          <p className="welcome-eyebrow">Join your team</p>
          <h1 className="serif">Your owner will<br />get you started.</h1>
          <p className="welcome-copy">
            Servora accounts are created by your restaurant owner, who assigns your role and login credentials.
            Ask your owner to set up your account.
          </p>
          <Link className="welcome-action welcome-action--primary" to="/login">
            <KeyRound size={19} />
            <span><strong>Go to log in</strong><small>Already have your credentials?</small></span>
            <ArrowRight className="welcome-action__arrow" size={18} />
          </Link>
          <Link className="signup-back" to="/">Back to welcome</Link>
        </div>
        <p className="welcome-footer">Made for gracious service.</p>
      </section>
    </main>
  );
}
