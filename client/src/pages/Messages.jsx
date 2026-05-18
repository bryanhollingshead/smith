// Smith — Messages page
//
// Two-pane: threads sidebar on the left, conversation view (or new-message
// picker) on the right. Routes:
//   /messages              — list view; right pane shows the picker
//   /messages/:threadId    — list + selected thread on the right
//
// Live updates:
//   - On message:new for the selected thread → append to message list.
//   - On message:new for any thread → bump that thread to top of sidebar,
//     update its last_message preview, increment unread (if not selected).

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { Avatar } from '../components/Primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useMessages } from '../lib/MessagesContext.jsx';

// Friendly relative time. Same pattern as elsewhere.
function relTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)        return 'now';
  if (diff < 3600)      return `${Math.round(diff / 60)}m`;
  if (diff < 86400)     return `${Math.round(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Initials for the avatar primitive.
const initialsOf = (first, last) =>
  `${(first || '?')[0] || '?'}${(last || '')[0] || ''}`.toUpperCase();

export function MessagesPage({ threadIdParam }) {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const { subscribe, refreshUnread, setUnread } = useMessages();

  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const activeThreadId = threadIdParam ? parseInt(threadIdParam, 10) : null;

  const loadThreads = useCallback(async () => {
    try {
      const data = await api.get('/messages/threads');
      setThreads(data.threads);
    } finally { setLoadingThreads(false); }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Live-update sidebar on incoming messages.
  useEffect(() => {
    const unsub = subscribe((evt) => {
      if (evt.type !== 'message:new') return;
      setThreads(prev => {
        const idx = prev.findIndex(t => t.id === evt.thread_id);
        if (idx === -1) {
          // We don't have this thread in the sidebar yet (e.g. someone we
          // haven't messaged before just messaged us). Refresh the whole list
          // — cheap because list is small.
          loadThreads();
          return prev;
        }
        const t = { ...prev[idx] };
        t.last_message = evt.message;
        t.last_message_at = evt.message.created_at;
        if (evt.thread_id !== activeThreadId) t.unread = (t.unread || 0) + 1;
        // Move to top.
        const next = [t, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        return next;
      });
    });
    return unsub;
  }, [subscribe, loadThreads, activeThreadId]);

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="messages"/>
      <main style={{
        maxWidth: 1180, margin: '0 auto', padding: '24px 32px',
        display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18,
        alignItems: 'flex-start',
      }}>
        <ThreadsSidebar
          threads={threads}
          loading={loadingThreads}
          activeId={activeThreadId}
          onSelect={(id) => navigate(`/messages/${id}`)}
          onNew={() => navigate('/messages')}
        />
        {activeThreadId ? (
          <ThreadView
            key={activeThreadId} /* force remount on switch — simpler than reset effects */
            threadId={activeThreadId}
            me={user}
            onMessageSent={() => {
              // Refresh threads after we send, so our own message bumps the
              // thread in our sidebar (we don't broadcast to self).
              loadThreads();
            }}
            onRead={() => {
              // Clear unread for this thread in the sidebar + drop global counter.
              setThreads(prev => prev.map(t => {
                if (t.id !== activeThreadId) return t;
                if (!t.unread) return t;
                setUnread(n => Math.max(0, n - t.unread));
                return { ...t, unread: 0 };
              }));
              refreshUnread();
            }}
          />
        ) : (
          <NewMessagePicker
            onPick={async (peerId) => {
              const { thread_id } = await api.post('/messages/threads', { peer_id: peerId });
              await loadThreads();
              navigate(`/messages/${thread_id}`);
            }}
          />
        )}
      </main>
    </div>
  );
}

// ── Threads sidebar ────────────────────────────────────────────────────
function ThreadsSidebar({ threads, loading, activeId, onSelect, onNew }) {
  return (
    <aside style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      overflow: 'hidden', position: 'sticky', top: 88,
    }}>
      <header style={{
        padding: '16px 18px', borderBottom: `1px solid ${B.line}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h2 className="serif" style={{
          margin: 0, fontSize: 18, fontWeight: 600,
          color: B.text, letterSpacing: '-0.01em',
        }}>Messages</h2>
        <button onClick={onNew} style={{
          background: 'transparent', border: 'none', color: B.accent,
          padding: 4, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center',
        }} title="New message">
          <Icon name="plus" size={16} stroke={2.4}/>
        </button>
      </header>

      <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
            Loading…
          </div>
        )}
        {!loading && threads.length === 0 && (
          <div style={{
            padding: '32px 24px', textAlign: 'center',
            color: B.dim, fontSize: 13,
          }}>
            <div className="serif" style={{
              color: B.text, fontWeight: 600, fontSize: 15, marginBottom: 6,
              letterSpacing: '-0.01em',
            }}>No conversations yet</div>
            <div style={{ fontSize: 12 }}>
              Start one with the + button or from a connection's profile.
            </div>
          </div>
        )}
        {threads.map(t => (
          <ThreadRow key={t.id} t={t} active={t.id === activeId}
                     onClick={() => onSelect(t.id)}/>
        ))}
      </div>
    </aside>
  );
}

function ThreadRow({ t, active, onClick }) {
  const name = `${t.peer.first_name} ${t.peer.last_name}`;
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left',
      display: 'flex', gap: 12, padding: '12px 18px',
      background: active ? B.bg : 'transparent',
      borderLeft: active ? `3px solid ${B.accent}` : '3px solid transparent',
      borderTop: 'none', borderRight: 'none', borderBottom: `1px solid ${B.line}`,
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <Avatar
        initials={initialsOf(t.peer.first_name, t.peer.last_name)}
        tone={t.peer.avatar_tone} size={40}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6,
        }}>
          <div className="serif" style={{
            color: B.text, fontWeight: t.unread ? 700 : 600, fontSize: 14,
            letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', minWidth: 0,
          }}>{name}</div>
          <div style={{ color: B.faint, fontSize: 11, flexShrink: 0 }}>
            {t.last_message ? relTime(t.last_message.created_at) : ''}
          </div>
        </div>
        <div style={{
          color: t.unread ? B.text : B.dim, fontSize: 12, fontWeight: t.unread ? 600 : 400,
          marginTop: 2, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {t.last_message
            ? (t.last_message.from_me ? 'You: ' : '') + t.last_message.body
            : <span style={{ fontStyle: 'italic', color: B.faint }}>No messages yet</span>}
        </div>
      </div>
      {t.unread > 0 && (
        <div style={{
          background: B.accent, color: '#fff',
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          fontSize: 10, fontWeight: 700, alignSelf: 'center',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{t.unread}</div>
      )}
    </button>
  );
}

// ── Conversation view ──────────────────────────────────────────────────
function ThreadView({ threadId, me, onMessageSent, onRead }) {
  const { subscribe, refreshUnread } = useMessages();
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const textareaRef = useRef(null);

  // Load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get(`/messages/threads/${threadId}`);
        if (!cancelled) setThread(data.thread);
      } catch (e) {
        if (!cancelled) setError(e.data?.error || 'Could not load thread.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [threadId]);

  // Mark read on open + on every incoming message while open.
  const markRead = useCallback(async () => {
    try { await api.post(`/messages/threads/${threadId}/read`); }
    catch { /* nothing to do */ }
    onRead?.();
  }, [threadId, onRead]);

  useEffect(() => { if (thread) markRead(); }, [thread, markRead]);

  // Live append on websocket message for THIS thread.
  useEffect(() => {
    const unsub = subscribe((evt) => {
      if (evt.type !== 'message:new') return;
      if (evt.thread_id !== threadId) return;
      setThread(prev => prev ? { ...prev, messages: [...prev.messages, evt.message] } : prev);
      // Mark this delivery as read since the user is actively looking at it.
      // Tiny delay so the message renders before the read receipt is sent —
      // matters less for v1 (we don't show "read"), but good habit.
      setTimeout(markRead, 50);
    });
    return unsub;
  }, [subscribe, threadId, markRead]);

  // Autoscroll to bottom on new message.
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [thread?.messages?.length]);

  const send = async () => {
    const body = composer.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    // Optimistic append. Replace with real message after the server returns
    // (so we have a real id + canonical timestamp).
    const optimistic = {
      id: `pending-${Date.now()}`,
      sender_id: me?.id,
      body,
      created_at: new Date().toISOString(),
      from_me: true,
      pending: true,
    };
    setThread(prev => ({ ...prev, messages: [...prev.messages, optimistic] }));
    setComposer('');
    try {
      const res = await api.post(`/messages/threads/${threadId}/messages`, { body });
      // Swap the optimistic entry for the real one.
      setThread(prev => ({
        ...prev,
        messages: prev.messages.map(m => m.id === optimistic.id ? res.message : m),
      }));
      onMessageSent?.();
    } catch (e) {
      // Roll the optimistic out and surface the error.
      setThread(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m.id !== optimistic.id),
      }));
      setComposer(body); // put it back so they can retry
      setError(e.data?.error || 'Could not send.');
    } finally { setSending(false); }
  };

  const onKey = (e) => {
    // Enter sends, Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (loading) return <PanelSkeleton/>;
  if (!thread) return (
    <Panel>
      <div style={{ padding: 32, color: B.dim, textAlign: 'center' }}>
        {error || 'Thread not found.'}
      </div>
    </Panel>
  );

  return (
    <Panel>
      {/* Peer header */}
      <header style={{
        padding: '14px 20px', borderBottom: `1px solid ${B.line}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Avatar
          initials={initialsOf(thread.peer?.first_name, thread.peer?.last_name)}
          tone={thread.peer?.avatar_tone} size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{
            color: B.text, fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em',
          }}>{thread.peer?.first_name} {thread.peer?.last_name}</div>
          {thread.peer?.headline && (
            <div style={{ color: B.dim, fontSize: 12 }}>{thread.peer.headline}</div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={listRef} style={{
        flex: 1, overflowY: 'auto', padding: '20px 20px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: 380, maxHeight: 'calc(100vh - 340px)',
      }}>
        {thread.messages.length === 0 && (
          <div style={{
            color: B.faint, fontSize: 13, fontStyle: 'italic',
            textAlign: 'center', margin: 'auto',
          }}>
            No messages yet — say hi.
          </div>
        )}
        {thread.messages.map((m, i) => {
          const prev = thread.messages[i - 1];
          // Group consecutive messages from the same sender.
          const sameAsPrev = prev && prev.from_me === m.from_me &&
            (new Date(m.created_at) - new Date(prev.created_at) < 5 * 60 * 1000);
          return <Bubble key={m.id} msg={m} grouped={sameAsPrev}/>;
        })}
      </div>

      {/* Composer */}
      <div style={{
        padding: '12px 16px', borderTop: `1px solid ${B.line}`,
        display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <textarea
          ref={textareaRef}
          value={composer}
          onChange={e => setComposer(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Message ${thread.peer?.first_name || ''}…`}
          rows={1}
          style={{
            flex: 1, background: B.bg, border: `1px solid ${B.line}`,
            borderRadius: 8, padding: '10px 14px',
            fontFamily: 'inherit', fontSize: 14, color: B.text,
            resize: 'none', outline: 'none', minHeight: 38, maxHeight: 140,
          }}
        />
        <button
          onClick={send}
          disabled={!composer.trim() || sending}
          style={{
            background: composer.trim() ? B.accent : B.surface2,
            color: composer.trim() ? '#fff' : B.faint,
            border: 'none', padding: '10px 18px', borderRadius: 100,
            fontSize: 13, fontWeight: 600,
            cursor: composer.trim() ? 'pointer' : 'not-allowed',
          }}>
          {sending ? '…' : 'Send'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '8px 20px', color: B.danger, fontSize: 12,
          borderTop: `1px solid ${B.line}`, background: '#fff2ec',
        }}>{error}</div>
      )}
    </Panel>
  );
}

function Bubble({ msg, grouped }) {
  const isMine = msg.from_me;
  return (
    <div style={{
      display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
      marginTop: grouped ? 2 : 6,
    }}>
      <div style={{
        background: isMine ? B.accent : B.surface,
        color: isMine ? '#fff' : B.text,
        border: isMine ? 'none' : `1px solid ${B.line}`,
        padding: '8px 14px', borderRadius: 16,
        // Tighten the inner corner on grouped consecutive messages.
        borderTopRightRadius: isMine && grouped ? 6 : 16,
        borderTopLeftRadius: !isMine && grouped ? 6 : 16,
        maxWidth: '70%', fontSize: 14, lineHeight: 1.4,
        whiteSpace: 'pre-wrap', wordWrap: 'break-word',
        opacity: msg.pending ? 0.65 : 1,
      }}>
        {msg.body}
      </div>
    </div>
  );
}

// ── New-message picker ─────────────────────────────────────────────────
function NewMessagePicker({ onPick }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/connections');
        setConnections(data.connections);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.headline || '').toLowerCase().includes(q)
    );
  }, [connections, filter]);

  return (
    <Panel>
      <header style={{
        padding: '18px 22px', borderBottom: `1px solid ${B.line}`,
      }}>
        <h2 className="serif" style={{
          margin: 0, fontSize: 20, fontWeight: 600,
          color: B.text, letterSpacing: '-0.015em',
        }}>New message</h2>
        <p style={{ color: B.dim, fontSize: 13, margin: '4px 0 0' }}>
          Pick a connection to start a thread.
        </p>
      </header>

      <div style={{ padding: '14px 22px', borderBottom: `1px solid ${B.line}` }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search your connections…"
          style={{
            width: '100%', background: B.bg, border: `1px solid ${B.line}`,
            borderRadius: 100, padding: '8px 14px',
            fontFamily: 'inherit', fontSize: 13, color: B.text, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
        {loading && (
          <div style={{ padding: 24, color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
            Loading…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{
            padding: 32, textAlign: 'center', color: B.dim, fontSize: 13,
          }}>
            {connections.length === 0
              ? 'No connections yet — add some from the Network page.'
              : 'No matches.'}
          </div>
        )}
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={async () => {
              setError(null);
              try { await onPick(c.id); }
              catch (e) { setError(e.data?.error || 'Could not start thread.'); }
            }}
            style={{
              width: '100%', textAlign: 'left',
              display: 'flex', gap: 12, padding: '12px 22px',
              background: 'transparent', border: 'none',
              borderBottom: `1px solid ${B.line}`,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={e => e.currentTarget.style.background = B.bg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Avatar initials={initialsOf(c.first_name, c.last_name)} tone={c.avatar_tone} size={36}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{
                color: B.text, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em',
              }}>{c.first_name} {c.last_name}</div>
              {c.headline && (
                <div style={{ color: B.dim, fontSize: 12, marginTop: 2 }}>{c.headline}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '8px 22px', color: B.danger, fontSize: 12,
          borderTop: `1px solid ${B.line}`, background: '#fff2ec',
        }}>{error}</div>
      )}
    </Panel>
  );
}

// ── Layout primitives ──────────────────────────────────────────────────
function Panel({ children }) {
  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      display: 'flex', flexDirection: 'column',
      minHeight: 560, overflow: 'hidden',
    }}>{children}</section>
  );
}

function PanelSkeleton() {
  return (
    <Panel>
      <div style={{ padding: 28, color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
        Loading conversation…
      </div>
    </Panel>
  );
}
