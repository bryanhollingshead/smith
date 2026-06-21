// Smith — Sign in page (pure auth form)
//
// Hits when the user navigates to /auth/signin from the Landing page
// (or anywhere else). All marketing content was moved to Landing.jsx
// when we split / from /auth/signin — keep this file lean.
//
// Layout: AuthShell handles the two-column composition (form on left,
// "The work is the résumé" hero photo on the right). Identical to the
// previous experience above the fold.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import {
  AuthShell, AuthLabel, AuthInput, PasswordInput,
  PrimaryButton, GhostButton,
} from '../components/AuthShell.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

// Only honor `?next=…` redirects that target our own app — never a full URL
// or protocol-relative form. Cheap defense against open-redirect tomfoolery.
function safeNext(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

export function SignInPage() {
  const { signIn, loading } = useAuth();
  const { navigate, params } = useRouter();
  // Pre-fill email when the caller passed one (e.g. the "you already have a
  // Smith account" banner on /auth/homeowner). next= lets that same path
  // hand us back to /mode/setup-homeowner with the picked address.
  const [email, setEmail] = useState(params.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const next = safeNext(params.next);

  const submit = async () => {
    setError(null);
    try {
      const u = await signIn(email.trim(), password);
      if (next) {
        navigate(next, { replace: true });
        return;
      }
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
        body: 'A network for carpenters, electricians, masons, GCs and subs, and the crews behind the build.',
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
          <a
            href="/auth/forgot"
            onClick={(e) => { e.preventDefault(); navigate('/auth/forgot'); }}
            style={{ color: B.accent, fontStyle: 'normal', fontWeight: 600, textDecoration: 'none' }}
          >
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
