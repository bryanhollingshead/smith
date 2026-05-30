// Smith — Hire Me modal (Jobs module phase 5)
//
// Structured intake form for the public profile. Inquirer needs NO Smith
// account; their identity is captured here. Required: name, email, message.
// Structured fields use job-types.js vocab to keep the lead qualified
// ("u available?" is the failure mode this defends against).

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { STRUCTURE_TYPES, JOB_TYPE_CATEGORIES } from '../lib/job-types.js';

export function HireMeModal({ targetName, targetSlug, onClose }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    inquirer_name: '', inquirer_email: '', inquirer_phone: '',
    structure_type: '', job_type: '',
    location: '', timeline: '', message: '',
  });
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!form.inquirer_name.trim() || !form.inquirer_email.trim() || !form.message.trim()) {
      setError('Name, email, and message are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/public/hire-me/${encodeURIComponent(targetSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDone(true);
    } catch (e) {
      setError(e.message || 'Could not send inquiry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}
         style={{
           position: 'fixed', inset: 0, background: 'rgba(42, 31, 23, 0.45)',
           display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
           padding: 24,
         }}>
      <div style={{
        background: B.surface, borderRadius: 8, maxWidth: 600, width: '100%',
        maxHeight: '90vh', overflow: 'auto', border: `1px solid ${B.line}`,
        boxShadow: '0 12px 40px rgba(42, 31, 23, 0.25)',
      }}>
        <div style={{
          padding: '20px 28px 16px', borderBottom: `1px solid ${B.line}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <div>
            <h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 600, color: B.text }}>
              {done ? 'Inquiry sent' : `Hire ${targetName.split(' ')[0] || ''}`}
            </h2>
            <p style={{ margin: '4px 0 0', color: B.dim, fontSize: 13 }}>
              {done
                ? 'They\'ll be notified right away.'
                : 'A few structured details makes for a faster reply.'}
            </p>
          </div>
          <button onClick={() => !busy && onClose?.()} disabled={busy} style={{
            background: 'transparent', border: 'none', color: B.dim, fontSize: 18,
            cursor: busy ? 'not-allowed' : 'pointer', padding: 4,
          }}>×</button>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {done ? (
            <DoneStage email={form.inquirer_email} onClose={onClose}/>
          ) : (
            <FormStage
              form={form} update={update}
              error={error} busy={busy}
              onSubmit={submit} onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FormStage({ form, update, error, busy, onSubmit, onCancel }) {
  return (
    <>
      <Row>
        <Field label="Your name *">
          <input value={form.inquirer_name} onChange={(e) => update('inquirer_name', e.target.value)}
                 disabled={busy} style={inputStyle}/>
        </Field>
        <Field label="Your email *">
          <input type="email" value={form.inquirer_email} onChange={(e) => update('inquirer_email', e.target.value)}
                 disabled={busy} style={inputStyle}/>
        </Field>
      </Row>

      <Field label="Phone (optional)">
        <input value={form.inquirer_phone} onChange={(e) => update('inquirer_phone', e.target.value)}
               disabled={busy} placeholder="So they can text or call back" style={inputStyle}/>
      </Field>

      <Row>
        <Field label="Structure">
          <select value={form.structure_type} onChange={(e) => update('structure_type', e.target.value)}
                  disabled={busy} style={inputStyle}>
            <option value="">—</option>
            {STRUCTURE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Job type">
          <select value={form.job_type} onChange={(e) => update('job_type', e.target.value)}
                  disabled={busy} style={inputStyle}>
            <option value="">—</option>
            {JOB_TYPE_CATEGORIES.map(cat => (
              <optgroup key={cat.label} label={cat.label}>
                {cat.jobs.map(j => <option key={j} value={j}>{j}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      </Row>

      <Row>
        <Field label="Location">
          <input value={form.location} onChange={(e) => update('location', e.target.value)}
                 disabled={busy} placeholder="City, ST" style={inputStyle}/>
        </Field>
        <Field label="Timeline">
          <input value={form.timeline} onChange={(e) => update('timeline', e.target.value)}
                 disabled={busy} placeholder='e.g. "Q3 this year"' style={inputStyle}/>
        </Field>
      </Row>

      <Field label="Message *">
        <textarea value={form.message} onChange={(e) => update('message', e.target.value)}
                  disabled={busy} rows={5} placeholder="Quick overview — what's the project?"
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}/>
      </Field>

      {error && (
        <div style={{
          color: B.danger, fontSize: 13, background: '#fff2ec',
          border: `1px solid ${B.danger}`, borderRadius: 4, padding: '8px 12px', marginTop: 10,
        }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button onClick={onCancel} disabled={busy} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={onSubmit} disabled={busy} style={{
          ...primaryBtnStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer',
        }}>{busy ? 'Sending…' : 'Send inquiry'}</button>
      </div>

      <div style={{ marginTop: 12, color: B.faint, fontSize: 11, textAlign: 'center', fontStyle: 'italic' }}>
        No account needed. If they reply, you'll get a magic-link email to continue the conversation.
      </div>
    </>
  );
}

function DoneStage({ email, onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ color: B.text, fontSize: 14, marginBottom: 8 }}>
        Inquiry delivered.
      </div>
      <div style={{ color: B.dim, fontSize: 13, marginBottom: 18 }}>
        If they reply, you'll get a magic-link email at <strong>{email}</strong> — just click to read and respond. No password to remember.
      </div>
      <button onClick={onClose} style={primaryBtnStyle}>Close</button>
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>;
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: B.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {children}
    </div>
  );
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
