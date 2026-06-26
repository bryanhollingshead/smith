// Smith — Project spec (homeowner project flow, in-progress)
//
// Route: /project/:id — authed. V1 placeholder: confirms the draft project
// was created, and is the route the picker lands the user on. The real
// multi-step flow (free-text → playback → Claude classifier → coordination
// question if multi-trade → clarifying questions → style → budget →
// decision criteria → SOW generation) lands in follow-on commits.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';

export function ProjectSpecPage({ id }) {
  const { navigate } = useRouter();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return <div style={{ padding: 80, color: B.faint, fontStyle: 'italic' }}>Loading…</div>;
  }
  if (!project) {
    return <div style={{ padding: 80, color: B.danger }}>{error || 'Project not found.'}</div>;
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: 720, margin: '0 auto' }}>
      <button
        onClick={() => navigate(`/home/${project.home_id}`)}
        style={{
          background: 'transparent', border: 'none', color: B.faint,
          fontSize: 13, fontStyle: 'italic', cursor: 'pointer', padding: 0,
          marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
        <Icon name="arrow-l" size={14}/> Back to your home
      </button>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: B.accentSoft, color: B.accent,
        padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600,
        marginBottom: 14, letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        <Icon name="check" size={11} stroke={3}/> Draft started
      </div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 32, fontWeight: 600, color: B.text, letterSpacing: '-0.025em',
      }}>{project.title || 'New project'}</h1>
      <p style={{ color: B.dim, fontSize: 15, lineHeight: 1.6, marginTop: 14 }}>
        Your draft is saved. The next step — describing the work in your own
        words and letting Smith translate into a real spec — lands shortly.
      </p>
      <p style={{ color: B.faint, fontSize: 13, fontStyle: 'italic', marginTop: 22 }}>
        Find this draft anytime from Projects in the left rail.
      </p>
    </div>
  );
}
