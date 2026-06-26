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

// Empty state for the Projects page when the user hasn't started one yet.
// CTA routes to the same describe-the-work flow the seed dashboard surfaces.
function ProjectsEmpty({ home, navigate }) {
  const isFromHireMe = !!(home && home.entry_source === 'hire-me' && home.pending_pro_slug);
  const startHref = home
    ? (isFromHireMe
        ? `/todo/describe-work?pro=${encodeURIComponent(home.pending_pro_slug)}&home=${home.id}`
        : `/todo/describe-work?home=${home.id}`)
    : null;
  return (
    <div style={{ padding: '48px 32px', maxWidth: 640 }}>
      <h1 className="serif" style={{
        margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: B.text,
      }}>No projects yet.</h1>
      <p style={{ color: B.dim, fontSize: 15, lineHeight: 1.6, marginTop: 14 }}>
        Every project at this address — scope, bids, decisions, photos — lives
        here once you start one. They follow the house.
      </p>
      {startHref && (
        <button
          onClick={() => navigate(startHref)}
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
    path === '/projects' ? 'projects' :
    'home';

  // Body content for the current route. The shell wraps everything; the
  // children change as the user navigates.
  let body;
  const homeMatch = match('/home/:id', path);
  if (homeMatch) {
    body = <SeedDashboardPage id={homeMatch.id}/>;
  } else if (navKey === 'projects') {
    body = <ProjectsEmpty home={home} navigate={navigate}/>;
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
