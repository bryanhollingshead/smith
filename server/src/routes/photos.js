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
    `SELECT c.id, c.claimed_by, c.created_by, c.logo_url,
            EXISTS (
              SELECT 1 FROM work_history wh
               WHERE wh.company_id = c.id
                 AND wh.user_id = $2
                 AND wh.is_owner = TRUE
                 AND wh.is_current = TRUE
            ) AS is_owner
       FROM companies c WHERE c.id = $1`,
    [companyId, userId]
  );
  if (!rows.length) return { ok: false, status: 404, error: 'Company not found.' };
  const co = rows[0];
  // Current asserted owners can manage the logo.
  if (co.is_owner) return { ok: true, company: co };
  // Legacy steward fallback (drops once owners are backfilled).
  if (co.claimed_by && co.claimed_by === userId) return { ok: true, company: co };
  // Unclaimed companies: original creator can still attach a logo on day 1
  // so the add-company flow keeps working before anyone asserts ownership.
  if (!co.claimed_by && co.created_by === userId) return { ok: true, company: co };
  return { ok: false, status: 403, error: 'Not authorized to edit this company logo.' };
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

router.post('/company/:id/cover', requireAuth, withUpload, async (req, res) => {
  const companyId = parseInt(req.params.id, 10);
  if (!Number.isFinite(companyId)) return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkCompanyAuth(companyId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const oldCover = (await q('SELECT cover_url FROM companies WHERE id = $1', [companyId])).rows[0]?.cover_url;
    const variants = await processCover(req.file.buffer, {
      namespace: 'companies',
      ownerId: companyId,
      label: 'cover',
    });
    await q(
      'UPDATE companies SET cover_url = $1 WHERE id = $2',
      [JSON.stringify(variants), companyId]
    );
    if (oldCover) deleteVariants(oldCover);

    res.status(201).json({ cover: { keys: variants, urls: urlsFor(variants) } });
  } catch (e) {
    console.error('[photos] company cover failed:', e);
    res.status(400).json({ error: e.message || 'Could not process image.' });
  }
});

router.delete('/company/:id/cover', requireAuth, async (req, res) => {
  const companyId = parseInt(req.params.id, 10);
  if (!Number.isFinite(companyId)) return res.status(400).json({ error: 'Invalid id' });
  const auth = await checkCompanyAuth(companyId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const cur = await q('SELECT cover_url FROM companies WHERE id = $1', [companyId]);
  const old = cur.rows[0]?.cover_url;
  await q('UPDATE companies SET cover_url = NULL WHERE id = $1', [companyId]);
  if (old) deleteVariants(old);
  res.json({ ok: true });
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
// JOBSITE PHOTOS — gallery (Migration 008)
// ════════════════════════════════════════════════════════════════════════
//
// A jobsite now has a multi-photo gallery in the jobsite_photos table. The
// lowest position is the "primary" photo. jobsites.photo_url (from Patch B)
// is kept as a denormalized mirror of the primary so every existing read
// path (profile cards, Featured Work, edit thumbnails) keeps working — these
// endpoints resync it after every gallery change.
//
// Routes:
//   POST   /api/photos/jobsite/:id              add a photo to the gallery
//   DELETE /api/photos/jobsite/:id/photo/:pid   remove one gallery photo
//   PATCH  /api/photos/jobsite/:id/photos       reorder ({ order: [pid,...] })
//   DELETE /api/photos/jobsite/:id              clear the whole gallery
//
// Photos are stored as cover-style variants (jobsites are landscape shots).
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

// Rewrite jobsites.photo_url to mirror the current primary (position-0) photo,
// or NULL if the gallery is empty. Called after every gallery mutation.
async function syncPrimaryPhoto(jobsiteId) {
  const { rows } = await q(
    `SELECT photo_url FROM jobsite_photos
      WHERE jobsite_id = $1 ORDER BY position ASC, id ASC LIMIT 1`,
    [jobsiteId]
  );
  const primary = rows[0]?.photo_url || null;
  await q('UPDATE jobsites SET photo_url = $1 WHERE id = $2', [primary, jobsiteId]);
}

// Fetch the gallery in display order, shaped for the client.
async function fetchGallery(jobsiteId) {
  const { rows } = await q(
    `SELECT id, photo_url, position FROM jobsite_photos
      WHERE jobsite_id = $1 ORDER BY position ASC, id ASC`,
    [jobsiteId]
  );
  return rows.map(r => ({ id: r.id, urls: urlsFor(r.photo_url), position: r.position }));
}

// Re-pack positions so they're contiguous 0..n-1 after a delete.
async function repackPositions(jobsiteId) {
  await q(
    `WITH ordered AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY position ASC, id ASC) - 1 AS rn
         FROM jobsite_photos WHERE jobsite_id = $1
     )
     UPDATE jobsite_photos jp SET position = ordered.rn
       FROM ordered WHERE jp.id = ordered.id`,
    [jobsiteId]
  );
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
    const { rows: pos } = await q(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM jobsite_photos WHERE jobsite_id = $1`,
      [jobsiteId]
    );
    const { rows } = await q(
      `INSERT INTO jobsite_photos (jobsite_id, photo_url, position)
         VALUES ($1,$2,$3) RETURNING id, position`,
      [jobsiteId, JSON.stringify(variants), pos[0].next]
    );
    await syncPrimaryPhoto(jobsiteId);
    const photos = await fetchGallery(jobsiteId);
    res.status(201).json({
      photo: { id: rows[0].id, urls: urlsFor(variants), position: rows[0].position },
      photos,
    });
  } catch (e) {
    console.error('[photos] jobsite add failed:', e);
    res.status(400).json({ error: e.message || 'Could not process image.' });
  }
});

router.delete('/jobsite/:id/photo/:photoId', requireAuth, async (req, res) => {
  const jobsiteId = parseInt(req.params.id, 10);
  const photoId = parseInt(req.params.photoId, 10);
  if (!Number.isFinite(jobsiteId) || !Number.isFinite(photoId))
    return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkJobsiteAuth(jobsiteId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { rows } = await q(
    `SELECT photo_url FROM jobsite_photos WHERE id = $1 AND jobsite_id = $2`,
    [photoId, jobsiteId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Photo not found.' });

  await q('DELETE FROM jobsite_photos WHERE id = $1', [photoId]);
  await repackPositions(jobsiteId);
  await syncPrimaryPhoto(jobsiteId);
  if (rows[0].photo_url) deleteVariants(rows[0].photo_url);

  const photos = await fetchGallery(jobsiteId);
  res.json({ ok: true, photos });
});

router.patch('/jobsite/:id/photos', requireAuth, async (req, res) => {
  const jobsiteId = parseInt(req.params.id, 10);
  if (!Number.isFinite(jobsiteId)) return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkJobsiteAuth(jobsiteId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const order = Array.isArray(req.body?.order) ? req.body.order : null;
  if (!order) return res.status(400).json({ error: 'order array required' });

  const { rows } = await q(
    'SELECT id FROM jobsite_photos WHERE jobsite_id = $1', [jobsiteId]
  );
  const owned = new Set(rows.map(r => r.id));
  const ids = order.map(n => parseInt(n, 10)).filter(n => owned.has(n));
  // Must be a complete permutation of the jobsite's photos.
  if (ids.length !== owned.size || new Set(ids).size !== owned.size)
    return res.status(400).json({ error: 'order must list every photo exactly once' });

  for (let i = 0; i < ids.length; i++) {
    await q('UPDATE jobsite_photos SET position = $1 WHERE id = $2 AND jobsite_id = $3',
      [i, ids[i], jobsiteId]);
  }
  await syncPrimaryPhoto(jobsiteId);

  const photos = await fetchGallery(jobsiteId);
  res.json({ ok: true, photos });
});

router.delete('/jobsite/:id', requireAuth, async (req, res) => {
  const jobsiteId = parseInt(req.params.id, 10);
  if (!Number.isFinite(jobsiteId)) return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkJobsiteAuth(jobsiteId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { rows } = await q(
    'SELECT photo_url FROM jobsite_photos WHERE jobsite_id = $1', [jobsiteId]
  );
  await q('DELETE FROM jobsite_photos WHERE jobsite_id = $1', [jobsiteId]);
  await q('UPDATE jobsites SET photo_url = NULL WHERE id = $1', [jobsiteId]);
  for (const r of rows) if (r.photo_url) deleteVariants(r.photo_url);
  // Belt-and-suspenders: drop the legacy mirror's variant if it wasn't in the
  // gallery (shouldn't happen post-backfill, but cheap insurance).
  if (auth.jobsite.photo_url && !rows.some(r => r.photo_url === auth.jobsite.photo_url)) {
    deleteVariants(auth.jobsite.photo_url);
  }
  res.json({ ok: true, photos: [] });
});

// ════════════════════════════════════════════════════════════════════════
// PROJECT PHOTOS — homeowner spec flow (Migration 025)
// ════════════════════════════════════════════════════════════════════════
//
// Photos attached to a homeowner's project spec, with pin annotations.
// Mirrors the jobsite pattern: gallery rows in project_photos, R2-stored
// via processCover (landscape variants), JSONB annotations on each row.
//
// Routes:
//   POST   /api/photos/project/:id                       add a photo
//   DELETE /api/photos/project/:id/photo/:pid            remove one photo
//   PATCH  /api/photos/project/:id/photo/:pid            update annotations
//   PATCH  /api/photos/project/:id/photos                reorder ({ order })
//
// Ownership: the project belongs to a home owned by the user.

async function checkProjectAuth(projectId, userId) {
  const { rows } = await q(
    `SELECT p.id
       FROM projects p
       JOIN homes h ON h.id = p.home_id
      WHERE p.id = $1 AND h.owner_user_id = $2`,
    [projectId, userId]
  );
  if (!rows.length) return { ok: false, status: 404, error: 'Project not found.' };
  return { ok: true };
}

async function fetchProjectGallery(projectId) {
  const { rows } = await q(
    `SELECT id, photo_url, annotations, position
       FROM project_photos
       WHERE project_id = $1
       ORDER BY position ASC, id ASC`,
    [projectId]
  );
  return rows.map(r => ({
    id: r.id,
    urls: urlsFor(r.photo_url),
    annotations: r.annotations || [],
    position: r.position,
  }));
}

async function repackProjectPhotoPositions(projectId) {
  await q(
    `WITH ordered AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY position ASC, id ASC) - 1 AS rn
         FROM project_photos WHERE project_id = $1
     )
     UPDATE project_photos pp SET position = ordered.rn
       FROM ordered WHERE pp.id = ordered.id`,
    [projectId]
  );
}

// Normalize an annotations payload: array of { x, y, caption } where x and
// y are floats in [0,1] and caption is a non-empty string. Anything else
// gets dropped. Numbering is regenerated server-side so clients can't
// produce duplicates.
function normalizeAnnotations(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  let nextId = 1;
  for (const a of input) {
    if (!a || typeof a !== 'object') continue;
    const x = Number(a.x);
    const y = Number(a.y);
    const caption = typeof a.caption === 'string' ? a.caption.trim() : '';
    if (!Number.isFinite(x) || x < 0 || x > 1) continue;
    if (!Number.isFinite(y) || y < 0 || y > 1) continue;
    if (!caption) continue;
    out.push({ id: nextId++, x, y, caption });
  }
  return out;
}

router.post('/project/:id', requireAuth, withUpload, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkProjectAuth(projectId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const variants = await processCover(req.file.buffer, {
      namespace: 'projects',
      ownerId: projectId,
      label: 'photo',
    });
    const { rows: pos } = await q(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM project_photos WHERE project_id = $1`,
      [projectId]
    );
    const { rows } = await q(
      `INSERT INTO project_photos (project_id, photo_url, position)
         VALUES ($1, $2, $3) RETURNING id, position`,
      [projectId, JSON.stringify(variants), pos[0].next]
    );
    const photos = await fetchProjectGallery(projectId);
    res.status(201).json({
      photo: { id: rows[0].id, urls: urlsFor(variants), annotations: [], position: rows[0].position },
      photos,
    });
  } catch (e) {
    console.error('[photos] project add failed:', e);
    res.status(400).json({ error: e.message || 'Could not process image.' });
  }
});

router.delete('/project/:id/photo/:photoId', requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  const photoId = parseInt(req.params.photoId, 10);
  if (!Number.isFinite(projectId) || !Number.isFinite(photoId))
    return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkProjectAuth(projectId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { rows } = await q(
    `SELECT photo_url FROM project_photos WHERE id = $1 AND project_id = $2`,
    [photoId, projectId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Photo not found.' });

  await q('DELETE FROM project_photos WHERE id = $1', [photoId]);
  await repackProjectPhotoPositions(projectId);
  if (rows[0].photo_url) deleteVariants(rows[0].photo_url);

  const photos = await fetchProjectGallery(projectId);
  res.json({ ok: true, photos });
});

router.patch('/project/:id/photo/:photoId', requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  const photoId = parseInt(req.params.photoId, 10);
  if (!Number.isFinite(projectId) || !Number.isFinite(photoId))
    return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkProjectAuth(projectId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const annotations = normalizeAnnotations(req.body?.annotations);

  const { rows } = await q(
    `UPDATE project_photos
        SET annotations = $1, updated_at = NOW()
      WHERE id = $2 AND project_id = $3
      RETURNING id, photo_url, annotations, position`,
    [JSON.stringify(annotations), photoId, projectId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Photo not found.' });

  const r = rows[0];
  res.json({
    photo: {
      id: r.id,
      urls: urlsFor(r.photo_url),
      annotations: r.annotations || [],
      position: r.position,
    },
  });
});

router.patch('/project/:id/photos', requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'Invalid id' });

  const auth = await checkProjectAuth(projectId, req.userId);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const order = Array.isArray(req.body?.order) ? req.body.order : null;
  if (!order) return res.status(400).json({ error: 'order array required' });

  const { rows } = await q(
    'SELECT id FROM project_photos WHERE project_id = $1', [projectId]
  );
  const owned = new Set(rows.map(r => r.id));
  const ids = order.map(n => parseInt(n, 10)).filter(n => owned.has(n));
  if (ids.length !== owned.size || new Set(ids).size !== owned.size)
    return res.status(400).json({ error: 'order must list every photo exactly once' });

  for (let i = 0; i < ids.length; i++) {
    await q('UPDATE project_photos SET position = $1 WHERE id = $2 AND project_id = $3',
      [i, ids[i], projectId]);
  }

  const photos = await fetchProjectGallery(projectId);
  res.json({ ok: true, photos });
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
