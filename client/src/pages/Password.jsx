// Smith — Forgot password + Reset password pages
// Ported from smith-auth.jsx → ForgotPasswordB / ForgotPasswordSentB / ResetPasswordB.

import React, { useState, useEffect } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import {
  AuthShell, AuthLabel, AuthInput, PasswordInput,
  PasswordStrengthBar, passwordStrength,
  PrimaryButton,
} from '../components/AuthShell.jsx';
import { api, auth } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

// ── Forgot password (request) ────────────────────────────────────────────
export function ForgotPasswordPage() {
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.post('/auth/forgot', { email: email.trim() });
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  if (sent) return <ForgotPasswordSent email={email}/>;

  return (
    <AuthShell
      eyebrow="Reset your password"
      title="Forgot your password?"
      subtitle="It happens. Type the email tied to your Smith account and we'll send a reset link."
      hero={{ title: 'Lost the password?', body: 'No tickets, no waiting. Reset yourself in two minutes.' }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="#/auth/signin" style={{
            color: B.dim, fontSize: 14, fontWeight: 500,
            padding: '10px 0', textDecoration: 'none',
          }}>← Back to sign in</a>
          <PrimaryButton disabled={!email || busy} onClick={submit}>
            Send reset link <Icon name="arrow-r" size={14} stroke={2.4}/>
          </PrimaryButton>
        </div>
      }
    >
      <div>
        <AuthLabel>Email</AuthLabel>
        <AuthInput icon="mail" type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="you@example.com"/>
      </div>

      <div style={{
        marginTop: 20, padding: '14px 18px',
        background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      }}>
        <div className="serif" style={{
          color: B.text, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em',
        }}>
          A note on security
        </div>
        <p style={{ color: B.dim, fontSize: 13, lineHeight: 1.55, margin: '6px 0 0' }}>
          Reset links expire after 30 minutes. If your email is on file, the link arrives within a minute. If it's not, we won't say so — but you also won't get a link.
        </p>
      </div>
    </AuthShell>
  );
}

// ── Sent confirmation ───────────────────────────────────────────────────
function ForgotPasswordSent({ email }) {
  return (
    <AuthShell
      eyebrow="Reset your password"
      title="Check your email"
      subtitle={
        <>If an account exists for <strong style={{ color: B.text }}>{email}</strong>, a reset link is on its way.</>
      }
      hero={{ title: 'Almost back in.', body: 'Open the email and click the link to set a new password.' }}
      footer={
        <a href="#/auth/signin" style={{
          color: B.dim, fontSize: 14, fontWeight: 500, textDecoration: 'none',
        }}>← Back to sign in</a>
      }
    >
      <div style={{
        background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
        padding: 24, display: 'flex', alignItems: 'flex-start', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: B.accentSoft, color: B.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="mail" size={22}/>
        </div>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{
            color: B.text, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em',
          }}>
            One email, on its way
          </div>
          <p style={{ color: B.dim, fontSize: 13.5, lineHeight: 1.55, margin: '6px 0 0' }}>
            The reset link is valid for 30 minutes. Open it from the same browser if you can — it makes the next step quicker.
          </p>
        </div>
      </div>

      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: B.accentSoft, border: `1px solid ${B.line}`, borderRadius: 4,
        color: B.dim, fontSize: 12.5, lineHeight: 1.55,
      }}>
        <strong style={{ color: B.text }}>Dev:</strong> mock emails are written to <span className="mono">mock_emails</span>.
        You can grab the reset link via{' '}
        <span className="mono">GET /api/auth/dev/last-email?email={'<email>'}&kind=reset</span>.
      </div>
    </AuthShell>
  );
}

// ── Reset password (token from email) ───────────────────────────────────
export function ResetPasswordPage() {
  const { navigate, params } = useRouter();
  const { setUser } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const score = passwordStrength(pw);
  const mismatch = pw2 && pw && pw !== pw2;
  const valid = pw.length >= 12 && /\d/.test(pw) && pw === pw2;
  const token = params.token || '';

  useEffect(() => {
    if (!token) setError('No reset token found in the link.');
  }, [token]);

  const submit = async () => {
    if (!valid || !token) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.post('/auth/reset', { token, password: pw });
      auth.set(data.token);
      // Fetch profile so the auth context populates.
      const me = await api.get('/auth/me');
      setUser(me.user);
      navigate('/feed', { replace: true });
    } catch (e) {
      setError(e.data?.error || 'Could not reset. Try requesting a new link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Reset your password"
      title="Set a new password"
      subtitle="Pick something only you would know. Twelve characters or more, with at least one number."
      hero={{ title: 'Almost done.', body: "After this you'll be signed back in to Smith." }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <PrimaryButton disabled={!valid || busy} onClick={submit}>
            Save & sign in <Icon name="arrow-r" size={14} stroke={2.4}/>
          </PrimaryButton>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <AuthLabel>New password</AuthLabel>
          <PasswordInput value={pw} onChange={e => setPw(e.target.value)}/>
          <PasswordStrengthBar score={score}/>
        </div>

        <div>
          <AuthLabel>Confirm new password</AuthLabel>
          <AuthInput
            icon="shield"
            type="password"
            value={pw2}
            onChange={e => setPw2(e.target.value)}
            placeholder="Type it again"
            error={mismatch ? "Passwords don't match." : null}
          />
        </div>

        {error && (
          <div style={{
            color: B.danger, fontSize: 13,
            background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
            padding: '10px 14px',
          }}>{error}</div>
        )}

        <div style={{
          padding: '14px 18px', background: B.accentSoft,
          border: `1px solid ${B.line}`, borderRadius: 4,
          color: B.dim, fontSize: 12.5, lineHeight: 1.55, fontStyle: 'italic',
        }}>
          Setting a new password signs out other devices. You'll need to sign in again on your phone if Smith is open there.
        </div>
      </div>
    </AuthShell>
  );
}
