// Smith — News routes
//
// Endpoints (all require auth):
//   GET    /api/news                       list articles (filters via query)
//   GET    /api/news/categories            counts per category
//   GET    /api/news/tags                  distinct tags in use, with counts
//   GET    /api/news/featured              hand-pinned featured stories for hero strip
//   GET    /api/news/for-you               articles tagged for the user's trades
//   GET    /api/news/saved                 user's saved articles
//   POST   /api/news/:id/save              bookmark
//   DELETE /api/news/:id/save              un-bookmark
//
// Admin-only (require requireAdmin):
//   GET    /api/admin/news/feeds           feed health
//   POST   /api/admin/news/feeds           add a feed
//   PATCH  /api/admin/news/feeds/:id       enable/disable
//   POST   /api/admin/news/ingest          run ingestion now
//   PATCH  /api/admin/news/:id             toggle featured / hidden

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { ingestAll } from '../ingest-news.js';

const router = Router();

// ── Admin gate ────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  // Quick re-fetch — req.user from requireAuth doesn't include is_admin.
  // Single small query, hits a primary-key lookup, fine.
  q(`SELECT is_admin FROM users WHERE id = $1`, [req.userId])
    .then(({ rows }) => {
      if (!rows[0]?.is_admin) return res.status(403).json({ error: 'Admin required' });
      next();
    })
    .catch(next);
}

// Shape a row into the API response. Adds saved_by_me when we have a viewer.
function shape(row, savedSet) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    source: row.source,
    source_url: row.source_url,
    author: row.author,
    published_at: row.published_at,
    read_minutes: row.read_minutes,
    image_kind: row.image_kind,
    category: row.category,
    tags: row.tags || [],
    featured: !!row.featured,
    saved_by_me: savedSet ? savedSet.has(row.id) : false,
  };
}

// Load a set of article IDs the viewer has saved — used to annotate lists
// with `saved_by_me` so the bookmark icon renders the right state.
async function loadSavedSet(userId) {
  const { rows } = await q(`SELECT article_id FROM news_saves WHERE user_id = $1`, [userId]);
  return new Set(rows.map(r => r.article_id));
}

// ── GET /api/news ─────────────────────────────────────────────────────────
// Query params: ?category=…  ?tag=…  ?q=…  ?limit=…  ?offset=…
router.get('/news', requireAuth, async (req, res) => {
  const category = (req.query.category || '').toString().trim() || null;
  const tag      = (req.query.tag || '').toString().trim() || null;
  const search   = (req.query.q || '').toString().trim() || null;
  const limit    = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 24));
  const offset   = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const where = ['NOT hidden'];
  const params = [];
  if (category) { params.push(category); where.push(`category = $${params.length}`); }
  if (tag)      { params.push(tag);      where.push(`$${params.length} = ANY(tags)`); }
  if (search)   {
    params.push(`%${search}%`);
    where.push(`(LOWER(title) LIKE LOWER($${params.length}) OR LOWER(summary) LIKE LOWER($${params.length}))`);
  }
  params.push(limit, offset);

  const sql = `
    SELECT id, title, summary, source, source_url, author, published_at,
           read_minutes, image_kind, category, tags, featured
      FROM news_articles
     WHERE ${where.join(' AND ')}
     ORDER BY published_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const { rows } = await q(sql, params);
  const saved = await loadSavedSet(req.userId);
  res.json({ articles: rows.map(r => shape(r, saved)) });
});

// ── GET /api/news/categories ──────────────────────────────────────────────
// Drives the tab nav on the news page. We return all 7 categories in a fixed
// order even if some are empty, so the UI is stable across ingestions.
const CANONICAL_CATEGORIES = ['The Trade', 'Career', 'Materials', 'Labor', 'Safety', 'Codes', 'Tech & AI'];
router.get('/news/categories', requireAuth, async (_req, res) => {
  const { rows } = await q(
    `SELECT category, COUNT(*)::int AS n
       FROM news_articles WHERE NOT hidden GROUP BY category`
  );
  const counts = Object.fromEntries(rows.map(r => [r.category, r.n]));
  res.json({
    categories: CANONICAL_CATEGORIES.map(name => ({ name, count: counts[name] || 0 })),
  });
});

// ── GET /api/news/tags ────────────────────────────────────────────────────
router.get('/news/tags', requireAuth, async (_req, res) => {
  const { rows } = await q(
    `SELECT t AS tag, COUNT(*)::int AS n
       FROM news_articles, UNNEST(tags) AS t
      WHERE NOT hidden
      GROUP BY t
      ORDER BY n DESC, t ASC
      LIMIT 50`
  );
  res.json({ tags: rows });
});

// ── GET /api/news/featured ────────────────────────────────────────────────
// Hero strip: 1 large + 2 secondary. Picks newest featured.
router.get('/news/featured', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT id, title, summary, source, source_url, author, published_at,
            read_minutes, image_kind, category, tags, featured
       FROM news_articles
      WHERE NOT hidden AND featured
      ORDER BY published_at DESC
      LIMIT 6`
  );
  const saved = await loadSavedSet(req.userId);
  res.json({ articles: rows.map(r => shape(r, saved)) });
});

// ── GET /api/news/for-you ─────────────────────────────────────────────────
// Articles tagged with any of the user's trade names. Falls back to
// most-recent if the user has no trades yet.
router.get('/news/for-you', requireAuth, async (req, res) => {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));

  const trades = await q(
    `SELECT t.name FROM user_trades ut JOIN trades t ON t.id = ut.trade_id
      WHERE ut.user_id = $1 ORDER BY ut.position ASC`,
    [req.userId]
  );
  const tradeNames = trades.rows.map(r => r.name);

  let rows;
  if (tradeNames.length === 0) {
    ({ rows } = await q(
      `SELECT id, title, summary, source, source_url, author, published_at,
              read_minutes, image_kind, category, tags, featured
         FROM news_articles
        WHERE NOT hidden
        ORDER BY published_at DESC LIMIT $1`,
      [limit]
    ));
  } else {
    ({ rows } = await q(
      `SELECT id, title, summary, source, source_url, author, published_at,
              read_minutes, image_kind, category, tags, featured
         FROM news_articles
        WHERE NOT hidden AND tags && $1::text[]
        ORDER BY published_at DESC LIMIT $2`,
      [tradeNames, limit]
    ));
    // If nothing matched the user's trades (small catalog), top up with newest.
    if (rows.length < limit) {
      const need = limit - rows.length;
      const have = new Set(rows.map(r => r.id));
      const more = await q(
        `SELECT id, title, summary, source, source_url, author, published_at,
                read_minutes, image_kind, category, tags, featured
           FROM news_articles
          WHERE NOT hidden AND id <> ALL($1::bigint[])
          ORDER BY published_at DESC LIMIT $2`,
        [[...have], need]
      );
      rows = rows.concat(more.rows);
    }
  }

  const saved = await loadSavedSet(req.userId);
  res.json({ articles: rows.map(r => shape(r, saved)) });
});

// ── Saved-for-later ───────────────────────────────────────────────────────
router.get('/news/saved', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT a.id, a.title, a.summary, a.source, a.source_url, a.author,
            a.published_at, a.read_minutes, a.image_kind, a.category, a.tags,
            a.featured, s.saved_at
       FROM news_saves s JOIN news_articles a ON a.id = s.article_id
      WHERE s.user_id = $1 AND NOT a.hidden
      ORDER BY s.saved_at DESC
      LIMIT 100`,
    [req.userId]
  );
  res.json({
    articles: rows.map(r => ({ ...shape(r), saved_by_me: true, saved_at: r.saved_at })),
  });
});

router.post('/news/:id/save', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const r = await q(
    `INSERT INTO news_saves (user_id, article_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING user_id`,
    [req.userId, id]
  );
  if (!r.rowCount) {
    // already saved — confirm article exists, otherwise 404.
    const check = await q(`SELECT 1 FROM news_articles WHERE id = $1`, [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Article not found' });
  }
  res.json({ ok: true, saved: true });
});

router.delete('/news/:id/save', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  await q(`DELETE FROM news_saves WHERE user_id = $1 AND article_id = $2`, [req.userId, id]);
  res.json({ ok: true, saved: false });
});

// ── Admin ─────────────────────────────────────────────────────────────────
router.get('/admin/news/feeds', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await q(
    `SELECT id, name, url, category, default_tags, enabled,
            last_ingested_at, last_status, last_count
       FROM news_feeds ORDER BY enabled DESC, name ASC`
  );
  res.json({ feeds: rows });
});

router.post('/admin/news/feeds', requireAuth, requireAdmin, async (req, res) => {
  const { name, url, category, default_tags = [] } = req.body || {};
  if (!name || !url || !category)
    return res.status(400).json({ error: 'name, url, category required' });
  const { rows } = await q(
    `INSERT INTO news_feeds (name, url, category, default_tags)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category
       RETURNING id, name, url, category, enabled`,
    [name, url, category, default_tags]
  );
  res.status(201).json({ feed: rows[0] });
});

router.patch('/admin/news/feeds/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const allowed = ['enabled', 'category', 'name', 'default_tags'];
  const updates = {};
  for (const k of allowed) if (k in (req.body || {})) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No fields to update' });
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
  const vals = [id, ...Object.values(updates)];
  const r = await q(
    `UPDATE news_feeds SET ${sets.join(', ')} WHERE id = $1 RETURNING id`,
    vals
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.post('/admin/news/ingest', requireAuth, requireAdmin, async (_req, res) => {
  const summary = await ingestAll();
  res.json({ ok: true, summary });
});

router.patch('/admin/news/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const allowed = ['featured', 'hidden', 'category', 'tags', 'image_kind'];
  const updates = {};
  for (const k of allowed) if (k in (req.body || {})) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No fields to update' });
  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
  const vals = [id, ...Object.values(updates)];
  const r = await q(
    `UPDATE news_articles SET ${sets.join(', ')} WHERE id = $1 RETURNING id`,
    vals
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
