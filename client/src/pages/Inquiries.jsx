// Smith — Inquiries inbox (Jobs module phase 5)
//
// The target's view of Hire Me inquiries. Separate from /messages because
// these have structured fields (job type, structure, location, timeline)
// that don't fit the casual-chat thread UI. Replying happens in /messages
// (linked via "Open conversation"); status management lives here.

import React, { useCallback, useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { Icon } from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';

const FILTERS = [
  { k: 'all',      label: 'All' },
  { k: 'new',      label: 'New' },
  { k: 'replied',  label: 'Replied' },
  { k: 'archived', label: 'Archived' },
];

export function InquiriesPage() {
  const { navigate } = useRouter();
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState({ inquiries: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      const d = await api.get(`/hire-me/inbox?${params.toString()}`);
      setData(d);
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not load inquiries');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (inq, status) => {
    // Optimistic — filter out from current view if status moved out of filter.
    setData(d => ({
      ...d,
      inquiries: d.inquiries.map(i => i.id === inq.id ? { ...i, status } : i)
                            .filter(i => filter === 'all' || i.status === filter),
    }));
    try { await api.patch(`/hire-me/${inq.id}`, { status }); }
    catch { load(); }
  };

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="inquiries"/>
      <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 40px' }}>
        <div style={{ marginBottom: 4 }}>
          <h1 className="serif" style={{
            color: B.text, fontSize: 32, fontWeight: 600, margin: 0,
            letterSpacing: '-0.02em',
          }}>Hire Me inquiries</h1>
          <p style={{ color: B.dim, fontSize: 14, marginTop: 4 }}>
            Structured leads from your public profile. Conversations live in Messages.
          </p>
        </div>

        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap',
          margin: '18px 0 20px', borderBottom: `1px solid ${B.line}`, paddingBottom: 14,
        }}>
          {FILTERS.map(f => {
            const count = f.k === 'all'
              ? Object.values(data.counts).reduce((a, b) => a + b, 0)
              : (data.counts[f.k] || 0);
            return (
              <button key={f.k} onClick={() => setFilter(f.k)} style={{
                background: filter === f.k ? B.text : 'transparent',
                color: filter === f.k ? B.surface : B.text,
                border: `1px solid ${filter === f.k ? B.text : B.line}`,
                padding: '7px 14px', borderRadius: 100,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {f.label}
                {count > 0 && (
                  <span style={{
                    background: filter === f.k ? B.surface : B.surface2,
                    color: filter === f.k ? B.text : B.dim,
                    padding: '1px 7px', borderRadius: 100, fontSize: 11,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {error && <Banner kind="error" msg={error}/>}

        {loading && <Skeleton/>}

        {!loading && !error && data.inquiries.length === 0 && (
          <Empty filter={filter}/>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.inquiries.map(inq => (
            <InquiryCard key={inq.id} inq={inq}
                         onArchive={() => setStatus(inq, 'archived')}
                         onSpam={() => setStatus(inq, 'spam')}
                         onOpenThread={() => navigate(`/messages/${inq.message_thread_id}`)}/>
          ))}
        </div>
      </main>
    </div>
  );
}

function InquiryCard({ inq, onArchive, onSpam, onOpenThread }) {
  return (
    <article style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '18px 22px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="serif" style={{
              color: B.text, fontWeight: 600, fontSize: 17,
            }}>{inq.inquirer_name}</div>
            {inq.is_connection_of && (
              <span style={{
                background: B.accentSoft, color: B.accent, fontSize: 11, fontWeight: 600,
                padding: '2px 7px', borderRadius: 4,
              }}>Connection-of</span>
            )}
            <StatusBadge status={inq.status}/>
          </div>
          <div style={{ color: B.dim, fontSize: 13, marginTop: 2 }}>
            {inq.inquirer_email}{inq.inquirer_phone ? ` · ${inq.inquirer_phone}` : ''}
          </div>
        </div>
        <div style={{ color: B.faint, fontSize: 12, flexShrink: 0 }}>
          {relative(inq.created_at)}
        </div>
      </div>

      {(inq.job_type || inq.structure_type || inq.location || inq.timeline) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {inq.job_type      && <Chip>{inq.job_type}</Chip>}
          {inq.structure_type && <Chip>{inq.structure_type}</Chip>}
          {inq.location       && <Chip>{inq.location}</Chip>}
          {inq.timeline       && <Chip>{inq.timeline}</Chip>}
        </div>
      )}

      <div style={{
        marginTop: 12, padding: '12px 14px', background: B.bg,
        border: `1px solid ${B.line}`, borderRadius: 4,
        color: B.text, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.5,
      }}>{inq.message}</div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
        {inq.status !== 'archived' && inq.status !== 'spam' && (
          <>
            <button onClick={onSpam} style={ghostBtn}>Mark spam</button>
            <button onClick={onArchive} style={ghostBtn}>Archive</button>
          </>
        )}
        <button onClick={onOpenThread} style={{
          background: B.text, color: B.surface, border: 'none',
          padding: '7px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>Open conversation →</button>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  const map = {
    new:      [B.accent,   B.accentSoft],
    replied:  ['#3d5a31',  '#dde7d8'],
    archived: [B.dim,      B.surface2],
    spam:     [B.danger,   '#fff2ec'],
  };
  const [c, bg] = map[status] || [B.dim, B.surface2];
  return (
    <span style={{
      background: bg, color: c, fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 4,
    }}>{status}</span>
  );
}

function Chip({ children }) {
  return (
    <span style={{
      background: B.surface2, color: B.text, border: `1px solid ${B.line}`,
      fontSize: 11, fontWeight: 500,
      padding: '3px 9px', borderRadius: 100,
    }}>{children}</span>
  );
}

function Empty({ filter }) {
  const map = {
    all:      ['No inquiries yet.', 'When someone hires you via your public profile, they show up here.'],
    new:      ['Inbox zero.', 'Any new Hire Me inquiry will land here.'],
    replied:  ['Nothing replied yet.', 'Inquiries you\'ve replied to show up here.'],
    archived: ['Nothing archived.', 'Inquiries you archive show up here.'],
  };
  const [title, body] = map[filter] || map.all;
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '40px 32px', textAlign: 'center',
    }}>
      <div style={{ marginBottom: 10, color: B.faint }}>
        <Icon name="mail" size={32}/>
      </div>
      <div className="serif" style={{ color: B.text, fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ color: B.dim, fontSize: 13, maxWidth: 460, margin: '0 auto' }}>{body}</div>
    </div>
  );
}

function Banner({ kind, msg }) {
  const isErr = kind === 'error';
  return (
    <div style={{
      background: isErr ? '#fff2ec' : B.surface,
      border: `1px solid ${isErr ? B.danger : B.line}`, borderRadius: 4,
      color: isErr ? B.danger : B.text,
      padding: '12px 16px', marginBottom: 12, fontSize: 13,
    }}>{msg}</div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[180, 200, 160].map((h, i) => (
        <div key={i} style={{
          height: h, background: B.surface, border: `1px solid ${B.line}`,
          borderRadius: 4, opacity: 0.6,
        }}/>
      ))}
    </div>
  );
}

function relative(ts) {
  const ms = Date.now() - new Date(ts).getTime();
  const min = ms / 60000;
  if (min < 1)   return 'just now';
  if (min < 60)  return Math.round(min) + 'm ago';
  if (min < 1440) return Math.round(min / 60) + 'h ago';
  return Math.round(min / 1440) + 'd ago';
}

const ghostBtn = {
  background: 'transparent', color: B.dim, border: `1px solid ${B.line}`,
  padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
