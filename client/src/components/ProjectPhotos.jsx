// Smith — Project photos + pin annotations (homeowner spec flow)
//
// Three exports drive the three entry points:
//   PhotosButton     — pill in the SpecShell top bar ("Photos · N")
//   PhotosInline     — read-only grid for the SOW review screen
//   PhotosModal      — the editing modal (upload + annotate + delete)
//
// Pin annotations: tap a point on a photo to drop a numbered marker and
// type a caption. Pins are stored as { id, x, y, caption } with x/y as
// fractions of the image so overlays scale with rendered size.

import React, { useEffect, useRef, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { api, auth as authStore } from '../lib/api.js';

// ── Public surface ────────────────────────────────────────────────────────

export function PhotosButton({ projectId, photos, onChange }) {
  const [open, setOpen] = useState(false);
  const count = photos?.length || 0;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: count ? B.accentSoft : 'transparent',
          color: count ? B.accent : B.faint,
          border: `1px solid ${count ? B.accent : B.line}`,
          padding: '6px 12px', borderRadius: 100,
          fontSize: 12.5, fontWeight: 600,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'inherit',
        }}>
        <Icon name="image" size={13}/>
        {count > 0 ? `Photos · ${count}` : 'Add photos'}
      </button>
      {open && (
        <PhotosModal
          projectId={projectId}
          photos={photos || []}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function PhotosInline({ photos }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 14, marginTop: 4,
    }}>
      {photos.map(p => <InlinePhoto key={p.id} photo={p}/>)}
    </div>
  );
}

function InlinePhoto({ photo }) {
  const src = photo.urls?.medium || photo.urls?.full || photo.urls?.thumb;
  const annotations = photo.annotations || [];
  return (
    <div>
      <div style={{
        position: 'relative', borderRadius: 8, overflow: 'hidden',
        border: `1px solid ${B.line}`, background: B.bg, aspectRatio: '4 / 3',
      }}>
        {src && (
          <img
            src={src}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {annotations.map((a, i) => (
          <PinMarker key={a.id} x={a.x} y={a.y} n={i + 1} readOnly/>
        ))}
      </div>
      {annotations.length > 0 && (
        <ol style={{
          margin: '8px 0 0', padding: '0 0 0 4px',
          color: B.text, fontSize: 12.5, lineHeight: 1.5, listStyle: 'none',
        }}>
          {annotations.map((a, i) => (
            <li key={a.id} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: '50%',
                background: B.accent, color: '#fff', fontSize: 10, fontWeight: 700,
                flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ color: B.dim }}>{a.caption}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────

export function PhotosModal({ projectId, photos, onChange, onClose }) {
  const [activeId, setActiveId] = useState(null);
  const active = photos.find(p => p.id === activeId);

  // Close on Escape, prevent body scroll while open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(20,15,10,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: B.surface, borderRadius: 12,
          width: '100%', maxWidth: active ? 860 : 720,
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(20,15,10,0.35)',
        }}>
        <ModalHeader
          title={active ? 'Annotate photo' : 'Project photos'}
          onBack={active ? () => setActiveId(null) : null}
          onClose={onClose}
        />
        <div style={{ overflowY: 'auto', padding: '20px 24px 28px' }}>
          {active ? (
            <AnnotateView
              projectId={projectId}
              photo={active}
              onChange={(updated) => {
                onChange(photos.map(p => p.id === updated.id ? updated : p));
              }}
              onDelete={async () => {
                try {
                  const { photos: next } = await api.delete(`/photos/project/${projectId}/photo/${active.id}`);
                  onChange(next);
                  setActiveId(null);
                } catch (e) {
                  console.error('delete photo failed', e);
                }
              }}
            />
          ) : (
            <GridView
              projectId={projectId}
              photos={photos}
              onOpen={(id) => setActiveId(id)}
              onChange={onChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ title, onBack, onClose }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 22px', borderBottom: `1px solid ${B.line}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'transparent', border: 'none', color: B.dim,
            cursor: 'pointer', padding: 4, display: 'inline-flex',
          }}>
            <Icon name="arrow-l" size={16}/>
          </button>
        )}
        <h2 className="serif" style={{
          margin: 0, fontSize: 18, fontWeight: 600, color: B.text,
        }}>{title}</h2>
      </div>
      <button onClick={onClose} style={{
        background: 'transparent', border: 'none', color: B.faint,
        cursor: 'pointer', padding: 4, display: 'inline-flex',
      }}>
        <Icon name="x" size={18}/>
      </button>
    </div>
  );
}

// ── Grid view ─────────────────────────────────────────────────────────────

function GridView({ projectId, photos, onOpen, onChange }) {
  const [error, setError] = useState(null);
  return (
    <div>
      <p style={{ color: B.dim, fontSize: 13.5, lineHeight: 1.55, margin: '0 0 16px' }}>
        Show what you're talking about. Pros bid sharper when they can see the
        space and what specifically bugs you. Tap a photo to drop pins on the
        bits worth pointing out.
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}>
        {photos.map(p => (
          <GridTile key={p.id} photo={p} onClick={() => onOpen(p.id)}/>
        ))}
        <UploadTile
          projectId={projectId}
          onUploaded={(updatedPhotos) => onChange(updatedPhotos)}
          onError={setError}
        />
      </div>
      {error && (
        <div style={{
          marginTop: 14, background: B.dangerSoft, color: B.danger,
          border: `1px solid ${B.danger}`, borderRadius: 6,
          padding: '8px 12px', fontSize: 12.5,
        }}>{error}</div>
      )}
    </div>
  );
}

function GridTile({ photo, onClick }) {
  const src = photo.urls?.medium || photo.urls?.full || photo.urls?.thumb;
  const pinCount = (photo.annotations || []).length;
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative', padding: 0, borderRadius: 8, overflow: 'hidden',
        border: `1px solid ${B.line}`, background: B.bg,
        cursor: 'pointer', aspectRatio: '4 / 3', fontFamily: 'inherit',
      }}>
      {src && (
        <img
          src={src}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {pinCount > 0 && (
        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          background: B.accent, color: '#fff',
          padding: '3px 8px', borderRadius: 100,
          fontSize: 10.5, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {pinCount} pin{pinCount === 1 ? '' : 's'}
        </div>
      )}
    </button>
  );
}

function UploadTile({ projectId, onUploaded, onError }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      onError('Image too large (20 MB max).');
      return;
    }
    onError(null);
    setBusy(true);
    setProgress(0);

    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/photos/project/${projectId}`);
    const token = authStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.min(95, Math.round((e.loaded / e.total) * 90)));
      }
    };
    xhr.onload = () => {
      setBusy(false);
      setProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          onUploaded(data.photos);
        } catch {
          onError('Upload returned an unreadable response.');
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          onError(data.error || `Upload failed (${xhr.status}).`);
        } catch {
          onError(`Upload failed (${xhr.status}).`);
        }
      }
      if (inputRef.current) inputRef.current.value = '';
    };
    xhr.onerror = () => {
      setBusy(false);
      setProgress(0);
      onError('Upload failed (network).');
    };
    xhr.send(form);
  };

  return (
    <label
      style={{
        position: 'relative', borderRadius: 8, overflow: 'hidden',
        border: `1.5px dashed ${B.line}`, background: B.bg,
        cursor: busy ? 'progress' : 'pointer', aspectRatio: '4 / 3',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: B.dim, fontSize: 13, gap: 6,
      }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={(e) => handleFile(e.target.files?.[0])}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'inherit' }}
      />
      {busy ? (
        <>
          <div style={{ color: B.accent, fontSize: 13, fontWeight: 600 }}>
            {progress < 90 ? `${progress}%` : 'Processing…'}
          </div>
        </>
      ) : (
        <>
          <Icon name="plus" size={22}/>
          <span>Add a photo</span>
        </>
      )}
    </label>
  );
}

// ── Annotate view ─────────────────────────────────────────────────────────

function AnnotateView({ projectId, photo, onChange, onDelete }) {
  const imgRef = useRef(null);
  const [draft, setDraft] = useState(null); // pending new pin: { x, y, caption }
  const [editingId, setEditingId] = useState(null);
  const [pending, setPending] = useState(null); // last-pending edit text per pin
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const annotations = photo.annotations || [];
  const src = photo.urls?.full || photo.urls?.medium || photo.urls?.thumb;

  const persist = async (next) => {
    setSaving(true);
    setError(null);
    try {
      const { photo: updated } = await api.patch(
        `/photos/project/${projectId}/photo/${photo.id}`,
        { annotations: next }
      );
      onChange(updated);
    } catch (e) {
      setError(e.data?.error || 'Could not save pins.');
    } finally {
      setSaving(false);
    }
  };

  const onImageClick = (e) => {
    if (draft) return; // already drafting
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setDraft({ x, y, caption: '' });
    setEditingId(null);
  };

  const confirmDraft = () => {
    if (!draft || !draft.caption.trim()) {
      setDraft(null);
      return;
    }
    const next = [...annotations, { x: draft.x, y: draft.y, caption: draft.caption.trim() }];
    setDraft(null);
    persist(next);
  };

  const updateAnnotation = (id, caption) => {
    const next = annotations.map(a =>
      a.id === id ? { ...a, caption: caption.trim() } : a
    ).filter(a => a.caption);
    setEditingId(null);
    persist(next);
  };

  const removeAnnotation = (id) => {
    const next = annotations.filter(a => a.id !== id);
    persist(next);
  };

  return (
    <div>
      <p style={{ color: B.dim, fontSize: 13, lineHeight: 1.55, margin: '0 0 14px' }}>
        Tap the photo where something matters. Add a quick note. Pins show up
        for the pro reading the spec.
      </p>
      <div style={{
        position: 'relative', borderRadius: 8, overflow: 'hidden',
        border: `1px solid ${B.line}`, background: B.bg,
        maxHeight: '60vh',
      }}>
        {src && (
          <img
            ref={imgRef}
            src={src}
            alt=""
            onClick={onImageClick}
            style={{
              display: 'block', width: '100%', maxHeight: '60vh',
              objectFit: 'contain', cursor: draft ? 'default' : 'crosshair',
              userSelect: 'none',
            }}
            draggable={false}
          />
        )}
        {annotations.map((a, i) => (
          <PinMarker
            key={a.id}
            x={a.x} y={a.y} n={i + 1}
            active={editingId === a.id}
            onClick={() => { setEditingId(a.id); setDraft(null); setPending(a.caption); }}
          />
        ))}
        {draft && (
          <>
            <PinMarker x={draft.x} y={draft.y} n={annotations.length + 1} pending/>
            <CaptionPopover
              x={draft.x} y={draft.y}
              value={draft.caption}
              onChange={(v) => setDraft({ ...draft, caption: v })}
              onCancel={() => setDraft(null)}
              onSave={confirmDraft}
            />
          </>
        )}
        {editingId && (() => {
          const a = annotations.find(x => x.id === editingId);
          if (!a) return null;
          return (
            <CaptionPopover
              x={a.x} y={a.y}
              value={pending ?? a.caption}
              onChange={(v) => setPending(v)}
              onCancel={() => { setEditingId(null); setPending(null); }}
              onSave={() => { updateAnnotation(a.id, pending ?? a.caption); setPending(null); }}
              onDelete={() => { removeAnnotation(a.id); setEditingId(null); setPending(null); }}
            />
          );
        })()}
      </div>

      {annotations.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{
            color: B.faint, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8,
          }}>Pins on this photo</div>
          {annotations.map((a, i) => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0', borderTop: i ? `1px dashed ${B.line}` : 'none',
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '50%',
                background: B.accent, color: '#fff', fontSize: 11, fontWeight: 700,
                flexShrink: 0,
              }}>{i + 1}</span>
              <div style={{ flex: 1, color: B.text, fontSize: 13.5 }}>{a.caption}</div>
              <button
                onClick={() => { setEditingId(a.id); setPending(a.caption); }}
                style={{
                  background: 'transparent', border: 'none', color: B.faint,
                  cursor: 'pointer', padding: 4,
                }}>
                <Icon name="edit" size={13}/>
              </button>
              <button
                onClick={() => removeAnnotation(a.id)}
                style={{
                  background: 'transparent', border: 'none', color: B.faint,
                  cursor: 'pointer', padding: 4,
                }}>
                <Icon name="trash" size={13}/>
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 22, display: 'flex', justifyContent: 'space-between', gap: 12,
      }}>
        <button
          onClick={onDelete}
          style={{
            background: 'transparent', color: B.danger,
            border: `1px solid ${B.danger}`,
            padding: '8px 14px', borderRadius: 100,
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          <Icon name="trash" size={13}/> Remove photo
        </button>
        <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic', alignSelf: 'center' }}>
          {saving ? 'Saving…' : (error || 'Tap the photo to add a pin.')}
        </div>
      </div>
    </div>
  );
}

function PinMarker({ x, y, n, active, pending, readOnly, onClick }) {
  return (
    <button
      onClick={(e) => { if (onClick) { e.stopPropagation(); onClick(); } }}
      disabled={readOnly}
      style={{
        position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`,
        transform: 'translate(-50%, -50%)',
        width: 26, height: 26, borderRadius: '50%',
        background: pending ? '#fff' : B.accent,
        color: pending ? B.accent : '#fff',
        border: `2px solid ${active ? B.text : B.accent}`,
        fontSize: 12, fontWeight: 700,
        cursor: readOnly ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
        padding: 0,
        fontFamily: 'inherit',
      }}>
      {n}
    </button>
  );
}

function CaptionPopover({ x, y, value, onChange, onSave, onCancel, onDelete }) {
  // Flip horizontally if the pin sits in the right half of the image, so the
  // popover doesn't run off the edge.
  const flip = x > 0.55;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${x * 100}%`, top: `${y * 100}%`,
        transform: `translate(${flip ? 'calc(-100% - 18px)' : '18px'}, -50%)`,
        background: B.surface, border: `1px solid ${B.line}`,
        borderRadius: 8, padding: '10px 12px',
        boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
        width: 220, zIndex: 5,
      }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="What's worth pointing out?"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: B.bg, border: `1px solid ${B.line}`,
          borderRadius: 6, padding: '8px 10px',
          fontSize: 13, color: B.text, fontFamily: 'inherit', outline: 'none',
        }}/>
      <div style={{
        marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 6,
      }}>
        {onDelete ? (
          <button onClick={onDelete} style={{
            background: 'transparent', border: 'none', color: B.danger,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 6px',
          }}>Delete</button>
        ) : <span/>}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onCancel} style={{
            background: 'transparent', border: `1px solid ${B.line}`,
            color: B.dim, fontSize: 11, fontWeight: 600,
            padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onSave} disabled={!value || !value.trim()} style={{
            background: B.text, color: B.surface, border: 'none',
            padding: '4px 12px', borderRadius: 100,
            fontSize: 11, fontWeight: 600,
            cursor: (value && value.trim()) ? 'pointer' : 'not-allowed',
            opacity: (value && value.trim()) ? 1 : 0.5,
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}
