// Smith — Projects (homeowner spec flow) API
//
// One row per spec the homeowner is building. Picker creates a draft row;
// the spec flow fills the `draft` JSONB; the final Claude call writes `sow`.
// See memory: project-spec-flow-architecture.

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

// V1 project type catalog. Kept in sync with client/src/lib/project-types.js
// (the picker UI source). Moves to a project_types table once the
// data-driven eligibility-rule catalog ships.
const KIND_TITLES = {
  'bathroom-remodel':  'Remodel a bathroom',
  'kitchen-remodel':   'Remodel a kitchen',
  'finish-basement':   'Finish a basement',
  'hvac-replacement':  'Replace HVAC system',
  'roof-replacement':  'Replace roof',
  'electrical-panel':  'Upgrade electrical panel',
  'custom':            'New project',
};

function shapeProject(row) {
  return {
    id: row.id,
    home_id: row.home_id,
    parent_project_id: row.parent_project_id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    coordination_role: row.coordination_role,
    pending_pro_slug: row.pending_pro_slug,
    draft: row.draft || {},
    sow: row.sow,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadOwnedHome(homeId, userId) {
  const { rows } = await q(
    `SELECT * FROM homes WHERE id = $1 AND owner_user_id = $2`,
    [homeId, userId]
  );
  return rows[0] || null;
}

// ── POST /api/projects ────────────────────────────────────────────────────
// Create a draft project for a home the user owns.
// Body: { home_id, kind, pending_pro_slug? }
router.post('/projects', requireAuth, async (req, res) => {
  const { home_id, kind, pending_pro_slug } = req.body || {};
  const homeId = parseInt(home_id, 10);
  if (!Number.isFinite(homeId)) return res.status(400).json({ error: 'home_id required' });
  if (!kind || typeof kind !== 'string') return res.status(400).json({ error: 'kind required' });
  if (!Object.prototype.hasOwnProperty.call(KIND_TITLES, kind)) {
    return res.status(400).json({ error: 'unknown kind' });
  }

  const home = await loadOwnedHome(homeId, req.userId);
  if (!home) return res.status(404).json({ error: 'home not found' });

  const title = KIND_TITLES[kind];
  const proSlug = pending_pro_slug ? String(pending_pro_slug).trim() : null;

  const { rows } = await q(
    `INSERT INTO projects (home_id, kind, title, pending_pro_slug)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [homeId, kind, title, proSlug]
  );
  res.status(201).json({ project: shapeProject(rows[0]) });
});

// ── GET /api/projects?home_id=… ───────────────────────────────────────────
// List the user's projects at a given home. Newest first.
router.get('/projects', requireAuth, async (req, res) => {
  const homeId = parseInt(req.query.home_id, 10);
  if (!Number.isFinite(homeId)) return res.status(400).json({ error: 'home_id required' });

  const home = await loadOwnedHome(homeId, req.userId);
  if (!home) return res.status(404).json({ error: 'home not found' });

  const { rows } = await q(
    `SELECT * FROM projects
       WHERE home_id = $1
       ORDER BY created_at DESC`,
    [homeId]
  );
  res.json({ projects: rows.map(shapeProject) });
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────
router.get('/projects/:id', requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'invalid id' });

  const { rows } = await q(
    `SELECT p.* FROM projects p
       JOIN homes h ON h.id = p.home_id
      WHERE p.id = $1 AND h.owner_user_id = $2`,
    [projectId, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ project: shapeProject(rows[0]) });
});

// ── PATCH /api/projects/:id ───────────────────────────────────────────────
// Update an in-progress draft. v1 accepts `draft` (full JSONB replace) and
// `title`. Status/coordination_role move through dedicated flows (classifier,
// send) which don't exist yet.
router.patch('/projects/:id', requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'invalid id' });

  const { rows: existing } = await q(
    `SELECT p.* FROM projects p
       JOIN homes h ON h.id = p.home_id
      WHERE p.id = $1 AND h.owner_user_id = $2`,
    [projectId, req.userId]
  );
  if (!existing.length) return res.status(404).json({ error: 'not found' });

  const body = req.body || {};
  const cols = [];
  const vals = [];
  if (body.draft !== undefined) {
    if (body.draft === null || typeof body.draft !== 'object') {
      return res.status(400).json({ error: 'draft must be an object' });
    }
    cols.push('draft');
    vals.push(JSON.stringify(body.draft));
  }
  if (body.title !== undefined) {
    cols.push('title');
    vals.push(String(body.title));
  }
  if (!cols.length) {
    return res.json({ project: shapeProject(existing[0]) });
  }

  const setStr = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  vals.push(projectId);
  const { rows } = await q(
    `UPDATE projects SET ${setStr}, updated_at = NOW()
       WHERE id = $${vals.length}
       RETURNING *`,
    vals
  );
  res.json({ project: shapeProject(rows[0]) });
});

export default router;
