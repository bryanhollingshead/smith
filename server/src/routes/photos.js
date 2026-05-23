// Smith — Photo upload routes
//
// Originally: just avatar + cover (Patch A).
// Patch B adds:
//   POST   /api/photos/company/:id/logo   multipart, field "file"
//   DELETE /api/photos/company/:id/logo
//   POST   /api/photos/jobsite/:id        multipart, field "file"
//   DELETE /api/photos/jobsite/:id
//   POST   /api/photos/post               multipart, field "file"   (returns key+urls; caller embeds in post)
//
// Pattern is the same across all: receive bytes → process with Sharp →
// upload variants to storage → update DB → cleanup old variants → return
// keys + URLs.
//
// Authorization: each route verifies ownership before processing the upload
// so a bad actor can't fill our storage by spamming requests against IDs
// they don't own.

import { Router } from 'express';
import multer from 'multer';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { processSquare, processCover } from '../image-processing.js';
import { publicUrl, deleteVariants } from '../storage.js';

const router = Router();

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

// ════════════════════════════════════════════════════════════════════════
// AVATAR (Patch A)
// ════════════════════════════════════════════════════════════════════════

router.post('/avatar', requireAuth, withUpload, async (req, res) => {
  try {
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
    if (oldVariants) deleteVariants(oldVariants);

    res.status(201).json({ avatar: { keys: variants, urls: urlsFor(variants) } });
  } catch (e) {
    console.error('[photos] avatar failed:', e);
    res.status(400).json({ error: e.message || 'Could not process image.' });
  }
});

router.delete('/avatar', requireAuth, async (req, res) => {
  const cur = await q('SELECT avatar_url FROM users WHERE id = $1', [req.userId]);
  const variants = cur.rows[0]?.avatar_url;
  await q('UPDATE users SET avatar_url = NULL WHERE id = $1', [req.userId]);
  if (variants) deleteVariants(variants);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════
// COVER (Patch A)
// ════════════════════════════════════════════════════════════════════════

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

router.delete('/cover', requireAuth, async (req, res) => {
  const cur = await q('SELECT cover_url FROM users WHERE id = $1', [req.userId]);
  const variants = cur.rows[0]?.cover_url;
  await q('UPDATE users SET cover_url = NULL WHERE id = $1', [req.userId]);
  if (variants) deleteVariants(variants);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════
// COMPANY LOGO (Patch B)
// ════════════════════════════════════════════════════════════════════════
//
// Only the company's claimer can change the logo. Unclaimed companies
// can have their logo set by the user who *created* the company (so the
// add-company flow can attach a logo on day 1, before formal claim).

async function checkCompanyAuth(companyId, userId) {
  const { rows } = await q(
    `SELECT id, claimed_by, created_by, logo_url
       FROM companies WHERE id = $1`,
    [companyId]
  );
  if (!rows.length) return { ok: false, status: 404, error: 'Company not found.' };
  const co = rows[0];
  // If claimed, only the claimer can change the logo.
  if (co.claimed_by && co.claimed_by !== userId) {
    return { ok: false, status: 403, error: 'Not authorized to edit this company logo.' };
  }
  // If unclaimed, the original creator can manage it.
  if (!co.claimed_by && co.created_by !== userId) {
    return { ok: false, status: 403, error: 'Not authorized to edit this company logo.' };
  }
  return { ok: true, company: co };
}

router.post('/company/:id/logo', requireAuth, withUpload, async (req, res) => {
  const companyId = parseInt(req.params.id, 10);
  if (!Number.isFinite(companyId)) return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkCompanyAuth(companyId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const variants = await processSquare(req.file.buffer, {
      namespace: 'companies',
      ownerId: companyId,
      label: 'logo',
    });
    await q(
      'UPDATE companies SET logo_url = $1 WHERE id = $2',
      [JSON.stringify(variants), companyId]
    );
    if (auth.company.logo_url) deleteVariants(auth.company.logo_url);

    res.status(201).json({ logo: { keys: variants, urls: urlsFor(variants) } });
  } catch (e) {
    console.error('[photos] company logo failed:', e);
    res.status(400).json({ error: e.message || 'Could not process image.' });
  }
});

router.delete('/company/:id/logo', requireAuth, async (req, res) => {
  const companyId = parseInt(req.params.id, 10);
  if (!Number.isFinite(companyId)) return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkCompanyAuth(companyId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  await q('UPDATE companies SET logo_url = NULL WHERE id = $1', [companyId]);
  if (auth.company.logo_url) deleteVariants(auth.company.logo_url);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════
// JOBSITE PHOTO (Patch B)
// ════════════════════════════════════════════════════════════════════════
//
// One uploaded photo per jobsite (plus the existing photo_kind placeholder
// as a fallback). The photo is stored as a cover-style variant since
// jobsites are typically landscape construction photos.
//
// Ownership: the jobsite belongs to a work_history row owned by the user.

async function checkJobsiteAuth(jobsiteId, userId) {
  const { rows } = await q(
    `SELECT js.id, js.photo_url, wh.user_id
       FROM jobsites js
       JOIN work_history wh ON wh.id = js.work_history_id
      WHERE js.id = $1`,
    [jobsiteId]
  );
  if (!rows.length) return { ok: false, status: 404, error: 'Jobsite not found.' };
  if (rows[0].user_id !== userId) {
    return { ok: false, status: 403, error: 'Not your jobsite.' };
  }
  return { ok: true, jobsite: rows[0] };
}

router.post('/jobsite/:id', requireAuth, withUpload, async (req, res) => {
  const jobsiteId = parseInt(req.params.id, 10);
  if (!Number.isFinite(jobsiteId)) return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkJobsiteAuth(jobsiteId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const variants = await processCover(req.file.buffer, {
      namespace: 'jobsites',
      ownerId: jobsiteId,
      label: 'photo',
    });
    await q(
      'UPDATE jobsites SET photo_url = $1 WHERE id = $2',
      [JSON.stringify(variants), jobsiteId]
    );
    if (auth.jobsite.photo_url) deleteVariants(auth.jobsite.photo_url);

    res.status(201).json({ photo: { keys: variants, urls: urlsFor(variants) } });
  } catch (e) {
    console.error('[photos] jobsite failed:', e);
    res.status(400).json({ error: e.message || 'Could not process image.' });
  }
});

router.delete('/jobsite/:id', requireAuth, async (req, res) => {
  const jobsiteId = parseInt(req.params.id, 10);
  if (!Number.isFinite(jobsiteId)) return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkJobsiteAuth(jobsiteId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  await q('UPDATE jobsites SET photo_url = NULL WHERE id = $1', [jobsiteId]);
  if (auth.jobsite.photo_url) deleteVariants(auth.jobsite.photo_url);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════
// POST PHOTO (Patch B)
// ════════════════════════════════════════════════════════════════════════
//
// Uploads here are decoupled from post creation. The composer uploads each
// photo individually (one POST per file), gets back keys+urls, then includes
// the keys in the eventual POST /api/posts body. This lets the UI show
// upload progress per photo and allow re-ordering before sending the post.
//
// The processed photo gets uploaded under namespace "posts/_pending/<userId>"
// initially. Once the post is created in posts.js, it stays there (we don't
// need to move it — the key never appears in a URL outside our control).
//
// Cleanup of orphaned uploads (user starts composing then bails) is a
// future concern. For now, we accept some R2 cruft.

router.post('/post', requireAuth, withUpload, async (req, res) => {
  try {
    const variants = await processCover(req.file.buffer, {
      namespace: 'posts',
      ownerId: req.userId,
      label: 'photo',
    });
    res.status(201).json({ photo: { keys: variants, urls: urlsFor(variants) } });
  } catch (e) {
    console.error('[photos] post failed:', e);
    res.status(400).json({ error: e.message || 'Could not process image.' });
  }
});

export default router;
