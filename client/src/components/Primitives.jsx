// Smith — Avatar, Photo, Logo primitives
// Ported 1:1 from the design handoff.

import React from 'react';
import { B } from '../lib/theme.js';

// ── Avatar ─────────────────────────────────────────────────────────────
// Initials over a tinted gradient. Tones map to the SAMPLE color palette.
const tones = {
  wood:  'linear-gradient(135deg, #8a5a2f, #4a3520)',
  steel: 'linear-gradient(135deg, #6b7178, #2d3137)',
  brick: 'linear-gradient(135deg, #a55c45, #6a3525)',
  sage:  'linear-gradient(135deg, #6b7560, #3d4a3a)',
  sand:  'linear-gradient(135deg, #c8b89a, #8a7758)',
  rust:  'linear-gradient(135deg, #C8731F, #6b3e15)',
  slate: 'linear-gradient(135deg, #4a5057, #232629)',
  cream: 'linear-gradient(135deg, #d8cfb8, #a8a085)',
};

export const Avatar = ({ initials = '·', size = 40, tone = 'wood', ring }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: tones[tone] || tones.wood,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: Math.max(11, size * 0.36),
    letterSpacing: '0.02em', flexShrink: 0,
    boxShadow: ring ? `0 0 0 2px ${ring}` : 'none',
    fontFamily: "'Inter Tight', sans-serif",
    userSelect: 'none',
  }}>{initials}</div>
);

// ── Photo placeholder ──────────────────────────────────────────────────
export const Photo = ({ kind = 'frame', label, height = 200, style = {}, children }) => (
  <div
    className={`ph ph-${kind}`}
    style={{
      // CSS custom prop expressed as inline style with --ph-label
      // (keeps the design's "label as caption" treatment).
      ...{ ['--ph-label']: `"${label || kind + ' photo'}"` },
      height: typeof height === 'number' ? `${height}px` : height,
      width: '100%',
      ...style,
    }}
  >
    {children}
  </div>
);

// ── Smith logo wordmark ───────────────────────────────────────────────
export const SmithLogo = ({ size = 26, color }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, color: color || B.text }}>
    <span className="serif" style={{
      fontWeight: 700, letterSpacing: '-0.02em', fontSize: size, fontStyle: 'italic',
    }}>Smith</span>
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: B.accent,
      display: 'inline-block', alignSelf: 'center', marginBottom: 2,
    }}/>
  </div>
);
