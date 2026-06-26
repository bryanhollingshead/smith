// Smith — Seed dashboard (homeowner home page)
//
// Route: /home/:id — authed. The home's permanent landing page. Orients the
// user around "everything about this house lives here forever" and points
// them at their first project. If they arrived via hire-me, the right rail
// surfaces the pending pro and the describe-the-work entry.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { Avatar, Photo } from '../components/Primitives.jsx';
import { StreetView } from '../components/StreetView.jsx';
import { useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';

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

  const proName = pro ? pro.first_name || pro.name : 'Your pro';
  const proInitials = pro?.initials || '··';
  const proTone = pro?.avatar_tone || 'brick';
  const isFromHireMe = home.entry_source === 'hire-me' && !!home.pending_pro_slug;
  const startProjectHref = isFromHireMe
    ? `/project/new?home=${home.id}&pro=${encodeURIComponent(home.pending_pro_slug)}`
    : `/project/new?home=${home.id}`;

  // Just the seed-home content — the shell (ProjectShell rail + nav +
  // mode toggle) is provided by HomeownerShell. Returning a fragment
  // keeps this component composable inside whatever shell wraps it.
  return (
    <>
      {/* Hero — Street View image with value-estimate chip overlay. */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {(home.latitude != null && home.longitude != null)
          ? <StreetView lat={home.latitude} lng={home.longitude} width={1280} height={260} radius={0}/>
          : <div style={{ height: 240 }}><Photo kind="frame" height="100%"/></div>
        }
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(42,31,23,0.08) 30%, rgba(42,31,23,0.82))',
          pointerEvents: 'none',
        }}/>
        {home.value_estimate != null && (
          <div style={{
            position: 'absolute', top: 18, right: 22,
            background: 'rgba(255,255,255,0.96)',
            border: `1px solid ${B.line}`, borderRadius: 8,
            padding: '10px 14px', minWidth: 180,
            boxShadow: '0 8px 24px rgba(42,31,23,0.18)',
          }}>
            <div style={{
              color: B.dim, fontSize: 10, fontStyle: 'italic',
              letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600,
            }}>Estimated value</div>
            <div className="serif" style={{
              color: B.text, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2,
            }}>{formatPrice(home.value_estimate)}</div>
            {(home.value_estimate_low != null && home.value_estimate_high != null) && (
              <div style={{ color: B.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                {formatPrice(home.value_estimate_low)} – {formatPrice(home.value_estimate_high)}
              </div>
            )}
          </div>
        )}
        <div style={{ position: 'absolute', left: 32, right: 32, bottom: 22 }}>
          <h1 className="serif" style={{
            margin: 0, fontSize: 36, fontWeight: 600, color: '#fff', letterSpacing: '-0.025em',
          }}>{home.address_line1}</h1>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, marginTop: 6 }}>
            {heroFacts(home)}
          </div>
        </div>
      </div>

      {/* Body grid */}
      <div style={{
        padding: '24px 32px', display: 'grid',
        gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'flex-start',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={{
            background: B.surface, border: `1px solid ${B.line}`,
            borderRadius: 8, padding: '32px 36px',
          }}>
            <h2 className="serif" style={{
              margin: '0 0 14px', fontSize: 26, fontWeight: 600,
              color: B.text, letterSpacing: '-0.015em', lineHeight: 1.15,
            }}>Welcome to your home file.</h2>
            <p style={{
              color: B.text, fontSize: 15, lineHeight: 1.6, margin: '0 0 14px',
            }}>
              Everything that happens to this house — projects, scope, who did the work,
              photos behind the walls, what it cost — gets recorded here and stays with
              the address.
            </p>
            <p style={{
              color: B.text, fontSize: 15, lineHeight: 1.6, margin: '0 0 22px',
            }}>
              The next pro you hire walks in already knowing what's there.
            </p>
            {isFromHireMe ? (
              <p style={{
                color: B.dim, fontSize: 13.5, fontStyle: 'italic', margin: 0,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                Start with {proName}, on the right. <Icon name="arrow-r" size={13} stroke={2}/>
              </p>
            ) : (
              <button
                onClick={() => navigate(startProjectHref)}
                style={{
                  background: B.text, color: B.surface, border: 'none',
                  padding: '12px 22px', borderRadius: 100,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                Start your first project <Icon name="arrow-r" size={14} stroke={2.4}/>
              </button>
            )}
          </section>
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
              <button
                onClick={() => navigate(startProjectHref)}
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
