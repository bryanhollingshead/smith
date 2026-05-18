// Smith — Post composer (modal)
// Pops up from the feed page when the user taps "What are you building today?".
// Lets them pick a post type, write the body, and (for project/photo posts)
// pick up to 4 photo placeholder kinds and a project name.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { Avatar, Photo } from './Primitives.jsx';
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

export function ComposePost({ user, onClose, onPosted }) {
  const [type, setType] = useState('project');
  const [body, setBody] = useState('');
  const [projectName, setProjectName] = useState('');
  const [milestone, setMilestone] = useState('');
  const [photos, setPhotos] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const togglePhoto = (kind) => {
    setPhotos(p =>
      p.includes(kind)
        ? p.filter(x => x !== kind)
        : (p.length < 4 ? [...p, kind] : p)
    );
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t) && tags.length < 6) setTags(ts => [...ts, t]);
    setTagInput('');
  };

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        type,
        body: body.trim(),
        photos,
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
            <Avatar initials={initials} size={42} tone={user?.avatar_tone || 'rust'}/>
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
              <div style={{ marginTop: 14 }}>
                <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic', marginBottom: 8 }}>
                  Pick photos · {photos.length}/4
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4,
                }}>
                  {PHOTO_KINDS.map(k => {
                    const sel = photos.includes(k);
                    return (
                      <button key={k} onClick={() => togglePhoto(k)} style={{
                        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                        position: 'relative', aspectRatio: '1', overflow: 'hidden',
                        borderRadius: 4,
                        boxShadow: sel ? `0 0 0 2px ${B.accent}` : 'none',
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
            disabled={busy || !body.trim()}
            style={{
              background: body.trim() ? B.text : B.surface2,
              border: body.trim() ? 'none' : `1px solid ${B.line}`,
              color: body.trim() ? B.surface : B.faint,
              padding: '10px 22px', borderRadius: 100, fontSize: 13, fontWeight: 600,
              cursor: body.trim() && !busy ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {busy ? 'Posting…' : 'Post'}
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
