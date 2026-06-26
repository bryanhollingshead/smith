// Smith — Spec picker (homeowner project flow, step 1)
//
// Route: /project/new?home=:id&pro=:slug — authed. The user picks what kind
// of project they're starting. Submitting creates a draft `projects` row
// and routes to /project/:id. The "What your house is asking for" section
// is structurally present but empty until the data-driven type catalog
// (memory: spec-flow-architecture) ships eligibility rules.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';
import { PROJECT_TYPES } from '../lib/project-types.js';

export function SpecPickerPage() {
  const { params, navigate } = useRouter();
  const homeId = parseInt(params.home, 10);
  const proSlug = params.pro || null;
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const pick = async (kind) => {
    if (!Number.isFinite(homeId)) {
      setError('Missing home. Head back to your home page and try again.');
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      const body = { home_id: homeId, kind };
      if (proSlug) body.pending_pro_slug = proSlug;
      const { project } = await api.post('/projects', body);
      navigate(`/project/${project.id}`);
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not start your project.');
      setBusy(null);
    }
  };

  return (
    <div style={{ padding: '40px 32px 80px', maxWidth: 920, margin: '0 auto' }}>
      <button
        onClick={() => navigate(Number.isFinite(homeId) ? `/home/${homeId}` : '/feed')}
        style={{
          background: 'transparent', border: 'none', color: B.faint,
          fontSize: 13, fontStyle: 'italic', cursor: 'pointer', padding: 0,
          marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
        <Icon name="arrow-l" size={14}/> Back to your home
      </button>

      <h1 className="serif" style={{
        margin: 0, fontSize: 32, fontWeight: 600, color: B.text,
        letterSpacing: '-0.025em', lineHeight: 1.1,
      }}>What are you thinking about doing?</h1>
      <p style={{ color: B.dim, fontSize: 15, lineHeight: 1.55, margin: '12px 0 32px' }}>
        Pick one to start — or tell Smith in your own words. We fill in the
        trade details and only ask what we can't infer from your home file.
      </p>

      <section>
        <div style={{
          color: B.faint, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12,
        }}>
          Common projects
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
        }}>
          {PROJECT_TYPES.map(t => (
            <PickerTile
              key={t.kind}
              type={t}
              busy={busy === t.kind}
              dim={!!busy && busy !== t.kind}
              onPick={() => pick(t.kind)}
            />
          ))}
        </div>
      </section>

      {error && (
        <div style={{
          marginTop: 18, background: B.dangerSoft, color: B.danger,
          border: `1px solid ${B.danger}`, borderRadius: 6,
          padding: '10px 14px', fontSize: 13,
        }}>{error}</div>
      )}

      <p style={{
        color: B.faint, fontSize: 12.5, fontStyle: 'italic',
        marginTop: 28, lineHeight: 1.55,
      }}>
        Whatever you pick, Smith remembers everything for next time. Your
        house gets smarter every project.
      </p>
    </div>
  );
}

function PickerTile({ type, busy, dim, onPick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onPick}
      disabled={busy || dim}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: B.surface,
        border: `1px solid ${hover ? B.accent : B.line}`,
        borderRadius: 8, padding: '18px 20px', textAlign: 'left',
        cursor: busy ? 'progress' : (dim ? 'not-allowed' : 'pointer'),
        opacity: dim ? 0.55 : 1,
        display: 'flex', alignItems: 'flex-start', gap: 14,
        transition: 'border-color 120ms',
        fontFamily: 'inherit',
      }}>
      <div style={{
        width: 36, height: 36, borderRadius: 6, flexShrink: 0,
        background: B.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: B.accent,
      }}>
        <Icon name={type.icon} size={18}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{
          color: B.text, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em',
        }}>{type.title}</div>
        <div style={{ color: B.dim, fontSize: 12.5, fontStyle: 'italic', marginTop: 2 }}>
          {type.sub}
        </div>
      </div>
      {busy && (
        <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic', marginLeft: 8 }}>
          Starting…
        </div>
      )}
    </button>
  );
}
