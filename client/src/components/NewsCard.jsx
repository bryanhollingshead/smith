// Smith — News card components
//
// Two card variants:
//   - <NewsCard> — uniform text-only card for the grid. Category strip +
//     title + summary + meta + tag chips + bookmark. No image.
//   - <NewsRow> — compact text row for sidebars (right rail).
//
// Plus <BookmarkButton> — used in both. Optimistic toggle; calls the API
// and reverts on failure.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { api } from '../lib/api.js';

// ── Helpers ──────────────────────────────────────────────────────────────
function relTime(iso) {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60)        return 'just now';
  if (diff < 3600)      return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Bookmark button ─────────────────────────────────────────────────────
export function BookmarkButton({ article, onToggle, size = 18 }) {
  const [saved, setSaved] = useState(!!article.saved_by_me);
  const [busy, setBusy] = useState(false);

  const toggle = async (e) => {
    e.stopPropagation();
    if (busy) return;
    const next = !saved;
    setSaved(next);
    setBusy(true);
    try {
      if (next) await api.post(`/news/${article.id}/save`);
      else      await api.delete(`/news/${article.id}/save`);
      onToggle?.(next);
    } catch {
      setSaved(!next); // revert
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      title={saved ? 'Saved — click to remove' : 'Save for later'}
      style={{
        background: 'transparent', border: 'none', padding: 6,
        color: saved ? B.accent : B.dim, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center',
        transition: 'color 120ms ease',
      }}
      onMouseEnter={e => { if (!saved) e.currentTarget.style.color = B.text; }}
      onMouseLeave={e => { if (!saved) e.currentTarget.style.color = B.dim; }}
    >
      {/* SVG bookmark — filled when saved, outline when not. Inline so we
          don't have to add another icon to Icon.jsx for one use. */}
      <svg width={size} height={size} viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'}
           stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  );
}

// ── Card (uniform grid) ──────────────────────────────────────────────────
// Compact text-only card. No images, no hero variant — every article gets
// the same shape. Click anywhere → open the source URL in a new tab.
export function NewsCard({ article, onTagClick }) {
  return (
    <article
      onClick={() => window.open(article.source_url, '_blank', 'noopener,noreferrer')}
      style={{
        background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
        overflow: 'hidden', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 140ms ease, box-shadow 140ms ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(42,31,23,0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Top strip: category label + bookmark. Replaces the old image area. */}
      <div style={{
        padding: '14px 18px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{
          color: B.accent, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>{article.category}</span>
        <BookmarkButton article={article} size={16}/>
      </div>

      <div style={{
        padding: '8px 18px 16px', flex: 1,
        display: 'flex', flexDirection: 'column',
      }}>
        <h3 className="serif" style={{
          margin: 0, color: B.text, fontWeight: 600,
          fontSize: 17, lineHeight: 1.3, letterSpacing: '-0.015em',
        }}>{article.title}</h3>

        {article.summary && (
          <p style={{
            color: B.dim, fontSize: 13, lineHeight: 1.55, margin: '10px 0 0',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{article.summary}</p>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
          color: B.faint, fontSize: 11, flexWrap: 'wrap',
        }}>
          <span style={{ color: B.text, fontWeight: 600 }}>{article.source}</span>
          <span>·</span>
          <span>{relTime(article.published_at)}</span>
          <span>·</span>
          <span>{article.read_minutes} min read</span>
        </div>

        {article.tags?.length > 0 && (
          <div style={{
            display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap',
            paddingTop: 12, borderTop: `1px solid ${B.line}`,
          }}>
            {article.tags.slice(0, 4).map(t => (
              <button
                key={t}
                onClick={e => { e.stopPropagation(); onTagClick?.(t); }}
                style={{
                  padding: '3px 9px', background: B.bg, border: `1px solid ${B.line}`,
                  borderRadius: 100, fontSize: 10.5, color: B.dim, fontWeight: 500,
                  cursor: onTagClick ? 'pointer' : 'default',
                }}
                onMouseEnter={e => {
                  if (onTagClick) {
                    e.currentTarget.style.background = B.accentSoft;
                    e.currentTarget.style.color = B.accent;
                    e.currentTarget.style.borderColor = B.accent;
                  }
                }}
                onMouseLeave={e => {
                  if (onTagClick) {
                    e.currentTarget.style.background = B.bg;
                    e.currentTarget.style.color = B.dim;
                    e.currentTarget.style.borderColor = B.line;
                  }
                }}
              >{t}</button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Compact row (sidebars) ──────────────────────────────────────────────
// No thumbnail — just text. Used in the right rail of the news page and
// in the feed-page news widget.
export function NewsRow({ article }) {
  return (
    <a
      href={article.source_url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block', padding: '10px 0',
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <div style={{
        color: B.accent, fontSize: 10, fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
      }}>{article.category}</div>
      <div className="serif" style={{
        color: B.text, fontSize: 13.5, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: '-0.01em',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>{article.title}</div>
      <div style={{
        color: B.faint, fontSize: 11, marginTop: 4, fontStyle: 'italic',
      }}>
        {article.source} · {relTime(article.published_at)}
      </div>
    </a>
  );
}
