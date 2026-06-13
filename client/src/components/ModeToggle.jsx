// Smith — Mode toggle (Tradesman ↔ Homeowner)
//
// Visual is lifted from ProjectShell.jsx:237-280's "You're viewing as" rail
// card — same icon-circle + tiny italic "Viewing as" / role-label pattern,
// so the two affordances feel like one consistent UI language.
//
// The label for the homeowner side comes from `modeLabel(user)` →
// 'Homeowner' or 'Property manager' depending on hiring_context. Never
// a hardcoded string.
//
// Two visual variants:
//   <ModeToggle variant="pill">     — compact, used in TopNav (tradesman shell)
//   <ModeToggle variant="card">     — full card, used in ProjectShell footer
//                                     (homeowner shell)
//
// First-switch routing: if switchMode() returns needsSetup:true, we route
// to the relevant setup screen. The new shell renders only after the user
// finishes setup, so the toggle isn't "broken" mid-switch.

import React, { useState, useEffect, useRef } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';
import { MODE, modeOf, modeLabel, labelForMode, iconForMode } from '../lib/mode.js';

function roleColor(mode) {
  return mode === MODE.HOMEOWNER ? B.homeowner : B.success;
}

export function ModeToggle({ variant = 'pill' }) {
  const { user, switchMode } = useAuth();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!user) return null;
  const current = modeOf(user);
  const other = current === MODE.HOMEOWNER ? MODE.TRADESMAN : MODE.HOMEOWNER;

  const onPick = async (mode) => {
    if (busy) return;
    setOpen(false);
    if (mode === current) return;
    setBusy(true);
    try {
      const { needsSetup } = await switchMode(mode);
      if (needsSetup) {
        navigate(mode === MODE.HOMEOWNER ? '/mode/setup-homeowner' : '/mode/setup-tradesman');
      }
      // If profile exists, App.jsx re-renders into the new shell on its own
      // when the user state updates.
    } catch (e) {
      console.error('mode switch failed:', e);
    } finally {
      setBusy(false);
    }
  };

  // ── Card variant — sits in ProjectShell rail footer ────────────────────
  if (variant === 'card') {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          disabled={busy}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: B.bg, border: `1px solid ${B.line}`,
            borderRadius: 4, marginBottom: 10, width: '100%',
            cursor: busy ? 'wait' : 'pointer', textAlign: 'left',
          }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: roleColor(current), color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name={iconForMode(current)} size={13}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: B.faint, fontSize: 10, fontStyle: 'italic' }}>
              {busy ? 'Switching…' : "You're viewing as"}
            </div>
            <div style={{ color: B.text, fontSize: 12.5, fontWeight: 600 }}>
              {modeLabel(user)}
            </div>
          </div>
          <Icon name="chevron-d" size={12} style={{ color: B.faint }}/>
        </button>
        {open && <Dropdown user={user} current={current} other={other} onPick={onPick} placement="up"/>}
      </div>
    );
  }

  // ── Pill variant — sits inside TopNav (tradesman shell) ────────────────
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        title="Switch mode"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 10px 5px 5px',
          background: B.bg, border: `1px solid ${B.line}`, borderRadius: 100,
          cursor: busy ? 'wait' : 'pointer', color: B.text,
          fontSize: 12.5, fontFamily: 'inherit',
        }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%',
          background: roleColor(current), color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name={iconForMode(current)} size={11}/>
        </span>
        <span style={{ fontWeight: 600 }}>{modeLabel(user)}</span>
        <Icon name="chevron-d" size={11} style={{ color: B.faint }}/>
      </button>
      {open && <Dropdown user={user} current={current} other={other} onPick={onPick} placement="down"/>}
    </div>
  );
}

function Dropdown({ user, current, other, onPick, placement }) {
  return (
    <div className="fade-in" style={{
      position: 'absolute',
      [placement === 'up' ? 'bottom' : 'top']: '100%',
      [placement === 'up' ? 'marginBottom' : 'marginTop']: 6,
      left: 0, minWidth: 220,
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 6,
      boxShadow: '0 12px 32px rgba(42,31,23,0.14)',
      padding: 6, zIndex: 30,
    }}>
      <div style={{
        color: B.faint, fontSize: 10, letterSpacing: '0.08em',
        textTransform: 'uppercase', fontWeight: 600,
        padding: '6px 10px 4px',
      }}>Switch mode</div>
      <Row user={user} mode={current} active onPick={() => onPick(current)}/>
      <Row user={user} mode={other}            onPick={() => onPick(other)}/>
    </div>
  );
}

function Row({ user, mode, active, onPick }) {
  return (
    <button onClick={onPick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 10px', background: 'transparent', border: 'none',
      borderRadius: 4, color: B.text, textAlign: 'left', cursor: 'pointer',
    }}
    onMouseEnter={e => e.currentTarget.style.background = B.bg}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <span style={{
        width: 24, height: 24, borderRadius: '50%',
        background: roleColor(mode), color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={iconForMode(mode)} size={12}/>
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{labelForMode(user, mode)}</div>
        <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
          {mode === MODE.TRADESMAN ? 'Be found · find work' : 'Find & hire pros'}
        </div>
      </div>
      {active && <Icon name="check" size={13} stroke={3} style={{ color: B.accent }}/>}
    </button>
  );
}
