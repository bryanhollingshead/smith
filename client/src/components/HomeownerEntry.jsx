// Smith — Homeowner-entry primitives
// Shared composables for the four homeowner-entry screens:
//   EntryShell    — the two-pane public chrome (header + form + side panel)
//   EntryInput    — labeled input with leading icon + hint
//   AddressField  — live address autocomplete (calls /api/places/autocomplete)
//   LockedModule  — the blurred-photo "what you'll unlock" card
//   ChromeWordmark — direction-B wordmark for the public chrome

import React, { useEffect, useRef, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { Photo } from './Primitives.jsx';
import { useRouter } from '../lib/router.jsx';

// Direction-B wordmark — upright Fraunces 600 with a period dot, matching
// Landing.jsx's Wordmark. Lives here so the public chrome is self-contained.
export function ChromeWordmark({ size = 22 }) {
  return (
    <div className="serif" style={{
      fontSize: size, fontWeight: 600, letterSpacing: '-0.02em', color: B.text,
    }}>
      Smith<span style={{ color: B.accent }}>.</span>
    </div>
  );
}

// ── EntryShell ────────────────────────────────────────────────────────────
// Public chrome for the pre-auth entry screens. Two-column at desktop;
// collapses to a single column at ≤900px (image panel hides).
export function EntryShell({ children, side, sideKind = 'frame', maxW = 480 }) {
  const { navigate } = useRouter();
  const [twoCol, setTwoCol] = useState(typeof window !== 'undefined' ? window.innerWidth > 900 : true);

  useEffect(() => {
    const onResize = () => setTwoCol(window.innerWidth > 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const showSide = side && twoCol;
  return (
    <div style={{
      background: B.bg, color: B.text, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '18px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${B.line}`,
        background: B.bg,
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        }}>
          <ChromeWordmark/>
        </button>
        <span style={{ color: B.faint, fontSize: 12.5 }}>
          Already have an account?{' '}
          <button onClick={() => navigate('/auth/signin')} style={{
            background: 'transparent', border: 'none', padding: 0,
            color: B.accent, fontWeight: 600, cursor: 'pointer', fontSize: 12.5,
          }}>Sign in</button>
        </span>
      </header>
      <main style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: showSide ? '1fr 1fr' : '1fr',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: showSide ? 'flex-end' : 'center',
          padding: '48px 56px',
        }}>
          <div style={{ width: '100%', maxWidth: maxW }}>{children}</div>
        </div>
        {showSide && (
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <Photo kind={sideKind} height="100%"/>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(42,31,23,0.2), rgba(42,31,23,0.72))',
            }}/>
            <div style={{
              position: 'absolute', inset: 0, padding: 56,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            }}>
              {side}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── EntryInput ────────────────────────────────────────────────────────────
export function EntryInput({ icon, label, hint, error, value, onChange, disabled, ...rest }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          color: B.dim, fontSize: 12, fontStyle: 'italic',
          display: 'block', marginBottom: 6,
        }}>{label}</label>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: B.surface, border: `1px solid ${error ? B.danger : B.line}`,
        borderRadius: 8, padding: '13px 15px',
        opacity: disabled ? 0.55 : 1,
      }}>
        {icon && <Icon name={icon} size={16} style={{ color: B.dim }}/>}
        <input
          value={value} onChange={onChange} disabled={disabled}
          {...rest}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: B.text, fontSize: 15, fontFamily: 'inherit',
          }}/>
      </div>
      {error && (
        <div style={{ color: B.danger, fontSize: 11.5, marginTop: 6 }}>{error}</div>
      )}
      {hint && !error && (
        <div style={{ color: B.faint, fontSize: 11.5, marginTop: 6, fontStyle: 'italic' }}>{hint}</div>
      )}
    </div>
  );
}

// ── AddressField ──────────────────────────────────────────────────────────
// Driven off /api/places/autocomplete. Picks emit (placeId, full place
// object) via onPick. Initial-focus dropdown opens automatically so the
// design's "first result highlighted" frame appears the moment the
// homeowner hits the screen.
export function AddressField({
  value, onChange, onPick, autoFocus = true, label = "Your home address",
}) {
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [picked, setPicked] = useState(null);
  const inputRef = useRef(null);
  const skipFetch = useRef(false);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      setOpen(true);
    }
  }, [autoFocus]);

  useEffect(() => {
    // External controlled value sync — but skip when we just programmatically
    // set text (after a pick) to avoid re-firing the autocomplete request.
    if (value != null && value !== text) {
      skipFetch.current = true;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (skipFetch.current) { skipFetch.current = false; return; }
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(text)}`);
        if (!res.ok) throw new Error('bad');
        const data = await res.json();
        if (!cancelled) setItems(data.suggestions || []);
      } catch {
        if (!cancelled) setItems([]);
      }
    }, 90);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [text]);

  const pick = (item) => {
    setPicked(item);
    skipFetch.current = true;
    setText(item.main + ', ' + item.sub.split(' · ')[0]);
    setOpen(false);
    onPick?.(item);
  };

  // First non-picked suggestion is "the highlight" — matches the design.
  const highlightId = picked?.place_id || items[0]?.place_id;

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <label style={{
        color: B.dim, fontSize: 12, fontStyle: 'italic',
        display: 'block', marginBottom: 6,
      }}>{label}</label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: B.surface,
        border: `1px solid ${open ? B.accent : B.line}`,
        borderRadius: 8, padding: '13px 15px',
        boxShadow: open ? `0 0 0 3px ${B.accentSoft}` : 'none',
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
      }}>
        <Icon name="mappin" size={16} style={{ color: open ? B.accent : B.dim }}/>
        <input
          ref={inputRef}
          value={text}
          placeholder="Start typing your address…"
          onChange={(e) => {
            setText(e.target.value);
            setPicked(null);
            onChange?.(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} // delay so click on suggestion lands
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: B.text, fontSize: 15, fontFamily: 'inherit',
          }}/>
      </div>
      {open && items.length > 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)',
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8,
          boxShadow: '0 12px 32px rgba(42,31,23,0.14)', overflow: 'hidden', zIndex: 5,
        }}>
          {items.map((a, i) => {
            const isHighlight = a.place_id === highlightId;
            return (
              <div
                key={a.place_id}
                onMouseDown={(e) => { e.preventDefault(); pick(a); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 15px',
                  borderTop: i ? `1px solid ${B.line}` : 'none',
                  background: isHighlight ? B.accentSoft : 'transparent',
                  cursor: 'pointer',
                }}>
                <Icon name="mappin" size={14} style={{ color: isHighlight ? B.accent : B.faint }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ color: B.text, fontSize: 13.5, fontWeight: 600 }}>{a.main}</div>
                  <div style={{ color: B.faint, fontSize: 11.5, fontStyle: 'italic' }}>{a.sub}</div>
                </div>
                {isHighlight && <Icon name="check" size={14} stroke={3} style={{ color: B.accent }}/>}
              </div>
            );
          })}
          <div style={{
            padding: '8px 15px', borderTop: `1px solid ${B.line}`,
            fontSize: 11, color: B.faint, display: 'flex', alignItems: 'center', gap: 6,
            fontStyle: 'italic',
          }}>
            <Icon name="shield" size={11}/> Powered by public address records
          </div>
        </div>
      )}
    </div>
  );
}

// ── LockedModule ──────────────────────────────────────────────────────────
// The blurred-photo "what you'll unlock" card. The CTA is provided by the
// caller and is wired to the relevant unlock subflow (TODOs for now).
export function LockedModule({ title, blurb, unlock, kind, onUnlock, h = 150 }) {
  return (
    <section style={{
      position: 'relative', background: B.surface, border: `1px solid ${B.line}`,
      borderRadius: 8, overflow: 'hidden',
    }}>
      <div style={{ filter: 'blur(3px)', opacity: 0.5, pointerEvents: 'none', height: h }}>
        <Photo kind={kind} height={h}/>
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(251,247,238,0.4), rgba(251,247,238,0.92))',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', padding: 22,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: B.surface, border: `1px solid ${B.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: B.dim, marginBottom: 10,
        }}>
          <Icon name="shield" size={16}/>
        </div>
        <div className="serif" style={{
          color: B.text, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em',
        }}>{title}</div>
        <p style={{
          color: B.dim, fontSize: 12, lineHeight: 1.5,
          margin: '5px 0 12px', maxWidth: 280,
        }}>{blurb}</p>
        <button onClick={onUnlock} style={{
          background: B.accentSoft, color: B.accent,
          border: `1px solid ${B.accent}`,
          padding: '7px 14px', borderRadius: 100,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>{unlock}</button>
      </div>
    </section>
  );
}
