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
import { recomputeMatchesForUser } from '../jobs/match.js';

const router = Router();

// Shape a `jobs` row + its `job_matches` join into the API response. Hides
// the long description from the list endpoint (caller fetches /jobs/:id for
// the full body).
function shapeJobListItem(row) {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    salary_min: row.salary_min != null ? Number(row.salary_min) : null,
    salary_max: row.salary_max != null ? Number(row.salary_max) : null,
    salary_currency: row.salary_currency,
    salary_period: row.salary_period,
    salary_is_predicted: !!row.salary_is_predicted,
    url: row.url,
    trade_tags: row.trade_tags || [],
    skill_tags: row.skill_tags || [],
    has_direct_contact: !!(row.contact_email || row.contact_phone),
    is_prevailing_wage: !!row.is_prevailing_wage,
    is_direct_post: !!row.is_direct_post,
    source_driver: row.source_driver,
    posted_at: row.posted_at,
    score: row.score != null ? Number(row.score) : 0,
    saved: !!row.saved_at,
    dismissed: !!row.dismissed_at,
    applied: !!row.sent_at,         // phase 4 — apply status from application_drafts join
    applied_at: row.sent_at || null,
    application_id: row.application_id || null,
  };
}

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

// ════════════════════════════════════════════════════════════════════════
// PUBLIC JOBS FEED (Jobs module — phase 3)
// ════════════════════════════════════════════════════════════════════════

// GET /api/jobs — ranked feed for the signed-in user.
// Filters (all optional):
//   ?trade=<canonical name>      filter to jobs tagged with that trade
//   ?has_direct_contact=1        only jobs with contact_email or contact_phone
//   ?prevailing_wage=1           only prevailing-wage / Davis-Bacon
//   ?saved=1                     only user-saved jobs
//   ?include_dismissed=1         include dismissed (hidden by default)
//   ?posted_since=<days>         e.g. 14 = only jobs posted in the last 14 days
//   ?limit=<n>&offset=<n>        pagination (default limit 25, max 60)
router.get('/jobs', requireAuth, async (req, res) => {
  // If the user has zero match rows, do a sync recompute so the feed isn't
  // empty on first visit. After this, ingest-cycle recomputes keep it fresh.
  const { rows: existing } = await q(
    `SELECT 1 FROM job_matches WHERE user_id = $1 LIMIT 1`,
    [req.userId]
  );
  if (existing.length === 0) {
    await recomputeMatchesForUser(req.userId);
  }

  const limit  = Math.min(60, Math.max(1, parseInt(req.query.limit, 10)  || 25));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const where  = ['NOT j.hidden', 'jm.user_id = $1'];
  const params = [req.userId];
  const push   = (v) => { params.push(v); return `$${params.length}`; };

  if (req.query.trade) {
    where.push(`${push(req.query.trade)} = ANY(j.trade_tags)`);
  }
  if (req.query.has_direct_contact === '1' || req.query.has_direct_contact === 'true') {
    where.push(`(j.contact_email IS NOT NULL OR j.contact_phone IS NOT NULL)`);
  }
  if (req.query.prevailing_wage === '1' || req.query.prevailing_wage === 'true') {
    where.push(`j.is_prevailing_wage = TRUE`);
  }
  if (req.query.saved === '1' || req.query.saved === 'true') {
    where.push(`jm.saved_at IS NOT NULL`);
  }
  if (req.query.include_dismissed !== '1' && req.query.include_dismissed !== 'true') {
    where.push(`jm.dismissed_at IS NULL`);
  }
  if (req.query.posted_since) {
    const days = Math.max(1, Math.min(365, parseInt(req.query.posted_since, 10) || 0));
    if (days > 0) where.push(`j.posted_at >= NOW() - (${days} || ' days')::interval`);
  }

  params.push(limit);
  params.push(offset);

  // ORDER BY saved DESC nudges saved jobs above unsaved at the same score,
  // and we tie-break on posted_at so newer matches surface first when scores
  // are identical.
  const { rows } = await q(
    `SELECT j.id, j.title, j.company, j.location,
            j.salary_min, j.salary_max, j.salary_currency, j.salary_period, j.salary_is_predicted,
            j.url, j.trade_tags, j.skill_tags, j.contact_email, j.contact_phone,
            j.is_prevailing_wage, j.is_direct_post, j.source_driver, j.posted_at,
            jm.score, jm.saved_at, jm.dismissed_at,
            ad.id AS application_id, ad.sent_at
       FROM jobs j
       JOIN job_matches jm ON jm.job_id = j.id
       LEFT JOIN application_drafts ad ON ad.job_id = j.id AND ad.user_id = $1
      WHERE ${where.join(' AND ')}
      ORDER BY (jm.saved_at IS NOT NULL) DESC, jm.score DESC, j.posted_at DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // Total count for pagination — same WHERE, no LIMIT/OFFSET.
  const countParams = params.slice(0, params.length - 2);
  const { rows: countRows } = await q(
    `SELECT COUNT(*)::int AS n
       FROM jobs j
       JOIN job_matches jm ON jm.job_id = j.id
      WHERE ${where.join(' AND ')}`,
    countParams
  );

  res.json({
    jobs: rows.map(shapeJobListItem),
    total: countRows[0].n,
    limit, offset,
  });
});

// GET /api/jobs/:id — full job detail with computed match data.
router.get('/jobs/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const { rows } = await q(
    `SELECT j.*, jm.score, jm.saved_at, jm.dismissed_at,
            ad.id AS application_id, ad.sent_at
       FROM jobs j
       LEFT JOIN job_matches jm ON jm.job_id = j.id AND jm.user_id = $1
       LEFT JOIN application_drafts ad ON ad.job_id = j.id AND ad.user_id = $1
      WHERE j.id = $2 AND NOT j.hidden`,
    [req.userId, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const row = rows[0];
  res.json({
    job: {
      ...shapeJobListItem(row),
      description: row.description,
      contact_email: row.contact_email,   // exposed on detail; hidden in list shape
      contact_phone: row.contact_phone,
      lat: row.lat != null ? Number(row.lat) : null,
      lng: row.lng != null ? Number(row.lng) : null,
      ingested_at: row.ingested_at,
    },
  });
});

// POST /api/jobs/:id/save — bookmark. Idempotent (no error if already saved).
router.post('/jobs/:id/save', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  // Use INSERT … ON CONFLICT so we work whether or not a match row already
  // exists for this user. If the match doesn't exist yet (rare — first GET
  // /jobs would have populated it), we materialize it with score=0.
  await q(
    `INSERT INTO job_matches (user_id, job_id, score, saved_at)
       VALUES ($1, $2, 0, NOW())
     ON CONFLICT (user_id, job_id) DO UPDATE SET saved_at = NOW()`,
    [req.userId, id]
  );
  res.json({ ok: true, saved: true });
});

// DELETE /api/jobs/:id/save — un-save.
router.delete('/jobs/:id/save', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  await q(
    `UPDATE job_matches SET saved_at = NULL WHERE user_id = $1 AND job_id = $2`,
    [req.userId, id]
  );
  res.json({ ok: true, saved: false });
});

// POST /api/jobs/:id/dismiss — hide from the default feed. Sticky across
// recomputes (recomputeMatchesForUser preserves dismissed_at via ON CONFLICT).
router.post('/jobs/:id/dismiss', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  await q(
    `INSERT INTO job_matches (user_id, job_id, score, dismissed_at)
       VALUES ($1, $2, 0, NOW())
     ON CONFLICT (user_id, job_id) DO UPDATE SET dismissed_at = NOW()`,
    [req.userId, id]
  );
  res.json({ ok: true, dismissed: true });
});

// DELETE /api/jobs/:id/dismiss — un-dismiss.
router.delete('/jobs/:id/dismiss', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  await q(
    `UPDATE job_matches SET dismissed_at = NULL WHERE user_id = $1 AND job_id = $2`,
    [req.userId, id]
  );
  res.json({ ok: true, dismissed: false });
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
