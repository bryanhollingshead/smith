// Smith — Intent picker (the new first step of account creation)
//
// Route: /auth/start — public. Visitor declares why they're here, then we
// forward to the right existing credentials screen:
//   "I'm a tradesman" → /auth/signup       (existing 5-step builder)
//   "I'm hiring"      → /auth/homeowner    (existing lightweight homeowner)
//
// This file is purely a diverter — both downstream screens already exist.

import React from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { ChromeWordmark } from '../components/HomeownerEntry.jsx';
import { useRouter } from '../lib/router.jsx';

export function SignUpStartPage() {
  const { navigate } = useRouter();
  return (
    <div style={{
      background: B.bg, color: B.text, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '18px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${B.line}`,
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        }}>
          <ChromeWordmark/>
        </button>
        <span style={{ color: B.faint, fontSize: 12.5 }}>
          Already have an account?{' '}
          <button onClick={() => navigate('/auth/signin')} style={{
            background: 'transparent', border: 'none', padding: 0,
            color: B.accent, fontWeight: 600, cursor: 'pointer', fontSize: 12.5,
          }}>Sign in</button>
        </span>
      </header>

      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 920 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              color: B.accent, fontSize: 12, fontStyle: 'italic', marginBottom: 10,
              fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em',
            }}>
              01 — WHY ARE YOU HERE?
            </div>
            <h1 className="serif" style={{
              margin: 0, fontSize: 40, fontWeight: 600,
              letterSpacing: '-0.025em', lineHeight: 1.1,
            }}>
              One account. Two ways to use it.
            </h1>
            <p style={{
              color: B.dim, fontSize: 15, lineHeight: 1.55,
              margin: '14px auto 0', maxWidth: 560,
            }}>
              Pick the door that fits today — you can switch modes later from
              the menu. Smith is one account, whether you're getting hired or
              hiring out.
            </p>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18,
          }}>
            <IntentCard
              icon="tool"
              tone={B.success}
              eyebrow="For trades"
              title="I'm a tradesman."
              body="Get found, find work, build the résumé that's actually your work — credentials, jobsites, crew."
              cta="Build your profile"
              onClick={() => navigate('/auth/signup')}
            />
            <IntentCard
              icon="home"
              tone={B.homeowner}
              eyebrow="For hiring"
              title="I'm hiring."
              body="Find and hire trusted pros for your home or property — start by claiming the place."
              cta="Find a pro"
              onClick={() => navigate('/auth/homeowner')}
            />
          </div>

          <div style={{
            marginTop: 32, textAlign: 'center',
            color: B.faint, fontSize: 12, fontStyle: 'italic',
          }}>
            Both doors lead to the same Smith account — you'll never need a second login.
          </div>
        </div>
      </main>
    </div>
  );
}

function IntentCard({ icon, tone, eyebrow, title, body, cta, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', textAlign: 'left',
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8,
      padding: '32px 32px 28px', cursor: 'pointer',
      transition: 'border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease',
      fontFamily: 'inherit', color: B.text,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = tone;
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = `0 12px 28px ${tone}1A`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = B.line;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: tone, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
      }}>
        <Icon name={icon} size={20}/>
      </div>
      <div style={{
        color: tone, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: 8,
      }}>{eyebrow}</div>
      <h2 className="serif" style={{
        margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em',
      }}>{title}</h2>
      <p style={{ color: B.dim, fontSize: 14, lineHeight: 1.55, margin: '8px 0 22px' }}>
        {body}
      </p>
      <div style={{ marginTop: 'auto' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: B.text, fontWeight: 600, fontSize: 14,
        }}>
          {cta} <Icon name="arrow-r" size={14} stroke={2.4}/>
        </span>
      </div>
    </button>
  );
}
