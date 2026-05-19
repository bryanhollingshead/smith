// Smith — "Demo" badge
//
// Small visual indicator that a user is a demo profile. Goes next to a
// name/avatar wherever demos can appear (profile header, connection cards,
// search results, suggestions, news feed authors).
//
// The badge does double duty: it's the visual cue that this profile isn't
// a real person, AND it acts as documentation for what a populated Smith
// profile can look like. The 403s come from the backend (demo-gate.js);
// this badge is just user-facing communication.
//
// Usage: import { DemoBadge } from './DemoBadge.jsx';
//        {profile.is_demo && <DemoBadge/>}

import React from 'react';
import { B } from '../lib/theme.js';

export function DemoBadge({ size = 'sm' }) {
  const big = size === 'lg';
  return (
    <span
      title="Demo profile — a sample Smith account, not a real person."
      style={{
        display: 'inline-flex', alignItems: 'center',
        background: B.surface2 || '#efe7d8',
        color: B.dim,
        border: `1px solid ${B.line}`,
        borderRadius: 4,
        padding: big ? '3px 8px' : '2px 6px',
        fontSize: big ? 11 : 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        lineHeight: 1,
        verticalAlign: 'middle',
      }}>
      Demo
    </span>
  );
}
