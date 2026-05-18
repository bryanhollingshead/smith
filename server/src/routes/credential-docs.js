// Smith — Credential document upload & serving
//
// Local-disk storage for v1. When we move to S3 later, this file changes;
// the schema, callers, and frontend don't.
//
// Endpoints:
//   POST /api/credential-docs              upload a file, returns {filename}
//   GET  /api/credential-docs/:filename    serve a file, gated on auth + ownership/share
//
// The upload returns the filename only — callers (frontend) attach it to a
// license via PATCH or to the user's insurance via PATCH /profiles/me. This
// two-step is slightly noisier than a single multipart endpoint, but lets us
// keep the license/profile JSON endpoints unchanged and isolated from the
// file-handling complexity.

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

// ── Disk location ────────────────────────────────────────────────────────
// uploads/credentials/ at the server root. Created on demand so a fresh
// checkout doesn't need a setup step.
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'credentials');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer config ────────────────────────────────────────────────────────
// We rename incoming files to a nonce-based filename to avoid:
//   - leaking the user's original filename (PII risk)
//   - collisions when two users upload "license.pdf"
//   - leaking the license id into the URL (mild speculative information leak)
const ALLOWED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const EXT_FOR_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg':      '.jpg',
  'image/png':       '.png',
};
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = EXT_FOR_MIME[file.mimetype] || '';
    const nonce = crypto.randomBytes(8).toString('hex');
    cb(null, `cred-${nonce}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Only PDF, JPG, and PNG files are allowed.'));
    }
    cb(null, true);
  },
});

// ── POST /api/credential-docs ───────────────────────────────────────────
// Receives a single file under field name `file`. On success returns
// { filename, mime } — caller stashes those in the license or insurance row.
router.post('/credential-docs', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, err => {
    if (err) {
      // Multer surfaces both validation rejects (bad mime) and limit errors
      // (file too big) through this `err`. Friendly message for the UI.
      let message = err.message || 'Upload failed.';
      if (err.code === 'LIMIT_FILE_SIZE') message = 'File too large (8 MB max).';
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    res.status(201).json({
      filename: req.file.filename,
      mime: req.file.mimetype,
      size: req.file.size,
    });
  });
});

// ── GET /api/credential-docs/:filename ──────────────────────────────────
// Auth-gated download. Allowed when:
//   (a) the file belongs to a license owned by req.userId, OR
//   (b) the file is the requester's own insurance doc, OR
//   (c) the file belongs to a license with share_public = TRUE, OR
//   (d) the file is someone's insurance doc with insurance_share_public = TRUE
//
// We look up the filename in both tables. If it matches nothing, 404. If it
// matches but the requester isn't authorized, 403.
router.get('/credential-docs/:filename', requireAuth, async (req, res) => {
  // Defend against path traversal — our filenames are always `cred-{hex}.{ext}`.
  // Anything else, refuse before touching the filesystem.
  const filename = req.params.filename;
  if (!/^cred-[a-f0-9]{16}\.(pdf|jpg|png)$/.test(filename)) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Look up the owning record.
  const lic = await q(
    `SELECT user_id, share_public, doc_mime FROM licenses WHERE doc_url = $1`,
    [filename]
  );
  let ownerId = null, share = false, mime = null;
  if (lic.rows[0]) {
    ownerId = lic.rows[0].user_id;
    share   = lic.rows[0].share_public;
    mime    = lic.rows[0].doc_mime;
  } else {
    const ins = await q(
      `SELECT id, insurance_share_public, insurance_doc_mime
         FROM users WHERE insurance_doc_url = $1`,
      [filename]
    );
    if (ins.rows[0]) {
      ownerId = ins.rows[0].id;
      share   = ins.rows[0].insurance_share_public;
      mime    = ins.rows[0].insurance_doc_mime;
    }
  }
  if (!ownerId) return res.status(404).json({ error: 'Not found' });

  const isOwner = ownerId === req.userId;
  if (!isOwner && !share) return res.status(403).json({ error: 'Not shared' });

  const filepath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File missing on disk' });
  }
  res.setHeader('Content-Type', mime || 'application/octet-stream');
  // Inline so the browser tries to render PDFs/images in a tab rather than
  // forcing a download. Safer for the casual "let me peek at this" case.
  res.setHeader('Content-Disposition', 'inline');
  fs.createReadStream(filepath).pipe(res);
});

// ── Internal helper: delete a doc file if it exists ──────────────────────
// Used by license-delete and replace-doc flows to keep the disk tidy.
export function deleteDocFile(filename) {
  if (!filename) return;
  if (!/^cred-[a-f0-9]{16}\.(pdf|jpg|png)$/.test(filename)) return;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.unlink(filepath, () => { /* best-effort */ });
}

export default router;
