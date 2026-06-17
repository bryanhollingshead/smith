// Smith — Invite tools
//
// Network-side growth affordances. Same backing endpoint
// (POST /api/connections/invites) used from two surfaces:
//   1. <InvitePanel/>  — full panel sitting on the Connections page,
//                        renders form + pending-list together.
//   2. <InviteModal/>  — compact modal triggered from the TopNav avatar
//                        menu so any signed-in user can invite from any
//                        page without navigating.
//
// On a successful invite, optimistically refresh the pending-list — the
// new row appears immediately without a network round-trip. The pending
// list also shows resend + revoke actions per row.

import React, { useEffect, useState, useCallback } from 'react';
import { B } from '../lib/theme.js';
import { api } from '../lib/api.js';
import { Icon } from './Icon.jsx';

// ── Shared form bits ────────────────────────────────────────────────────
function InviteForm({ onSent, dense = false }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    setBusy(true);
    try {
      await api.post('/connections/invites', {
        email: email.trim(),
        message: message.trim() || undefined,
      });
      setOk(`Invite sent to ${email.trim()}.`);
      setEmail(''); setMessage('');
      onSent?.();
    } catch (e) {
      // 409 = already on Smith → softer copy than a generic error
      if (e.status === 409) {
        setErr(`${email.trim()} is already on Smith — try connecting instead.`);
      } else {
        setErr(e.data?.error || e.message || 'Could not send invite.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="their.email@example.com"
        autoComplete="off"
        style={{
          padding: '10px 12px', border: `1px solid ${B.line}`, borderRadius: 6,
          background: B.surface, color: B.text, fontSize: 13,
          fontFamily: 'inherit',
        }}
      />
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={dense
          ? "Optional note (quoted in the email)…"
          : "Optional note — quoted in the email. e.g. 'You're the best tile guy I know.'"}
        rows={dense ? 2 : 3}
        maxLength={500}
        style={{
          padding: '10px 12px', border: `1px solid ${B.line}`, borderRadius: 6,
          background: B.surface, color: B.text, fontSize: 13,
          fontFamily: 'inherit', resize: 'vertical',
        }}
      />
      {err && <div style={{ color: B.danger, fontSize: 12 }}>{err}</div>}
      {ok  && <div style={{ color: '#1c6f3a', fontSize: 12 }}>{ok}</div>}
      <button
        type="submit"
        disabled={busy || !email.trim()}
        style={{
          background: B.text, color: B.surface, border: 'none',
          padding: '10px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600,
          cursor: busy || !email.trim() ? 'not-allowed' : 'pointer',
          opacity: busy || !email.trim() ? 0.55 : 1,
          alignSelf: 'flex-start',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
        {busy ? 'Sending…' : 'Invite to Smith'}{' '}
        {!busy && <Icon name="arrow-r" size={13} stroke={2.4}/>}
      </button>
    </form>
  );
}

// ── Pending invites list (only used by InvitePanel) ─────────────────────
function PendingList({ invites, onChanged }) {
  const onResend = async (id) => {
    try { await api.post(`/connections/invites/${id}/resend`); onChanged?.(); } catch {}
  };
  const onRevoke = async (id) => {
    if (!window.confirm('Revoke this invite? The magic link will stop working.')) return;
    try { await api.delete(`/connections/invites/${id}`); onChanged?.(); } catch {}
  };

  if (!invites?.length) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <h3 className="serif" style={{
        margin: 0, fontSize: 14, color: B.text, fontWeight: 600,
      }}>You've brought in {invites.filter(i => i.status === 'accepted').length} so far</h3>
      <div style={{ color: B.faint, fontSize: 11.5, fontStyle: 'italic', marginTop: 2 }}>
        {invites.length} total sent
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
        {invites.map(inv => {
          const badgeColor =
            inv.status === 'accepted' ? '#1c6f3a' :
            inv.status === 'expired'  ? B.faint :
            inv.status === 'revoked'  ? B.faint :
            B.accent;
          return (
            <div key={inv.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0', borderBottom: `1px solid ${B.line}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: B.text, fontSize: 13, fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{inv.email}</div>
                {inv.message && (
                  <div style={{ color: B.faint, fontSize: 11.5, fontStyle: 'italic', marginTop: 2 }}>
                    "{inv.message}"
                  </div>
                )}
              </div>
              <span style={{
                color: badgeColor, fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{inv.status}</span>
              {inv.status === 'pending' && (
                <>
                  <button onClick={() => onResend(inv.id)} title="Resend invite email" style={{
                    background: 'transparent', border: 'none', color: B.accent,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Resend</button>
                  <button onClick={() => onRevoke(inv.id)} title="Revoke invite" style={{
                    background: 'transparent', border: 'none', color: B.dim,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Revoke</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Full panel — Connections page ──────────────────────────────────────
export function InvitePanel() {
  const [invites, setInvites] = useState([]);

  const refresh = useCallback(() => {
    api.get('/connections/invites')
      .then(d => setInvites(d.invites || []))
      .catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <section style={{
      marginTop: 22, padding: '22px 24px',
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8,
    }}>
      <h2 className="serif" style={{
        margin: 0, fontSize: 18, color: B.text, fontWeight: 600,
        letterSpacing: '-0.01em',
      }}>Bring people to Smith</h2>
      <p style={{ color: B.dim, fontSize: 13, margin: '4px 0 14px', lineHeight: 1.5 }}>
        Invite a tradesperson by email. They'll get a magic-link signup, and
        you'll already be connected the second they join.
      </p>
      <InviteForm onSent={refresh}/>
      <PendingList invites={invites} onChanged={refresh}/>
    </section>
  );
}

// ── Compact modal — TopNav menu trigger ────────────────────────────────
export function InviteModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 20,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8,
          padding: 24, minWidth: 440, maxWidth: 520,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <h3 className="serif" style={{
            margin: 0, fontSize: 17, color: B.text, fontWeight: 600,
          }}>Pass the fire</h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: B.dim, padding: 4,
          }}><Icon name="x" size={16}/></button>
        </div>
        <p style={{ color: B.dim, fontSize: 12.5, margin: '0 0 14px', lineHeight: 1.5 }}>
          Invite a tradesperson by email — they arrive at Smith already
          connected to you.
        </p>
        <InviteForm onSent={onClose} dense/>
      </div>
    </div>
  );
}
