// Smith — Signup (credentials step)
// Ported from smith-auth.jsx → SignUpCredentialsB. We render the 5-step
// indicator and ask for first/last/email/password in one shot, then hand off
// to confirm-email.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import {
  AuthShell, AuthLabel, AuthInput, PasswordInput,
  PasswordStrengthBar, passwordStrength,
  PrimaryButton, GhostButton,
} from '../components/AuthShell.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

const stepDots = [
  { n: 1, label: 'You',       done: true },
  { n: 2, label: 'Trade',     done: true },
  { n: 3, label: 'Account',   current: true },
  { n: 4, label: 'Companies' },
  { n: 5, label: 'Network'   },
];

export function SignUpPage() {
  const { signUp, loading } = useAuth();
  const { navigate } = useRouter();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [agree, setAgree] = useState(true);
  const [error, setError] = useState(null);

  const score = passwordStrength(pw);
  const canSubmit =
    first.trim() && last.trim() && email.trim() && pw.length >= 12 && /\d/.test(pw) && agree;

  const submit = async () => {
    setError(null);
    try {
      await signUp({
        email: email.trim(),
        password: pw,
        first_name: first.trim(),
        last_name: last.trim(),
      });
      navigate('/auth/confirm');
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not create account');
    }
  };

  return (
    <AuthShell
      stepNum={3} stepTotal={5}
      eyebrow="03 — your account"
      title="Set up your sign-in"
      subtitle="We'll use email as your username. Pick a password you'll remember on a jobsite, with grit on your hands."
      hero={{
        title: 'One account. Years of work.',
        body: 'Your trade history, credentials, and crew connections — all under a single sign-in you control.',
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <GhostButton onClick={() => navigate('/auth/signin')}>← Already have one? Sign in</GhostButton>
          <PrimaryButton disabled={!canSubmit || loading} onClick={submit}>
            Create account <Icon name="arrow-r" size={14} stroke={2.4}/>
          </PrimaryButton>
        </div>
      }
    >
      {/* Step indicator dots — exact match to SignUpCredentialsB */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
        {stepDots.map((s, i) => {
          const reached = s.done || s.current;
          return (
            <div key={s.n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="serif" style={{
                width: 26, height: 26, borderRadius: '50%',
                background: reached ? B.accent : B.surface,
                border: `1px solid ${reached ? B.accent : B.line}`,
                color: reached ? '#fff' : B.dim,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {s.done ? <Icon name="check" size={11} stroke={3}/> : s.n}
              </div>
              <span style={{ fontSize: 11, color: reached ? B.text : B.dim, fontWeight: 500 }}>
                {s.label}
              </span>
              {i < stepDots.length - 1 && (
                <div style={{
                  flex: 1, height: 1,
                  background: stepDots[i + 1].done || stepDots[i + 1].current ? B.accent : B.line,
                  marginLeft: 6,
                }}/>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <AuthLabel>First name</AuthLabel>
            <AuthInput value={first} onChange={e => setFirst(e.target.value)} placeholder="Marcus"/>
          </div>
          <div>
            <AuthLabel>Last name</AuthLabel>
            <AuthInput value={last} onChange={e => setLast(e.target.value)} placeholder="Whitfield"/>
          </div>
        </div>

        <div>
          <AuthLabel>Email — this is your username</AuthLabel>
          <AuthInput icon="mail" type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"/>
        </div>

        <div>
          <AuthLabel>Password</AuthLabel>
          <PasswordInput value={pw} onChange={e => setPw(e.target.value)}/>
          <PasswordStrengthBar score={score}/>
        </div>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 6, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
            style={{ accentColor: B.accent, marginTop: 3 }}/>
          <span style={{ color: B.text, fontSize: 13, lineHeight: 1.55 }}>
            I agree to the <a href="#" style={{ color: B.accent }}>Terms</a> and{' '}
            <a href="#" style={{ color: B.accent }}>Privacy Policy</a>. I confirm I'm 18+ and the work I post is mine to share.
          </span>
        </label>

        {error && (
          <div style={{
            color: B.danger, fontSize: 13,
            background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
            padding: '10px 14px',
          }}>{error}</div>
        )}
      </div>
    </AuthShell>
  );
}
