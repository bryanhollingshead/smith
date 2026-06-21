// Smith — App entry
// Owns the routing-vs-auth logic: unauthenticated users get the Landing
// marketing page by default (or auth pages at /auth/*), unverified users
// get pushed into confirm-email, users without onboarding get pushed into
// the trade-selection screen, everyone else gets the app.

import React from 'react';
import { B } from './lib/theme.js';
import { useAuth } from './lib/AuthContext.jsx';
import { useRouter, match } from './lib/router.jsx';

import { LandingPage } from './pages/Landing.jsx';
import { SignInPage } from './pages/SignIn.jsx';
import { SignUpPage } from './pages/SignUp.jsx';
import { ConfirmEmailPage } from './pages/ConfirmEmail.jsx';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/Password.jsx';
import { OnboardingPage } from './pages/Onboarding.jsx';
import { ProfilePage } from './pages/Profile.jsx';
import { EditProfilePage } from './pages/EditProfile.jsx';
import { FeedPage } from './pages/Feed.jsx';
import { NetworkPage } from './pages/Network.jsx';
import { AlertsPage } from './pages/Alerts.jsx';
import { CompanyPage } from './pages/Company.jsx';
import { NewsPage } from './pages/News.jsx';
import { NewsSavedPage } from './pages/NewsSaved.jsx';
import { JobsPage } from './pages/Jobs.jsx';
import { PublicProfilePage } from './pages/PublicProfile.jsx';
import { MagicLinkReplyPage } from './pages/MagicLinkReply.jsx';
import { InquiriesPage } from './pages/Inquiries.jsx';
import { AdminNewsPage } from './pages/AdminNews.jsx';
import { MessagesPage } from './pages/Messages.jsx';
import { MessagesProvider } from './lib/MessagesContext.jsx';
import { HireMeEntryPage } from './pages/HireMeEntry.jsx';
import { HomeownerSignupPage } from './pages/HomeownerSignup.jsx';
import { AddressFoundPage } from './pages/AddressFound.jsx';
import { SeedDashboardPage } from './pages/SeedDashboard.jsx';
import { SignUpStartPage } from './pages/SignUpStart.jsx';
import { ModeSetupHomeownerPage } from './pages/ModeSetupHomeowner.jsx';
import { ModeSetupTradesmanPage } from './pages/ModeSetupTradesman.jsx';
import { HomeownerShell } from './components/HomeownerShell.jsx';
import { ImpersonationBanner } from './components/AdminTools.jsx';
import { modeOf, MODE } from './lib/mode.js';

export function App() {
  const { user, booted } = useAuth();
  const { path, navigate } = useRouter();

  // Don't render anything until we've checked the saved token.
  if (!booted) {
    return (
      <div style={{
        background: B.bg, color: B.faint, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontStyle: 'italic', fontSize: 14,
      }}>
        Loading Smith…
      </div>
    );
  }

  // Not signed in: serve the marketing Landing page at "/" and explicit
  // auth pages at /auth/*. Anything else (e.g. someone bookmarked /feed
  // before signing out) is treated as a Landing visit too — no forced
  // redirect, since they're not actually trying to authenticate.
  if (!user) {
    if (path === '/auth/signup')    return <SignUpPage/>;
    if (path === '/auth/forgot')    return <ForgotPasswordPage/>;
    if (path === '/auth/reset')     return <ResetPasswordPage/>;
    if (path === '/auth/signin')    return <SignInPage/>;
    // Phase 7: intent picker is the new first step of account creation.
    if (path === '/auth/start')     return <SignUpStartPage/>;
    // Phase 6: homeowner self-serve signup is also publicly reachable.
    if (path === '/auth/homeowner') return <HomeownerSignupPage/>;
    // Phase 5: public profile + magic-link reply pages are reachable without auth.
    const slugMatchPub = match('/profile/:slug', path);
    if (slugMatchPub && !/^\d+$/.test(slugMatchPub.slug)) {
      return <PublicProfilePage slug={slugMatchPub.slug}/>;
    }
    // Phase 6: hire-me entry (homeowner-acquisition path #1) is public — it
    // collects an address then routes to /auth/homeowner with the address
    // pre-filled.
    const hireMatch = match('/hire/:slug', path);
    if (hireMatch) return <HireMeEntryPage slug={hireMatch.slug}/>;
    const tokenMatchPub = match('/h/:token', path);
    if (tokenMatchPub) return <MagicLinkReplyPage token={tokenMatchPub.token}/>;
    // Default: marketing landing page. No redirect — visitors see Smith
    // before being asked to sign in.
    return <LandingPage/>;
  }

  // Signed in. Block in-app navigation until verified + onboarded.
  if (!user.email_verified) return <ConfirmEmailPage/>;
  if (!user.onboarding_done) return <OnboardingPage/>;

  // Phase 7: setup-mode flows live outside both shells (they're transitional
  // by definition — the user is mid-switch and may not have the target
  // mode's profile yet).
  if (path === '/mode/setup-homeowner') return <ModeSetupHomeownerPage/>;
  if (path === '/mode/setup-tradesman') return <ModeSetupTradesmanPage/>;

  // AddressFound is a transitional "is this your home?" screen with its own
  // step-counter chrome — render it outside the shell in any mode.
  const homeConfirmMatchTop = match('/home/:id/confirm', path);
  if (homeConfirmMatchTop) {
    return (
      <>
        <ImpersonationBanner/>
        <MessagesProvider>
          <AddressFoundPage id={homeConfirmMatchTop.id}/>
        </MessagesProvider>
      </>
    );
  }

  // Phase 7: shell fork by active mode. Homeowner mode gets its own
  // shell (left rail + homeowner nav); tradesman mode is the legacy
  // TopNav + route tree.
  if (modeOf(user) === MODE.HOMEOWNER) {
    return (
      <>
        <ImpersonationBanner/>
        <MessagesProvider>
          <HomeownerShell/>
        </MessagesProvider>
      </>
    );
  }

  // Tradesman shell — the existing experience.
  // Authenticated, verified, onboarded — route. Wrap the whole authenticated
  // tree in MessagesProvider so the websocket opens once and the nav badge
  // updates everywhere.
  return (
    <>
    <ImpersonationBanner/>
    <MessagesProvider>
      {(() => {
        if (path === '/' || path === '/feed') return <FeedPage/>;
        if (path === '/profile') return <ProfilePage/>;
        if (path === '/profile/edit') return <EditProfilePage/>;
        // Phase 5 routing: numeric → authed profile by id; slug → public render.
        const profIdMatch = match('/profile/:id', path);
        if (profIdMatch) {
          if (/^\d+$/.test(profIdMatch.id)) {
            return <ProfilePage userId={parseInt(profIdMatch.id, 10)}/>;
          }
          return <PublicProfilePage slug={profIdMatch.id}/>;
        }
        if (path === '/connections') return <NetworkPage/>;
        // Old /network URL: keep redirecting to /connections so external
        // links and bookmarks survive the rename.
        if (path === '/network') {
          setTimeout(() => navigate('/connections', { replace: true }), 0);
          return <NetworkPage/>;
        }
        if (path === '/alerts') return <AlertsPage/>;
        const companyMatch = match('/company/:id', path);
        if (companyMatch) return <CompanyPage companyIdOrSlug={companyMatch.id}/>;
        if (path === '/news') return <NewsPage/>;
        if (path === '/news/saved') return <NewsSavedPage/>;
        if (path === '/jobs') return <JobsPage/>;
        if (path === '/inquiries') return <InquiriesPage/>;
        if (path === '/admin/news') return <AdminNewsPage/>;
        if (path === '/messages') return <MessagesPage/>;
        const msgMatch = match('/messages/:id', path);
        if (msgMatch) return <MessagesPage threadIdParam={msgMatch.id}/>;
        // Phase 6: homeowner seed-home flow — authed-only (post-signup).
        const homeConfirmMatch = match('/home/:id/confirm', path);
        if (homeConfirmMatch) return <AddressFoundPage id={homeConfirmMatch.id}/>;
        const homeMatch = match('/home/:id', path);
        if (homeMatch) return <SeedDashboardPage id={homeMatch.id}/>;
        // A homeowner who navigates to /hire/:slug while signed in still
        // belongs in the entry flow — they may want to mint a fresh home
        // bound to a different pro. Reuses the public component.
        const hireMatch = match('/hire/:slug', path);
        if (hireMatch) return <HireMeEntryPage slug={hireMatch.slug}/>;
        const tokenMatch = match('/h/:token', path);
        if (tokenMatch) return <MagicLinkReplyPage token={tokenMatch.token}/>;

        // Hitting an auth page while signed in: bounce to /feed.
        if (path.startsWith('/auth/')) {
          setTimeout(() => navigate('/feed', { replace: true }), 0);
          return <FeedPage/>;
        }

        // 404
        return (
          <div style={{
            background: B.bg, color: B.text, minHeight: '100vh',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 14,
          }}>
            <div className="serif" style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em' }}>
              Lost your hammer.
            </div>
            <div style={{ color: B.dim, fontSize: 14 }}>
              We can't find <span className="mono">#{path}</span>.
            </div>
            <button onClick={() => navigate('/feed')} style={{
              background: B.text, border: 'none', color: B.surface,
              padding: '10px 22px', borderRadius: 100, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', marginTop: 8,
            }}>Back to the feed</button>
          </div>
        );
      })()}
    </MessagesProvider>
    </>
  );
}
