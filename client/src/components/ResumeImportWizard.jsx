// Smith — Resume import wizard
//
// Two screens in a single modal:
//   1. Upload — drop a PDF, POST to /api/profiles/me/resume/parse
//   2. Review — edit the prefilled sections, deselect ones to skip, then save
//      by POSTing each enabled section to /api/profiles/me/interview/step.
//
// Why one-screen-review (vs. multi-step wizard): the parsed data is small and
// the user wants to see everything at once before committing. Five "next →
// save" clicks is friction; one "save everything" click is not.

import React, { useRef, useState } from 'react';
import { B } from '../lib/theme.js';
import { api, auth as authStore } from '../lib/api.js';

export function ResumeImportWizard({ onClose, onComplete }) {
  const [stage, setStage] = useState('upload'); // 'upload' | 'review' | 'saving' | 'done'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const inputRef = useRef(null);

  // Section enable toggles — default ON when the parser returned content.
  const [enabled, setEnabled] = useState({
    header: true, trades: true, skills: true, licenses: true, work_history: true,
  });

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('PDF too large (10 MB max).');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { prefill } = await api.upload('/profiles/me/resume/parse', form);
      setPrefill(prefill);
      // Auto-disable any section that came back empty.
      setEnabled({
        header: !!(prefill.headline || prefill.about || prefill.location || prefill.years_experience),
        trades: (prefill.trades || []).length > 0,
        skills: (prefill.skills || []).length > 0,
        licenses: (prefill.licenses || []).length > 0,
        work_history: (prefill.work_history || []).length > 0,
      });
      setStage('review');
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not parse the PDF.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!prefill) return;
    setBusy(true);
    setError(null);
    setStage('saving');
    try {
      if (enabled.header) {
        await api.post('/profiles/me/interview/step', {
          step: 'header',
          data: {
            headline: prefill.headline || '',
            about: prefill.about || '',
            location: prefill.location || '',
            years_experience: prefill.years_experience || 0,
          },
        });
      }
      if (enabled.trades && (prefill.trades || []).length) {
        await api.post('/profiles/me/interview/step', {
          step: 'trades',
          data: { trades: prefill.trades },
        });
      }
      if (enabled.skills && (prefill.skills || []).length) {
        await api.post('/profiles/me/interview/step', {
          step: 'skills',
          data: { skills: prefill.skills },
        });
      }
      if (enabled.licenses && (prefill.licenses || []).length) {
        await api.post('/profiles/me/interview/step', {
          step: 'licenses',
          data: { licenses: prefill.licenses },
        });
      }
      if (enabled.work_history && (prefill.work_history || []).length) {
        await api.post('/profiles/me/interview/step', {
          step: 'work_history',
          data: { work_history: prefill.work_history },
        });
      }
      setStage('done');
      onComplete?.();
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not save.');
      setStage('review');
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
        background: B.surface, borderRadius: 8, maxWidth: 720, width: '100%',
        maxHeight: '85vh', overflow: 'auto', border: `1px solid ${B.line}`,
        boxShadow: '0 12px 40px rgba(42, 31, 23, 0.25)',
      }}>
        <div style={{
          padding: '20px 28px 16px', borderBottom: `1px solid ${B.line}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <div>
            <h2 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 600, color: B.text }}>
              Import from resume
            </h2>
            <p style={{ margin: '4px 0 0', color: B.dim, fontSize: 13 }}>
              {stage === 'upload' && 'Drop a PDF, we\'ll pre-fill your profile.'}
              {stage === 'review' && 'Edit anything before saving. Uncheck sections you want to skip.'}
              {stage === 'saving' && 'Saving to your profile…'}
              {stage === 'done' && 'Done — your profile has been updated.'}
            </p>
          </div>
          <button onClick={() => !busy && onClose?.()} disabled={busy} style={{
            background: 'transparent', border: 'none', color: B.dim, fontSize: 18,
            cursor: busy ? 'not-allowed' : 'pointer', padding: 4,
          }}>×</button>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {stage === 'upload' && (
            <UploadStage
              busy={busy}
              error={error}
              onChoose={() => inputRef.current?.click()}
              inputRef={inputRef}
              onFile={handleFile}
            />
          )}

          {(stage === 'review' || stage === 'saving') && prefill && (
            <ReviewStage
              prefill={prefill}
              setPrefill={setPrefill}
              enabled={enabled}
              setEnabled={setEnabled}
              busy={busy}
              error={error}
              onSave={save}
              onCancel={() => !busy && onClose?.()}
            />
          )}

          {stage === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ color: B.text, fontSize: 15, marginBottom: 16 }}>
                Profile updated. You can keep editing or close this.
              </div>
              <button onClick={() => onClose?.()} style={primaryBtnStyle}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadStage({ busy, error, onChoose, inputRef, onFile }) {
  return (
    <div>
      <div style={{
        border: `2px dashed ${B.line}`, borderRadius: 6, padding: '40px 20px',
        textAlign: 'center', background: B.bg,
      }}>
        <div style={{ color: B.dim, fontSize: 13, marginBottom: 12 }}>
          Text-PDF only. Scanned images aren't supported yet.
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button onClick={onChoose} disabled={busy} style={{
          ...primaryBtnStyle,
          opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer',
        }}>
          {busy ? 'Parsing…' : 'Choose PDF'}
        </button>
      </div>
      {error && <ErrorBanner msg={error}/>}
    </div>
  );
}

function ReviewStage({ prefill, setPrefill, enabled, setEnabled, busy, error, onSave, onCancel }) {
  const counts = {
    trades: (prefill.trades || []).length,
    skills: (prefill.skills || []).length,
    licenses: (prefill.licenses || []).length,
    work_history: (prefill.work_history || []).length,
  };
  const update = (patch) => setPrefill(p => ({ ...p, ...patch }));

  return (
    <div>
      <Section title="Header & about" check={enabled.header} setCheck={(v) => setEnabled(e => ({ ...e, header: v }))}>
        <Field label="Headline">
          <input value={prefill.headline || ''} onChange={(e) => update({ headline: e.target.value })} style={inputStyle}/>
        </Field>
        <Field label="Location">
          <input value={prefill.location || ''} onChange={(e) => update({ location: e.target.value })} style={inputStyle}/>
        </Field>
        <Field label="Years of experience">
          <input type="number" value={prefill.years_experience || 0}
                 onChange={(e) => update({ years_experience: parseInt(e.target.value, 10) || 0 })}
                 style={{ ...inputStyle, width: 100 }}/>
        </Field>
        <Field label="About">
          <textarea value={prefill.about || ''} onChange={(e) => update({ about: e.target.value })}
                    rows={3} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}/>
        </Field>
      </Section>

      <Section title={`Trades (${counts.trades})`} check={enabled.trades} setCheck={(v) => setEnabled(e => ({ ...e, trades: v }))}>
        {counts.trades === 0 ? <Empty/> : (prefill.trades || []).map((t, i) => (
          <RowPair key={i}>
            <input value={t.name} onChange={(e) => updateListItem(prefill, setPrefill, 'trades', i, { name: e.target.value })} style={{ ...inputStyle, flex: 1 }}/>
            <input type="number" value={t.years} onChange={(e) => updateListItem(prefill, setPrefill, 'trades', i, { years: parseInt(e.target.value, 10) || 0 })} style={{ ...inputStyle, width: 80 }} placeholder="years"/>
            <RemoveBtn onClick={() => removeListItem(prefill, setPrefill, 'trades', i)}/>
          </RowPair>
        ))}
      </Section>

      <Section title={`Work history (${counts.work_history})`} check={enabled.work_history} setCheck={(v) => setEnabled(e => ({ ...e, work_history: v }))}>
        {counts.work_history === 0 ? <Empty/> : (prefill.work_history || []).map((w, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <input value={w.company_name} onChange={(e) => updateListItem(prefill, setPrefill, 'work_history', i, { company_name: e.target.value })} style={inputStyle} placeholder="Company"/>
            <input value={w.role} onChange={(e) => updateListItem(prefill, setPrefill, 'work_history', i, { role: e.target.value })} style={inputStyle} placeholder="Role"/>
            <input value={w.from_year} onChange={(e) => updateListItem(prefill, setPrefill, 'work_history', i, { from_year: e.target.value })} style={inputStyle} placeholder="From"/>
            <input value={w.is_current ? 'now' : (w.to_year || '')} onChange={(e) => {
              const v = e.target.value.trim().toLowerCase();
              if (v === 'now' || v === 'present' || v === 'current') {
                updateListItem(prefill, setPrefill, 'work_history', i, { is_current: true, to_year: '' });
              } else {
                updateListItem(prefill, setPrefill, 'work_history', i, { is_current: false, to_year: e.target.value });
              }
            }} style={inputStyle} placeholder="To"/>
            <RemoveBtn onClick={() => removeListItem(prefill, setPrefill, 'work_history', i)}/>
          </div>
        ))}
      </Section>

      <Section title={`Credentials (${counts.licenses})`} check={enabled.licenses} setCheck={(v) => setEnabled(e => ({ ...e, licenses: v }))}>
        {counts.licenses === 0 ? <Empty/> : (prefill.licenses || []).map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 100px auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <input value={l.name} onChange={(e) => updateListItem(prefill, setPrefill, 'licenses', i, { name: e.target.value })} style={inputStyle} placeholder="Name"/>
            <input value={l.number} onChange={(e) => updateListItem(prefill, setPrefill, 'licenses', i, { number: e.target.value })} style={inputStyle} placeholder="Number"/>
            <input value={l.expiration} onChange={(e) => updateListItem(prefill, setPrefill, 'licenses', i, { expiration: e.target.value })} style={inputStyle} placeholder="YYYY-MM"/>
            <RemoveBtn onClick={() => removeListItem(prefill, setPrefill, 'licenses', i)}/>
          </div>
        ))}
      </Section>

      <Section title={`Skills (${counts.skills})`} check={enabled.skills} setCheck={(v) => setEnabled(e => ({ ...e, skills: v }))}>
        {counts.skills === 0 ? <Empty/> : (prefill.skills || []).map((s, i) => (
          <RowPair key={i}>
            <input value={s.name} onChange={(e) => updateListItem(prefill, setPrefill, 'skills', i, { name: e.target.value })} style={{ ...inputStyle, flex: 1 }}/>
            <input type="number" min={1} max={5} value={s.level || 3} onChange={(e) => updateListItem(prefill, setPrefill, 'skills', i, { level: parseInt(e.target.value, 10) || 3 })} style={{ ...inputStyle, width: 80 }} placeholder="1-5"/>
            <RemoveBtn onClick={() => removeListItem(prefill, setPrefill, 'skills', i)}/>
          </RowPair>
        ))}
      </Section>

      {error && <ErrorBanner msg={error}/>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <button onClick={onCancel} disabled={busy} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={onSave} disabled={busy} style={{
          ...primaryBtnStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer',
        }}>{busy ? 'Saving…' : 'Save to profile'}</button>
      </div>
    </div>
  );
}

function updateListItem(prefill, setPrefill, key, idx, patch) {
  setPrefill(p => {
    const arr = [...(p[key] || [])];
    arr[idx] = { ...arr[idx], ...patch };
    return { ...p, [key]: arr };
  });
}
function removeListItem(prefill, setPrefill, key, idx) {
  setPrefill(p => ({ ...p, [key]: (p[key] || []).filter((_, i) => i !== idx) }));
}

// ── Small UI bits ────────────────────────────────────────────────────────
function Section({ title, check, setCheck, children }) {
  return (
    <div style={{
      marginBottom: 18, padding: 14, border: `1px solid ${B.line}`, borderRadius: 6,
      background: check ? B.surface : B.bg, opacity: check ? 1 : 0.6,
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: B.text, marginBottom: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)}/>
        {title}
      </label>
      {check && <div>{children}</div>}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: B.dim, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {children}
    </div>
  );
}
function RowPair({ children }) {
  return <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>{children}</div>;
}
function RemoveBtn({ onClick }) {
  return <button onClick={onClick} style={{
    background: 'transparent', border: 'none', color: B.dim, cursor: 'pointer',
    fontSize: 14, padding: '4px 8px',
  }}>×</button>;
}
function Empty() {
  return <div style={{ color: B.faint, fontSize: 13, fontStyle: 'italic' }}>Nothing extracted.</div>;
}
function ErrorBanner({ msg }) {
  return <div style={{
    color: B.danger, fontSize: 13, background: '#fff2ec',
    border: `1px solid ${B.danger}`, borderRadius: 4, padding: '8px 12px', marginTop: 10,
  }}>{msg}</div>;
}

const inputStyle = {
  background: B.surface, border: `1px solid ${B.line}`, color: B.text,
  padding: '7px 9px', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const primaryBtnStyle = {
  background: B.text, color: B.surface, border: 'none', padding: '9px 20px',
  borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const secondaryBtnStyle = {
  background: 'transparent', color: B.text, border: `1px solid ${B.line}`,
  padding: '9px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
