// Smith — Magic-link reply page (Jobs module phase 5)
//
// Mounted at /h/:token. Reachable WITHOUT a Smith account. Shows the thread
// history + the original inquiry's structured fields + a one-shot reply box.
// On reply, the token burns (single-use). The next target reply mints a
// fresh token + emails a new link.
//
// "What happens next" CTA at the bottom invites the inquirer to create a
// real Smith account — this IS the growth funnel the journal calls out.

import React, { useEffect, useState, useCallback } from 'react';
import { B } from '../lib/theme.js';
import { SmithLogo } from '../components/Primitives.jsx';
import { useRouter } from '../lib/router.jsx';

export function MagicLinkReplyPage({ token }) {
  const { navigate } = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/hire-me/thread/${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setData(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/hire-me/thread/${encodeURIComponent(token)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <PublicChrome navigate={navigate}/>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 56px' }}>
        {loading && <Skeleton/>}
        {error && (
          <ErrorState msg={error}/>
        )}
        {data && !error && (
          <div style={{
            background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
            padding: '24px 28px',
          }}>
            <h1 className="serif" style={{
              margin: 0, fontSize: 24, fontWeight: 600,
              color: B.text, letterSpacing: '-0.01em',
            }}>Conversation with {data.target.name}</h1>
            {data.target.headline && (
              <p style={{ color: B.dim, fontSize: 14, margin: '4px 0 0' }}>{data.target.headline}</p>
            )}

            {(data.inquiry.structure_type || data.inquiry.job_type || data.inquiry.location || data.inquiry.timeline) && (
              <div style={{
                marginTop: 16, padding: '10px 14px', background: B.bg,
                border: `1px solid ${B.line}`, borderRadius: 4,
                color: B.dim, fontSize: 12,
              }}>
                Your inquiry: {[data.inquiry.job_type, data.inquiry.structure_type, data.inquiry.location, data.inquiry.timeline]
                  .filter(Boolean).join(' · ')}
              </div>
            )}

            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.messages.map(m => (
                <div key={m.id} style={{
                  background: m.from_target ? B.surface2 : B.bg,
                  border: `1px solid ${B.line}`, borderRadius: 6,
                  padding: '12px 14px',
                }}>
                  <div style={{
                    color: B.dim, fontSize: 11, fontWeight: 600, marginBottom: 4,
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>{m.from_target ? data.target.name : 'You'}</span>
                    <span style={{ color: B.faint, fontWeight: 400 }}>{relative(m.created_at)}</span>
                  </div>
                  <div style={{ color: B.text, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.body}</div>
                </div>
              ))}
            </div>

            {sent ? (
              <SentBanner/>
            ) : data.token.used ? (
              <UsedBanner/>
            ) : (
              <div style={{ marginTop: 22 }}>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                          disabled={sending} rows={5} placeholder="Write your reply…"
                          style={{
                            background: B.surface, border: `1px solid ${B.line}`, color: B.text,
                            padding: '10px 12px', borderRadius: 4, fontSize: 14,
                            width: '100%', boxSizing: 'border-box',
                            fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5,
                          }}/>
                {error && <div style={{ color: B.danger, fontSize: 13, marginTop: 6 }}>{error}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
                    This link is single-use. If {data.target.name.split(' ')[0]} replies again, you'll get a new email.
                  </div>
                  <button onClick={send} disabled={sending || !reply.trim()} style={{
                    background: B.text, color: B.surface, border: 'none',
                    padding: '9px 22px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                    cursor: (sending || !reply.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (sending || !reply.trim()) ? 0.6 : 1,
                  }}>{sending ? 'Sending…' : 'Send reply'}</button>
                </div>
              </div>
            )}

            <SignupCTA navigate={navigate}/>
          </div>
        )}
      </main>
    </div>
  );
}

function PublicChrome({ navigate }) {
  return (
    <header style={{
      background: B.surface, borderBottom: `1px solid ${B.line}`, padding: '14px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <button onClick={() => navigate('/')} style={{
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
      }}>
        <SmithLogo size={24}/>
      </button>
      <button onClick={() => navigate('/auth/signup')} style={{
        background: B.text, border: 'none', color: B.surface,
        padding: '7px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600,
        cursor: 'pointer',
      }}>Create your free Smith account</button>
    </header>
  );
}

function SentBanner() {
  return (
    <div style={{
      marginTop: 22, padding: '14px 18px', background: B.accentSoft,
      border: `1px solid ${B.accent}`, borderRadius: 4,
      color: B.accent, fontSize: 14, textAlign: 'center',
    }}>
      Reply sent. You'll get a new email when they respond.
    </div>
  );
}

function UsedBanner() {
  return (
    <div style={{
      marginTop: 22, padding: '14px 18px', background: B.surface2,
      border: `1px solid ${B.line}`, borderRadius: 4,
      color: B.dim, fontSize: 13, textAlign: 'center',
    }}>
      You've already replied via this link. Wait for them to write back — you'll get a new email with a fresh link.
    </div>
  );
}

function SignupCTA({ navigate }) {
  return (
    <div style={{
      marginTop: 28, padding: '18px 20px', background: B.bg,
      border: `1px solid ${B.line}`, borderRadius: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ color: B.text, fontSize: 14, fontWeight: 600 }}>
          Skip the magic links.
        </div>
        <div style={{ color: B.dim, fontSize: 12, marginTop: 2 }}>
          Create a free Smith account to manage all your inquiries + chat in one place.
        </div>
      </div>
      <button onClick={() => navigate('/auth/signup')} style={{
        background: B.accent, color: B.surface, border: 'none',
        padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>Sign up</button>
    </div>
  );
}

function ErrorState({ msg }) {
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '40px 28px', textAlign: 'center',
    }}>
      <div className="serif" style={{ fontSize: 22, fontWeight: 600, color: B.text, marginBottom: 8 }}>
        Link unavailable.
      </div>
      <div style={{ color: B.dim, fontSize: 14 }}>{msg}</div>
    </div>
  );
}

function Skeleton() {
  return <div style={{ height: 320, background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, opacity: 0.6 }}/>;
}

function relative(ts) {
  const ms = Date.now() - new Date(ts).getTime();
  const min = ms / 60000;
  if (min < 1)   return 'just now';
  if (min < 60)  return Math.round(min) + 'm ago';
  if (min < 1440) return Math.round(min / 60) + 'h ago';
  return Math.round(min / 1440) + 'd ago';
}
