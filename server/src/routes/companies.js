// Smith — Companies, work-history, and jobsites
//
// The profile page's "Where I've worked" timeline is the unique structural piece
// of Smith — companies, with jobsites stacked under each. Endpoints here let
// users add a company tenure, then attach jobsites to it.
//
// Patch B: companies + jobsites grew a photo upload (logo, jobsite photo). The
// upload itself lives in routes/photos.js; this file mostly cares about
// surfacing logo_urls + photo_urls in the returned shape and accepting them
// where it makes sense.

import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth } from '../middleware.js';
import { publicUrl } from '../storage.js';

const router = Router();

// Translate a JSON shape of storage keys to URLs the client can render.
// Shared with profiles.js's parser — kept inline here for module isolation.
function parseUrls(stored) {
  if (!stored) return null;
  let parsed = stored;
  if (typeof stored === 'string') {
    try { parsed = JSON.parse(stored); } catch { return null; }
  }
  if (typeof parsed !== 'object' || !parsed) return null;
  const out = {};
  for (const [size, key] of Object.entries(parsed)) {
    if (typeof key === 'string') out[size] = publicUrl(key);
  }
  return out;
}

// GET /api/companies?search=... — autocomplete during "Add company" flow.
// Returns logo_urls so the dropdown can show real logos for companies that
// have one.
router.get('/companies', requireAuth, async (req, res) => {
  const search = (req.query.search || '').toString().trim();
  if (!search) return res.json({ companies: [] });
  const { rows } = await q(
    `SELECT id, name, type, logo_tone, logo_url,
            claimed_by IS NOT NULL AS claimed
       FROM companies
      WHERE LOWER(name) LIKE LOWER($1)
      ORDER BY claimed_by IS NOT NULL DESC, name ASC
      LIMIT 10`,
    [`%${search}%`]
  );
  res.json({
    companies: rows.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      logo_tone: c.logo_tone,
      logo_urls: parseUrls(c.logo_url),
      claimed: c.claimed,
    })),
  });
});

// POST /api/companies — create a new company (will be unclaimed unless claim=true)
router.post('/companies', requireAuth, async (req, res) => {
  const { name, type = 'General Contractor', logo_tone = 'rust', claim = false } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await q(
    `INSERT INTO companies (name, type, logo_tone, claimed_by, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, type, logo_tone, logo_url,
                 claimed_by IS NOT NULL AS claimed`,
    [name, type, logo_tone, claim ? req.userId : null, req.userId]
  );
  const c = rows[0];
  res.status(201).json({
    company: {
      id: c.id,
      name: c.name,
      type: c.type,
      logo_tone: c.logo_tone,
      logo_urls: parseUrls(c.logo_url),
      claimed: c.claimed,
    },
  });
});

// POST /api/companies/:id/claim — claim an unclaimed company
router.post('/companies/:id/claim', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = await q(
    `UPDATE companies SET claimed_by = $1
       WHERE id = $2 AND claimed_by IS NULL
       RETURNING id`,
    [req.userId, id]
  );
  if (!r.rowCount) return res.status(409).json({ error: 'Already claimed or not found' });
  res.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────────────
// Work history (a tenure at a company)
// ────────────────────────────────────────────────────────────────────────────

// POST /api/work-history
// Body: { company_id, role, from_year, to_year?, is_current?, jobsites?: [{title,kind,location,duration,photo_kind}] }
router.post('/work-history', requireAuth, async (req, res) => {
  const { company_id, role, from_year, to_year, is_current, jobsites = [] } = req.body || {};
  if (!company_id || !role || !from_year)
    return res.status(400).json({ error: 'company_id, role, from_year required' });

  const result = await tx(async (c) => {
    const { rows: pos } = await c.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM work_history WHERE user_id = $1`,
      [req.userId]
    );
    const { rows } = await c.query(
      `INSERT INTO work_history (user_id, company_id, role, from_year, to_year, is_current, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.userId, company_id, role, String(from_year), to_year ? String(to_year) : null,
       !!is_current, pos[0].next]
    );
    const whId = rows[0].id;
    for (let i = 0; i < jobsites.length; i++) {
      const js = jobsites[i] || {};
      if (!js.title) continue;
      await c.query(
        `INSERT INTO jobsites (work_history_id, title, kind, location, duration, photo_kind, position)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [whId, js.title, js.kind || '', js.location || '',
         js.duration || '', js.photo_kind || 'frame', i]
      );
    }
    return whId;
  });

  res.status(201).json({ work_history_id: result });
});

router.delete('/work-history/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = await q(
    `DELETE FROM work_history WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// POST /api/work-history/:id/jobsites — append a jobsite
router.post('/work-history/:id/jobsites', requireAuth, async (req, res) => {
  const whId = parseInt(req.params.id, 10);
  const { title, kind = '', location = '', duration = '', photo_kind = 'frame', is_featured = false } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });

  // Verify the work-history row belongs to this user.
  const { rows: own } = await q(
    `SELECT id FROM work_history WHERE id = $1 AND user_id = $2`,
    [whId, req.userId]
  );
  if (!own.length) return res.status(404).json({ error: 'Not found' });

  const { rows: pos } = await q(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM jobsites WHERE work_history_id = $1`,
    [whId]
  );
  const { rows } = await q(
    `INSERT INTO jobsites (work_history_id, title, kind, location, duration, photo_kind, is_featured, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, title, kind, location, duration, photo_kind, photo_url, is_featured, position`,
    [whId, title, kind, location, duration, photo_kind, !!is_featured, pos[0].next]
  );
  const j = rows[0];
  res.status(201).json({
    jobsite: {
      id: j.id,
      title: j.title,
      kind: j.kind,
      location: j.location,
      duration: j.duration,
      photo_kind: j.photo_kind,
      photo_urls: parseUrls(j.photo_url),
      is_featured: j.is_featured,
      position: j.position,
    },
  });
});

router.delete('/jobsites/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = await q(
    `DELETE FROM jobsites js USING work_history wh
       WHERE js.id = $1 AND js.work_history_id = wh.id AND wh.user_id = $2`,
    [id, req.userId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// PATCH /api/jobsites/:id — toggle featured, edit fields
router.patch('/jobsites/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const allowed = ['title', 'kind', 'location', 'duration', 'photo_kind', 'is_featured'];
  const updates = {};
  for (const k of allowed) if (k in (req.body || {})) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No fields to update' });

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`);
  const vals = [id, req.userId, ...Object.values(updates)];
  const r = await q(
    `UPDATE jobsites js SET ${sets.join(', ')}
       FROM work_history wh
      WHERE js.id = $1 AND js.work_history_id = wh.id AND wh.user_id = $2
      RETURNING js.id`,
    vals
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
