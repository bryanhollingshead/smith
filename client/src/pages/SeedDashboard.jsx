// Smith — Seed dashboard (homeowner-acquisition step 4)
//
// Route: /home/:id — authed. The "day one" home profile: sparse real data
// from the records pull, a setup-progress bar derived from filled fields,
// a checklist of next steps, locked future modules as carrots, and a
// right-column "Marcus is ready" card iff the entry path was hire-me.
//
// "Describe the work →" and the locked-module unlock CTAs intentionally
// route to /todo/* placeholders — they're the next handoff's flows.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { Avatar, Photo } from '../components/Primitives.jsx';
import { LockedModule } from '../components/HomeownerEntry.jsx';
import { useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';

// Derive a human checklist from the home row. Two rows can be completed
// programmatically today; the other four are stubs that route to TODO
// flows when ticked. Mirrors the design's row order exactly.
function buildChecklist(home) {
  const hasBasic = !!(
    home.year_built || home.square_feet ||
    home.bedrooms || home.bathrooms ||
    home.lot_acres || home.stories ||
    home.last_sold_date || home.last_sold_price ||
    home.roof_material || home.heating
  );
  return [
    {
      key: 'confirm',
      done: !!home.confirmed_at,
      t: 'Confirm your address',
      s: 'Pulled from public records',
      pts: '',
    },
    {
      key: 'basic',
      done: hasBasic,
      t: 'Basic facts auto-imported',
      s: 'Year, sqft, beds, baths',
      pts: '',
    },
    {
      key: 'systems', done: false, hot: true,
      t: 'Add your systems',
      s: 'Electrical, plumbing, HVAC, roof age',
      pts: 'Unlocks maintenance',
      go: '/todo/add-systems',
    },
    {
      key: 'project', done: false,
      t: 'Log a past project',
      s: "Even a rough one — builds your value model",
      pts: 'Unlocks value & equity',
      go: '/todo/log-project',
    },
    {
      key: 'photos', done: false,
      t: 'Upload a few photos',
      s: 'Rooms, exterior, anything behind walls',
      pts: 'Unlocks photo vault',
      go: '/todo/upload-photos',
    },
    {
      key: 'trade', done: false,
      t: 'Connect a trade you trust',
      s: 'The pros who already know your house',
      pts: 'Unlocks fast bidding',
      go: '/todo/connect-trade',
    },
  ];
}

function formatPrice(n) {
  if (!n) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n / 1000)}k`;
}

function heroFacts(home) {
  const parts = [];
  if (home.neighborhood) parts.push(home.neighborhood);
  if (home.year_built) parts.push(`Built ${home.year_built}`);
  if (home.square_feet) parts.push(`${home.square_feet.toLocaleString()} sqft`);
  if (home.bedrooms != null || home.bathrooms != null) {
    parts.push(`${home.bedrooms ?? '—'} bd / ${home.bathrooms ?? '—'} ba`);
  }
  return parts.join(' · ');
}

export function SeedDashboardPage({ id }) {
  const { navigate } = useRouter();
  const [home, setHome] = useState(null);
  const [pro, setPro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { home } = await api.get(`/homes/${id}`);
        if (cancelled) return;
        setHome(home);
        if (home.entry_source === 'hire-me' && home.pending_pro_slug) {
          try {
            const res = await fetch(`/api/public/profiles/${encodeURIComponent(home.pending_pro_slug)}`);
            if (res.ok) {
              const data = await res.json();
              if (!cancelled) setPro(data.profile);
            }
          } catch { /* non-fatal */ }
        }
      } catch (e) {
        if (!cancelled) setError(e.data?.error || 'Could not load your home.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const patchFact = async (col, val) => {
    try {
      const { home: updated } = await api.patch(`/homes/${id}`, { [col]: val });
      setHome(updated);
    } catch (e) {
      console.error('patch fact failed:', e);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: B.bg, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: B.faint, fontStyle: 'italic',
      }}>Loading your home…</div>
    );
  }
  if (!home) {
    return (
      <div style={{ background: B.bg, minHeight: '100vh', padding: 80, color: B.danger }}>
        {error || 'Home not found.'}
      </div>
    );
  }

  const checklist = buildChecklist(home);
  const proName = pro ? pro.first_name || pro.name : 'Your pro';
  const proInitials = pro?.initials || '··';
  const proTone = pro?.avatar_tone || 'brick';
  const isFromHireMe = home.entry_source === 'hire-me' && !!home.pending_pro_slug;
  const detailsRemainingForUnlock = Math.max(0, 7 - home.progress.added); // arbitrary "next milestone"

  // Just the seed-home content — the shell (ProjectShell rail + nav +
  // mode toggle) is provided by HomeownerShell. Returning a fragment
  // keeps this component composable inside whatever shell wraps it.
  return (
    <>
      {/* Hero */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        <Photo kind="frame" height="100%"/>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(42,31,23,0.08) 30%, rgba(42,31,23,0.82))',
        }}/>
        <div style={{ position: 'absolute', left: 32, right: 32, bottom: 22 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
            color: '#fff', padding: '5px 11px', borderRadius: 100,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 12,
          }}>
            <Icon name="check" size={11} stroke={3}/> HOME PROFILE STARTED
          </div>
          <h1 className="serif" style={{
            margin: 0, fontSize: 36, fontWeight: 600, color: '#fff', letterSpacing: '-0.025em',
          }}>{home.address_line1}</h1>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, marginTop: 6 }}>
            {heroFacts(home)}
          </div>
        </div>
      </div>

      {/* Progress band */}
      <div style={{
        background: B.surface, borderBottom: `1px solid ${B.line}`,
        padding: '18px 32px', display: 'flex', alignItems: 'center', gap: 22,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span className="serif" style={{ color: B.text, fontSize: 15, fontWeight: 600 }}>
              Your home profile is {home.progress.pct}% complete
            </span>
            <span style={{ color: B.dim, fontSize: 12.5, fontStyle: 'italic' }}>
              {home.progress.added} of {home.progress.total} details added
            </span>
          </div>
          <div style={{
            height: 7, background: B.bg, borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              width: `${home.progress.pct}%`, height: '100%', background: B.accent,
              transition: 'width 220ms ease',
            }}/>
          </div>
        </div>
        <button
          onClick={() => navigate('/todo/add-systems')}
          style={{
            background: B.accent, color: '#fff', border: 'none',
            padding: '11px 18px', borderRadius: 100,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          Add {detailsRemainingForUnlock} details → unlock value
        </button>
      </div>

      {/* Body grid */}
      <div style={{
        padding: '24px 32px', display: 'grid',
        gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'flex-start',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Checklist */}
          <section style={{
            background: B.surface, border: `1px solid ${B.line}`,
            borderRadius: 8, padding: '22px 26px',
          }}>
            <h2 className="serif" style={{
              margin: '0 0 4px', fontSize: 20, fontWeight: 600,
              color: B.text, letterSpacing: '-0.01em',
            }}>Build out your home</h2>
            <p style={{
              color: B.dim, fontSize: 12.5, fontStyle: 'italic', margin: '0 0 18px',
            }}>Each step unlocks more of your dashboard. Do them in any order, anytime.</p>
            {checklist.map((step, i) => (
              <div key={step.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '12px 0', borderTop: i ? `1px dashed ${B.line}` : 'none',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: step.done ? B.accent : 'transparent',
                  border: `1.5px solid ${step.done ? B.accent : B.line}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>
                  {step.done && <Icon name="check" size={12} stroke={3} style={{ color: '#fff' }}/>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="serif" style={{
                      color: B.text, fontSize: 14.5, fontWeight: 600,
                      letterSpacing: '-0.01em',
                      textDecoration: step.done ? 'line-through' : 'none',
                      opacity: step.done ? 0.55 : 1,
                    }}>{step.t}</span>
                    {step.hot && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                        color: B.accent, background: B.accentSoft,
                        padding: '2px 6px', borderRadius: 2,
                      }}>DO NEXT</span>
                    )}
                  </div>
                  <div style={{ color: B.dim, fontSize: 12, fontStyle: 'italic', marginTop: 1 }}>
                    {step.s}
                  </div>
                </div>
                {step.pts && !step.done && (
                  <button
                    onClick={() => step.go && navigate(step.go)}
                    style={{
                      color: B.accent, fontSize: 11, fontWeight: 600, fontStyle: 'italic',
                      whiteSpace: 'nowrap', marginTop: 2,
                      background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                    }}>{step.pts}</button>
                )}
              </div>
            ))}
          </section>

          {/* Locked future modules */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <h2 className="serif" style={{
                margin: 0, fontSize: 18, fontWeight: 600,
                color: B.text, letterSpacing: '-0.01em',
              }}>What you'll unlock</h2>
              <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
                · a glimpse of where this goes
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LockedModule
                kind="kitchen" title="Value & equity"
                blurb="Live home value, equity, and pre-qualified credit to fund projects."
                unlock="Log a project to unlock"
                onUnlock={() => navigate('/todo/log-project')}/>
              <LockedModule
                kind="detail" title="Behind the walls"
                blurb="Every photo your trades take before drywall — pinned to your floor plan."
                unlock="Add photos to unlock"
                onUnlock={() => navigate('/todo/upload-photos')}/>
              <LockedModule
                kind="workshop" title="Smart maintenance"
                blurb="Material-aware care schedule tuned to what's actually in your home."
                unlock="Add systems to unlock"
                onUnlock={() => navigate('/todo/add-systems')}/>
              <LockedModule
                kind="concrete" title="Instant bidding"
                blurb="Fast, accurate estimates from pros — because your spec writes itself."
                unlock="Connect a trade to unlock"
                onUnlock={() => navigate('/todo/connect-trade')}/>
            </div>
          </div>
        </div>

        {/* Right column */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isFromHireMe && (
            <section style={{
              background: B.accentSoft, border: `1px solid ${B.accent}`,
              borderRadius: 8, padding: '18px 20px',
            }}>
              <div style={{
                color: B.accent, fontSize: 11, fontStyle: 'italic',
                fontWeight: 600, marginBottom: 10,
              }}>YOUR FIRST PROJECT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar tone={proTone} initials={proInitials} size={44}/>
                <div style={{ flex: 1 }}>
                  <div className="serif" style={{ color: B.text, fontSize: 15, fontWeight: 600 }}>
                    {proName} is ready
                  </div>
                  <div style={{ color: B.dim, fontSize: 12, fontStyle: 'italic' }}>
                    Waiting on your project details
                  </div>
                </div>
              </div>
              {/* TODO: describe-the-work flow (separate handoff) */}
              <button
                onClick={() => navigate(`/todo/describe-work?pro=${encodeURIComponent(home.pending_pro_slug)}&home=${home.id}`)}
                style={{
                  width: '100%', marginTop: 14, background: B.text, color: B.surface,
                  border: 'none', padding: '11px', borderRadius: 100,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                Describe the work →
              </button>
            </section>
          )}

          <section style={{
            background: B.surface, border: `1px solid ${B.line}`,
            borderRadius: 8, padding: '20px 22px',
          }}>
            <h3 className="serif" style={{
              margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: B.text,
            }}>From public records</h3>
            <p style={{ color: B.dim, fontSize: 12, fontStyle: 'italic', margin: '0 0 14px' }}>
              We started you off with what's public. Confirm or correct each.
            </p>
            <PublicFactRow label="Year built" value={home.year_built} onSave={(v) => patchFact('year_built', v ? parseInt(v, 10) : null)} top/>
            <PublicFactRow label="Square feet" value={home.square_feet} onSave={(v) => patchFact('square_feet', v ? parseInt(v, 10) : null)}/>
            <PublicFactRow
              label="Bed · bath"
              value={(home.bedrooms != null || home.bathrooms != null) ? `${home.bedrooms ?? '—'} · ${home.bathrooms ?? '—'}` : null}
              readOnly
            />
            <PublicFactRow
              label="Last sold"
              value={home.last_sold_date ? `${home.last_sold_date}${home.last_sold_price ? ' · ' + formatPrice(home.last_sold_price) : ''}` : null}
              readOnly
            />
          </section>

          <section style={{
            background: B.surface, border: `1px solid ${B.line}`,
            borderRadius: 8, padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="shield" size={18} style={{ color: B.accent, marginTop: 2, flexShrink: 0 }}/>
              <div>
                <div className="serif" style={{ color: B.text, fontSize: 14, fontWeight: 600 }}>
                  Your home, your data
                </div>
                <p style={{ color: B.dim, fontSize: 12, lineHeight: 1.55, margin: '4px 0 0' }}>
                  Nothing here is public. You choose which pros see what, project by project. Export or delete anytime.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

// Inline-editable fact row for the "From public records" card.
function PublicFactRow({ label, value, onSave, readOnly, top }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderTop: top ? 'none' : `1px dashed ${B.line}`,
    }}>
      <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>{label}</span>
      {editing && !readOnly ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { setEditing(false); onSave?.(draft); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); onSave?.(draft); } }}
            autoFocus
            style={{
              width: 110, background: B.bg, border: `1px solid ${B.accent}`,
              borderRadius: 3, padding: '3px 6px', fontSize: 13,
              color: B.text, fontFamily: 'inherit',
            }}/>
        </span>
      ) : (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: value ? B.text : B.faint, fontSize: 13, fontWeight: 600,
          fontStyle: value ? 'normal' : 'italic',
        }}>
          {value ?? '—'}
          {!readOnly && (
            <button onClick={() => setEditing(true)} style={{
              background: 'transparent', border: 'none',
              color: B.accent, cursor: 'pointer', padding: 0, display: 'inline-flex',
            }}><Icon name="edit" size={12}/></button>
          )}
        </span>
      )}
    </div>
  );
}
