// Smith — Sign in page
// The original handoff doesn't include a sign-in screen (only signup → confirm),
// but every flow needs one. We keep the AuthShell layout consistent with the
// rest of the auth screens and use the same pill-button visual language.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import {
  AuthShell, AuthLabel, AuthInput, PasswordInput,
  PrimaryButton, GhostButton,
} from '../components/AuthShell.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

export function SignInPage() {
  const { signIn, loading } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    try {
      const u = await signIn(email.trim(), password);
      navigate(u.onboarding_done ? '/feed' : '/onboarding');
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not sign in');
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && email && password) submit();
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to Smith"
      subtitle="Pick up where you left off — your network, your projects, your next job."
      hero={{
        title: 'The work is the résumé.',
        body: 'A network for the people behind the build — carpenters, electricians, masons, GCs.',
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <GhostButton onClick={() => navigate('/auth/signup')}>
            ← New here? Create an account
          </GhostButton>
          <PrimaryButton disabled={loading || !email || !password} onClick={submit}>
            Sign in <Icon name="arrow-r" size={14} stroke={2.4}/>
          </PrimaryButton>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <AuthLabel>Email</AuthLabel>
          <AuthInput
            icon="mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={onKey}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <AuthLabel>Password</AuthLabel>
          <PasswordInput
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>

        {error && (
          <div style={{
            color: B.danger, fontSize: 13,
            background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
            padding: '10px 14px',
          }}>{error}</div>
        )}

        <div style={{ paddingTop: 4, color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
          Forgot it?{' '}
          <a href="#/auth/forgot" style={{ color: B.accent, fontStyle: 'normal', fontWeight: 600, textDecoration: 'none' }}>
            Reset your password
          </a>
        </div>

        <div style={{
          marginTop: 8, padding: '12px 16px',
          background: B.accentSoft, border: `1px solid ${B.line}`, borderRadius: 4,
          color: B.dim, fontSize: 12.5, lineHeight: 1.55,
        }}>
          <strong style={{ color: B.text }}>Try the demo:</strong>{' '}
          <span className="mono">marcus.whitfield@smith.test</span> /{' '}
          <span className="mono">framer-2024-mt</span>
        </div>
      </div>
    </AuthShell>
  );
}
