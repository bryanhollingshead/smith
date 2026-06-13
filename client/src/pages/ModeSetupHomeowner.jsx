// Smith — First-switch setup: tradesman → homeowner
//
// Route: /mode/setup-homeowner — authed. Reached only when a tradesman
// flips to homeowner mode and has no `homes` row yet (server returned
// needs_setup: true from PATCH /api/auth/me/mode).
//
// Reuses the AddressField + HiringContextChoice + POST /api/homes from
// the public homeowner-signup path, minus credentials (the user is
// already signed in).

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
  const { navigate } = useRouter();
  const { refresh, switchMode } = useAuth();
  const [picked, setPicked] = useState(null);
  const [hiringContext, setHiringContext] = useState('own_home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async () => {
    setError(null);
    if (!picked) { setError('Pick an address from the suggestions.'); return; }
    setBusy(true);
    try {
      // Save the declared hiring context first so the label updates everywhere
      // the moment the seed home renders.
      await api.patch('/profiles/me', { hiring_context: hiringContext });
      const { home } = await api.post('/homes', {
        place_id: picked.place_id,
        entry_source: 'self-serve',
      });
      // Refresh user state so profiles.homeowner flips to true; then route
      // into the homeowner confirm screen.
      await refresh();
      navigate(`/home/${home.id}/confirm`);
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not set up your home.');
    } finally {
      setBusy(false);
    }
  };

  // Escape hatch: bail back to tradesman without forcing them through.
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
            <Icon name="home" size={12}/> Setting up homeowner mode
          </div>
          <h1 className="serif" style={{
            margin: 0, fontSize: 32, fontWeight: 600,
            letterSpacing: '-0.025em', lineHeight: 1.1,
          }}>
            Claim your home.
          </h1>
          <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 26px' }}>
            One address, one tap. We'll pull what's public, then you fill in
            the rest at your pace. Switch back to tradesman anytime.
          </p>

          <HiringContextChoice
            value={hiringContext}
            onChange={setHiringContext}
            disabled={busy}
          />

          <AddressField onPick={setPicked}/>

          {error && (
            <div style={{
              background: B.dangerSoft, color: B.danger,
              border: `1px solid ${B.danger}`, borderRadius: 6,
              padding: '8px 12px', marginBottom: 14, marginTop: 6, fontSize: 13,
            }}>{error}</div>
          )}

          <button
            onClick={onSubmit}
            disabled={busy || !picked}
            style={{
              width: '100%', marginTop: 26,
              background: B.text, color: B.surface, border: 'none',
              padding: '15px', borderRadius: 100,
              fontSize: 15, fontWeight: 600,
              cursor: busy || !picked ? 'not-allowed' : 'pointer',
              opacity: busy || !picked ? 0.55 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {busy ? 'Finding your home…' : 'Find my home'}{' '}
            <Icon name="arrow-r" size={15} stroke={2.4}/>
          </button>
        </div>
      </main>
    </div>
  );
}
