// Smith — Admin tools (founder-only)
//
// Surfaces two admin-only affordances that target is_demo accounts ONLY:
//   1. View as demo (impersonation) — swaps the JWT to a target demo so the
//      admin lands in that demo's session. Original token is stashed under
//      smith.token.admin so the ImpersonationBanner can restore it.
//   2. Set demo password — sets a known password on a demo so the admin can
//      sign in fresh on another browser to test login flows.
//
// All buttons here are inert for non-admins (they're rendered conditionally
// in TopNav based on user.is_admin), and every server route enforces both
// is_admin and is_demo independently — the UI is convenience, not security.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { api, auth } from '../lib/api.js';
import { Icon } from './Icon.jsx';
import { SmithAvatar } from './SmithAvatar.jsx';

const ADMIN_TOKEN_KEY = 'smith.token.admin';

export function isImpersonating() {
  return !!localStorage.getItem(ADMIN_TOKEN_KEY);
}

// ── Drop-in menu items for TopNav's avatar dropdown ─────────────────────
// onPick is invoked with the modal kind to open ('view-as' | 'set-password').
export function AdminMenuItems({ onPick }) {
  return (
    <>
      <div style={{
        padding: '6px 12px 4px', color: B.faint, fontSize: 10,
        fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>Admin</div>
      <MenuItem icon="users"  onClick={() => onPick('view-as')}>View as demo…</MenuItem>
      <MenuItem icon="shield" onClick={() => onPick('set-password')}>Set demo password…</MenuItem>
      <MenuItem icon="trash"  onClick={() => onPick('delete-user')}>Delete user…</MenuItem>
    </>
  );
}

// ── Modal host ──────────────────────────────────────────────────────────
// One component renders whichever modal is active so TopNav only needs to
// track a single open/close state.
export function AdminModals({ kind, onClose }) {
  if (kind === 'view-as')      return <ViewAsModal onClose={onClose}/>;
  if (kind === 'set-password') return <SetPasswordModal onClose={onClose}/>;
  if (kind === 'delete-user')  return <DeleteUserModal onClose={onClose}/>;
  return null;
}

// ── Sticky banner that shows while impersonating ────────────────────────
// Mounted globally. Renders only when smith.token.admin exists.
export function ImpersonationBanner() {
  const [active, setActive] = useState(isImpersonating());
  const [identity, setIdentity] = useState(null);

  useEffect(() => {
    setActive(isImpersonating());
    if (!isImpersonating()) { setIdentity(null); return; }
    let cancelled = false;
    api.get('/auth/me')
      .then(d => { if (!cancelled) setIdentity(d.user); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!active) return null;

  const onReturn = () => {
    const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (adminToken) auth.set(adminToken);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    // Hard reload so every component re-reads /auth/me cleanly.
    window.location.assign('/');
  };

  const label = identity
    ? `${identity.first_name || ''} ${identity.last_name || ''}`.trim() || identity.email
    : 'demo account';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: '#7a2a0f', color: '#fff',
      padding: '8px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 14, fontSize: 13, fontWeight: 500,
      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    }}>
      <Icon name="eye" size={14}/>
      <span>Viewing as <strong>{label}</strong> (demo)</span>
      <button onClick={onReturn} style={{
        background: '#fff', color: '#7a2a0f', border: 'none',
        padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700,
        cursor: 'pointer',
      }}>Return to admin</button>
    </div>
  );
}

// ── View-as modal ───────────────────────────────────────────────────────
function ViewAsModal({ onClose }) {
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/admin/demo-users')
      .then(d => { if (!cancelled) setUsers(d.users); })
      .catch(e => { if (!cancelled) setErr(e.message || 'Failed to load demos'); });
    return () => { cancelled = true; };
  }, []);

  const onPick = async (u) => {
    setBusyId(u.id);
    setErr('');
    try {
      const data = await api.post(`/admin/users/${u.id}/impersonate`);
      const current = auth.get();
      // Stash the admin token before swapping. If we're already impersonating
      // (smith.token.admin already set), keep the ORIGINAL admin token —
      // don't overwrite with a demo's token.
      if (current && !localStorage.getItem(ADMIN_TOKEN_KEY)) {
        localStorage.setItem(ADMIN_TOKEN_KEY, current);
      }
      auth.set(data.token);
      window.location.assign('/');
    } catch (e) {
      setErr(e.message || 'Impersonation failed');
      setBusyId(null);
    }
  };

  return (
    <ModalShell title="View as demo" onClose={onClose}>
      {err && <div style={{ color: '#b00', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {!users && !err && <div style={{ color: B.faint, fontStyle: 'italic', fontSize: 13 }}>Loading…</div>}
      {users && users.length === 0 && (
        <div style={{ color: B.faint, fontStyle: 'italic', fontSize: 13 }}>No demo accounts found.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {users?.map(u => (
          <button
            key={u.id}
            disabled={busyId === u.id}
            onClick={() => onPick(u)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', border: 'none', background: 'transparent',
              textAlign: 'left', borderRadius: 4, cursor: busyId === u.id ? 'wait' : 'pointer',
              opacity: busyId === u.id ? 0.6 : 1,
            }}
            onMouseEnter={e => e.currentTarget.style.background = B.bg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <SmithAvatar
              size={36}
              tone={u.avatar_tone || 'wood'}
              initials={(u.first_name?.[0] || '') + (u.last_name?.[0] || '')}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: B.text, fontSize: 13, fontWeight: 600 }}>
                {u.first_name} {u.last_name}
              </div>
              <div style={{ color: B.dim, fontSize: 11 }}>{u.headline || u.email}</div>
            </div>
            <Icon name="arrow-r" size={14} style={{ color: B.dim }}/>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

// ── Set-password modal ──────────────────────────────────────────────────
function SetPasswordModal({ onClose }) {
  const [users, setUsers] = useState(null);
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/admin/demo-users')
      .then(d => { if (!cancelled) setUsers(d.users); })
      .catch(e => { if (!cancelled) setErr(e.message || 'Failed to load demos'); });
    return () => { cancelled = true; };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await api.post(`/admin/users/${selected.id}/password`, { password });
      setOk(`Password set for ${selected.email}. Sign in with it on a fresh browser to test.`);
      setPassword('');
    } catch (e) {
      setErr(e.message || 'Failed to set password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Set demo password" onClose={onClose}>
      {!users && !err && <div style={{ color: B.faint, fontStyle: 'italic', fontSize: 13 }}>Loading…</div>}
      {users && (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, color: B.dim, fontWeight: 600 }}>
            Demo account
            <select
              value={selected?.id || ''}
              onChange={e => setSelected(users.find(u => u.id === parseInt(e.target.value, 10)) || null)}
              style={{
                width: '100%', marginTop: 4, padding: '8px 10px',
                border: `1px solid ${B.line}`, borderRadius: 4, background: B.surface,
                color: B.text, fontSize: 13,
              }}
              required
            >
              <option value="">Pick a demo…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} — {u.email}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, color: B.dim, fontWeight: 600 }}>
            New password (12+ chars, 1 number)
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%', marginTop: 4, padding: '8px 10px',
                border: `1px solid ${B.line}`, borderRadius: 4, background: B.surface,
                color: B.text, fontSize: 13, fontFamily: 'monospace',
              }}
              required
            />
          </label>
          {err && <div style={{ color: '#b00', fontSize: 12 }}>{err}</div>}
          {ok && <div style={{ color: '#1c6f3a', fontSize: 12 }}>{ok}</div>}
          <button
            type="submit"
            disabled={busy || !selected || !password}
            style={{
              background: B.text, color: B.surface, border: 'none',
              padding: '10px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer', opacity: (busy || !selected || !password) ? 0.5 : 1,
              marginTop: 4,
            }}
          >
            {busy ? 'Setting…' : 'Set password'}
          </button>
        </form>
      )}
    </ModalShell>
  );
}

// ── Delete-user modal ───────────────────────────────────────────────────
// Hard-deletes any user. The picker lists all users; selecting one reveals
// a typed-email confirmation that must match exactly before the danger
// button enables. Admin cannot use this on their own account — the server
// refuses, and the picker filters self out for clarity.
function DeleteUserModal({ onClose }) {
  const [users, setUsers] = useState(null);
  const [selected, setSelected] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/admin/users'), api.get('/auth/me')])
      .then(([list, who]) => {
        if (cancelled) return;
        setUsers(list.users);
        setMe(who.user);
      })
      .catch(e => { if (!cancelled) setErr(e.message || 'Failed to load users'); });
    return () => { cancelled = true; };
  }, []);

  const targetable = users ? users.filter(u => u.id !== me?.id) : null;
  const matches = !!selected
    && confirmEmail.trim().toLowerCase() === selected.email.trim().toLowerCase();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!selected || !matches) return;
    setBusy(true);
    setErr('');
    try {
      await api.delete(`/admin/users/${selected.id}`, { confirmation_email: confirmEmail.trim() });
      onClose();
      // Bust caches — the deleted user shouldn't appear in subsequent pickers.
      // A page reload is heavy but keeps every list (demos, users, etc) in sync.
      window.location.reload();
    } catch (e) {
      setErr(e.data?.error || e.message || 'Delete failed');
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Delete user" onClose={onClose}>
      {err && !busy && <div style={{ color: B.danger, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {!users && !err && <div style={{ color: B.faint, fontStyle: 'italic', fontSize: 13 }}>Loading…</div>}

      {users && (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, color: B.dim, fontWeight: 600 }}>
            User to delete
            <select
              value={selected?.id || ''}
              onChange={e => {
                const u = users.find(x => x.id === parseInt(e.target.value, 10)) || null;
                setSelected(u);
                setConfirmEmail('');
              }}
              style={{
                width: '100%', marginTop: 4, padding: '8px 10px',
                border: `1px solid ${B.line}`, borderRadius: 4, background: B.surface,
                color: B.text, fontSize: 13,
              }}
              required
            >
              <option value="">Pick a user…</option>
              {targetable?.map(u => {
                const flags = [
                  u.is_admin ? 'admin' : null,
                  u.is_demo  ? 'demo'  : null,
                ].filter(Boolean).join(', ');
                return (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} — {u.email}
                    {flags ? ` (${flags})` : ''}
                  </option>
                );
              })}
            </select>
          </label>

          {selected && (
            <>
              {selected.is_admin && (
                <div style={{
                  background: B.dangerSoft, color: B.danger,
                  border: `1px solid ${B.danger}`, borderRadius: 6,
                  padding: '8px 12px', fontSize: 12, lineHeight: 1.5,
                }}>
                  <strong>Heads up:</strong> this user is an admin. The server
                  will refuse if they are the only admin remaining.
                </div>
              )}
              <label style={{ fontSize: 12, color: B.dim, fontWeight: 600 }}>
                Re-type <span style={{ color: B.danger, fontFamily: 'monospace' }}>{selected.email}</span> to confirm
                <input
                  type="text"
                  value={confirmEmail}
                  onChange={e => setConfirmEmail(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    width: '100%', marginTop: 4, padding: '8px 10px',
                    border: `1px solid ${B.line}`, borderRadius: 4, background: B.surface,
                    color: B.text, fontSize: 13, fontFamily: 'monospace',
                  }}
                />
              </label>
            </>
          )}

          {err && busy === false && <div style={{ color: B.danger, fontSize: 12 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                background: 'transparent', color: B.text,
                border: `1px solid ${B.line}`, borderRadius: 100,
                padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!matches || busy}
              style={{
                background: (matches && !busy) ? B.danger : B.faint, color: '#fff', border: 'none',
                borderRadius: 100, padding: '9px 16px', fontSize: 13, fontWeight: 700,
                cursor: (matches && !busy) ? 'pointer' : 'not-allowed',
                opacity: (matches && !busy) ? 1 : 0.6,
              }}>
              {busy ? 'Deleting…' : 'Delete user permanently'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────
function MenuItem({ icon, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: 'transparent', border: 'none',
      color: B.text, fontSize: 13, fontWeight: 500, textAlign: 'left',
      borderRadius: 4, cursor: 'pointer',
    }}
    onMouseEnter={e => e.currentTarget.style.background = B.bg}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Icon name={icon} size={15} style={{ color: B.dim }}/>
      {children}
    </button>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8,
          padding: 22, minWidth: 420, maxWidth: 520, maxHeight: '80vh',
          overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        }}
        className="scroll-thin"
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: B.text }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: B.dim, padding: 4,
          }}><Icon name="x" size={16}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}
