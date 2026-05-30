// Smith — Jobs routes
//
// Phase 2 (this file ships): admin source-registry CRUD + manual ingest
// trigger. Endpoints for the public Jobs feed (GET /jobs, GET /jobs/:id,
// save/dismiss) ship in phase 3 once the matcher exists.
//
// Admin endpoints (require requireAdmin):
//   GET    /api/admin/jobs/sources           list source registry + health
//   POST   /api/admin/jobs/sources           add a source
//   PATCH  /api/admin/jobs/sources/:id       enable/disable/edit config
//   DELETE /api/admin/jobs/sources/:id       drop a source (jobs FK SET NULL)
//   POST   /api/admin/jobs/ingest            run ingestion now (returns summary)

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { ingestAllJobs } from '../ingest-jobs.js';
import { listDrivers } from '../jobs/sources/index.js';

const router = Router();

// Mirror of news.js's admin gate — same pattern, same trade-off (one small
// query per request, ID-keyed, no caching needed at our scale).
function requireAdmin(req, res, next) {
  q(`SELECT is_admin FROM users WHERE id = $1`, [req.userId])
    .then(({ rows }) => {
      if (!rows[0]?.is_admin) return res.status(403).json({ error: 'Admin required' });
      next();
    })
    .catch(next);
}

// ── GET /api/admin/jobs/sources ──────────────────────────────────────────
// Returns every source with last-run health so the UI can show "Adzuna SLC —
// 47 new 12 min ago" or "ERROR: ADZUNA_APP_ID + ADZUNA_APP_KEY not set."
router.get('/admin/jobs/sources', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await q(
    `SELECT id, driver, name, config, enabled,
            last_ingested_at, last_status, last_count, created_at,
            (SELECT COUNT(*)::int FROM jobs WHERE source_id = job_sources.id) AS total_jobs
       FROM job_sources
      ORDER BY id ASC`
  );
  res.json({
    sources: rows,
    available_drivers: listDrivers(),
  });
});

// ── POST /api/admin/jobs/sources ─────────────────────────────────────────
// Body: { driver, name, config?, enabled? }
router.post('/admin/jobs/sources', requireAuth, requireAdmin, async (req, res) => {
  const { driver, name, config = {}, enabled = true } = req.body || {};
  if (!driver || !name) {
    return res.status(400).json({ error: 'driver and name required' });
  }
  if (!listDrivers().includes(driver)) {
    return res.status(400).json({ error: `Unknown driver: ${driver}. Available: ${listDrivers().join(', ')}` });
  }
  if (typeof config !== 'object' || config === null) {
    return res.status(400).json({ error: 'config must be an object' });
  }
  const { rows } = await q(
    `INSERT INTO job_sources (driver, name, config, enabled)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id, driver, name, config, enabled, created_at`,
    [driver, name, JSON.stringify(config), !!enabled]
  );
  res.status(201).json({ source: rows[0] });
});

// ── PATCH /api/admin/jobs/sources/:id ────────────────────────────────────
// Body: any subset of { name, config, enabled }. driver is intentionally
// immutable — change drivers by deleting + recreating, to avoid a row
// silently switching shapes mid-ingest.
router.patch('/admin/jobs/sources/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const allowed = ['name', 'config', 'enabled'];
  const updates = {};
  for (const k of allowed) if (k in (req.body || {})) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  if ('config' in updates && (typeof updates.config !== 'object' || updates.config === null)) {
    return res.status(400).json({ error: 'config must be an object' });
  }

  // Build dynamic UPDATE — special-case config so we cast it to jsonb.
  const sets = [];
  const params = [id];
  let i = 2;
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'config') {
      sets.push(`config = $${i}::jsonb`);
      params.push(JSON.stringify(v));
    } else {
      sets.push(`${k} = $${i}`);
      params.push(v);
    }
    i++;
  }
  const r = await q(
    `UPDATE job_sources SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, driver, name, config, enabled, last_status`,
    params
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ source: r.rows[0] });
});

// ── DELETE /api/admin/jobs/sources/:id ───────────────────────────────────
// jobs.source_id is ON DELETE SET NULL — existing jobs survive (the dedup
// key on (source_driver, source_job_id) keeps them addressable). They just
// stop refreshing.
router.delete('/admin/jobs/sources/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const r = await q(`DELETE FROM job_sources WHERE id = $1`, [id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ── POST /api/admin/jobs/ingest ──────────────────────────────────────────
// Runs the full ingest cycle synchronously and returns the summary so the
// admin can see "Adzuna SLC: 47 new, 12 updated" in their browser. Long
// requests are fine here — admin only, called rarely.
router.post('/admin/jobs/ingest', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const summary = await ingestAllJobs();
    res.json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Ingest failed' });
  }
});

export default router;
