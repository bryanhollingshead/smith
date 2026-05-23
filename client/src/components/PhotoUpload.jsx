// Smith — PhotoUpload component
//
// Self-contained upload control for a single image field (avatar OR cover).
// Renders the current photo (if any) plus an "Upload" button. Handles the
// multipart upload to either /api/photos/avatar or /api/photos/cover, with
// progress indication and error display.
//
// Props:
//   kind        — 'avatar' | 'cover'  (which endpoint to call)
//   currentUrls — JSON shape { thumb, medium, full } or null
//   onChange    — called with the new urls after successful upload, or null
//                 after successful delete
//   preview     — a render-prop that receives currentUrls and renders the
//                 visual preview (so the same component works for circle
//                 avatars and rectangular cover photos)
//
// We use raw fetch() here rather than the api.js helper because uploads are
// multipart (not JSON) and we want a progress callback (which fetch doesn't
// support natively — we use XMLHttpRequest for that).

import React, { useRef, useState } from 'react';
import { B } from '../lib/theme.js';
import { auth as authStore } from '../lib/api.js';

export function PhotoUpload({ kind, currentUrls, onChange, preview, label = 'Upload photo' }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const endpoint = `/api/photos/${kind}`;

  const handleFile = (file) => {
    if (!file) return;

    // Quick client-side sanity check on file size — server caps at 20MB but
    // failing here is faster + clearer than waiting for the upload to fail.
    if (file.size > 20 * 1024 * 1024) {
      setError('Image too large (20 MB max).');
      return;
    }

    setError(null);
    setBusy(true);
    setProgress(0);

    const form = new FormData();
    form.append('file', file);

    // XHR rather than fetch so we get an upload progress event. Once we've
    // sent all the bytes, the server still has to do the resize+upload work
    // before responding, which we report as "processing…".
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
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
          const urls = data[kind]?.urls || null;
          onChange?.(urls, data[kind]?.keys);
        } catch (e) {
          setError('Server returned an invalid response.');
        }
      } else {
        let msg = 'Upload failed.';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* ignore */ }
        setError(msg);
      }
    };

    xhr.onerror = () => {
      setBusy(false);
      setProgress(0);
      setError('Network error during upload.');
    };

    xhr.send(form);
  };

  const handleDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      const token = authStore.get();
      const r = await fetch(endpoint, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'Could not remove photo.');
      }
      onChange?.(null, null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* The user-provided preview slot renders the current photo or fallback */}
      {preview ? preview(currentUrls) : null}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          style={{
            background: busy ? B.surface2 : B.text,
            color: busy ? B.faint : B.surface,
            border: 'none', padding: '8px 18px', borderRadius: 100,
            fontSize: 13, fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? (progress > 0 ? `Uploading ${progress}%…` : 'Processing…') : label}
        </button>

        {currentUrls && !busy && (
          <button
            type="button"
            onClick={handleDelete}
            style={{
              background: 'transparent', color: B.dim, border: 'none',
              padding: '8px 4px', fontSize: 12, fontWeight: 500,
              fontStyle: 'italic', cursor: 'pointer',
            }}
          >
            Remove
          </button>
        )}

        <span style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
          JPG, PNG, HEIC. Max 20 MB.
        </span>
      </div>

      {error && (
        <div style={{
          color: B.danger, fontSize: 12,
          background: '#fff2ec', border: `1px solid ${B.danger}`, borderRadius: 4,
          padding: '8px 12px',
        }}>{error}</div>
      )}
    </div>
  );
}
