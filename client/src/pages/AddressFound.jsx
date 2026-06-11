// Smith — Address found / confirm-your-home (homeowner-acquisition step 3)
//
// Route: /home/:id/confirm — authed (homeowner only). Loads the seed home
// the user just minted, shows the auto-pulled imagery + facts grid, and
// asks them to confirm or kick into manual edit mode for the facts.
//
// On confirm: PATCH /api/homes/:id with confirm:true → navigate to
// /home/:id (the seed dashboard).

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { Photo } from '../components/Primitives.jsx';
import { ChromeWordmark } from '../components/HomeownerEntry.jsx';
import { useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';

function formatPrice(n) {
  if (!n) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n / 1000)}k`;
}

function deriveFacts(home) {
  const bedBath = (home.bedrooms != null || home.bathrooms != null)
    ? `${home.bedrooms ?? '—'} · ${home.bathrooms ?? '—'}`
    : null;
  const lastSold = home.last_sold_date
    ? `${home.last_sold_date}${home.last_sold_price ? ' · ' + formatPrice(home.last_sold_price) : ''}`
    : null;
  const roof = home.roof_material
    ? `${home.roof_material}${home.roof_year ? ' · ~' + home.roof_year : ''}`
    : null;
  return [
    { k: 'year_built',  l: 'Year built',  v: home.year_built },
    { k: 'square_feet', l: 'Square feet', v: home.square_feet ? home.square_feet.toLocaleString() : null },
    { k: 'bed_bath',    l: 'Bed · bath',  v: bedBath },
    { k: 'lot_acres',   l: 'Lot',         v: home.lot_acres ? `${home.lot_acres} ac` : null },
    { k: 'stories',     l: 'Stories',     v: home.stories },
    { k: 'last_sold',   l: 'Last sold',   v: lastSold },
    { k: 'roof',        l: 'Roof',        v: roof },
    { k: 'heating',     l: 'Heating',     v: home.heating },
  ];
}

export function AddressFoundPage({ id }) {
  const { navigate } = useRouter();
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { home } = await api.get(`/homes/${id}`);
        if (!cancelled) setHome(home);
      } catch (e) {
        if (!cancelled) setError(e.data?.error || 'Could not load your home.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      // Save any pending edits + flip confirm in one PATCH.
      const body = { ...edits, confirm: true };
      const { home: updated } = await api.patch(`/homes/${id}`, body);
      navigate(`/home/${updated.id}`);
    } catch (e) {
      setError(e.data?.error || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <PageChrome><div style={{ padding: 80, color: B.faint, fontStyle: 'italic' }}>Loading your home…</div></PageChrome>;
  }
  if (!home) {
    return <PageChrome><div style={{ padding: 80, color: B.danger }}>{error || 'Home not found.'}</div></PageChrome>;
  }

  const facts = deriveFacts(home);
  const displayHome = { ...home, ...edits };

  return (
    <PageChrome>
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40,
      }}>
        <div style={{ width: '100%', maxWidth: 920 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: B.accentSoft, color: B.accent,
              padding: '5px 12px', borderRadius: 100,
              fontSize: 11.5, fontWeight: 600, marginBottom: 14,
            }}>
              <Icon name="check" size={12} stroke={3}/> Found it — pulled from public records
            </div>
            <h1 className="serif" style={{
              margin: 0, fontSize: 34, fontWeight: 600, letterSpacing: '-0.025em',
            }}>Is this your home?</h1>
            <p style={{ color: B.dim, fontSize: 14, margin: '8px 0 0', fontStyle: 'italic' }}>
              We assembled this from county records and street imagery. You can fix anything that's off.
            </p>
          </div>

          <div style={{
            background: B.surface, border: `1px solid ${B.line}`, borderRadius: 10,
            overflow: 'hidden', boxShadow: '0 12px 40px rgba(42,31,23,0.10)',
          }}>
            {/* Imagery band */}
            <div style={{ position: 'relative', height: 300 }}>
              <Photo kind="frame" height="100%"/>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(42,31,23,0) 55%, rgba(42,31,23,0.55))',
              }}/>
              <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6 }}>
                {['Street view · 2024', '3 photos found'].map(c => (
                  <span key={c} style={{
                    background: 'rgba(14,19,16,0.6)', backdropFilter: 'blur(6px)',
                    color: '#fff', fontSize: 11, fontWeight: 600,
                    padding: '5px 10px', borderRadius: 100,
                  }}>{c}</span>
                ))}
              </div>
              <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', gap: 6 }}>
                {['detail', 'workshop', 'concrete'].map((k, i) => (
                  <div key={i} style={{
                    width: 56, height: 42, borderRadius: 4, overflow: 'hidden',
                    border: '2px solid rgba(255,255,255,0.6)',
                  }}>
                    <Photo kind={k} height={42}/>
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', left: 18, bottom: 16, color: '#fff' }}>
                <div className="serif" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  {displayHome.address_line1}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {displayHome.city}, {displayHome.state} {displayHome.postal_code}
                  {displayHome.neighborhood && ` · ${displayHome.neighborhood}`}
                </div>
              </div>
            </div>

            {/* Facts band */}
            <div style={{ padding: '22px 26px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <h3 className="serif" style={{
                  margin: 0, fontSize: 16, fontWeight: 600, color: B.text,
                }}>What we already know</h3>
                <span style={{ color: B.faint, fontSize: 11.5, fontStyle: 'italic' }}>
                  {displayHome.facts_source_attribution || 'Salt Lake County Assessor'}
                </span>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
              }}>
                {facts.map(f => (
                  <div key={f.k} style={{
                    background: B.bg, border: `1px solid ${B.line}`,
                    borderRadius: 6, padding: '11px 13px',
                  }}>
                    <div style={{ color: B.faint, fontSize: 10.5, fontStyle: 'italic' }}>{f.l}</div>
                    {editMode ? (
                      <input
                        defaultValue={f.v ?? ''}
                        onChange={(e) => {
                          // Persist via PATCH on confirm; just stage in `edits` for now.
                          const col = ({
                            year_built:  'year_built',
                            square_feet: 'square_feet',
                            bed_bath:    null,           // composite — edit each below
                            lot_acres:   'lot_acres',
                            stories:     'stories',
                            last_sold:   null,
                            roof:        null,
                            heating:     'heating',
                          })[f.k];
                          if (col) {
                            const val = e.target.value === '' ? null
                              : ['year_built','square_feet'].includes(col) ? parseInt(e.target.value, 10)
                              : col === 'lot_acres' ? parseFloat(e.target.value)
                              : e.target.value;
                            setEdits(prev => ({ ...prev, [col]: val }));
                          }
                        }}
                        style={{
                          width: '100%', marginTop: 2,
                          background: B.surface, border: `1px solid ${B.line}`,
                          padding: '4px 6px', borderRadius: 3,
                          fontSize: 14, color: B.text, fontFamily: "'Fraunces', serif",
                          fontWeight: 600,
                        }}/>
                    ) : (
                      <div className="serif" style={{
                        color: f.v ? B.text : B.faint,
                        fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2,
                        fontStyle: f.v ? 'normal' : 'italic',
                      }}>{f.v ?? '—'}</div>
                    )}
                  </div>
                ))}
              </div>
              {error && (
                <div style={{
                  background: B.dangerSoft, color: B.danger,
                  border: `1px solid ${B.danger}`, borderRadius: 6,
                  padding: '8px 12px', marginTop: 14, fontSize: 13,
                }}>{error}</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  onClick={onConfirm}
                  disabled={busy}
                  style={{
                    flex: 1, background: B.text, color: B.surface, border: 'none',
                    padding: '13px', borderRadius: 100,
                    fontSize: 14, fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.7 : 1,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {busy ? 'Saving…' : 'Yes, this is my home'}{' '}
                  <Icon name="arrow-r" size={14} stroke={2.4}/>
                </button>
                <button
                  onClick={() => setEditMode(v => !v)}
                  disabled={busy}
                  style={{
                    background: editMode ? B.accentSoft : 'transparent',
                    color: editMode ? B.accent : B.text,
                    border: `1px solid ${editMode ? B.accent : B.line}`,
                    padding: '13px 22px', borderRadius: 100,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {editMode ? 'Done editing' : "Something's off"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </PageChrome>
  );
}

function PageChrome({ children }) {
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
        <span style={{ color: B.faint, fontSize: 12.5, fontStyle: 'italic' }}>
          Step 2 of 3 · Confirm your home
        </span>
      </header>
      {children}
    </div>
  );
}
