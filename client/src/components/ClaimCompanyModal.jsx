// Smith — Claim Company modal
//
// Three states, decided after fetching claim-state + workers:
//   1. The viewer already has a pending claim → show progress + cosigns.
//   2. The viewer is the only Smith worker on this company → offer immediate
//      claim via POST /companies/:id/claim (solo case).
//   3. Other workers exist → cosigner picker + POST /companies/:id/claim-request.
//
// Plain language by design: "steward" instead of "owner", "confirm" instead
// of "witness." The substance carries the gravitas; the words don't strain
// for it.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { SmithAvatar } from './SmithAvatar.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';

export function ClaimCompanyModal({ company, onClose, onChanged }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [claimState, setClaimState] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [state, ws] = await Promise.all([
          api.get(`/companies/${company.id}/claim-state`),
          api.get(`/companies/${company.id}/workers`),
        ]);
        if (cancelled) return;
        setClaimState(state);
        setWorkers(ws.workers);
      } catch (e) {
        if (!cancelled) setError(e.data?.error || 'Could not load claim details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [company.id]);

  const toggle = (id) => {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const claimSolo = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/companies/${company.id}/claim`);
      onChanged?.();
      onClose?.();
    } catch (e) {
      setError(e.data?.error || 'Could not claim the company.');
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/companies/${company.id}/claim-request`, {
        cosigner_user_ids: [...selected],
      });
      onChanged?.();
      onClose?.();
    } catch (e) {
      setError(e.data?.error || 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  // Already claimed? Should rarely land here, but render a clear state.
  const claimed = claimState?.claimed_by;
  const pending = claimState?.pending_request;
  const isMyPending = !!(pending && user && pending.requester?.id === user.id);
  const otherPending = !!(pending && !isMyPending);
  const solo = !claimed && !pending && workers.length === 0;
  const pickerMode = !claimed && !pending && workers.length > 0;

  return (
    <div onClick={onClose} style={overlay} className="fade-in">
      <div onClick={e => e.stopPropagation()} style={panel}>
        <header style={header}>
          <div className="serif" style={title}>Claim {company.name}</div>
          <button onClick={onClose} style={closeBtn}><Icon name="x" size={18}/></button>
        </header>

        <div className="scroll-thin" style={body}>
          {loading && (
            <div style={muted}>Loading…</div>
          )}

          {!loading && claimed && (
            <div style={{ color: B.text, fontSize: 14, lineHeight: 1.55 }}>
              This company has already been claimed by{' '}
              <span style={{ fontWeight: 600 }}>{claimed.name || 'another user'}</span>.
            </div>
          )}

          {!loading && !claimed && pending && isMyPending && (
            <>
              <p style={lede}>
                Your claim is in. Waiting for{' '}
                <strong>{pending.confirms}</strong> of{' '}
                <strong>{pending.min_cosigns}</strong> confirmation
                {pending.min_cosigns === 1 ? '' : 's'}.
              </p>
              <CosignList items={pending.cosigns}/>
            </>
          )}

          {!loading && !claimed && otherPending && (
            <>
              <p style={lede}>
                <strong>{pending.requester?.name || 'Someone else'}</strong> has
                an open claim for this company —{' '}
                <strong>{pending.confirms}</strong> of{' '}
                <strong>{pending.min_cosigns}</strong> confirmation
                {pending.min_cosigns === 1 ? '' : 's'} so far.
              </p>
              <p style={muted}>
                If you were named as a cosigner, you'll find it in your alerts.
              </p>
              <CosignList items={pending.cosigns}/>
            </>
          )}

          {!loading && solo && (
            <>
              <p style={lede}>
                You're the only Smith user who's listed this company. You can
                claim it directly — there's no one else to confirm.
              </p>
              <p style={muted}>
                As steward, you'll be the person who edits the company's page.
              </p>
            </>
          )}

          {!loading && pickerMode && (
            <>
              <p style={lede}>
                Pick someone else who's worked here. They'll get a notification
                and can confirm or decline.
              </p>
              <p style={muted}>
                As steward, you'll be the person who edits the company's page.
                One confirmation is needed.
              </p>
              <div style={{ marginTop: 14 }}>
                {workers.map(w => {
                  const on = selected.has(w.id);
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggle(w.id)}
                      style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px',
                        background: on ? B.accentSoft : B.bg,
                        border: `1px solid ${on ? B.accent : B.line}`,
                        borderRadius: 4, marginBottom: 8,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <SmithAvatar
                        urls={w.avatar_urls}
                        initials={w.initials}
                        size={36}
                        tone={w.avatar_tone || 'wood'}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: B.text, fontSize: 14, fontWeight: 600 }}>{w.name}</div>
                        {w.headline && (
                          <div style={{
                            color: B.dim, fontSize: 12,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{w.headline}</div>
                        )}
                      </div>
                      {on && <Icon name="check" size={16} style={{ color: B.accent }}/>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {error && (
            <div style={{
              marginTop: 12, color: B.danger, fontSize: 13,
              background: B.bg, border: `1px solid ${B.danger}`, borderRadius: 4,
              padding: '10px 14px',
            }}>{error}</div>
          )}
        </div>

        <footer style={footer}>
          <button onClick={onClose} style={ghostBtn} disabled={busy}>
            {claimed || (pending && isMyPending) ? 'Close' : 'Cancel'}
          </button>
          {solo && (
            <button onClick={claimSolo} disabled={busy} style={primaryBtn(true)}>
              {busy ? 'Claiming…' : 'Claim this company'}
            </button>
          )}
          {pickerMode && (
            <button
              onClick={sendRequest}
              disabled={busy || selected.size === 0}
              style={primaryBtn(selected.size > 0 && !busy)}
            >
              {busy ? 'Sending…' : `Send request${selected.size > 1 ? ` (${selected.size})` : ''}`}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function CosignList({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      {items.map(c => (
        <div key={c.user_id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 12px',
          background: B.bg, border: `1px solid ${B.line}`,
          borderRadius: 4, marginBottom: 6,
        }}>
          <SmithAvatar
            urls={c.avatar_urls}
            initials={(c.name?.[0] || '').toUpperCase()}
            size={32}
            tone={c.avatar_tone || 'wood'}
          />
          <div style={{ flex: 1, color: B.text, fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
          <span style={decisionTag(c.decision)}>
            {c.decision === 'confirm' ? 'Confirmed'
              : c.decision === 'decline' ? 'Declined'
              : 'Pending'}
          </span>
        </div>
      ))}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(42,31,23,0.4)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const panel = {
  background: B.surface, border: `1px solid ${B.line}`, borderRadius: 6,
  width: '100%', maxWidth: 520, maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
};
const header = {
  padding: '18px 24px', display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', borderBottom: `1px solid ${B.line}`,
};
const title = { fontSize: 18, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' };
const closeBtn = {
  background: 'transparent', border: 'none', color: B.dim, cursor: 'pointer', padding: 4,
};
const body = { padding: '20px 24px', overflowY: 'auto', flex: 1 };
const footer = {
  padding: '14px 24px', borderTop: `1px solid ${B.line}`,
  display: 'flex', justifyContent: 'flex-end', gap: 10,
};
const lede = { color: B.text, fontSize: 14, lineHeight: 1.55, margin: 0 };
const muted = { color: B.dim, fontSize: 13, marginTop: 8 };
const ghostBtn = {
  background: 'transparent', border: 'none', color: B.dim,
  padding: '9px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const primaryBtn = (enabled) => ({
  background: enabled ? B.text : B.surface2,
  border: enabled ? 'none' : `1px solid ${B.line}`,
  color: enabled ? B.surface : B.faint,
  padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600,
  cursor: enabled ? 'pointer' : 'not-allowed',
});
const decisionTag = (decision) => ({
  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  padding: '3px 8px', borderRadius: 100,
  color: decision === 'confirm' ? B.accent
       : decision === 'decline' ? B.danger
       : B.dim,
  background: decision === 'confirm' ? B.accentSoft : B.bg,
  border: decision === 'pending' ? `1px dashed ${B.line}` : 'none',
});
