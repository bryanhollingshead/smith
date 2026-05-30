// Smith — Visibility toggle (Jobs module phase 5)
//
// Lets the user opt their profile into public visibility (turns on the
// /profile/:slug page + makes them discoverable in public search +
// surfaces the Hire Me button on their page).
//
// First opt-in generates `first-last-####` slug server-side and returns it.
// Opt-out keeps the slug around so re-enabling later doesn't break links the
// user already shared.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { api } from '../lib/api.js';

export function VisibilityCard({ visibility, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const isPublic = !!visibility?.is_public;
  const slug = visibility?.public_slug || null;
  const publicUrl = slug ? `${window.location.origin}/profile/${slug}` : null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const { visibility: next } = await api.patch('/profiles/me/visibility', {
        is_public: !isPublic,
      });
      onChange?.(next);
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not update visibility');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <div style={{
      background: isPublic ? B.surface : B.bg,
      border: `1px solid ${B.line}`, borderRadius: 6, padding: '14px 18px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, marginBottom: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>
          {isPublic ? 'Your profile is public.' : 'Make your profile public.'}
        </div>
        <div style={{ fontSize: 12, color: B.dim, marginTop: 2 }}>
          {isPublic
            ? 'Anyone can view your page and send you a Hire Me inquiry — even without a Smith account.'
            : 'Get a shareable link, show up in public search, and let people send you Hire Me inquiries.'}
        </div>
        {isPublic && publicUrl && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{
              background: B.bg, border: `1px solid ${B.line}`,
              padding: '4px 8px', borderRadius: 3, fontSize: 12, color: B.text,
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280,
              whiteSpace: 'nowrap',
            }}>{publicUrl}</code>
            <button onClick={copy} style={ghostBtnStyle}>{copied ? 'Copied ✓' : 'Copy link'}</button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{
              ...ghostBtnStyle, textDecoration: 'none', display: 'inline-block',
            }}>View ↗</a>
          </div>
        )}
        {error && (
          <div style={{ color: B.danger, fontSize: 12, marginTop: 6 }}>{error}</div>
        )}
      </div>
      <button onClick={toggle} disabled={busy} style={{
        background: isPublic ? 'transparent' : B.accent,
        color: isPublic ? B.text : B.surface,
        border: isPublic ? `1px solid ${B.line}` : 'none',
        padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600,
        cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        opacity: busy ? 0.7 : 1, flexShrink: 0,
      }}>
        {busy ? '…' : (isPublic ? 'Make private' : 'Go public')}
      </button>
    </div>
  );
}

const ghostBtnStyle = {
  background: 'transparent', color: B.text, border: `1px solid ${B.line}`,
  padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600,
  cursor: 'pointer',
};
