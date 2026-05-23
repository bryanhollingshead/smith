// Smith — SmithAvatar component
//
// "Smart" avatar that prefers a real photo when present, falls back to the
// existing initial-letter monogram-on-tone when not. Designed to be a
// drop-in upgrade from <Avatar> for any context that has access to a user's
// avatar_url field.
//
// Props mirror the underlying Avatar — `initials`, `size`, `tone` — plus a
// new `urls` prop that's the JSON shape returned by the photos API:
//   { thumb: '...', medium: '...', full: '...' }
// or null/undefined when no photo is set.
//
// We pick the right variant based on size:
//   size <= 80   → thumb
//   size <= 400  → medium
//   else         → full
//
// On image-load failure, we silently fall back to the initials view. This
// handles e.g. R2 outage, slow connections, or a stale URL in the cache —
// the user always sees *something*, never a broken-image icon.

import React, { useState } from 'react';
import { Avatar } from './Primitives.jsx';

export function SmithAvatar({ urls, initials, size = 40, tone = 'wood', ring }) {
  const [errored, setErrored] = useState(false);

  // Choose variant. The variants are pre-resized so we don't over-fetch
  // 1600px PNGs to draw a 40px avatar circle.
  let src = null;
  if (urls && !errored) {
    const u = typeof urls === 'string' ? safeJSON(urls) : urls;
    if (u) {
      if (size <= 80)       src = u.thumb || u.medium || u.full;
      else if (size <= 400) src = u.medium || u.full || u.thumb;
      else                  src = u.full || u.medium || u.thumb;
    }
  }

  // No photo, or load failed → fall back to monogram.
  if (!src) return <Avatar initials={initials} size={size} tone={tone} ring={ring}/>;

  // Photo present — circular crop, sized box, error fallback. We render the
  // initials Avatar UNDERNEATH the img so if the img fails the layout doesn't
  // jump and we already have something visible during load.
  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      flexShrink: 0,
      boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
      background: '#0000', // transparent — the Avatar below provides color
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Avatar initials={initials} size={size} tone={tone}/>
      </div>
      <img
        src={src}
        alt=""
        onError={() => setErrored(true)}
        style={{
          position: 'relative',
          width: '100%', height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}

function safeJSON(s) {
  try { return JSON.parse(s); } catch { return null; }
}
