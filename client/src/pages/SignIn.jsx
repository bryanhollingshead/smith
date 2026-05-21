// Smith — Sign in page (+ landing story below the fold)
//
// First fold: the AuthShell sign-in form on the left, "The work is the résumé"
// hero photo on the right. Identical to before.
//
// Below the fold: three "moments" cards that show what Smith does without
// explaining what Smith does. Avatar-tone accents bleed behind the cards as
// subtle Smith-brand fingerprints (rust, wood, slate, brick). A second
// sign-up CTA at the bottom, and a minimal footer.
//
// Why the landing lives inside SignIn instead of a separate page:
//   - Routing already lands unauthenticated users on SignIn
//   - Signed-in users never see this page (App.jsx routes them straight to /feed)
//   - One file is easier to maintain than splitting and cross-linking
//
// Eventually (post-launch) we may want a marketing-only page at "/" that's
// separate from sign-in. For now this is the right shape.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import {
  AuthShell, AuthLabel, AuthInput, PasswordInput,
  PrimaryButton, GhostButton,
} from '../components/AuthShell.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

export function SignInPage() {
  const { signIn, loading } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    try {
      const u = await signIn(email.trim(), password);
      navigate(u.onboarding_done ? '/feed' : '/onboarding');
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not sign in');
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && email && password) submit();
  };

  return (
    // Wrapper governs the document scroll. AuthShell sets its own
    // minHeight: 100vh, so the first fold fills the viewport and the
    // landing sections scroll into view naturally underneath.
    <div style={{ background: B.bg }}>
      <AuthShell
        eyebrow="Welcome back"
        title="Sign in to Smith"
        subtitle="Pick up where you left off — your network, your projects, your next job."
        hero={{
          title: 'The work is the résumé.',
          body: 'A network for carpenters, electricians, masons, GCs and subs, and the crews behind the build.',
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <GhostButton onClick={() => navigate('/auth/signup')}>
              ← New here? Create an account
            </GhostButton>
            <PrimaryButton disabled={loading || !email || !password} onClick={submit}>
              Sign in <Icon name="arrow-r" size={14} stroke={2.4}/>
            </PrimaryButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <AuthLabel>Email</AuthLabel>
            <AuthInput
              icon="mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={onKey}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <AuthLabel>Password</AuthLabel>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

          {error && (
            <div style={{
              color: B.danger, fontSize: 13,
              background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
              padding: '10px 14px',
            }}>{error}</div>
          )}

          <div style={{ paddingTop: 4, color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
            Forgot it?{' '}
            <a href="#/auth/forgot" style={{ color: B.accent, fontStyle: 'normal', fontWeight: 600, textDecoration: 'none' }}>
              Reset your password
            </a>
          </div>

          <div style={{
            marginTop: 8, padding: '12px 16px',
            background: B.accentSoft, border: `1px solid ${B.line}`, borderRadius: 4,
            color: B.dim, fontSize: 12.5, lineHeight: 1.55,
          }}>
            <strong style={{ color: B.text }}>Try the demo:</strong>{' '}
            <span className="mono">marcus.whitfield@smith.test</span> /{' '}
            <span className="mono">framer-2024-mt</span>
          </div>
        </div>
      </AuthShell>

      {/* ── BELOW THE FOLD ────────────────────────────────────────────── */}
      <LandingMoments/>
      <LandingCTA navigate={navigate}/>
      <LandingFooter/>
    </div>
  );
}

// ── The three "moments" — what Smith does, without explaining it ──────────
//
// Each card is a moment from a tradesperson's actual day, not a feature
// description. The headline is the moment; the body is the why.
// Avatar tones (rust, wood, slate, brick) sit behind each card as a subtle
// brand fingerprint.

const MOMENTS = [
  {
    accent: '#9A5A2A',           // rust — keys to the rust avatar tone
    accentSoft: '#9A5A2A12',
    headline: 'Your work, where a GC can see it.',
    body: 'Showcase your real jobsites — photos, what you built, what you led. Not a résumé. The actual work.',
    icon: 'tool',
  },
  {
    accent: '#6B5040',           // wood
    accentSoft: '#6B504012',
    headline: 'Licenses and insurance, kept current.',
    body: 'Upload them once. When a new contractor asks for your credentials, share a link. They see what\u2019s verified. Done.',
    icon: 'shield',
  },
  {
    accent: '#4A5560',           // slate
    accentSoft: '#4A556012',
    headline: 'Hire from your circle, or beyond it.',
    body: 'The journeyman who showed up clean for two years on someone else\u2019s crew. Or the steady electrician three towns over that everyone you trust has worked with. Smith makes finding them possible.',
    icon: 'briefcase',
  },
];

function LandingMoments() {
  return (
    <section style={{
      padding: '88px 40px 64px',
      borderTop: `1px solid ${B.line}`,
      background: B.bg,
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ maxWidth: 720, marginBottom: 56 }}>
          <div style={{
            color: B.accent, fontSize: 12, fontStyle: 'italic',
            marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            What Smith does
          </div>
          <h2 className="serif" style={{
            margin: 0, fontSize: 36, fontWeight: 600,
            letterSpacing: '-0.025em', lineHeight: 1.15, color: B.text,
          }}>
            Built for the way the trades actually work.
          </h2>
        </header>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          alignItems: 'stretch',
        }}>
          {MOMENTS.map((m, i) => <MomentCard key={i} {...m}/>)}
        </div>
      </div>
    </section>
  );
}

function MomentCard({ accent, accentSoft, headline, body, icon }) {
  return (
    <article style={{
      position: 'relative',
      background: B.surface,
      border: `1px solid ${B.line}`,
      borderRadius: 4,
      padding: '36px 32px 32px',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 16,
      minHeight: 280,
    }}>
      {/* The accent: a soft bleed of the avatar tone behind the card.
          Anchored to the top-right corner — far enough from the text not
          to compromise contrast. */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        top: -60, right: -60,
        width: 220, height: 220,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${accent}38, ${accentSoft} 60%, transparent 75%)`,
        pointerEvents: 'none',
      }}/>

      {/* The icon — sized like a small architectural mark. */}
      <div style={{
        position: 'relative',
        width: 44, height: 44,
        borderRadius: 4,
        background: B.surface2,
        border: `1px solid ${B.line}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
      }}>
        <Icon name={icon} size={20}/>
      </div>

      <h3 className="serif" style={{
        position: 'relative',
        margin: 0, fontSize: 22, fontWeight: 600,
        letterSpacing: '-0.015em', lineHeight: 1.25, color: B.text,
      }}>
        {headline}
      </h3>

      <p style={{
        position: 'relative',
        margin: 0, color: B.dim, fontSize: 14.5, lineHeight: 1.6,
      }}>
        {body}
      </p>
    </article>
  );
}

// ── Bottom CTA ────────────────────────────────────────────────────────────
function LandingCTA({ navigate }) {
  return (
    <section style={{
      padding: '88px 40px',
      borderTop: `1px solid ${B.line}`,
      background: B.surface,
    }}>
      <div style={{
        maxWidth: 720, margin: '0 auto', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      }}>
        <h2 className="serif" style={{
          margin: 0, fontSize: 36, fontWeight: 600,
          letterSpacing: '-0.025em', lineHeight: 1.15, color: B.text,
        }}>
          Set up your profile in ten minutes.
        </h2>
        <p style={{
          margin: 0, color: B.dim, fontSize: 16, lineHeight: 1.6, maxWidth: 520,
        }}>
          Free to join. No résumé builder, no buzzwords. Just your trade,
          your work, your people.
        </p>
        <div style={{ marginTop: 12 }}>
          <PrimaryButton onClick={() => navigate('/auth/signup')}>
            Create an account <Icon name="arrow-r" size={14} stroke={2.4}/>
          </PrimaryButton>
        </div>
      </div>
    </section>
  );
}

// ── Minimal footer ────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer style={{
      padding: '32px 40px',
      borderTop: `1px solid ${B.line}`,
      background: B.bg,
      color: B.faint, fontSize: 12,
      display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div>©{new Date().getFullYear()} Smith · Built in Salt Lake City</div>
      <div>
        Contact:{' '}
        <a href="mailto:bryan@smith.app" style={{
          color: B.dim, textDecoration: 'none', fontWeight: 500,
        }}>bryan@smith.app</a>
      </div>
    </footer>
  );
}
