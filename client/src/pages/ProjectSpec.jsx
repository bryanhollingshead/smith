// Smith — Project spec (homeowner project flow, in-progress)
//
// Route: /project/:id — authed. A linear step machine driven by
// project.draft.step. Each step writes its slice into draft and advances.
// Steps in v1:
//   describe  → free-text "in your own words"
//   playback  → reflects user's words + previews what Smith will ask
//   q1..q3    → three hardcoded clarifying questions per project type
//   review    → stub end-state. Style, budget, decision criteria, and the
//               Claude-generated SOW land in follow-on commits.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';
import { CLARIFYING_QUESTIONS, PLAYBACK_PREVIEWS } from '../lib/project-types.js';

export function ProjectSpecPage({ id }) {
  const { navigate } = useRouter();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { project } = await api.get(`/projects/${id}`);
        if (!cancelled) setProject(project);
      } catch (e) {
        if (!cancelled) setError(e.data?.error || 'Could not load this project.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const advance = async (patch) => {
    setSaving(true);
    setError(null);
    try {
      const newDraft = { ...(project.draft || {}), ...patch };
      const { project: updated } = await api.patch(`/projects/${id}`, { draft: newDraft });
      setProject(updated);
    } catch (e) {
      setError(e.data?.error || 'Could not save your answer.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 80, color: B.faint, fontStyle: 'italic' }}>Loading…</div>;
  }
  if (!project) {
    return <div style={{ padding: 80, color: B.danger }}>{error || 'Project not found.'}</div>;
  }

  const step = project.draft?.step || 'describe';
  const questions = CLARIFYING_QUESTIONS[project.kind] || CLARIFYING_QUESTIONS.custom;

  let body;
  if (step === 'describe') {
    body = (
      <DescribeStep
        project={project}
        saving={saving}
        onContinue={(words) => advance({ homeowner_words: words, step: 'playback' })}
      />
    );
  } else if (step === 'playback') {
    body = (
      <PlaybackStep
        project={project}
        saving={saving}
        onContinue={() => advance({ playback_confirmed: true, step: 'q1' })}
        onEdit={() => advance({ step: 'describe' })}
      />
    );
  } else if (step.startsWith('q')) {
    const i = parseInt(step.slice(1), 10) - 1;
    const question = questions[i];
    if (!question) {
      // Shouldn't happen with current question counts, but if a project type
      // had fewer questions than the step claims, advance to review.
      body = <ReviewStep project={project} navigate={navigate}/>;
    } else {
      const nextStep = i + 1 < questions.length ? `q${i + 2}` : 'review';
      const backStep = i === 0 ? 'playback' : `q${i}`;
      body = (
        <QuestionStep
          stepIndex={i}
          stepCount={questions.length}
          question={question}
          saving={saving}
          currentAnswer={(project.draft?.qa || [])[i]?.a}
          onAnswer={(answer) => {
            const qa = (project.draft?.qa || []).slice();
            qa[i] = { q: question.q, a: answer };
            advance({ qa, step: nextStep });
          }}
          onBack={() => advance({ step: backStep })}
        />
      );
    }
  } else {
    body = <ReviewStep project={project} navigate={navigate}/>;
  }

  return (
    <SpecShell project={project} step={step} navigate={navigate} saving={saving} error={error}>
      {body}
    </SpecShell>
  );
}

function SpecShell({ project, step, navigate, saving, error, children }) {
  return (
    <div style={{ padding: '40px 32px 80px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={() => navigate(`/home/${project.home_id}`)}
          style={{
            background: 'transparent', border: 'none', color: B.faint,
            fontSize: 13, fontStyle: 'italic', cursor: 'pointer', padding: 0,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          <Icon name="arrow-l" size={14}/> Save & come back
        </button>
        {saving && (
          <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>Saving…</span>
        )}
      </div>
      <div style={{
        color: B.faint, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14,
      }}>
        {project.title || 'New project'}
      </div>
      {children}
      {error && (
        <div style={{
          marginTop: 18, background: B.dangerSoft, color: B.danger,
          border: `1px solid ${B.danger}`, borderRadius: 6,
          padding: '10px 14px', fontSize: 13,
        }}>{error}</div>
      )}
    </div>
  );
}

// ── Step 1: Describe ──────────────────────────────────────────────────────
function DescribeStep({ project, saving, onContinue }) {
  const [text, setText] = useState(project.draft?.homeowner_words || '');
  const ready = text.trim().length > 0 && !saving;
  return (
    <div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 30, fontWeight: 600, lineHeight: 1.1,
        letterSpacing: '-0.025em', color: B.text,
      }}>Tell Smith what you want — in your own words.</h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 6px' }}>
        Describe it like you'd describe it to a friend. Smith fills in the
        trade details and only asks what we can't infer from your home file.
      </p>
      <p style={{ color: B.faint, fontSize: 12.5, fontStyle: 'italic', margin: '0 0 22px' }}>
        We already know your house — start from there.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Example: tear out the old tub, keep the cast iron one. Want a more modern look — feels dated. The fan barely works. Open to changing the layout if it saves money."
        rows={9}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: B.surface, color: B.text,
          border: `1px solid ${B.line}`, borderRadius: 8,
          padding: '14px 16px', fontSize: 15, lineHeight: 1.55,
          fontFamily: 'inherit', resize: 'vertical', outline: 'none',
        }}/>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <button
          onClick={() => onContinue(text.trim())}
          disabled={!ready}
          style={{
            background: B.text, color: B.surface, border: 'none',
            padding: '12px 22px', borderRadius: 100,
            fontSize: 14, fontWeight: 600,
            cursor: ready ? 'pointer' : 'not-allowed',
            opacity: ready ? 1 : 0.55,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
          Continue <Icon name="arrow-r" size={14} stroke={2.4}/>
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Playback ──────────────────────────────────────────────────────
function PlaybackStep({ project, saving, onContinue, onEdit }) {
  const preview = PLAYBACK_PREVIEWS[project.kind] || PLAYBACK_PREVIEWS.custom;
  return (
    <div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 30, fontWeight: 600, lineHeight: 1.1,
        letterSpacing: '-0.025em', color: B.text,
      }}>Here's what we heard.</h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 22px' }}>
        Push back on anything off, or keep going.
      </p>
      <div style={{
        background: B.surface, border: `1px solid ${B.line}`,
        borderRadius: 8, padding: '20px 22px', marginBottom: 16,
      }}>
        <div style={{
          color: B.faint, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8,
        }}>In your words</div>
        <p style={{
          color: B.text, fontSize: 15, lineHeight: 1.6, margin: 0,
          fontStyle: 'italic', whiteSpace: 'pre-wrap',
        }}>"{project.draft?.homeowner_words || ''}"</p>
      </div>
      <div style={{
        background: B.accentSoft, border: `1px solid ${B.accent}`,
        borderRadius: 8, padding: '16px 20px', marginBottom: 24,
        color: B.text, fontSize: 14, lineHeight: 1.55,
      }}>
        <div style={{
          color: B.accent, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6,
        }}>Next up</div>
        {preview}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button
          onClick={onEdit}
          disabled={saving}
          style={{
            background: 'transparent', color: B.dim,
            border: `1px solid ${B.line}`,
            padding: '12px 22px', borderRadius: 100,
            fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>
          Back to edit
        </button>
        <button
          onClick={onContinue}
          disabled={saving}
          style={{
            background: B.text, color: B.surface, border: 'none',
            padding: '12px 22px', borderRadius: 100,
            fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.55 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
          Keep going <Icon name="arrow-r" size={14} stroke={2.4}/>
        </button>
      </div>
    </div>
  );
}

// ── Steps 3..5: Clarifying questions ──────────────────────────────────────
function QuestionStep({ stepIndex, stepCount, question, saving, currentAnswer, onAnswer, onBack }) {
  const [other, setOther] = useState('');
  const [showOther, setShowOther] = useState(false);
  return (
    <div>
      <div style={{ color: B.faint, fontSize: 11.5, fontStyle: 'italic', marginBottom: 10 }}>
        Question {stepIndex + 1} of {stepCount}
      </div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 26, fontWeight: 600, lineHeight: 1.2,
        letterSpacing: '-0.015em', color: B.text,
      }}>{question.q}</h1>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10, marginTop: 24,
      }}>
        {question.options.map(opt => (
          <button
            key={opt}
            onClick={() => onAnswer(opt)}
            disabled={saving}
            style={{
              background: currentAnswer === opt ? B.accentSoft : B.surface,
              border: `1px solid ${currentAnswer === opt ? B.accent : B.line}`,
              borderRadius: 8, padding: '14px 18px', textAlign: 'left',
              fontSize: 14, fontWeight: 600, color: B.text,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 120ms, background 120ms',
            }}>
            {opt}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 18 }}>
        {!showOther ? (
          <button
            onClick={() => setShowOther(true)}
            style={{
              background: 'transparent', border: 'none', color: B.accent,
              fontSize: 13, fontStyle: 'italic', cursor: 'pointer', padding: 0,
            }}>
            Something else? Tell us →
          </button>
        ) : (
          <div>
            <input
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="In your own words"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && other.trim() && !saving) {
                  onAnswer(other.trim());
                }
              }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: B.surface, border: `1px solid ${B.accent}`,
                borderRadius: 8, padding: '12px 14px', fontSize: 14,
                color: B.text, fontFamily: 'inherit', outline: 'none',
              }}/>
            <button
              onClick={() => other.trim() && onAnswer(other.trim())}
              disabled={!other.trim() || saving}
              style={{
                marginTop: 10,
                background: B.text, color: B.surface, border: 'none',
                padding: '10px 18px', borderRadius: 100,
                fontSize: 13, fontWeight: 600,
                cursor: other.trim() && !saving ? 'pointer' : 'not-allowed',
                opacity: other.trim() && !saving ? 1 : 0.55,
              }}>
              Use this answer
            </button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 32 }}>
        <button
          onClick={onBack}
          disabled={saving}
          style={{
            background: 'transparent', border: 'none', color: B.faint,
            fontSize: 13, fontStyle: 'italic', cursor: 'pointer', padding: 0,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          <Icon name="arrow-l" size={13}/> Back
        </button>
      </div>
    </div>
  );
}

// ── Final step (v1 stub): Review ──────────────────────────────────────────
function ReviewStep({ project, navigate }) {
  const qa = project.draft?.qa || [];
  return (
    <div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: B.accentSoft, color: B.accent,
        padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600,
        marginBottom: 14, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <Icon name="check" size={11} stroke={3}/> Spec captured
      </div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 30, fontWeight: 600, lineHeight: 1.1,
        letterSpacing: '-0.025em', color: B.text,
      }}>Smith has what it needs.</h1>
      <p style={{ color: B.dim, fontSize: 15, lineHeight: 1.6, marginTop: 14 }}>
        Your description and answers are saved. The next iteration lands the
        rest of the flow — style direction, budget comfort, decision criteria,
        and the SOW Smith translates into trade-speak for the bidding pro.
      </p>

      <section style={{
        background: B.surface, border: `1px solid ${B.line}`,
        borderRadius: 8, padding: '20px 22px', marginTop: 24,
      }}>
        <div style={{
          color: B.faint, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12,
        }}>What we have so far</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{
            color: B.faint, fontSize: 12, fontStyle: 'italic', marginBottom: 4,
          }}>In your words</div>
          <div style={{
            color: B.text, fontSize: 14, lineHeight: 1.55, fontStyle: 'italic',
            whiteSpace: 'pre-wrap',
          }}>"{project.draft?.homeowner_words || ''}"</div>
        </div>
        {qa.map((row, i) => (
          <div key={i} style={{
            borderTop: `1px dashed ${B.line}`, paddingTop: 12, marginTop: 12,
          }}>
            <div style={{
              color: B.faint, fontSize: 12, fontStyle: 'italic', marginBottom: 4,
            }}>{row.q}</div>
            <div style={{ color: B.text, fontSize: 14, fontWeight: 600 }}>
              {row.a}
            </div>
          </div>
        ))}
      </section>

      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-start' }}>
        <button
          onClick={() => navigate(`/home/${project.home_id}`)}
          style={{
            background: B.text, color: B.surface, border: 'none',
            padding: '12px 22px', borderRadius: 100,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
          Back to your home <Icon name="arrow-r" size={14} stroke={2.4}/>
        </button>
      </div>
    </div>
  );
}
