// Smith — Post composer (modal)
// Pops up from the feed page when the user taps "What are you building today?".
// Lets them pick a post type, write the body, attach up to 4 photos (from
// device upload OR placeholder kinds), and add tags.
//
// Patch B: photos can now be uploaded from the user's device. Each uploaded
// photo is processed server-side immediately on selection, getting back
// storage keys we embed in the eventual post-create body.
//
// Photo model in this component:
//   photos: [
//     { kind: 'frame' },                           // placeholder
//     { keys: {thumb,medium,full}, preview: url }  // uploaded
//   ]
// Cap at 4 total across both.

import React, { useState, useRef } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { Photo } from './Primitives.jsx';
import { SmithAvatar } from './SmithAvatar.jsx';
import { api } from '../lib/api.js';

const PHOTO_KINDS = [
  'frame', 'wood', 'concrete', 'steel', 'roof', 'brick',
  'kitchen', 'workshop', 'tile', 'crew', 'blueprint', 'sky',
];

const TYPES = [
  { k: 'project',   label: 'Project update', icon: 'briefcase', hint: 'Share progress on a build.' },
  { k: 'photo',     label: 'Photo',          icon: 'image',     hint: 'A single shot from the site.' },
  { k: 'hiring',    label: 'Hiring',         icon: 'users',     hint: 'Looking for a crew member.' },
  { k: 'milestone', label: 'Milestone',      icon: 'award',     hint: 'A career or project milestone.' },
];

const MAX_PHOTOS = 4;

export function ComposePost({ user, onClose, onPosted }) {
  const [type, setType] = useState('project');
  const [body, setBody] = useState('');
  const [projectName, setProjectName] = useState('');
  const [milestone, setMilestone] = useState('');
  // photos: array of { kind } or { keys, preview }. Mixed is fine.
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(0);  // count of in-flight uploads
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Count the photos currently occupying slots — including in-flight uploads
  // (which haven't yet returned keys but reserve a slot).
  const filledSlots = photos.length + uploading;
  const remainingSlots = Math.max(0, MAX_PHOTOS - filledSlots);

  // Upload a single file → server returns {photo: {keys, urls}}; we add it
  // to photos.  Preview uses the medium URL while we wait. The medium URL
  // works immediately because R2 makes objects available right away.
  const uploadFile = async (file) => {
    setError(null);
    setUploading(n => n + 1);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await api.upload('/photos/post', fd);
      setPhotos(p => [...p, {
        keys: data.photo.keys,
        preview: data.photo.urls?.medium || data.photo.urls?.full,
      }]);
    } catch (e) {
      setError(e.data?.error || 'Photo upload failed.');
    } finally {
      setUploading(n => n - 1);
    }
  };

  const onFilesPicked = async (e) => {
    const files = Array.from(e.target.files || []);
    // Reset the input so picking the same file twice in a row still works.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!files.length) return;
    // Take only enough to fit. Upload sequentially so failures are clear.
    const toUpload = files.slice(0, remainingSlots);
    for (const f of toUpload) {
      await uploadFile(f);
    }
  };

  // Toggle a placeholder kind into/out of the photos array. Each placeholder
  // slot is a separate entry; toggling removes that specific entry.
  const togglePlaceholder = (kind) => {
    const idx = photos.findIndex(p => p.kind === kind && !p.keys);
    if (idx >= 0) {
      setPhotos(p => p.filter((_, i) => i !== idx));
    } else if (filledSlots < MAX_PHOTOS) {
      setPhotos(p => [...p, { kind }]);
    }
  };

  const removePhotoAt = (i) => {
    setPhotos(p => p.filter((_, x) => x !== i));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t) && tags.length < 6) setTags(ts => [...ts, t]);
    setTagInput('');
  };

  const submit = async () => {
    if (!body.trim()) return;
    // Don't submit while uploads are in flight — the user is still building.
    if (uploading > 0) return;
    setBusy(true);
    setError(null);
    try {
      // Strip preview URL from payload; server only needs keys (or kind).
      const photoPayload = photos.map(p => p.keys
        ? { keys: p.keys }
        : { kind: p.kind }
      );
      const payload = {
        type,
        body: body.trim(),
        photos: photoPayload,
        tags,
      };
      if (projectName.trim()) payload.project_name = projectName.trim();
      if (milestone.trim()) payload.milestone = milestone.trim();
      const { post } = await api.post('/posts', payload);
      onPosted?.(post);
      onClose?.();
    } catch (e) {
      setError(e.data?.error || 'Could not post.');
    } finally {
      setBusy(false);
    }
  };

  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase();

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(42,31,23,0.4)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} className="fade-in">
      <div onClick={e => e.stopPropagation()} style={{
        background: B.surface, border: `1px solid ${B.line}`, borderRadius: 6,
        width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{
          padding: '20px 28px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: `1px solid ${B.line}`,
        }}>
          <div className="serif" style={{
            margin: 0, fontSize: 20, fontWeight: 600, color: B.text, letterSpacing: '-0.01em',
          }}>Create a post</div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: B.dim, cursor: 'pointer', padding: 4,
          }}>
            <Icon name="x" size={20}/>
          </button>
        </div>

        <div className="scroll-thin" style={{
          padding: '20px 28px', overflowY: 'auto', flex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <SmithAvatar
              urls={user?.avatar_urls}
              initials={initials}
              size={42}
              tone={user?.avatar_tone || 'rust'}
            />
            <div>
              <div className="serif" style={{
                color: B.text, fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em',
              }}>{user?.first_name} {user?.last_name}</div>
              <div style={{ color: B.dim, fontSize: 12 }}>Posting publicly</div>
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
            marginBottom: 16,
          }}>
            {TYPES.map(t => (
              <button key={t.k} onClick={() => setType(t.k)} title={t.hint} style={{
                padding: '10px 8px',
                background: type === t.k ? B.accentSoft : B.bg,
                border: `1px solid ${type === t.k ? B.accent : B.line}`,
                borderRadius: 4, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                color: type === t.k ? B.accent : B.text,
                fontSize: 11, fontWeight: 600,
              }}>
                <Icon name={t.icon} size={16}/>
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={
              type === 'hiring' ? 'What kind of help are you looking for?' :
              type === 'milestone' ? 'What did you hit?' :
              'What are you building?'
            }
            rows={5}
            style={{
              width: '100%', background: B.bg, border: `1px solid ${B.line}`,
              borderRadius: 4, padding: '12px 14px', fontSize: 14, lineHeight: 1.55,
              color: B.text, fontFamily: 'inherit', resize: 'vertical',
              outline: 'none',
            }}
          />

          {(type === 'project' || type === 'photo') && (
            <>
              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="Project name (optional)"
                style={smallInput}
              />

              {/* ── Photos section ─────────────────────────────────────
                  Two ways to attach: real upload from device (primary), or
                  placeholder kind from the grid (secondary, mostly for posts
                  without a real photo handy). Mix freely up to 4 total. */}
              <div style={{ marginTop: 14 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <span style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
                    Photos · {filledSlots}/{MAX_PHOTOS}
                  </span>
                </div>

                {/* Upload row */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={onFilesPicked}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={remainingSlots === 0 || uploading > 0}
                  style={{
                    width: '100%', padding: '12px',
                    background: B.bg, border: `1px dashed ${B.line}`, borderRadius: 4,
                    color: remainingSlots === 0 ? B.faint : B.text,
                    fontSize: 13, fontWeight: 600,
                    cursor: remainingSlots === 0 || uploading > 0 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  <Icon name="image" size={16} style={{ color: B.accent }}/>
                  {uploading > 0
                    ? `Uploading ${uploading} photo${uploading === 1 ? '' : 's'}…`
                    : remainingSlots === 0
                      ? 'Photo limit reached'
                      : `Upload photos from device${remainingSlots < MAX_PHOTOS ? ` (${remainingSlots} more)` : ''}`}
                </button>

                {/* Selected photos thumbnail strip — both uploads and
                    placeholder kinds appear here so the user sees one row of
                    "what I'm posting". X-button removes either kind. */}
                {photos.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(photos.length, 4)}, 1fr)`,
                    gap: 6, marginTop: 10,
                  }}>
                    {photos.map((p, i) => (
                      <div key={i} style={{
                        position: 'relative',
                        aspectRatio: '16/9',
                        overflow: 'hidden', borderRadius: 4,
                        boxShadow: `0 0 0 2px ${B.accent}`,
                      }}>
                        {p.keys ? (
                          <img
                            src={p.preview}
                            alt=""
                            style={{
                              width: '100%', height: '100%',
                              objectFit: 'cover', display: 'block',
                            }}
                          />
                        ) : (
                          <Photo kind={p.kind} label={p.kind} height="100%"/>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhotoAt(i)}
                          title="Remove"
                          style={{
                            position: 'absolute', top: 4, right: 4,
                            width: 20, height: 20,
                            background: 'rgba(42,31,23,0.7)',
                            border: 'none', borderRadius: '50%',
                            color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                          }}>
                          <Icon name="x" size={12}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Placeholder kinds — kept as a fallback for posts without
                    a real photo (e.g., posts written from someone's office). */}
                <div style={{
                  color: B.faint, fontSize: 11, fontStyle: 'italic',
                  marginTop: 14, marginBottom: 6,
                }}>
                  Or pick a placeholder
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4,
                }}>
                  {PHOTO_KINDS.map(k => {
                    const sel = photos.some(p => p.kind === k && !p.keys);
                    const disabled = !sel && remainingSlots === 0;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => togglePlaceholder(k)}
                        disabled={disabled}
                        style={{
                          background: 'transparent', border: 'none', padding: 0,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          position: 'relative', aspectRatio: '1', overflow: 'hidden',
                          borderRadius: 4,
                          boxShadow: sel ? `0 0 0 2px ${B.accent}` : 'none',
                          opacity: disabled ? 0.45 : 1,
                        }}>
                        <Photo kind={k} label={k} height="100%"/>
                        {sel && (
                          <div style={{
                            position: 'absolute', top: 4, right: 4, width: 18, height: 18,
                            background: B.accent, borderRadius: '50%', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon name="check" size={11} stroke={3}/>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {type === 'milestone' && (
            <input
              value={milestone}
              onChange={e => setMilestone(e.target.value)}
              placeholder="The milestone (e.g. 10,000 hours)"
              style={smallInput}
            />
          )}

          {type === 'hiring' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {tags.map(t => (
                  <span key={t} style={{
                    padding: '4px 10px', background: B.accentSoft, color: B.accent,
                    fontSize: 11, fontWeight: 600, borderRadius: 100,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    {t}
                    <button onClick={() => setTags(ts => ts.filter(x => x !== t))} style={{
                      background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                      color: B.accent, display: 'inline-flex',
                    }}>
                      <Icon name="x" size={11}/>
                    </button>
                  </span>
                ))}
              </div>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag (e.g. Hiring, Journeyman) — press enter"
                style={{ ...smallInput, marginTop: 8 }}
              />
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 12, color: B.danger, fontSize: 13,
              background: B.bg, border: `1px solid ${B.danger}`, borderRadius: 4,
              padding: '10px 14px',
            }}>{error}</div>
          )}
        </div>

        <div style={{
          padding: '16px 28px', borderTop: `1px solid ${B.line}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: B.dim,
            padding: '10px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Cancel</button>
          <button
            onClick={submit}
            disabled={busy || !body.trim() || uploading > 0}
            style={{
              background: body.trim() && uploading === 0 ? B.text : B.surface2,
              border: body.trim() && uploading === 0 ? 'none' : `1px solid ${B.line}`,
              color: body.trim() && uploading === 0 ? B.surface : B.faint,
              padding: '10px 22px', borderRadius: 100, fontSize: 13, fontWeight: 600,
              cursor: body.trim() && uploading === 0 && !busy ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {busy ? 'Posting…' : uploading > 0 ? 'Uploading…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

const smallInput = {
  width: '100%', marginTop: 12,
  background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
  padding: '10px 12px', fontSize: 13, color: B.text, fontFamily: 'inherit',
  outline: 'none',
};
