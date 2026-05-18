// Smith — Confirm email page
// Ported from smith-auth.jsx → ConfirmEmailB. Six 1-character inputs that
// auto-advance + paste the whole code in if the user pastes one. We hit
// /api/auth/verify-email and route on success.

import React, { useState, useRef, useEffect } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import {
  AuthShell, PrimaryButton, GhostButton,
} from '../components/AuthShell.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

export function ConfirmEmailPage() {
  const { user, refresh, signOut } = useAuth();
  const { navigate } = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const refs = useRef([]);

  // If they're already verified, send them onward. Otherwise let them confirm.
  useEffect(() => {
    if (user && user.email_verified) navigate('/onboarding', { replace: true });
  }, [user, navigate]);

  const code = digits.join('');
  const ready = code.length === 6 && /^\d{6}$/.test(code);

  const handle = (i, v) => {
    setError(null);
    // Pasting the whole code lands here too — split it across boxes.
    if (v.length > 1) {
      const ds = v.replace(/\D/g, '').slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      ds.forEach((d, idx) => next[idx] = d);
      setDigits(next);
      const last = Math.min(5, ds.length - 1);
      refs.current[last]?.focus();
      return;
    }
    const clean = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i, e) => {
    // Backspace on empty cell goes back.
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/verify-email', { code });
      await refresh();
      navigate('/onboarding', { replace: true });
    } catch (e) {
      setError(e.data?.error || 'That code didn\'t work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await api.post('/auth/resend-code');
      setResent(true);
    } catch {
      setError('Could not resend. Try again in a moment.');
    }
  };

  return (
    <AuthShell
      stepNum={4} stepTotal={5}
      eyebrow="04 — confirm your email"
      title="Check your email"
      subtitle={
        <>
          We sent a 6-digit code to{' '}
          <strong style={{ color: B.text }}>{user?.email || 'your inbox'}</strong>.
          The code expires in 15 minutes.
        </>
      }
      hero={{
        title: 'A real address, a real person.',
        body: 'Confirming your email keeps Smith honest. No bots, no spam profiles — just makers.',
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <GhostButton onClick={() => { signOut(); navigate('/auth/signup'); }}>
            ← Use a different email
          </GhostButton>
          <PrimaryButton disabled={!ready || busy} onClick={submit}>
            Continue <Icon name="arrow-r" size={14} stroke={2.4}/>
          </PrimaryButton>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            value={d}
            onChange={e => handle(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            inputMode="numeric"
            maxLength={6} /* allow paste */
            style={{
              width: 56, height: 64,
              background: B.surface, border: `1px solid ${d ? B.accent : B.line}`,
              borderRadius: 4, textAlign: 'center',
              fontSize: 26, fontWeight: 600, fontFamily: 'Fraunces, serif',
              color: B.text, outline: 'none',
              boxShadow: d ? `0 0 0 3px ${B.accentSoft}` : 'none',
              transition: 'border 120ms ease, box-shadow 120ms ease',
            }}
          />
        ))}
      </div>

      {error && (
        <div style={{
          color: B.danger, fontSize: 13, marginBottom: 16,
          background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
          padding: '10px 14px',
        }}>{error}</div>
      )}

      <div style={{
        background: B.accentSoft, border: `1px solid ${B.line}`, borderRadius: 4,
        padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <Icon name="mail" size={18} style={{ color: B.accent, marginTop: 2 }}/>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{
            color: B.text, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em',
          }}>
            Didn't get the code?
          </div>
          <div style={{ color: B.dim, fontSize: 12.5, lineHeight: 1.5, marginTop: 4 }}>
            Check your spam folder. If you opened a fresh window, the code may have arrived in a separate inbox tab.
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, alignItems: 'center' }}>
            <button onClick={resend} disabled={resent} style={{
              background: 'transparent', border: 'none',
              color: resent ? B.faint : B.accent,
              fontSize: 13, fontWeight: 600, padding: 0,
              cursor: resent ? 'default' : 'pointer',
            }}>
              {resent ? '✓ Resent — check your inbox' : 'Resend the code'}
            </button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
