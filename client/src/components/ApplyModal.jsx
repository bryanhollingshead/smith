// Smith — Apply with Smith modal (Jobs module phase 4)
//
// One modal, two stages:
//   1. review  — show generated body in editable textarea, channel + recipient
//                fields editable, "Send" button.
//   2. done    — confirmation + "View source ↗" (deeplink) / mock-email note.
//
// On open: POST /api/jobs/:id/draft  (idempotent — server returns existing draft if any)
// On save edits: PATCH /api/applications/:id  (only if the user actually edited)
// On send: POST /api/applications/:id/send
//
// Per the journal Trusted Auto-Send entry: review-before-send is the ONLY
// path this build ships. Auto-send shares the same application_drafts row;
// the toggle ships in phase 6.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { api } from '../lib/api.js';

export function ApplyModal({ job, onClose, onApplied }) {
  const [stage, setStage] = useState('loading');     // 'loading' | 'review' | 'sending' | 'done' | 'error'
  const [draft, setDraft] = useState(null);
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState('email');
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState(null);

  // Open draft on mount. Idempotent per (user, job), so re-opening the modal
  // reuses the existing row.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { draft } = await api.post(`/jobs/${job.id}/draft`);
        if (cancelled) return;
        setDraft(draft);
        setBody(draft.edited_body || draft.generated_body);
        setChannel(draft.channel);
        setRecipient(draft.recipient_email || '');
        setStage(draft.status === 'sent' ? 'done' : 'review');
      } catch (e) {
        if (!cancelled) {
          setError(e.data?.error || e.message || 'Could not load draft');
          setStage('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [job.id]);

  // Save edits on blur / channel change. Cheap PATCH that updates only what
  // changed. Bail when there's nothing to save.
  const saveIfDirty = async () => {
    if (!draft || draft.status !== 'draft') return;
    const patch = {};
    if (body !== (draft.edited_body || draft.generated_body)) patch.edited_body = body;
    if (channel !== draft.channel) patch.channel = channel;
    if (recipient !== (draft.recipient_email || '')) patch.recipient_email = recipient || null;
    if (Object.keys(patch).length === 0) return;
    try {
      const { draft: updated } = await api.patch(`/applications/${draft.id}`, patch);
      setDraft(updated);
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not save edits');
    }
  };

  const send = async () => {
    if (!draft) return;
    setError(null);
    await saveIfDirty();
    setStage('sending');
    try {
      const { draft: sent } = await api.post(`/applications/${draft.id}/send`);
      setDraft(sent);
      setStage('done');
      onApplied?.(sent);
    } catch (e) {
      setError(e.data?.error || e.message || 'Send failed');
      setStage('review');
    }
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget && stage !== 'sending') onClose?.(); }}
         style={{
           position: 'fixed', inset: 0, background: 'rgba(42, 31, 23, 0.45)',
           display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
           padding: 24,
         }}>
      <div style={{
        background: B.surface, borderRadius: 8, maxWidth: 640, width: '100%',
        maxHeight: '85vh', overflow: 'auto', border: `1px solid ${B.line}`,
        boxShadow: '0 12px 40px rgba(42, 31, 23, 0.25)',
      }}>
        <div style={{
          padding: '20px 28px 16px', borderBottom: `1px solid ${B.line}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <div>
            <h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 600, color: B.text }}>
              Apply with Smith
            </h2>
            <p style={{ margin: '4px 0 0', color: B.dim, fontSize: 13 }}>
              {job.title}{job.company ? ` · ${job.company}` : ''}
            </p>
          </div>
          <button onClick={() => stage !== 'sending' && onClose?.()} disabled={stage === 'sending'} style={{
            background: 'transparent', border: 'none', color: B.dim, fontSize: 18,
            cursor: stage === 'sending' ? 'not-allowed' : 'pointer', padding: 4,
          }}>×</button>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {stage === 'loading' && (
            <div style={{ color: B.dim, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              Drafting your outreach…
            </div>
          )}

          {(stage === 'review' || stage === 'sending') && draft && (
            <ReviewStage
              draft={draft}
              body={body} setBody={setBody}
              channel={channel} setChannel={setChannel}
              recipient={recipient} setRecipient={setRecipient}
              error={error}
              busy={stage === 'sending'}
              onSaveIfDirty={saveIfDirty}
              onSend={send}
              onCancel={onClose}
              hasDirectContact={!!(job.has_direct_contact)}
            />
          )}

          {stage === 'done' && draft && (
            <DoneStage draft={draft} job={job} onClose={onClose}/>
          )}

          {stage === 'error' && (
            <div>
              <ErrorBanner msg={error || 'Something went wrong.'}/>
              <div style={{ textAlign: 'right', marginTop: 14 }}>
                <button onClick={onClose} style={secondaryBtnStyle}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewStage({ draft, body, setBody, channel, setChannel, recipient, setRecipient,
                      error, busy, onSaveIfDirty, onSend, onCancel, hasDirectContact }) {
  return (
    <div>
      {draft.llm_model
        ? null
        : <Banner kind="info" msg={`Drafted from a template — Anthropic API key not configured. Edit before sending.`}/>
      }

      <Field label="Channel">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={busy} style={inputStyle}>
          <option value="email">Email — send via Smith</option>
          {/* sms + onsite are scaffolded server-side but not user-facing yet. */}
          <option value="deeplink">Deep-link — copy &amp; paste into the source posting</option>
        </select>
      </Field>

      {channel === 'email' && (
        <Field label="Send to">
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} onBlur={onSaveIfDirty}
                 disabled={busy} type="email" placeholder="contact email"
                 style={inputStyle}/>
          {!hasDirectContact && !recipient && (
            <div style={{ color: B.faint, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
              This listing didn't publish an email. You'll need to find one (or switch to Deep-link).
            </div>
          )}
        </Field>
      )}

      <Field label="Message">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={onSaveIfDirty}
                  disabled={busy} rows={12}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}/>
        <div style={{ color: B.faint, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
          Review before sending. Edits save automatically.
        </div>
      </Field>

      {error && <ErrorBanner msg={error}/>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} disabled={busy} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={onSend} disabled={busy || (channel === 'email' && !recipient.trim()) || !body.trim()}
                style={{ ...primaryBtnStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
          {busy ? 'Sending…' : (channel === 'email' ? 'Send email' : 'Mark sent (copy below)')}
        </button>
      </div>
    </div>
  );
}

function DoneStage({ draft, job, onClose }) {
  const isDeeplink = draft.channel === 'deeplink';
  return (
    <div>
      <div style={{ padding: '10px 0 4px', color: B.text, fontSize: 14 }}>
        {isDeeplink
          ? <>Marked as sent. Copy the message below and paste it into the source posting.</>
          : <>Email queued via Smith. {draft.recipient_email ? <>Sent to <strong>{draft.recipient_email}</strong>.</> : null}</>
        }
      </div>

      {isDeeplink && (
        <div style={{ marginTop: 14 }}>
          <Field label="Your message">
            <textarea readOnly rows={10} value={draft.edited_body || draft.generated_body}
                      style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, background: B.bg }}/>
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => navigator.clipboard?.writeText(draft.edited_body || draft.generated_body)}
                    style={secondaryBtnStyle}>Copy text</button>
            {job.url && (
              <a href={job.url} target="_blank" rel="noopener noreferrer" style={{
                ...primaryBtnStyle, textDecoration: 'none', display: 'inline-block',
              }}>Open source ↗</a>
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'right', marginTop: 18 }}>
        <button onClick={onClose} style={primaryBtnStyle}>Done</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: B.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {children}
    </div>
  );
}
function Banner({ kind, msg }) {
  const bg = kind === 'info' ? B.accentSoft : '#fff2ec';
  const col = kind === 'info' ? B.accent : B.danger;
  return (
    <div style={{
      color: col, fontSize: 12, background: bg,
      border: `1px solid ${col}`, borderRadius: 4, padding: '8px 12px', marginBottom: 14,
    }}>{msg}</div>
  );
}
function ErrorBanner({ msg }) {
  return <div style={{
    color: B.danger, fontSize: 13, background: '#fff2ec',
    border: `1px solid ${B.danger}`, borderRadius: 4, padding: '8px 12px', marginTop: 10,
  }}>{msg}</div>;
}

const inputStyle = {
  background: B.surface, border: `1px solid ${B.line}`, color: B.text,
  padding: '8px 10px', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const primaryBtnStyle = {
  background: B.text, color: B.surface, border: 'none', padding: '9px 20px',
  borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const secondaryBtnStyle = {
  background: 'transparent', color: B.text, border: `1px solid ${B.line}`,
  padding: '9px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
