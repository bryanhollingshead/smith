// Smith — Feed post card
// Ported from FeedPostB. Like + comment are wired live; we expand a comments
// thread inline when the comment button is tapped.
//
// Patch B: post photos can be uploaded from the user's device. The post.photos
// array now contains entries shaped like:
//   { kind: 'frame', photo_urls: null }                     // placeholder
//   { kind: 'frame', photo_urls: {thumb,medium,full} }      // uploaded (kind retained as fallback)
//
// Uploaded photos render as <img> letterboxed 16:9; placeholder kinds fall
// back to the existing gradient Photo component.
//
// Author + comment avatars also upgraded to SmithAvatar so uploaded profile
// photos render through the feed.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { Photo } from './Primitives.jsx';
import { SmithAvatar } from './SmithAvatar.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';

export function FeedPost({ post, onChange, onAuthorClick }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.stats.liked_by_me);
  const [likes, setLikes] = useState(post.stats.likes);
  const [showComments, setShowComments] = useState(false);

  const toggleLike = async () => {
    // Optimistic.
    const next = !liked;
    setLiked(next);
    setLikes(n => n + (next ? 1 : -1));
    try {
      const data = await api.post(`/posts/${post.id}/like`);
      setLiked(data.liked);
    } catch {
      // Revert on failure.
      setLiked(!next);
      setLikes(n => n - (next ? 1 : -1));
    }
  };

  return (
    <article style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => onAuthorClick?.(post.author.id)} style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          borderRadius: '50%',
        }}>
          <SmithAvatar
            urls={post.author.avatar_urls}
            initials={post.author.initials}
            size={44}
            tone={post.author.avatar_tone}
          />
        </button>
        <div style={{ flex: 1 }}>
          <button onClick={() => onAuthorClick?.(post.author.id)} style={{
            background: 'transparent', border: 'none', padding: 0,
            color: B.text, fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em',
            cursor: 'pointer',
          }} className="serif">{post.author.name}</button>
          <div style={{ color: B.dim, fontSize: 12 }}>
            {post.author.headline}
            {post.author.headline ? ' · ' : ''}
            <span style={{ color: B.faint }}>{relTime(post.created_at)}</span>
          </div>
        </div>
        <button style={iconBtn} title="More">
          <Icon name="more" size={18}/>
        </button>
      </div>

      <div style={{
        padding: '0 24px 18px', color: B.text, fontSize: 14.5, lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {post.body}
        {post.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {post.tags.map(t => (
              <span key={t} style={{
                padding: '4px 10px', background: B.accentSoft, color: B.accent,
                fontSize: 11, fontWeight: 600, borderRadius: 100,
              }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      {post.photos?.length > 0 && (
        <PostPhotoGrid
          photos={post.photos}
          projectName={post.project_name}
        />
      )}

      {post.milestone && (
        <div style={{
          padding: '14px 24px', background: B.accentSoft,
          borderTop: `1px solid ${B.line}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Icon name="award" size={20} style={{ color: B.accent }}/>
          <div>
            <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>Milestone</div>
            <div className="serif" style={{
              color: B.text, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em',
            }}>{post.milestone}</div>
          </div>
        </div>
      )}

      <div style={{
        padding: '6px 18px', borderTop: `1px solid ${B.line}`,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <button onClick={toggleLike} style={{
          ...rowBtn,
          color: liked ? B.accent : B.dim,
        }}>
          <Icon name="thumb" size={16} stroke={liked ? 2 : 1.6}/>
          {likes > 0 && <span>{likes}</span>}
        </button>
        <button onClick={() => setShowComments(s => !s)} style={rowBtn}>
          <Icon name="comment" size={16}/>
          {post.stats.comments > 0 && <span>{post.stats.comments}</span>}
        </button>
        <button style={rowBtn}>
          <Icon name="share" size={16}/>
          <span>Share</span>
        </button>
      </div>

      {showComments && (
        <CommentThread
          postId={post.id}
          author={user}
          onAdded={() => onChange?.()}
        />
      )}
    </article>
  );
}

// ── Photo grid ────────────────────────────────────────────────────────
// Each photo is either an uploaded image (rendered <img> letterboxed 16:9)
// or a placeholder kind (rendered gradient via <Photo>). Mixed grids work
// — same row, same aspect ratio for visual coherence.
//
// Layout:
//   1 photo   → full width, taller frame
//   2-4 photos → side-by-side columns, 16:9 each
function PostPhotoGrid({ photos, projectName }) {
  const cols = Math.min(photos.length, 3);
  const isSingle = photos.length === 1;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isSingle ? '1fr' : `repeat(${cols}, 1fr)`,
      gap: 2,
    }}>
      {photos.map((p, i) => (
        <div key={i} style={{
          aspectRatio: isSingle ? '16/9' : '4/3',
          overflow: 'hidden',
          background: B.bg,
        }}>
          {p.photo_urls ? (
            <img
              src={p.photo_urls.medium || p.photo_urls.full}
              alt={projectName || p.kind || ''}
              loading="lazy"
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <Photo
              kind={p.kind}
              label={projectName ? projectName.toLowerCase() : p.kind}
              height="100%"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Comment thread (loads on demand) ─────────────────────────────────
function CommentThread({ postId, author, onAdded }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    api.get(`/posts/${postId}/comments`)
      .then(d => !cancelled && setComments(d.comments))
      .catch(() => !cancelled && setComments([]));
    return () => { cancelled = true; };
  }, [postId]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { comment } = await api.post(`/posts/${postId}/comments`, { body: text.trim() });
      // Append to local state. We synthesize the author from the signed-in user.
      const initials = ((author?.first_name?.[0] || '') + (author?.last_name?.[0] || '')).toUpperCase();
      setComments(c => [...(c || []), {
        ...comment,
        author: {
          id: author?.id,
          name: `${author?.first_name || ''} ${author?.last_name || ''}`.trim(),
          initials,
          avatar_tone: author?.avatar_tone || 'wood',
          avatar_urls: author?.avatar_urls || null,
          headline: '',
        },
      }]);
      setText('');
      onAdded?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      borderTop: `1px solid ${B.line}`, padding: '14px 24px 18px',
      background: B.bg,
    }} className="fade-in">
      {comments === null && (
        <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>Loading…</div>
      )}
      {comments?.length === 0 && (
        <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>
          No comments yet — be the first.
        </div>
      )}
      {comments?.map(c => (
        <div key={c.id} style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12,
        }}>
          <SmithAvatar
            urls={c.author.avatar_urls}
            initials={c.author.initials}
            size={32}
            tone={c.author.avatar_tone}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: B.surface, border: `1px solid ${B.line}`,
              borderRadius: 4, padding: '8px 12px',
            }}>
              <div className="serif" style={{
                color: B.text, fontWeight: 600, fontSize: 13, letterSpacing: '-0.01em',
              }}>{c.author.name}</div>
              <div style={{
                color: B.text, fontSize: 13, marginTop: 2, whiteSpace: 'pre-wrap',
              }}>{c.body}</div>
            </div>
            <div style={{
              color: B.faint, fontSize: 11, marginTop: 4, fontStyle: 'italic',
            }}>{relTime(c.created_at)}</div>
          </div>
        </div>
      ))}

      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
        marginTop: comments?.length ? 12 : 0,
      }}>
        <SmithAvatar
          urls={author?.avatar_urls}
          initials={((author?.first_name?.[0] || '') + (author?.last_name?.[0] || '')).toUpperCase()}
          size={32}
          tone={author?.avatar_tone || 'wood'}
        />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Add a comment…"
          style={{
            flex: 1, background: B.surface, border: `1px solid ${B.line}`,
            borderRadius: 100, padding: '9px 14px', fontSize: 13,
            color: B.text, outline: 'none',
          }}
        />
        <button onClick={submit} disabled={busy || !text.trim()} style={{
          background: text.trim() ? B.accent : B.surface2, border: 'none',
          color: text.trim() ? '#fff' : B.faint,
          padding: '9px 12px', borderRadius: '50%',
          cursor: text.trim() ? 'pointer' : 'not-allowed',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="send" size={14}/>
        </button>
      </div>
    </div>
  );
}

function relTime(iso) {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

const iconBtn = {
  background: 'transparent', border: 'none', color: B.dim, cursor: 'pointer',
  padding: 6,
};
const rowBtn = {
  flex: 1, padding: '10px', background: 'transparent', border: 'none',
  color: B.dim, display: 'inline-flex', alignItems: 'center',
  justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};
