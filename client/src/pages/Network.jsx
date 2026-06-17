// Smith — Network page
// Ported from ConnectionsPageB. Three tabs: Connections, Pending, Suggestions.
// All tabs render the same connection-card grid; the tab determines what
// actions are available (Message / Connected for accepted, Accept / Reject
// for pending, Connect for suggestions).

import React, { useEffect, useState, useCallback } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { Avatar, Photo } from '../components/Primitives.jsx';
import { SmithAvatar } from '../components/SmithAvatar.jsx';
import { Icon } from '../components/Icon.jsx';
import { InvitePanel } from '../components/InviteTools.jsx';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';

const photoFor = tone => ({
  sage: 'crew', rust: 'workshop', slate: 'steel', brick: 'brick',
  steel: 'steel', sand: 'tile', wood: 'wood', cream: 'frame',
}[tone] || 'wood');

export function NetworkPage() {
  const { navigate } = useRouter();
  const [tab, setTab] = useState('connections');
  const [counts, setCounts] = useState({ connections: 0, pending: 0, suggestions: 0 });
  const [data, setData] = useState({ connections: [], pending: [], suggestions: [] });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, s] = await Promise.all([
        api.get('/connections'),
        api.get('/connections/pending'),
        api.get('/connections/suggestions?limit=24'),
      ]);
      setData({
        connections: c.connections,
        pending: p.pending,
        suggestions: s.suggestions,
      });
      setCounts({
        connections: c.connections.length,
        pending: p.pending.length,
        suggestions: s.suggestions.length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = (data[tab] || []).filter(c => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(f) ||
      (c.current_role || c.headline || '').toLowerCase().includes(f) ||
      (c.location || '').toLowerCase().includes(f) ||
      (c.company_name || '').toLowerCase().includes(f)
    );
  });

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="connections"/>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 40px' }}>
        <h1 className="serif" style={{
          color: B.text, fontSize: 36, fontWeight: 600, margin: 0,
          letterSpacing: '-0.02em',
        }}>Your connections</h1>
        <p style={{ color: B.dim, fontSize: 15, marginTop: 6 }}>
          The people you've worked with, and the ones you should.
        </p>

        <InvitePanel/>

        <div style={{
          display: 'flex', gap: 28, marginTop: 28,
          borderBottom: `1px solid ${B.line}`, alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}>
          {[
            { k: 'connections', label: 'Connections', count: counts.connections },
            { k: 'pending', label: 'Pending', count: counts.pending },
            { k: 'suggestions', label: 'Suggestions', count: counts.suggestions },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                padding: '12px 0', background: 'transparent', border: 'none',
                color: tab === t.k ? B.text : B.dim,
                borderBottom: tab === t.k ? `2px solid ${B.accent}` : '2px solid transparent',
                fontSize: 14, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                cursor: 'pointer',
              }}
            >
              {t.label}
              <span style={{ color: B.faint, fontSize: 11, fontWeight: 500 }}>{t.count}</span>
            </button>
          ))}

          <div style={{
            marginLeft: 'auto', display: 'flex', gap: 8,
            alignItems: 'center', paddingBottom: 8,
          }}>
            <div style={{
              background: B.surface, border: `1px solid ${B.line}`, borderRadius: 100,
              padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
              color: B.dim,
            }}>
              <Icon name="search" size={14}/>
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter your network…"
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 12, color: B.text, width: 160,
                }}
              />
            </div>
          </div>
        </div>

        {loading && (
          <div style={{
            color: B.faint, fontSize: 13, fontStyle: 'italic',
            padding: 32, textAlign: 'center',
          }}>Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState tab={tab} hasFilter={!!filter.trim()}/>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14, marginTop: 24,
        }}>
          {filtered.map(c => (
            <ConnectionCard
              key={`${tab}-${c.id}-${c.connection_id || ''}`}
              tab={tab}
              card={c}
              onView={() => navigate(`/profile/${c.id}`)}
              onChange={loadAll}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

// CoverBand: renders the user's uploaded cover photo if present, otherwise
// falls back to the placeholder Photo component (which renders a tone-based
// abstract image). Keeps the visual rhythm even for users who haven't
// uploaded yet — connection cards always have a header strip.
function CoverBand({ urls, tone, height = 64 }) {
  const src = urls?.medium || urls?.full || urls?.thumb;
  if (src) {
    return (
      <div style={{
        width: '100%', height,
        background: `center/cover url("${src}") no-repeat`,
      }}/>
    );
  }
  return <Photo kind={photoFor(tone)} label="" height={height}/>;
}

function ConnectionCard({ tab, card, onView, onChange }) {
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try { await api.post(`/connections/${card.connection_id}/accept`); onChange?.(); }
    finally { setBusy(false); }
  };
  const reject = async () => {
    setBusy(true);
    try { await api.post(`/connections/${card.connection_id}/reject`); onChange?.(); }
    finally { setBusy(false); }
  };
  const connect = async () => {
    setBusy(true);
    try { await api.post('/connections/request', { target_id: card.id }); onChange?.(); }
    finally { setBusy(false); }
  };

  const initials = (card.first_name[0] || '') + (card.last_name[0] || '');

  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      overflow: 'hidden',
    }}>
      {/* Patch: render uploaded cover photo when present, fall back to the
          previous tone-based placeholder otherwise. */}
      <CoverBand urls={card.cover_urls} tone={card.avatar_tone} height={64}/>
      <div style={{ padding: '0 22px 22px', marginTop: -32 }}>
        <button onClick={onView} style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          borderRadius: '50%',
        }}>
          <span style={{ background: B.surface, padding: 4, borderRadius: '50%', display: 'inline-block' }}>
            {/* Patch: SmithAvatar renders an uploaded avatar photo when
                avatar_urls is present, falls back to tone+initials otherwise. */}
            <SmithAvatar
              urls={card.avatar_urls}
              initials={initials}
              size={62}
              tone={card.avatar_tone}
            />
          </span>
        </button>
        <div style={{ marginTop: 14 }}>
          <button onClick={onView} className="serif" style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            color: B.text, fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em',
            textAlign: 'left', display: 'block',
          }}>{card.first_name} {card.last_name}</button>
          <div style={{ color: B.text, fontSize: 13, marginTop: 4 }}>
            {card.current_role || card.headline || '—'}
          </div>
          {card.company_name && (
            <div style={{ color: B.dim, fontSize: 12, marginTop: 2 }}>{card.company_name}</div>
          )}
          <div style={{
            color: B.faint, fontSize: 11, marginTop: 8, fontStyle: 'italic',
          }}>
            {card.location || '—'}
            {card.mutual !== undefined && (card.mutual > 0 || tab === 'suggestions') && (
              <> · {card.mutual} mutual</>
            )}
          </div>
          {/* Smith god marker — subtle groundwork. Gods are visible but quiet;
              richer treatment (separate section, "Receive guidance", etc.) is
              a later phase. */}
          {card.is_smith_god && (
            <div style={{
              color: B.accent, fontSize: 11, marginTop: 4, fontStyle: 'italic',
            }}>
              ⚒ Smith original
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {tab === 'connections' && (
            <>
              <button
                onClick={async () => {
                  try {
                    const { thread_id } = await api.post('/messages/threads', { peer_id: card.id });
                    window.location.hash = `#/messages/${thread_id}`;
                  } catch (e) {
                    alert(e.data?.error || 'Could not start message thread.');
                  }
                }}
                style={{
                  flex: 1, background: 'transparent', border: `1px solid ${B.line}`,
                  color: B.text, padding: '9px', borderRadius: 100,
                  fontSize: 12, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: 'pointer',
                }} title={`Message ${card.first_name}`}>
                <Icon name="message" size={13}/> Message
              </button>
              <button style={{
                background: B.text, border: 'none', color: B.surface,
                padding: '9px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600,
              }}>Connected</button>
            </>
          )}
          {tab === 'pending' && (
            <>
              <button onClick={reject} disabled={busy} style={{
                flex: 1, background: 'transparent', border: `1px solid ${B.line}`,
                color: B.dim, padding: '9px', borderRadius: 100,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>Decline</button>
              <button onClick={accept} disabled={busy} style={{
                flex: 1, background: B.accent, border: 'none', color: '#fff',
                padding: '9px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}>Accept</button>
            </>
          )}
          {tab === 'suggestions' && (
            <button onClick={connect} disabled={busy} style={{
              flex: 1, background: B.text, border: 'none', color: B.surface,
              padding: '9px', borderRadius: 100, fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: 'pointer',
            }}>
              <Icon name="plus" size={13} stroke={2.4}/> Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ tab, hasFilter }) {
  const messages = {
    connections: hasFilter ? 'No matches in your network.' : 'You haven\'t connected with anyone yet.',
    pending: 'No pending requests.',
    suggestions: 'No suggestions right now — your network is well-explored, or new folks just haven\'t shown up.',
  };
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: 32, textAlign: 'center', marginTop: 24,
    }}>
      <div className="serif" style={{
        color: B.text, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em',
      }}>{messages[tab]}</div>
    </div>
  );
}
