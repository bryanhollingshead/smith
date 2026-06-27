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
import {
  CLARIFYING_QUESTIONS, PLAYBACK_PREVIEWS,
  STYLE_OPTIONS, hasStyleStep,
  BUDGET_TIERS, formatBudgetRange,
  DECISION_CRITERIA,
} from '../lib/project-types.js';

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
      body = <SowReviewStep project={project} navigate={navigate}/>;
    } else {
      const afterQs = hasStyleStep(project.kind) ? 'style' : 'budget';
      const nextStep = i + 1 < questions.length ? `q${i + 2}` : afterQs;
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
  } else if (step === 'style') {
    body = (
      <StyleStep
        project={project}
        saving={saving}
        onPick={(opt) => advance({
          style: { tone: opt.value, label: opt.label, refs: [] },
          step: 'budget',
        })}
        onBack={() => advance({ step: `q${questions.length}` })}
      />
    );
  } else if (step === 'budget') {
    body = (
      <BudgetStep
        project={project}
        saving={saving}
        onPick={(tier) => advance({
          budget: { tier: tier.tier, label: tier.label, range: tier.range },
          step: 'criteria',
        })}
        onBack={() => advance({
          step: hasStyleStep(project.kind) ? 'style' : `q${questions.length}`,
        })}
      />
    );
  } else if (step === 'criteria') {
    body = (
      <CriteriaStep
        project={project}
        saving={saving}
        onBuild={async (criterion) => {
          setSaving(true);
          setError(null);
          try {
            const draftPatch = { decision_criteria: criterion };
            const { project: updated } = await api.post(
              `/projects/${id}/generate-sow`,
              { draft: draftPatch }
            );
            setProject(updated);
          } catch (e) {
            setError(e.data?.error || 'Could not build the spec.');
          } finally {
            setSaving(false);
          }
        }}
        onBack={() => advance({ step: 'budget' })}
      />
    );
  } else if (step === 'review') {
    body = project.sow
      ? <SowReviewStep project={project} navigate={navigate}/>
      : <ReviewMissingSowStep project={project}/>;
  } else {
    body = <SowReviewStep project={project} navigate={navigate}/>;
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

// ── Step 6: Style direction (skipped for non-aesthetic project types) ─────
function StyleStep({ project, saving, onPick, onBack }) {
  const options = STYLE_OPTIONS[project.kind] || STYLE_OPTIONS.custom;
  const current = project.draft?.style?.tone;
  return (
    <div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 28, fontWeight: 600, lineHeight: 1.15,
        letterSpacing: '-0.02em', color: B.text,
      }}>What's the vibe?</h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 22px' }}>
        Pick a direction. Pros will propose specifics that fit your house.
        You can change it later.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onPick(opt)}
            disabled={saving}
            style={{
              background: current === opt.value ? B.accentSoft : B.surface,
              border: `1px solid ${current === opt.value ? B.accent : B.line}`,
              borderRadius: 8, padding: '14px 18px', textAlign: 'left',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}>
            <div className="serif" style={{
              color: B.text, fontSize: 15, fontWeight: 600,
            }}>{opt.label}</div>
            <div style={{
              color: B.dim, fontSize: 12.5, fontStyle: 'italic', marginTop: 2,
            }}>{opt.note}</div>
          </button>
        ))}
      </div>
      <BackLink onClick={onBack} disabled={saving}/>
    </div>
  );
}

// ── Step 7: Budget comfort ────────────────────────────────────────────────
function BudgetStep({ project, saving, onPick, onBack }) {
  const tiers = BUDGET_TIERS[project.kind] || BUDGET_TIERS.custom;
  const current = project.draft?.budget?.tier;
  return (
    <div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 28, fontWeight: 600, lineHeight: 1.15,
        letterSpacing: '-0.02em', color: B.text,
      }}>What's your budget comfort?</h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 22px' }}>
        Not a quote — the zone you're comfortable in. Bids will come in
        within or near it.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tiers.map(tier => (
          <button
            key={tier.tier}
            onClick={() => onPick(tier)}
            disabled={saving}
            style={{
              background: current === tier.tier ? B.accentSoft : B.surface,
              border: `1px solid ${current === tier.tier ? B.accent : B.line}`,
              borderRadius: 8, padding: '14px 18px', textAlign: 'left',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}>
            <div className="serif" style={{
              color: B.text, fontSize: 15, fontWeight: 600,
              display: 'flex', justifyContent: 'space-between', gap: 12,
            }}>
              <span>{tier.label}</span>
              {tier.range && (
                <span style={{ color: B.dim, fontWeight: 500 }}>
                  {formatBudgetRange(tier.range)}
                </span>
              )}
            </div>
            <div style={{
              color: B.dim, fontSize: 12.5, fontStyle: 'italic', marginTop: 2,
            }}>{tier.note}</div>
          </button>
        ))}
      </div>
      <BackLink onClick={onBack} disabled={saving}/>
    </div>
  );
}

// ── Step 8: Decision criteria → triggers SOW generation on Build ──────────
function CriteriaStep({ project, saving, onBuild, onBack }) {
  const [selection, setSelection] = useState(project.draft?.decision_criteria || null);
  return (
    <div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 28, fontWeight: 600, lineHeight: 1.15,
        letterSpacing: '-0.02em', color: B.text,
      }}>What matters most when picking a bid?</h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 22px' }}>
        This tells whoever bids whether to compete on price or fit. Pick
        one — change it later if you want.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DECISION_CRITERIA.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSelection(opt.value)}
            disabled={saving}
            style={{
              background: selection === opt.value ? B.accentSoft : B.surface,
              border: `1px solid ${selection === opt.value ? B.accent : B.line}`,
              borderRadius: 8, padding: '14px 18px', textAlign: 'left',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}>
            <div className="serif" style={{
              color: B.text, fontSize: 15, fontWeight: 600,
            }}>{opt.label}</div>
            <div style={{
              color: B.dim, fontSize: 12.5, fontStyle: 'italic', marginTop: 2,
            }}>{opt.note}</div>
          </button>
        ))}
      </div>
      <div style={{
        marginTop: 24, display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 12,
      }}>
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
        <button
          onClick={() => selection && onBuild(selection)}
          disabled={!selection || saving}
          style={{
            background: B.text, color: B.surface, border: 'none',
            padding: '12px 22px', borderRadius: 100,
            fontSize: 14, fontWeight: 600,
            cursor: selection && !saving ? 'pointer' : 'not-allowed',
            opacity: selection && !saving ? 1 : 0.55,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
          {saving ? 'Building…' : 'Build the spec'}{' '}
          <Icon name="arrow-r" size={14} stroke={2.4}/>
        </button>
      </div>
    </div>
  );
}

// ── Step 9: Review the SOW ────────────────────────────────────────────────
function SowReviewStep({ project, navigate }) {
  const sow = project.sow || {};
  const scopeIn = (sow.scope || []).filter(s => s.in_or_out !== 'out');
  const scopeOut = (sow.scope || []).filter(s => s.in_or_out === 'out');
  return (
    <div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: B.accentSoft, color: B.accent,
        padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600,
        marginBottom: 14, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <Icon name="check" size={11} stroke={3}/> Spec ready
      </div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 30, fontWeight: 600, lineHeight: 1.1,
        letterSpacing: '-0.025em', color: B.text,
      }}>{project.title}</h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, marginTop: 12 }}>
        Here's the spec the way a contractor will read it. Save it for now —
        sending it to a bidder lands in the next slice.
      </p>

      {/* Summary trio — style / budget / criteria */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10, marginTop: 24,
      }}>
        <SummaryCard label="Style direction"
          value={sow.style?.label || 'Open to suggestions'}/>
        <SummaryCard label="Budget comfort"
          value={sow.budget?.label || '—'}
          sub={sow.budget?.range ? formatBudgetRange(sow.budget.range) : null}/>
        <SummaryCard label="Decision criteria"
          value={DECISION_CRITERIA.find(c => c.value === sow.decision_criteria)?.label || '—'}/>
      </div>

      <SowSection title="Scope of work">
        <ScopeList items={scopeIn}/>
      </SowSection>

      {scopeOut.length > 0 && (
        <SowSection title="Not in scope">
          <ScopeList items={scopeOut} muted/>
        </SowSection>
      )}

      {(sow.assumptions || []).length > 0 && (
        <SowSection title="What Smith is assuming">
          <BulletList items={sow.assumptions}/>
        </SowSection>
      )}

      {(sow.exclusions || []).length > 0 && (
        <SowSection title="Exclusions">
          <BulletList items={sow.exclusions}/>
        </SowSection>
      )}

      {(sow.home_facts || []).length > 0 && (
        <SowSection title="What we know about your house">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {sow.home_facts.map((f, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: `1px dashed ${B.line}`,
              }}>
                <span style={{ color: B.faint, fontSize: 12.5, fontStyle: 'italic' }}>{f.label}</span>
                <span style={{ color: B.text, fontSize: 13.5, fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
          </div>
        </SowSection>
      )}

      <SowSection title="In your words">
        <div style={{
          color: B.text, fontSize: 14, lineHeight: 1.6,
          fontStyle: 'italic', whiteSpace: 'pre-wrap',
        }}>"{sow.homeowner_words || project.draft?.homeowner_words || ''}"</div>
      </SowSection>

      {(sow.context_qa || []).length > 0 && (
        <SowSection title="What we asked you">
          {sow.context_qa.map((row, i) => (
            <div key={i} style={{
              padding: '10px 0',
              borderTop: i ? `1px dashed ${B.line}` : 'none',
            }}>
              <div style={{
                color: B.faint, fontSize: 12, fontStyle: 'italic', marginBottom: 4,
              }}>{row.q}</div>
              <div style={{ color: B.text, fontSize: 14, fontWeight: 600 }}>{row.a}</div>
            </div>
          ))}
        </SowSection>
      )}

      {sow.generated_by === 'stub' && (
        <div style={{
          marginTop: 22, background: B.bg, border: `1px dashed ${B.line}`,
          borderRadius: 6, padding: '10px 14px',
          color: B.faint, fontSize: 12, fontStyle: 'italic',
        }}>
          v1 stub spec. Once the Anthropic key is wired on Render, Claude
          generates this from your answers + house file instead of canned
          templates.
        </div>
      )}

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

// Defensive fallback: project says step='review' but sow is null. Shouldn't
// happen with the criteria-step flow above, but covers the case of someone
// poking at the draft directly.
function ReviewMissingSowStep({ project }) {
  return (
    <div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 26, fontWeight: 600, color: B.text,
      }}>Spec not built yet.</h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, marginTop: 12 }}>
        Head back through the flow and click <em>Build the spec</em> at the
        end of the decision-criteria step.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, sub }) {
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.line}`,
      borderRadius: 8, padding: '12px 14px',
    }}>
      <div style={{
        color: B.faint, fontSize: 10.5, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        marginBottom: 6,
      }}>{label}</div>
      <div className="serif" style={{
        color: B.text, fontSize: 14, fontWeight: 600, lineHeight: 1.25,
      }}>{value}</div>
      {sub && (
        <div style={{ color: B.dim, fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SowSection({ title, children }) {
  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`,
      borderRadius: 8, padding: '18px 22px', marginTop: 16,
    }}>
      <div style={{
        color: B.faint, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12,
      }}>{title}</div>
      {children}
    </section>
  );
}

function ScopeList({ items, muted }) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '7px 0', borderTop: i ? `1px dashed ${B.line}` : 'none',
        }}>
          <Icon
            name={muted ? 'x' : 'check'}
            size={13}
            stroke={2.5}
            style={{ color: muted ? B.faint : B.accent, marginTop: 4, flexShrink: 0 }}
          />
          <div style={{
            color: muted ? B.dim : B.text, fontSize: 14, lineHeight: 1.5,
          }}>{item.line}</div>
        </div>
      ))}
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, color: B.text, fontSize: 14, lineHeight: 1.55 }}>
      {items.map((it, i) => <li key={i} style={{ marginBottom: 4 }}>{it}</li>)}
    </ul>
  );
}

function BackLink({ onClick, disabled }) {
  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          background: 'transparent', border: 'none', color: B.faint,
          fontSize: 13, fontStyle: 'italic', cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
        <Icon name="arrow-l" size={13}/> Back
      </button>
    </div>
  );
}
