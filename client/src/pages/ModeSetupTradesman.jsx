// Smith — First-switch setup: homeowner → tradesman
//
// Route: /mode/setup-tradesman — authed. Reached when a homeowner flips
// to tradesman mode without any trades on file (no user_trades rows).
//
// Trades step is the existing rich tradesman onboarding's gate, so we
// reuse the same /api/trades + /api/profiles/me/trades endpoints rather
// than re-creating the wizard. After save → tradesman shell renders
// because profiles.tradesman is now true.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { ChromeWordmark } from '../components/HomeownerEntry.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';

export function ModeSetupTradesmanPage() {
  const { navigate } = useRouter();
  const { refresh, switchMode } = useAuth();
  const [trades, setTrades] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/trades').then(d => setTrades(d.trades || [])).catch(() => {});
  }, []);

  const toggle = (name) => {
    setSelected(s =>
      s.includes(name) ? s.filter(n => n !== name)
      : (s.length < 6 ? [...s, name] : s)
    );
  };

  const onSubmit = async () => {
    if (selected.length === 0) {
      setError('Pick at least one trade.'); return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post('/profiles/me/trades', {
        trades: selected.map(name => ({ name, years: 0 })),
      });
      await refresh();
      navigate('/feed', { replace: true });
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not save your trades.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    try { await switchMode('homeowner'); } catch {}
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
          ← Back to homeowner mode
        </button>
      </header>

      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 580 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: B.accentSoft, color: B.accent,
            padding: '5px 12px', borderRadius: 100, fontSize: 11.5, fontWeight: 600,
            marginBottom: 18,
          }}>
            <Icon name="tool" size={12}/> Setting up tradesman mode
          </div>
          <h1 className="serif" style={{
            margin: 0, fontSize: 32, fontWeight: 600,
            letterSpacing: '-0.025em', lineHeight: 1.1,
          }}>
            What do you build?
          </h1>
          <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 26px' }}>
            Pick your primary trade. Add specializations next — most makers
            wear more than one hat. Up to 6.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {trades.map(t => {
              const isSelected = selected.includes(t.name);
              const order = selected.indexOf(t.name);
              return (
                <button key={t.id} onClick={() => toggle(t.name)} style={{
                  padding: '14px 18px', textAlign: 'left',
                  background: isSelected ? B.accentSoft : B.surface,
                  border: `1px solid ${isSelected ? B.accent : B.line}`,
                  borderRadius: 4, color: B.text,
                  display: 'flex', alignItems: 'center', gap: 12,
                  fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                }}>
                  <Icon name={t.icon || 'tool'} size={16} style={{ color: isSelected ? B.accent : B.dim }}/>
                  <span style={{ flex: 1 }}>{t.name}</span>
                  {isSelected && (
                    <span className="serif" style={{
                      fontSize: 11, fontWeight: 700,
                      width: 18, height: 18, borderRadius: '50%',
                      background: B.accent, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{order === 0 ? '★' : order + 1}</span>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <div style={{
              background: B.dangerSoft, color: B.danger,
              border: `1px solid ${B.danger}`, borderRadius: 6,
              padding: '8px 12px', marginTop: 18, fontSize: 13,
            }}>{error}</div>
          )}

          <button
            onClick={onSubmit}
            disabled={busy || selected.length === 0}
            style={{
              width: '100%', marginTop: 26,
              background: B.text, color: B.surface, border: 'none',
              padding: '15px', borderRadius: 100,
              fontSize: 15, fontWeight: 600,
              cursor: busy || !selected.length ? 'not-allowed' : 'pointer',
              opacity: busy || !selected.length ? 0.55 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {busy ? 'Saving…' : 'Save trades and continue'}{' '}
            <Icon name="arrow-r" size={15} stroke={2.4}/>
          </button>
        </div>
      </main>
    </div>
  );
}
