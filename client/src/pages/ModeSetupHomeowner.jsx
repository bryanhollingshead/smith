// Smith — First-switch setup: tradesman → homeowner
//
// Route: /mode/setup-homeowner — authed. Reached two ways:
//   (a) An authed tradesman flips to homeowner mode via ModeToggle and
//       has no `homes` row yet (server returned needs_setup:true from
//       PATCH /api/auth/me/mode).
//   (b) An existing tradesman tried to sign up at /auth/homeowner; we
//       caught the 409, redirected them through /auth/signin with a
//       `next=/mode/setup-homeowner?address=…&hiring_context=…&…`
//       URL so the typed address + intent survive the sign-in hop.
//
// Reuses AddressField + HiringContextChoice + POST /api/homes from the
// public homeowner-signup path, minus credentials (we're already authed).
// On submit, idempotently flips users.role to 'homeowner' so the new shell
// renders even when the caller arrived in tradesman mode (case b above).

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import {
  AddressField, HiringContextChoice, ChromeWordmark,
} from '../components/HomeownerEntry.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';

export function ModeSetupHomeownerPage() {
  const { navigate, params } = useRouter();
  const { refresh, switchMode } = useAuth();

  // Pre-fill from URL — when present, the caller already typed an address
  // (typically the resume-after-signin path from /auth/homeowner, or a
  // signed-in user coming from the hire-me entry flow).
  const incomingAddress   = params.address || '';
  const incomingHiringIn  = params.hiring_context === 'property_manager' ? 'property_manager' : 'own_home';
  const incomingEntry     = params.entry_source === 'hire-me' ? 'hire-me' : 'self-serve';
  const incomingProSlug   = params.pro || null;
  const hasPrefill        = !!incomingAddress;

  const [addressText, setAddressText] = useState(incomingAddress);
  const [hiringContext, setHiringContext] = useState(incomingHiringIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async () => {
    setError(null);
    if (!addressText.trim()) { setError('Type your home address.'); return; }
    setBusy(true);
    try {
      // Save hiring_context first so the label is right the moment the
      // seed home renders.
      await api.patch('/profiles/me', { hiring_context: hiringContext });
      const { home } = await api.post('/homes', {
        address: addressText.trim(),
        entry_source: incomingEntry,
        pending_pro_slug: incomingEntry === 'hire-me' ? incomingProSlug : null,
      });
      // Idempotently flip the persisted mode to homeowner. If the user was
      // already in homeowner mode (case a) this is a no-op on the DB side.
      // If they arrived from sign-in still in tradesman mode (case b) this
      // is what makes the new shell render after we navigate.
      try { await switchMode('homeowner'); } catch { /* not fatal */ }
      await refresh();
      navigate(`/home/${home.id}/confirm`);
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not set up your home.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    try { await switchMode('tradesman'); } catch {}
    navigate('/feed', { replace: true });
  };

  return (
    <div style={{
      background: B.bg, color: B.text, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '18px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${B.line}`,
      }}>
        <ChromeWordmark/>
        <button onClick={cancel} style={{
          background: 'transparent', border: 'none', color: B.faint, fontSize: 12.5,
          fontStyle: 'italic', cursor: 'pointer', padding: 0,
        }}>
          ← Back to tradesman mode
        </button>
      </header>

      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: B.accentSoft, color: B.accent,
            padding: '5px 12px', borderRadius: 100, fontSize: 11.5, fontWeight: 600,
            marginBottom: 18,
          }}>
            <Icon name="home" size={12}/>{' '}
            {hasPrefill ? 'Adding home to your account' : 'Setting up homeowner mode'}
          </div>
          <h1 className="serif" style={{
            margin: 0, fontSize: 32, fontWeight: 600,
            letterSpacing: '-0.025em', lineHeight: 1.1,
          }}>
            {hasPrefill ? 'Confirm and add.' : 'Claim your home.'}
          </h1>
          <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 26px' }}>
            {hasPrefill
              ? "We saved the address you picked. Confirm and we'll add it to your existing Smith account."
              : "One address, one tap. We'll pull what's public, then you fill in the rest at your pace. Switch back to tradesman anytime."
            }
          </p>

          <HiringContextChoice
            value={hiringContext}
            onChange={setHiringContext}
            disabled={busy}
          />

          {hasPrefill ? (
            <PrefilledAddress addressText={incomingAddress}/>
          ) : (
            <AddressField value={addressText} onChange={setAddressText}/>
          )}

          {error && (
            <div style={{
              background: B.dangerSoft, color: B.danger,
              border: `1px solid ${B.danger}`, borderRadius: 6,
              padding: '8px 12px', marginBottom: 14, marginTop: 6, fontSize: 13,
            }}>{error}</div>
          )}

          <button
            onClick={onSubmit}
            disabled={busy || !addressText.trim()}
            style={{
              width: '100%', marginTop: 26,
              background: B.text, color: B.surface, border: 'none',
              padding: '15px', borderRadius: 100,
              fontSize: 15, fontWeight: 600,
              cursor: busy || !addressText.trim() ? 'not-allowed' : 'pointer',
              opacity: busy || !addressText.trim() ? 0.55 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {busy ? 'Adding…' : (hasPrefill ? 'Add this home' : 'Find my home')}{' '}
            <Icon name="arrow-r" size={15} stroke={2.4}/>
          </button>
        </div>
      </main>
    </div>
  );
}

// Read-only display when an address was carried in via URL params.
function PrefilledAddress({ addressText }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        color: B.dim, fontSize: 12, fontStyle: 'italic',
        display: 'block', marginBottom: 6,
      }}>Your home address</label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: B.surface, border: `1px solid ${B.line}`,
        borderRadius: 8, padding: '13px 15px',
      }}>
        <Icon name="mappin" size={16} style={{ color: B.dim }}/>
        <span style={{ flex: 1, color: B.text, fontSize: 15 }}>{addressText}</span>
      </div>
      <div style={{
        color: B.faint, fontSize: 11.5, marginTop: 6, fontStyle: 'italic',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="check" size={11} stroke={3} style={{ color: B.accent }}/>
        Picked on the previous step.
      </div>
    </div>
  );
}
