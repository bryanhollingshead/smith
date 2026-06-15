// Smith — Street View static image
//
// Renders a Google Street View Static API image for a given lat/lng. The
// API key ships in the URL but is referrer-restricted, so a copy of the URL
// pasted off-domain is useless. Vite injects the key from VITE_GOOGLE_MAPS_KEY.
//
// We render <img>, not a background-image, so the browser handles caching
// and lazy-loading naturally. If lat/lng is missing or the key isn't set,
// we render a graceful fallback tile so the layout never shifts.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';

const STREETVIEW_BASE = 'https://maps.googleapis.com/maps/api/streetview';
const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

function buildUrl({ lat, lng, size, fov, pitch }) {
  if (!KEY || lat == null || lng == null) return null;
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    size,
    fov: String(fov ?? 80),
    pitch: String(pitch ?? 0),
    key: KEY,
  });
  return `${STREETVIEW_BASE}?${params.toString()}`;
}

export function StreetView({
  lat, lng, width = 800, height = 360, radius = 8, fov = 80, pitch = 0,
}) {
  const [failed, setFailed] = useState(false);
  const url = buildUrl({ lat, lng, size: `${width}x${height}`, fov, pitch });

  if (!url || failed) {
    return (
      <div style={{
        width: '100%', aspectRatio: `${width} / ${height}`,
        background: B.bg, border: `1px solid ${B.line}`, borderRadius: radius,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 8, color: B.faint,
      }}>
        <Icon name="image" size={26}/>
        <div style={{ fontSize: 12, fontStyle: 'italic' }}>
          {!KEY ? 'Imagery key not set' : 'No street view available'}
        </div>
      </div>
    );
  }

  return (
    <img
      src={url}
      onError={() => setFailed(true)}
      alt="Street view of your home"
      style={{
        width: '100%', aspectRatio: `${width} / ${height}`,
        objectFit: 'cover', borderRadius: radius,
        border: `1px solid ${B.line}`, display: 'block',
      }}
    />
  );
}
