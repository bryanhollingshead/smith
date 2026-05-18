// Smith — Onboarding (trade selection)
// Ported from smith-direction-b.jsx → OnboardingB. After signup + email
// confirmation we ask the user to pick their trades, then mark onboarding done.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { Photo, SmithLogo } from '../components/Primitives.jsx';
import { PrimaryButton, GhostButton } from '../components/AuthShell.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

const STEPS = [
  { n: 1, label: 'You' },
  { n: 2, label: 'Trade' },
  { n: 3, label: 'Companies' },
  { n: 4, label: 'Network' },
];

export function OnboardingPage() {
  const { user, refresh } = useAuth();
  const { navigate } = useRouter();
  const [trades, setTrades] = useState([]);
  const [selected, setSelected] = useState([]);  // ordered list of trade names
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/trades').then(d => setTrades(d.trades)).catch(() => {});
  }, []);

  const toggle = (name) => {
    setSelected(s =>
      s.includes(name)
        ? s.filter(n => n !== name)
        : (s.length < 6 ? [...s, name] : s)  // max 6 per spec
    );
  };

  const submit = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      // Save trades (server creates new rows for any unknown trade names),
      // then flip the onboarding flag on the user record.
      await api.post('/profiles/me/trades', {
        trades: selected.map(name => ({ name, years: 0 })),
      });
      await api.patch('/profiles/me', { onboarding_done: true, onboarding_step: 5 });
      await refresh();
      navigate('/feed', { replace: true });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    try { await api.patch('/profiles/me', { onboarding_done: true }); } catch {}
    await refresh();
    navigate('/feed', { replace: true });
  };

  return (
    <div style={{
      background: B.bg, color: B.text, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '20px 40px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: `1px solid ${B.line}`,
      }}>
        <SmithLogo/>
        <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>Step 2 of 4</span>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'stretch' }}>
        <div style={{
          padding: '56px 72px', maxWidth: 580, width: '100%', justifySelf: 'end',
        }}>
          {/* Step bar */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 36 }}>
            {STEPS.map((s, i) => {
              const reached = s.n <= 2;
              return (
                <div key={s.n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="serif" style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: reached ? B.accent : B.surface,
                    border: `1px solid ${reached ? B.accent : B.line}`,
                    color: reached ? '#fff' : B.dim,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                  }}>{s.n}</div>
                  <span style={{
                    fontSize: 12, color: reached ? B.text : B.dim, fontWeight: 500,
                  }}>{s.label}</span>
                  {i < STEPS.length - 1 && (
                    <div style={{
                      flex: 1, height: 1,
                      background: s.n < 2 ? B.accent : B.line, marginLeft: 8,
                    }}/>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ color: B.accent, fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>
            02 — your trade
          </div>
          <h1 className="serif" style={{
            margin: 0, fontSize: 44, fontWeight: 600,
            letterSpacing: '-0.025em', lineHeight: 1.05,
          }}>
            What do you build?
          </h1>
          <p style={{ margin: '14px 0 32px', color: B.dim, fontSize: 16, lineHeight: 1.55 }}>
            Pick your primary trade. Add specializations next — most makers wear more than one hat. Up to 6.
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
                  fontSize: 13.5, fontWeight: 500,
                  cursor: 'pointer',
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

          {selected.length > 0 && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
              color: B.dim, fontSize: 12,
            }}>
              <strong style={{ color: B.text }}>{selected[0]}</strong> is your primary trade.
              {selected.length > 1 && ` You also picked ${selected.length - 1} specialization${selected.length > 2 ? 's' : ''}.`}
            </div>
          )}

          <div style={{
            marginTop: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <GhostButton onClick={skip}>Skip for now</GhostButton>
            <PrimaryButton disabled={selected.length === 0 || busy} onClick={submit}>
              Continue <Icon name="arrow-r" size={14} stroke={2.4}/>
            </PrimaryButton>
          </div>
        </div>

        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <Photo kind="frame" label="for the ones who build" height="100%"/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(42,31,23,0.2), rgba(42,31,23,0.7))',
          }}/>
          <div style={{
            position: 'absolute', left: 56, bottom: 64, color: '#fff', maxWidth: 400,
          }}>
            <div style={{
              color: '#fff', opacity: 0.85, fontSize: 12,
              fontStyle: 'italic', marginBottom: 16,
            }}>
              Smith — for makers
            </div>
            <div className="serif" style={{
              fontSize: 38, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.025em',
            }}>
              The work is the résumé.
            </div>
            <div style={{
              fontSize: 15, color: 'rgba(255,255,255,0.85)',
              marginTop: 18, lineHeight: 1.6,
            }}>
              A network for the people behind the build — carpenters, electricians, masons, GCs. Connect by the projects you've stood on, not just the titles you've held.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
