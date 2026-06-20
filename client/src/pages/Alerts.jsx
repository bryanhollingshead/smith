// Smith — Alerts (notifications) page
// A simple list view of notifications. Marks all read on mount.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { SmithAvatar } from '../components/SmithAvatar.jsx';
import { Icon } from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';

const KIND_LABELS = {
  connection_request: 'Connection request',
  connection_accepted: 'Connection accepted',
  post_like: 'Liked your post',
  post_comment: 'Commented on your post',
  skill_endorse: 'Endorsed your skill',
  company_claim_request: 'is claiming a company you worked at',
  company_claim_granted: 'confirmed your company claim',
};

export function AlertsPage() {
  const { navigate } = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // request_id → 'confirm' | 'decline' once acted on, so the row reflects it
  // without a full reload and the action buttons disappear.
  const [acted, setActed] = useState(() => new Map());
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/notifications');
        if (!cancelled) setItems(data.notifications);
        // Mark read after we've shown them once.
        await api.post('/notifications/read');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const cosign = async (requestId, decision) => {
    setBusyId(requestId);
    try {
      await api.post(`/company-claim-requests/${requestId}/cosign`, { decision });
      setActed(m => new Map(m).set(requestId, decision));
    } catch (e) {
      window.alert(e.data?.error || 'Could not record your decision.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="notifications"/>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 40px' }}>
        <h1 className="serif" style={{
          color: B.text, fontSize: 32, fontWeight: 600, margin: 0,
          letterSpacing: '-0.02em',
        }}>Alerts</h1>
        <p style={{ color: B.dim, fontSize: 14, marginTop: 4 }}>
          Connection requests, replies, and post activity.
        </p>

        <div style={{ marginTop: 24 }}>
          {loading && (
            <div style={{ color: B.faint, fontSize: 13, fontStyle: 'italic', padding: 24 }}>
              Loading…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div style={{
              background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
              padding: 32, textAlign: 'center', color: B.faint, fontSize: 14, fontStyle: 'italic',
            }}>
              All quiet on the jobsite.
            </div>
          )}
          {items.map(n => (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              background: n.read_at ? B.surface : B.accentSoft,
              border: `1px solid ${B.line}`, borderRadius: 4,
              marginBottom: 8,
            }}>
              {n.actor ? (
                <button onClick={() => navigate(`/profile/${n.actor.id}`)} style={{
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%',
                }}>
                  <SmithAvatar
                    urls={n.actor.avatar_urls}
                    initials={n.actor.initials}
                    size={42}
                    tone={n.actor.avatar_tone || 'wood'}
                  />
                </button>
              ) : (
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: B.bg, color: B.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="bell" size={18}/>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: B.text, fontSize: 13.5 }}>
                  {n.actor && (
                    <button onClick={() => navigate(`/profile/${n.actor.id}`)} style={{
                      background: 'transparent', border: 'none', padding: 0,
                      color: B.text, fontWeight: 600, cursor: 'pointer',
                    }} className="serif">{n.actor.name}</button>
                  )}{' '}
                  {n.body || KIND_LABELS[n.kind] || n.kind}
                </div>
                <div style={{ color: B.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                  {relTime(n.created_at)}
                </div>
              </div>
              {n.kind === 'connection_request' && (
                <button onClick={() => navigate('/network')} style={{
                  background: B.text, border: 'none', color: B.surface,
                  padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}>Review</button>
              )}
              {n.kind === 'company_claim_request' && n.subject_id && (
                acted.has(n.subject_id) ? (
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: acted.get(n.subject_id) === 'confirm' ? B.accent : B.dim,
                  }}>
                    {acted.get(n.subject_id) === 'confirm' ? 'Confirmed' : 'Declined'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => cosign(n.subject_id, 'decline')}
                      disabled={busyId === n.subject_id}
                      style={{
                        background: 'transparent', border: `1px solid ${B.line}`,
                        color: B.dim, padding: '7px 12px', borderRadius: 100,
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      }}>Decline</button>
                    <button
                      onClick={() => cosign(n.subject_id, 'confirm')}
                      disabled={busyId === n.subject_id}
                      style={{
                        background: B.text, border: 'none', color: B.surface,
                        padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                        cursor: busyId === n.subject_id ? 'wait' : 'pointer',
                      }}>{busyId === n.subject_id ? '…' : 'Confirm'}</button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function relTime(iso) {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
