// Smith — App entry
// Owns the routing-vs-auth logic: unauthenticated users get auth pages,
// unverified users get pushed into confirm-email, users without onboarding
// get pushed into the trade-selection screen, everyone else gets the app.

import React from 'react';
import { B } from './lib/theme.js';
import { useAuth } from './lib/AuthContext.jsx';
import { useRouter, match } from './lib/router.jsx';

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
import { NewsPage } from './pages/News.jsx';
import { NewsSavedPage } from './pages/NewsSaved.jsx';
import { AdminNewsPage } from './pages/AdminNews.jsx';

export function App() {
  const { user, booted } = useAuth();
  const { path, navigate } = useRouter();

  // Allow the password-reset flow to be reached even when signed in,
  // because the user clicked a link from email.
  const publicPaths = ['/auth/signin', '/auth/signup', '/auth/forgot', '/auth/reset'];
  const isPublic = publicPaths.includes(path);

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

  // Not signed in: only auth pages are reachable.
  if (!user) {
    if (path === '/auth/signup')  return <SignUpPage/>;
    if (path === '/auth/forgot')  return <ForgotPasswordPage/>;
    if (path === '/auth/reset')   return <ResetPasswordPage/>;
    if (path === '/auth/signin')  return <SignInPage/>;
    // Default: send to sign-in.
    if (path !== '/auth/signin') {
      // Use replace to avoid a stack of identical redirects.
      setTimeout(() => navigate('/auth/signin', { replace: true }), 0);
    }
    return <SignInPage/>;
  }

  // Signed in. Block in-app navigation until verified + onboarded.
  if (!user.email_verified) return <ConfirmEmailPage/>;
  if (!user.onboarding_done) return <OnboardingPage/>;

  // Authenticated, verified, onboarded — route!
  if (path === '/' || path === '/feed') return <FeedPage/>;
  if (path === '/profile') return <ProfilePage/>;
  if (path === '/profile/edit') return <EditProfilePage/>;
  const profIdMatch = match('/profile/:id', path);
  if (profIdMatch) return <ProfilePage userId={parseInt(profIdMatch.id, 10)}/>;
  if (path === '/network') return <NetworkPage/>;
  if (path === '/alerts') return <AlertsPage/>;
  if (path === '/news') return <NewsPage/>;
  if (path === '/news/saved') return <NewsSavedPage/>;
  if (path === '/admin/news') return <AdminNewsPage/>;

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
}
