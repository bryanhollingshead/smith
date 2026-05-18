// Smith — Auth screen layout primitives
// Ported from smith-auth.jsx → AuthShellB / AuthInput / PasswordStrengthBar.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { Photo, SmithLogo } from './Primitives.jsx';

export function AuthShell({
  stepNum, stepTotal, eyebrow, title, subtitle,
  hero, footer, children,
}) {
  return (
    <div style={{
      background: B.bg, color: B.text, minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '20px 40px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: `1px solid ${B.line}`,
      }}>
        <SmithLogo/>
        {stepNum && (
          <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
            Step {stepNum} of {stepTotal}
          </span>
        )}
      </header>

      <main style={{
        flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'stretch',
      }}>
        <div style={{
          padding: '56px 72px', maxWidth: 580, width: '100%',
          justifySelf: 'end', display: 'flex', flexDirection: 'column',
        }}>
          {eyebrow && (
            <div style={{ color: B.accent, fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>
              {eyebrow}
            </div>
          )}
          <h1 className="serif" style={{
            margin: 0, fontSize: 40, fontWeight: 600,
            letterSpacing: '-0.025em', lineHeight: 1.08,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: '14px 0 32px', color: B.dim, fontSize: 16, lineHeight: 1.55 }}>
              {subtitle}
            </p>
          )}

          {children}

          {footer && <div style={{ marginTop: 'auto', paddingTop: 36 }}>{footer}</div>}
        </div>

        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <Photo kind={hero?.kind || 'frame'} label="for the ones who build" height="100%"/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(42,31,23,0.2), rgba(42,31,23,0.7))',
          }}/>
          <div style={{
            position: 'absolute', left: 56, bottom: 64, color: '#fff', maxWidth: 400,
          }}>
            <div style={{
              color: '#fff', opacity: 0.85, fontSize: 12,
              fontStyle: 'italic', marginBottom: 16,
            }}>
              {hero?.eyebrow || 'Smith — for makers'}
            </div>
            <div className="serif" style={{
              fontSize: 36, fontWeight: 500, lineHeight: 1.12, letterSpacing: '-0.025em',
            }}>
              {hero?.title || 'The work is the résumé.'}
            </div>
            <div style={{
              fontSize: 15, color: 'rgba(255,255,255,0.85)',
              marginTop: 18, lineHeight: 1.55,
            }}>
              {hero?.body || 'A network for the people behind the build.'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export const AuthLabel = ({ children }) => (
  <label style={{
    color: B.dim, fontSize: 12, fontStyle: 'italic',
    display: 'block', marginBottom: 6,
  }}>{children}</label>
);

export const AuthInput = ({
  icon, error, hint, type = 'text',
  value, onChange, onKeyDown, ...rest
}) => (
  <div>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: B.surface, border: `1px solid ${error ? B.danger : B.line}`,
      borderRadius: 4, padding: '12px 14px',
    }}>
      {icon && <Icon name={icon} size={16} style={{ color: B.dim }}/>}
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange}
        onKeyDown={onKeyDown}
        {...rest}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: B.text, fontSize: 14.5, fontFamily: 'inherit',
        }}
      />
    </div>
    {hint && !error && (
      <div style={{ color: B.faint, fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>{hint}</div>
    )}
    {error && (
      <div style={{ color: B.danger, fontSize: 12, marginTop: 6 }}>{error}</div>
    )}
  </div>
);

// Password input with show/hide toggle. Used in signup + reset.
export function PasswordInput({ value, onChange, placeholder = 'At least 12 characters' }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '12px 14px',
    }}>
      <Icon name="shield" size={16} style={{ color: B.dim }}/>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: B.text, fontSize: 14.5, fontFamily: 'inherit',
          letterSpacing: show || !value ? 'normal' : '0.15em',
        }}
      />
      <button onClick={() => setShow(s => !s)} type="button" style={{
        background: 'transparent', border: 'none', color: B.dim,
        fontSize: 12, fontWeight: 600, fontStyle: 'italic',
      }}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

// Strength bar — reproduces the smith-auth.jsx widget exactly.
// Score is 0..4. We compute the same way as the server.
export const PasswordStrengthBar = ({ score }) => {
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#A33A2A', '#C8731F', '#7A8A3F', '#4F6B3F'];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        height: 4, background: B.surface2, borderRadius: 2,
        overflow: 'hidden', display: 'flex', gap: 2,
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: '100%',
            background: i <= score ? colors[score - 1] : 'transparent',
          }}/>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
          {score > 0 ? labels[score - 1] : 'Pick a password'}
        </span>
        <span style={{ color: B.faint, fontSize: 11 }}>12+ chars · 1 number</span>
      </div>
    </div>
  );
};

export function passwordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw) || pw.length >= 16) score++;
  return Math.min(4, score);
}

// Pill button used across auth screens — primary (dark fill) and ghost variants.
export function PrimaryButton({ children, disabled, onClick, type, style }) {
  return (
    <button
      type={type || 'button'}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: disabled ? B.surface2 : B.text,
        border: disabled ? `1px solid ${B.line}` : 'none',
        color: disabled ? B.faint : B.surface,
        padding: '13px 30px', borderRadius: 100,
        fontSize: 14, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, type, style }) {
  return (
    <button type={type || 'button'} onClick={onClick} style={{
      background: 'transparent', border: 'none', color: B.dim,
      fontSize: 14, fontWeight: 500, padding: '10px 0',
      cursor: 'pointer',
      ...style,
    }}>{children}</button>
  );
}
