// Smith — Landing page (marketing surface at /)
//
// The first page anyone hits when they're not signed in. Visual goals:
// polished, serious, clearly for trade people (not tech bros). Mirrors the
// React-converted draft we iterated on in Claude's artifact.
//
// Sections, top to bottom:
//   1. Nav — logo + product links + sign-in + primary CTA
//   2. Hero — "The work is the résumé." + architectural-blueprint visual
//   3. Credibility band — six trade types named explicitly
//   4. What Smith does — three feature cards (work / credentials / network)
//   5. Pull-quote — manifesto on dark background
//   6. How it works — three-step onboarding flow
//   7. Final CTA — "The work is what counts. Let it count."
//   8. Footer — sitemap + contact
//
// Future: when product screens are ready, swap the architectural blueprint
// in Hero for a layered composition of real Smith UI, and add an "Inside
// Smith" gallery section between #4 and #5.

import React from 'react';
import { B } from '../lib/theme.js';
import { useRouter } from '../lib/router.jsx';

// Centralized link targets so we can rewire navigation in one place if
// these routes ever move.
const ROUTES = {
  signin:    '/auth/signin',
  // `signup` used to point directly at the tradesman credentials page; we
  // now fork through the intent picker at /auth/start. The fast-path
  // accent link below the hero CTAs still goes straight to /auth/homeowner
  // for users who already know they're hiring.
  signup:    '/auth/start',
  forgot:    '/auth/forgot',
  homeowner: '/auth/homeowner',
};

export function LandingPage() {
  const { navigate } = useRouter();
  const go = (route) => () => navigate(route);

  return (
    <div style={{ background: B.bg, color: B.text, minHeight: '100vh' }}>
      <LandingNav navigate={navigate}/>
      <Hero navigate={navigate}/>
      <CredibilityBand/>
      <WhatSmithDoes/>
      <ManifestoQuote/>
      <HowItWorks/>
      <FinalCTA onCTA={go(ROUTES.signup)}/>
      <Footer/>
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────
// Sticky-feeling top bar: wordmark on the left, anchor links + sign-in +
// primary CTA on the right. The anchor links scroll to in-page sections
// (we use hash fragments that just target IDs further down).
function LandingNav({ navigate }) {
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 48px',
      borderBottom: `0.5px solid ${B.line}`,
      background: B.bg,
    }}>
      <Wordmark/>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 28,
        fontSize: 13.5, color: B.dim,
      }}>
        <a href="#how-it-works" style={navLinkStyle}>How it works</a>
        <a href="#for-trades"   style={navLinkStyle}>For trades</a>
        <a href="#for-gcs"      style={navLinkStyle}>For GCs</a>
        <a
          href={ROUTES.signin}
          onClick={(e) => { e.preventDefault(); navigate(ROUTES.signin); }}
          style={navLinkStyle}
        >Sign in</a>
        <button
          onClick={() => navigate(ROUTES.signup)}
          style={{
            background: B.text, color: B.surface, border: 'none',
            padding: '8px 16px', borderRadius: 100,
            fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
            cursor: 'pointer',
          }}>
          Create account →
        </button>
      </div>
    </nav>
  );
}

const navLinkStyle = {
  color: B.dim, textDecoration: 'none', fontFamily: 'inherit',
};

// Reusable Smith wordmark — serif name with a small accent dot.
function Wordmark({ size = 22 }) {
  return (
    <div className="serif" style={{
      fontSize: size, fontWeight: 600, letterSpacing: '-0.02em', color: B.text,
    }}>
      Smith<span style={{ color: B.accent }}>.</span>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────
// Two-column layout: copy + CTAs on the left, architectural-blueprint
// visual on the right. The blueprint is original SVG (not stock photo),
// keyed to Smith's rust/leather palette, evoking a section-elevation
// drawing — the kind of artifact actual builders look at.
function Hero({ navigate }) {
  return (
    <section style={{
      padding: '88px 48px 96px',
      maxWidth: 1280, margin: '0 auto',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.9fr',
        gap: 64, alignItems: 'center',
      }}>
        {/* LEFT: copy */}
        <div>
          <Eyebrow>Smith — for makers</Eyebrow>
          <h1 className="serif" style={{
            fontSize: 64, fontWeight: 500,
            letterSpacing: '-0.035em', lineHeight: 1.02,
            margin: '18px 0 24px',
          }}>
            The work<br/>is the<br/>
            <span style={{ color: B.accent }}>résumé.</span>
          </h1>
          <p style={{
            fontSize: 17.5, lineHeight: 1.55, color: B.dim,
            maxWidth: 480, margin: '0 0 36px',
          }}>
            A professional network for the people who actually build —
            carpenters, electricians, masons, GCs, and the crews behind
            every project.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => navigate(ROUTES.signup)}
              style={primaryButtonStyle}>
              Create your profile →
            </button>
            <a href="#how-it-works" style={{ textDecoration: 'none' }}>
              <button style={secondaryButtonStyle}>See how it works</button>
            </a>
          </div>
          {/* Homeowner entry — surfaced quietly under the trade-pitched
              hero CTAs until the landing page gets a full redesign that
              treats homeowners as a first-class audience. */}
          <div style={{
            marginTop: 18, fontSize: 13.5, color: B.dim,
          }}>
            Own a home?{' '}
            <button
              onClick={() => navigate(ROUTES.homeowner)}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                color: B.accent, fontWeight: 600, cursor: 'pointer',
                fontSize: 13.5, fontFamily: 'inherit',
              }}>
              Claim your home →
            </button>
          </div>
          <div style={{
            marginTop: 32,
            fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
            fontSize: 11, color: B.faint, letterSpacing: '0.04em',
          }}>
            FREE TO JOIN · NO RÉSUMÉ BUILDER · BUILT IN SALT LAKE CITY
          </div>
        </div>

        {/* RIGHT: architectural blueprint visual */}
        <HeroBlueprint/>
      </div>
    </section>
  );
}

// Architectural section-elevation drawing rendered in SVG. Dark-brown
// background, blueprint-grid + framed-structure linework in Smith accent,
// dimension callouts in mono type. Reads as a serious construction artifact.
//
// This is the placeholder for the eventual "real product screens" hero.
// When we have polished UI shots, we replace this component's body with a
// layered composition; the wrapper sizing stays.
function HeroBlueprint() {
  return (
    <div style={{
      position: 'relative',
      aspectRatio: '4 / 5',
      background: B.text,
      borderRadius: 8,
      overflow: 'hidden',
      display: 'flex', alignItems: 'flex-end',
      padding: 32,
    }}>
      <svg
        viewBox="0 0 400 500"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true">
        <rect width="400" height="500" fill={B.text}/>
        {/* Blueprint grid */}
        <g stroke={B.accent} strokeWidth="0.5" opacity="0.18">
          <line x1="0" y1="80"  x2="400" y2="80"/>
          <line x1="0" y1="160" x2="400" y2="160"/>
          <line x1="0" y1="240" x2="400" y2="240"/>
          <line x1="0" y1="320" x2="400" y2="320"/>
          <line x1="0" y1="400" x2="400" y2="400"/>
          <line x1="80"  y1="0" x2="80"  y2="500"/>
          <line x1="160" y1="0" x2="160" y2="500"/>
          <line x1="240" y1="0" x2="240" y2="500"/>
          <line x1="320" y1="0" x2="320" y2="500"/>
        </g>
        {/* Framed structure */}
        <g stroke={B.accent} strokeWidth="1.5" fill="none">
          <rect x="80" y="120" width="240" height="280"/>
          <line x1="80" y1="180" x2="320" y2="180"/>
          <line x1="80" y1="260" x2="320" y2="260"/>
          <line x1="80" y1="340" x2="320" y2="340"/>
          <line x1="140" y1="120" x2="140" y2="400"/>
          <line x1="200" y1="120" x2="200" y2="400"/>
          <line x1="260" y1="120" x2="260" y2="400"/>
          {/* Diagonal bracing */}
          <line x1="80"  y1="120" x2="320" y2="400" strokeDasharray="4 4" opacity="0.5"/>
          <line x1="320" y1="120" x2="80"  y2="400" strokeDasharray="4 4" opacity="0.5"/>
        </g>
        {/* Dimension callouts */}
        <g fill={B.accent} fontFamily="IBM Plex Mono, monospace" fontSize="9" opacity="0.7">
          <text x="200" y="105" textAnchor="middle">240"</text>
          <text x="68"  y="265" textAnchor="end">280"</text>
          <text x="332" y="135">A.1</text>
          <text x="332" y="195">A.2</text>
        </g>
      </svg>
      <div style={{
        position: 'relative', zIndex: 1,
        color: B.surface,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10, letterSpacing: '0.08em', opacity: 0.6,
      }}>
        FIG. 01 — SECTION ELEVATION
      </div>
    </div>
  );
}

// ── Credibility band ─────────────────────────────────────────────────────
// Names the trades explicitly. Visitors immediately self-identify ("oh,
// this is for me") without having to scroll and infer. Replaces fake
// testimonials with real specificity.
function CredibilityBand() {
  const trades = ['Carpenters', 'Electricians', 'Masons', 'Plumbers', 'GCs & Subs', 'Foremen'];
  return (
    <section style={{
      borderTop:    `0.5px solid ${B.line}`,
      borderBottom: `0.5px solid ${B.line}`,
      padding: '28px 48px',
      background: B.surface,
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 32,
      }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11, color: B.faint,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          Built for ↓
        </div>
        <div style={{
          display: 'flex', gap: 36, flex: 1, justifyContent: 'center',
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 19, fontWeight: 500, color: B.text,
        }}>
          {trades.map((t, i) => (
            <React.Fragment key={t}>
              <span>{t}</span>
              {i < trades.length - 1 && <span style={{ color: B.line }}>·</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── What Smith does ──────────────────────────────────────────────────────
// Three feature cards in a tight grid. Each card has:
//   - Numbered editorial prefix (01 / WORK)
//   - Custom SVG mark (not stock icon)
//   - Serif headline with concrete claim
//   - Body paragraph in dim color
//   - Mono caption listing what's inside
function WhatSmithDoes() {
  return (
    <section id="for-trades" style={{
      padding: '112px 48px 88px',
      maxWidth: 1280, margin: '0 auto',
    }}>
      <header style={{ maxWidth: 720, marginBottom: 64 }}>
        <Eyebrow>What Smith does</Eyebrow>
        <h2 className="serif" style={{
          fontSize: 44, fontWeight: 500,
          letterSpacing: '-0.025em', lineHeight: 1.08,
          margin: '14px 0 18px',
        }}>
          Built for the way the trades actually work.
        </h2>
        <p style={{
          fontSize: 17, color: B.dim, lineHeight: 1.6,
          maxWidth: 580, margin: 0,
        }}>
          No buzzwords. No résumé builder. Just the tools you need to show
          your work, prove your credentials, and find your next crew.
        </p>
      </header>

      {/* Bordered grid with 1px gap so the lines between cards form a
          single hairline frame — easier than fiddling per-card borders. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
        background: B.line,
        border: `0.5px solid ${B.line}`,
      }}>
        <FeatureCard
          number="01 / WORK"
          icon={<WorkMark/>}
          headline={<>Your work, where a&nbsp;GC can see it.</>}
          body="Showcase real jobsites — photos, what you built, what you led. Not a résumé. The actual work."
          caption="Photo · Project update · Milestone"
        />
        <FeatureCard
          number="02 / CREDENTIALS"
          icon={<CredentialsMark/>}
          headline="Licenses and insurance, kept current."
          body="Upload them once. When a contractor asks, share a link. They see what's verified. Done."
          caption="Licenses · Insurance · OSHA"
        />
        <FeatureCard
          number="03 / NETWORK"
          icon={<NetworkMark/>}
          headline={<>Hire from your circle, or beyond&nbsp;it.</>}
          body="The journeyman everyone's foreman wishes they could keep. The electrician three towns over everyone trusts. Smith makes finding them possible."
          caption="Search · Connect · Endorse"
        />
      </div>
    </section>
  );
}

function FeatureCard({ number, icon, headline, body, caption }) {
  return (
    <article style={{
      background: B.surface,
      padding: '40px 32px 36px',
      display: 'flex', flexDirection: 'column', gap: 18,
      minHeight: 340,
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11, color: B.accent, letterSpacing: '0.1em',
      }}>
        {number}
      </div>
      <div style={{ margin: '8px 0' }}>{icon}</div>
      <h3 className="serif" style={{
        fontSize: 24, fontWeight: 500,
        letterSpacing: '-0.015em', lineHeight: 1.2,
        margin: 0,
      }}>
        {headline}
      </h3>
      <p style={{
        fontSize: 14.5, color: B.dim, lineHeight: 1.65, margin: 0,
      }}>
        {body}
      </p>
      <div style={{
        marginTop: 'auto',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11, color: B.faint,
        paddingTop: 16, borderTop: `0.5px solid ${B.line}`,
      }}>
        {caption}
      </div>
    </article>
  );
}

// Three custom SVG marks for the feature cards. Each is 56×56 and uses
// only Smith's accent color + text color. Not stock icons; designed to
// match the brand specifically.
function WorkMark() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <rect x="4"  y="20" width="22" height="14" rx="2" fill={B.accent} opacity="0.18"/>
      <rect x="4"  y="20" width="22" height="14" rx="2" fill="none" stroke={B.accent} strokeWidth="1.2"/>
      <rect x="30" y="20" width="22" height="14" rx="2" fill={B.accent} opacity="0.32"/>
      <rect x="30" y="20" width="22" height="14" rx="2" fill="none" stroke={B.accent} strokeWidth="1.2"/>
      <rect x="4"  y="38" width="22" height="14" rx="2" fill={B.accent} opacity="0.50"/>
      <rect x="4"  y="38" width="22" height="14" rx="2" fill="none" stroke={B.accent} strokeWidth="1.2"/>
      <circle cx="45" cy="46" r="6" fill={B.text}/>
      <path d="M42 46 L44 48 L48 44" stroke={B.surface} strokeWidth="1.5"
        fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CredentialsMark() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <rect x="10" y="8" width="30" height="40" rx="2"
        fill={B.accent} opacity="0.15" stroke={B.accent} strokeWidth="1.2"/>
      <line x1="15" y1="18" x2="35" y2="18" stroke={B.accent} strokeWidth="1" opacity="0.5"/>
      <line x1="15" y1="24" x2="35" y2="24" stroke={B.accent} strokeWidth="1" opacity="0.5"/>
      <line x1="15" y1="30" x2="28" y2="30" stroke={B.accent} strokeWidth="1" opacity="0.5"/>
      <circle cx="42" cy="42" r="9" fill={B.text}/>
      <path d="M38 42 L41 45 L46 39" stroke={B.surface} strokeWidth="1.8"
        fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function NetworkMark() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <line x1="12" y1="14" x2="28" y2="28" stroke={B.accent} strokeWidth="1" opacity="0.5"/>
      <line x1="44" y1="14" x2="28" y2="28" stroke={B.accent} strokeWidth="1" opacity="0.5"/>
      <line x1="12" y1="44" x2="28" y2="28" stroke={B.accent} strokeWidth="1" opacity="0.5"/>
      <line x1="44" y1="44" x2="28" y2="28" stroke={B.accent} strokeWidth="1" opacity="0.5"/>
      <circle cx="12" cy="14" r="5" fill={B.accent} opacity="0.4"/>
      <circle cx="44" cy="14" r="5" fill={B.accent} opacity="0.4"/>
      <circle cx="12" cy="44" r="5" fill={B.accent} opacity="0.4"/>
      <circle cx="44" cy="44" r="5" fill={B.accent} opacity="0.4"/>
      <circle cx="28" cy="28" r="7" fill={B.text}/>
    </svg>
  );
}

// ── Manifesto pull-quote ─────────────────────────────────────────────────
// Dark band breaks page rhythm and lets the positioning claim land hard.
// This is where a real customer quote eventually goes; the manifesto line
// is the placeholder.
function ManifestoQuote() {
  return (
    <section id="for-gcs" style={{
      background: B.text, color: B.surface,
      padding: '96px 48px',
    }}>
      <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11, color: B.accent,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          marginBottom: 28,
        }}>
          Why Smith exists
        </div>
        <p className="serif" style={{
          fontSize: 36, fontWeight: 400,
          letterSpacing: '-0.02em', lineHeight: 1.25,
          margin: '0 0 32px',
        }}>
          "LinkedIn is for desk jobs. Smith is for people who actually
          build things — and want their work to speak for itself."
        </p>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11, color: B.faint, letterSpacing: '0.06em',
        }}>
          — THE SMITH MANIFESTO
        </div>
      </div>
    </section>
  );
}

// ── How it works ─────────────────────────────────────────────────────────
// Three-step explainer. Big serif numerals in accent color carry the eye
// through 01 → 02 → 03. Short bodies; this is "what's going to happen
// when I sign up", not deep documentation.
function HowItWorks() {
  const steps = [
    { n: '01', title: 'Sign up free',         body: "Email, password, your name. That's it. No credit card, no résumé import dance." },
    { n: '02', title: 'Build your profile',   body: "Pick your trade. Add specializations. Upload photos of work you've actually done." },
    { n: '03', title: 'Get found',            body: 'Show up in searches. Get endorsed by people you\u2019ve worked with. Get hired.' },
  ];
  return (
    <section id="how-it-works" style={{
      padding: '112px 48px',
      maxWidth: 1280, margin: '0 auto',
    }}>
      <header style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 64px' }}>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="serif" style={{
          fontSize: 44, fontWeight: 500,
          letterSpacing: '-0.025em', lineHeight: 1.08,
          margin: '14px 0 0',
        }}>
          Set up your profile in ten minutes.
        </h2>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 48,
        maxWidth: 1040, margin: '0 auto',
      }}>
        {steps.map(s => (
          <div key={s.n}>
            <div className="serif" style={{
              fontSize: 56, fontWeight: 400, color: B.accent,
              lineHeight: 1, marginBottom: 12,
            }}>
              {s.n}
            </div>
            <h3 className="serif" style={{
              fontSize: 20, fontWeight: 500, margin: '0 0 8px',
            }}>
              {s.title}
            </h3>
            <p style={{
              fontSize: 14.5, color: B.dim, lineHeight: 1.6, margin: 0,
            }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────
function FinalCTA({ onCTA }) {
  return (
    <section style={{
      background: B.surface,
      borderTop: `0.5px solid ${B.line}`,
      padding: '112px 48px',
    }}>
      <div style={{
        maxWidth: 720, margin: '0 auto', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      }}>
        <h2 className="serif" style={{
          fontSize: 48, fontWeight: 500,
          letterSpacing: '-0.025em', lineHeight: 1.1,
          margin: 0,
        }}>
          The work is what counts.<br/>Let it count.
        </h2>
        <p style={{
          fontSize: 17, color: B.dim, lineHeight: 1.6,
          maxWidth: 520, margin: 0,
        }}>
          Free to join. No résumé builder, no buzzwords. Just your trade,
          your work, your people.
        </p>
        <button onClick={onCTA} style={{
          ...primaryButtonStyle,
          marginTop: 16, padding: '16px 28px', fontSize: 15,
        }}>
          Create your profile →
        </button>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      padding: '48px 48px 36px',
      borderTop: `0.5px solid ${B.line}`,
      background: B.bg,
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', flexWrap: 'wrap', gap: 32,
        justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <Wordmark size={20}/>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11, color: B.faint,
            letterSpacing: '0.06em', marginTop: 8,
          }}>
            FOR MAKERS
          </div>
        </div>
        <div style={{ display: 'flex', gap: 48, fontSize: 13 }}>
          <FooterColumn title="Product" links={[
            { label: 'How it works', href: '#how-it-works' },
            { label: 'For trades',   href: '#for-trades' },
            { label: 'For GCs',      href: '#for-gcs' },
          ]}/>
          <FooterColumn title="Company" links={[
            { label: 'About',    href: '#' },
            { label: 'Contact',  href: 'mailto:bryan@smith.app' },
            { label: 'Privacy',  href: '#' },
          ]}/>
        </div>
      </div>
      <div style={{
        maxWidth: 1280, margin: '32px auto 0',
        paddingTop: 24, borderTop: `0.5px solid ${B.line}`,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 12, color: B.faint,
      }}>
        <div>© {new Date().getFullYear()} Smith · Built in Salt Lake City</div>
        <div>
          <a href="mailto:bryan@smith.app" style={{ color: B.faint, textDecoration: 'none' }}>
            bryan@smith.app
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11, color: B.faint,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        {title}
      </div>
      {links.map(l => (
        <a key={l.label} href={l.href}
          style={{ color: B.dim, textDecoration: 'none', fontFamily: 'inherit' }}>
          {l.label}
        </a>
      ))}
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────
function Eyebrow({ children }) {
  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
      fontSize: 11, color: B.accent,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

const primaryButtonStyle = {
  background: B.text, color: B.surface, border: 'none',
  padding: '14px 22px', borderRadius: 100,
  fontSize: 14.5, fontWeight: 500, fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 8,
};

const secondaryButtonStyle = {
  background: 'transparent', color: B.text,
  border: `0.5px solid ${B.line}`,
  padding: '14px 22px', borderRadius: 100,
  fontSize: 14.5, fontWeight: 500, fontFamily: 'inherit',
  cursor: 'pointer',
};
