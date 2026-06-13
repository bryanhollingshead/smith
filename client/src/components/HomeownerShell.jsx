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

// Stub pages for homeowner-mode nav destinations that haven't been built
// yet. Each links back to the journal's "next handoff" framing so the
// reader knows this is intentional, not lost.
function HomeownerStub({ title, blurb }) {
  return (
    <div style={{ padding: '48px 32px', maxWidth: 720 }}>
      <h1 className="serif" style={{
        margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: B.text,
      }}>{title}</h1>
      <p style={{ color: B.dim, fontSize: 15, lineHeight: 1.55, marginTop: 12 }}>
        {blurb}
      </p>
      <p style={{ color: B.faint, fontSize: 13, fontStyle: 'italic', marginTop: 28 }}>
        Coming in the next handoff. The shell + mode toggle ship now so the
        homeowner side has a real seat at the table.
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
    path === '/find-pros' ? 'find-pros' :
    path === '/projects' ? 'projects' :
    path === '/inquiries-sent' ? 'inquiries' :
    path === '/saved-pros' ? 'saved' :
    'home';

  // Body content for the current route. The shell wraps everything; the
  // children change as the user navigates.
  let body;
  const homeMatch = match('/home/:id', path);
  if (homeMatch) {
    body = <SeedDashboardPage id={homeMatch.id}/>;
  } else if (navKey === 'find-pros') {
    body = <HomeownerStub
      title="Find a pro"
      blurb="Search and shortlist trusted tradesmen by trade, location, and the work they've actually done. The same network the trades use to connect — opened up for homeowners."/>;
  } else if (navKey === 'projects') {
    body = <HomeownerStub
      title="My projects"
      blurb="Every project at your home or property in one place — scope, bids, decisions, photos, the works. Project initiation lands with the next handoff."/>;
  } else if (navKey === 'inquiries') {
    body = <HomeownerStub
      title="Inquiries sent"
      blurb="Track every Hire Me you've sent — who's read it, who's replied, what stage you're at. Magic-link replies feed back here."/>;
  } else if (navKey === 'saved') {
    body = <HomeownerStub
      title="Saved tradesmen"
      blurb="The pros you've shortlisted, organized by trade. Add notes, jump back to any profile, send a follow-up inquiry in one click."/>;
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
    body = <HomeownerStub
      title="Lost your hammer."
      blurb={`We can't find #${path} in homeowner mode.`}/>;
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
        { k: 'find-pros',  label: 'Find a pro',      icon: 'search',
          onClick: () => navigate('/find-pros'),
          sub: 'Search the network' },
        { k: 'projects',   label: 'My projects',     icon: 'briefcase',
          onClick: () => navigate('/projects'),
          sub: 'Coming soon' },
        { k: 'inquiries',  label: 'Inquiries sent',  icon: 'send',
          onClick: () => navigate('/inquiries-sent'),
          sub: 'Coming soon' },
        { k: 'saved',      label: 'Saved tradesmen', icon: 'star',
          onClick: () => navigate('/saved-pros'),
          sub: 'Coming soon' },
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
