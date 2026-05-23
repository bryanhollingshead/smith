// Smith — Credential document upload & serving
//
// PDFs and ID photos for licenses + insurance. Auth-gated reads with
// per-doc share_public toggle. Underneath, uses the storage.js driver
// (local in dev, R2 in production) so it scales out of single-server
// deployments.
//
// Endpoints (unchanged from before):
//   POST /api/credential-docs              upload, returns {filename}
//   GET  /api/credential-docs/:filename    serve, auth-gated
//
// The wire contract is identical to the pre-storage-layer version — old
// callers + existing license/user rows with `doc_url` filenames continue
// to work. Per the API commandment: behavior preserved, only the backing
// implementation moved.
//
// Key namespacing: credential docs live at "credentials/<userId>/<filename>"
// in storage. The DB column stores just the filename ("cred-abc123.pdf");
// the userId is reattached here when we read.

import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { uploadBuffer, downloadStream, deleteObject } from '../storage.js';

const router = Router();

const ALLOWED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const EXT_FOR_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg':      '.jpg',
  'image/png':       '.png',
};
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// Memory storage — buffer streams straight to the storage layer, no on-disk
// tmp file staging. Multer needs to know up-front what to do, hence memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Only PDF, JPG, and PNG files are allowed.'));
    }
    cb(null, true);
  },
});

function generateFilename(mimetype) {
  const ext = EXT_FOR_MIME[mimetype] || '';
  return `cred-${crypto.randomBytes(8).toString('hex')}${ext}`;
}

const keyFor = (userId, filename) => `credentials/${userId}/${filename}`;

// ── POST /api/credential-docs ───────────────────────────────────────────
router.post('/credential-docs', requireAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      let message = err.message || 'Upload failed.';
      if (err.code === 'LIMIT_FILE_SIZE') message = 'File too large (8 MB max).';
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const filename = generateFilename(req.file.mimetype);
    try {
      await uploadBuffer(keyFor(req.userId, filename), req.file.buffer, req.file.mimetype);
    } catch (e) {
      console.error('[credential-docs] upload failed:', e);
      return res.status(500).json({ error: 'Storage error.' });
    }

    res.status(201).json({
      filename,
      mime: req.file.mimetype,
      size: req.file.size,
    });
  });
});

// ── GET /api/credential-docs/:filename ──────────────────────────────────
// Auth-gated. Looks up the filename across licenses + users.insurance, then:
//   - owner gets it always
//   - non-owners only if share_public is on for that record
router.get('/credential-docs/:filename', requireAuth, async (req, res) => {
  // Refuse anything that doesn't match our filename shape — defense in depth.
  const filename = req.params.filename;
  if (!/^cred-[a-f0-9]{16}\.(pdf|jpg|png)$/.test(filename)) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Find the owning record + share state.
  let ownerId = null, share = false, mime = null;
  const lic = await q(
    `SELECT user_id, share_public, doc_mime FROM licenses WHERE doc_url = $1`,
    [filename]
  );
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

  // Stream from storage.
  try {
    const { stream, contentType } = await downloadStream(keyFor(ownerId, filename));
    res.setHeader('Content-Type', mime || contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    stream.pipe(res);
  } catch (e) {
    console.error('[credential-docs] read failed:', e);
    res.status(404).json({ error: 'File missing in storage' });
  }
});

// ── Internal helper: delete a doc when its row is removed ──────────────
// Called by routes/profiles.js when a license is deleted or a doc replaced.
// Best-effort — the DB is the source of truth for "current doc"; orphaned
// storage objects are harmless and cleaned up over time.
export async function deleteDocFile(filename, userId) {
  if (!filename) return;
  if (!/^cred-[a-f0-9]{16}\.(pdf|jpg|png)$/.test(filename)) return;
  // userId may be undefined for legacy callers (before this signature change).
  // In that case we walk both license + insurance lookups to find the owner.
  let ownerId = userId;
  if (!ownerId) {
    const lic = await q('SELECT user_id FROM licenses WHERE doc_url = $1', [filename]);
    if (lic.rows[0]) ownerId = lic.rows[0].user_id;
    else {
      const ins = await q('SELECT id FROM users WHERE insurance_doc_url = $1', [filename]);
      if (ins.rows[0]) ownerId = ins.rows[0].id;
    }
  }
  if (!ownerId) return; // file has no owning row — nothing to do
  await deleteObject(keyFor(ownerId, filename));
}

export default router;
