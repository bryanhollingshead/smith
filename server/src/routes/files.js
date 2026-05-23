// Smith — File serving endpoint
//
// Generic read endpoint for storage-managed files. Maps GET /api/files/<key>
// to storage.downloadStream(key). Works for both local and R2 drivers.
//
// Auth: this endpoint is intentionally OPEN. The files we serve here are
// "public read by URL knowledge" — profile photos, jobsite photos, post
// images, etc. The keys include nonces that make them effectively
// unguessable, so a leaked URL is the only path to access.
//
// IMPORTANT: credential documents (PDFs, IDs) do NOT go through this
// endpoint. They have their own auth-gated route at /api/credential-docs/:filename
// that checks ownership + share_public. Keep these separate; the trust models
// are different.

import { Router } from 'express';
import { downloadStream } from '../storage.js';

const router = Router();

// Key safety: storage keys should look like `<namespace>/<id>/<filename>`.
// Reject anything else early to make traversal impossible.
const KEY_PATTERN = /^[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_.\-]+$/;

router.get('/files/*', async (req, res) => {
  // Strip the route prefix to get the storage key.
  // Express 5 puts the wildcard in req.params[0]; in 4 it's path-suffix.
  // We do a defensive substring from the known URL prefix instead.
  const idx = req.originalUrl.indexOf('/api/files/');
  if (idx === -1) return res.status(400).json({ error: 'Bad request' });
  let key = req.originalUrl.slice(idx + '/api/files/'.length);
  // Strip query string + decode.
  const qIdx = key.indexOf('?');
  if (qIdx !== -1) key = key.slice(0, qIdx);
  try { key = decodeURIComponent(key); } catch { /* leave as-is */ }

  if (!KEY_PATTERN.test(key)) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { stream, contentType, contentLength } = await downloadStream(key);
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    // Aggressive cache — these files are immutable (keys are nonce-suffixed).
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    stream.pipe(res);
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
