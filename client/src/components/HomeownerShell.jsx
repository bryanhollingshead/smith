// Smith — Homeowner-mode shell
//
// Wraps every homeowner-mode screen with the global ProjectShell rail +
// homeowner nav. The "project switcher" at the top of the rail represents
// the user's home(s) (we only support one for now; multi-property comes
// with the property_manager flow later).
//
// Mode toggle lives in the rail footer (provided by ProjectShell's default
// non-roleData footer).

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { ProjectShell } from './ProjectShell.jsx';
import { useRouter, match } from '../lib/router.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import { SeedDashboardPage } from '../pages/SeedDashboard.jsx';
import { SpecPickerPage } from '../pages/SpecPicker.jsx';
import { ProjectSpecPage } from '../pages/ProjectSpec.jsx';
import { Icon } from './Icon.jsx';

// Build the picker URL for "Start a project" CTAs, carrying the hire-me
// pro slug when there's a pending one (so the picker can bind the draft
// to that pro on creation).
function startProjectHref(home) {
  if (!home) return null;
  const isFromHireMe = !!(home.entry_source === 'hire-me' && home.pending_pro_slug);
  return isFromHireMe
    ? `/project/new?home=${home.id}&pro=${encodeURIComponent(home.pending_pro_slug)}`
    : `/project/new?home=${home.id}`;
}

const STATUS_LABEL = {
  draft:        'Draft · keep going',
  sent:         'Sent to pro',
  bidding:      'Awaiting bid',
  awarded:      'Awarded',
  in_progress:  'In progress',
  done:         'Done',
  archived:     'Archived',
};

// Projects index — list when there are drafts, empty state otherwise.
function ProjectsList({ home, navigate }) {
  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!home) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get(`/projects?home_id=${home.id}`);
        if (!cancelled) setProjects(data.projects || []);
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [home?.id]);

  const href = startProjectHref(home);

  if (loading) {
    return <div style={{ padding: 48, color: B.faint, fontStyle: 'italic' }}>Loading…</div>;
  }

  if (!projects || projects.length === 0) {
    return (
      <div style={{ padding: '48px 32px', maxWidth: 640 }}>
        <h1 className="serif" style={{
          margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: B.text,
        }}>No projects yet.</h1>
        <p style={{ color: B.dim, fontSize: 15, lineHeight: 1.6, marginTop: 14 }}>
          Every project at this address — scope, bids, decisions, photos — lives
          here once you start one. They follow the house.
        </p>
        {href && (
          <button
            onClick={() => navigate(href)}
            style={{
              marginTop: 24,
              background: B.text, color: B.surface, border: 'none',
              padding: '12px 22px', borderRadius: 100,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
            Start a project →
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 32px 80px', maxWidth: 920 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', marginBottom: 18,
      }}>
        <h1 className="serif" style={{
          margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: B.text,
        }}>Projects</h1>
        {href && (
          <button
            onClick={() => navigate(href)}
            style={{
              background: B.text, color: B.surface, border: 'none',
              padding: '10px 18px', borderRadius: 100,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            Start a project →
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => navigate(`/project/${p.id}`)}
            style={{
              background: B.surface, border: `1px solid ${B.line}`,
              borderRadius: 8, padding: '16px 20px', textAlign: 'left',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
              fontFamily: 'inherit',
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{
                color: B.text, fontSize: 16, fontWeight: 600,
              }}>{p.title || 'Untitled project'}</div>
              <div style={{ color: B.dim, fontSize: 12.5, fontStyle: 'italic', marginTop: 2 }}>
                {STATUS_LABEL[p.status] || p.status}
              </div>
            </div>
            <Icon name="chevron-r" size={16} style={{ color: B.faint }}/>
          </button>
        ))}
      </div>
    </div>
  );
}

// Fallback for routes that don't exist in homeowner mode.
function HomeownerLost({ path }) {
  return (
    <div style={{ padding: '48px 32px', maxWidth: 720 }}>
      <h1 className="serif" style={{
        margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: B.text,
      }}>Lost your hammer.</h1>
      <p style={{ color: B.dim, fontSize: 15, lineHeight: 1.55, marginTop: 12 }}>
        We can't find <span className="mono">#{path}</span> in homeowner mode.
      </p>
    </div>
  );
}

export function HomeownerShell() {
  const { path, navigate } = useRouter();
  const { user } = useAuth();
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);

  // Find the user's primary home so the project switcher + the "My home"
  // nav item have something real to point at. 404 = they have no home yet
  // (shouldn't happen if mode-switch routing did its job, but we still
  // render the shell so they can see the chrome).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/homes/me/primary');
        if (!cancelled) setHome(data.home);
      } catch {
        if (!cancelled) setHome(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  }, [user?.id]);

  // Active nav-key derived from the route. Homeowner mode has its own
  // small set of destinations; everything else routes to /home/:id.
  const navKey =
    path === '/projects' || path.startsWith('/project/')
      ? 'projects'
      : 'home';

  // Body content for the current route. The shell wraps everything; the
  // children change as the user navigates.
  let body;
  const homeMatch = match('/home/:id', path);
  const projectMatch = match('/project/:id', path);
  if (homeMatch) {
    body = <SeedDashboardPage id={homeMatch.id}/>;
  } else if (path === '/project/new') {
    body = <SpecPickerPage/>;
  } else if (projectMatch) {
    body = <ProjectSpecPage id={projectMatch.id}/>;
  } else if (navKey === 'projects') {
    body = <ProjectsList home={home} navigate={navigate}/>;
  } else if (path === '/' || path === '/feed') {
    // Tradesman default route in homeowner mode → redirect to seed dashboard.
    if (loading) {
      body = <Loading/>;
    } else if (home) {
      setTimeout(() => navigate(`/home/${home.id}`, { replace: true }), 0);
      body = <Loading/>;
    } else {
      // No home yet — homeowner mode without a profile shouldn't happen,
      // but route to the setup flow as a safety net.
      setTimeout(() => navigate('/mode/setup-homeowner', { replace: true }), 0);
      body = <Loading/>;
    }
  } else {
    body = <HomeownerLost path={path}/>;
  }

  return (
    <ProjectShell
      active={navKey}
      role="homeowner"
      project={home ? {
        name: home.address_line1,
        addr: `${home.city}, ${home.state}`,
        cover: 'frame',
        phase: 'New profile',
        color: B.success,
      } : { name: 'No home yet', addr: '', cover: 'frame' }}
      navItems={[
        { k: 'home',       label: 'My home',         icon: 'home',
          onClick: () => home && navigate(`/home/${home.id}`),
          sub: home ? `${home.city}, ${home.state}` : 'Setting up…' },
        { k: 'projects',   label: 'Projects',        icon: 'briefcase',
          onClick: () => navigate('/projects'),
          sub: 'Start one here' },
      ]}>
      {body}
    </ProjectShell>
  );
}

function Loading() {
  return (
    <div style={{
      padding: 80, color: B.faint, fontStyle: 'italic', fontSize: 14,
    }}>Loading…</div>
  );
}
