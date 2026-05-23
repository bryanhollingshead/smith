// Smith — Profile photo upload routes
//
// Two endpoints (avatar + cover) sharing one helper.
//
//   POST /api/photos/avatar    multipart, field "file"
//   POST /api/photos/cover     multipart, field "file"
//   DELETE /api/photos/avatar  remove the user's avatar
//   DELETE /api/photos/cover   remove the user's cover
//
// Both write to the user's own record; no targets, no ownership check needed.

import { Router } from 'express';
import multer from 'multer';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { processSquare, processCover } from '../image-processing.js';
import { publicUrl, deleteVariants } from '../storage.js';

const router = Router();

// In-memory upload — we resize and forward to storage immediately, so we
// never need the original on disk. 20MB cap on the wire (sharp will reject
// anything bigger anyway, but we want to fail fast before reading bytes).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

// Translate a JSON shape of storage keys to a JSON shape of URLs the client
// can render. We always emit a thumb/medium/full triple so the frontend can
// pick the right one for the context.
function urlsFor(variantsJson) {
  if (!variantsJson) return null;
  let parsed = variantsJson;
  if (typeof variantsJson === 'string') {
    try { parsed = JSON.parse(variantsJson); } catch { return null; }
  }
  if (typeof parsed !== 'object') return null;
  const out = {};
  for (const [size, key] of Object.entries(parsed)) {
    if (typeof key === 'string') out[size] = publicUrl(key);
  }
  return out;
}

// Multer error → friendly JSON. Mirrors the credential-docs convention.
function withUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      let message = err.message || 'Upload failed.';
      if (err.code === 'LIMIT_FILE_SIZE') message = 'Image too large (20 MB max on upload).';
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    next();
  });
}

// ── POST /api/photos/avatar ─────────────────────────────────────────────
router.post('/avatar', requireAuth, withUpload, async (req, res) => {
  try {
    // Get the user's current avatar so we can clean it up after the new one lands.
    const cur = await q('SELECT avatar_url FROM users WHERE id = $1', [req.userId]);
    const oldVariants = cur.rows[0]?.avatar_url;

    const variants = await processSquare(req.file.buffer, {
      namespace: 'users',
      ownerId: req.userId,
      label: 'avatar',
    });
    await q(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [JSON.stringify(variants), req.userId]
    );

    // Best-effort cleanup of previous variants. We do this AFTER the new
    // upload + DB update so a mid-flight failure doesn't leave the user
    // without any avatar at all.
    if (oldVariants) deleteVariants(oldVariants);

    res.status(201).json({ avatar: { keys: variants, urls: urlsFor(variants) } });
  } catch (e) {
    console.error('[photos] avatar failed:', e);
    res.status(400).json({ error: e.message || 'Could not process image.' });
  }
});

// ── POST /api/photos/cover ──────────────────────────────────────────────
router.post('/cover', requireAuth, withUpload, async (req, res) => {
  try {
    const cur = await q('SELECT cover_url FROM users WHERE id = $1', [req.userId]);
    const oldVariants = cur.rows[0]?.cover_url;

    const variants = await processCover(req.file.buffer, {
      namespace: 'users',
      ownerId: req.userId,
      label: 'cover',
    });
    await q(
      'UPDATE users SET cover_url = $1 WHERE id = $2',
      [JSON.stringify(variants), req.userId]
    );
    if (oldVariants) deleteVariants(oldVariants);

    res.status(201).json({ cover: { keys: variants, urls: urlsFor(variants) } });
  } catch (e) {
    console.error('[photos] cover failed:', e);
    res.status(400).json({ error: e.message || 'Could not process image.' });
  }
});

// ── DELETE /api/photos/avatar ───────────────────────────────────────────
router.delete('/avatar', requireAuth, async (req, res) => {
  const cur = await q('SELECT avatar_url FROM users WHERE id = $1', [req.userId]);
  const variants = cur.rows[0]?.avatar_url;
  await q('UPDATE users SET avatar_url = NULL WHERE id = $1', [req.userId]);
  if (variants) deleteVariants(variants);
  res.json({ ok: true });
});

// ── DELETE /api/photos/cover ────────────────────────────────────────────
router.delete('/cover', requireAuth, async (req, res) => {
  const cur = await q('SELECT cover_url FROM users WHERE id = $1', [req.userId]);
  const variants = cur.rows[0]?.cover_url;
  await q('UPDATE users SET cover_url = NULL WHERE id = $1', [req.userId]);
  if (variants) deleteVariants(variants);
  res.json({ ok: true });
});

export default router;
