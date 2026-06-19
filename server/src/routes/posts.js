// Smith — Feed posts
//
// Feed shape mirrors SAMPLE.feed in the design files:
//   - type: 'project' | 'hiring' | 'milestone' | 'photo'
//   - body, photos[], tags[], milestone, project_name
//   - stats: { likes, comments }, plus liked_by_me for button state.
//
// Patch B: each entry in `photos[]` now optionally carries an uploaded photo
// alongside (or instead of) the placeholder photo_kind. The frontend renders
// the upload when present and falls back to the kind otherwise. We accept
// uploads as { kind?, photo_url? } pairs on create — the upload itself
// goes through POST /api/photos/post first, which returns the key shape
// the client embeds here.

import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth } from '../middleware.js';
import { publicUrl } from '../storage.js';

const router = Router();

const PHOTO_KINDS = new Set([
  'concrete','wood','steel','frame','roof','brick','sky','crew',
  'blueprint','tile','kitchen','workshop',
]);

// Parse a JSON-blob storage key bundle to URLs. Same as profiles.js's
// parseUrls. Defined locally for module isolation.
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

// Build the feed-row shape the frontend renders.
// json_agg + json_build_object lets us return one row per post with the
// photo list as a structured array, so we can include photo_url alongside
// photo_kind. The COALESCE handles the no-photos case.
const FEED_SQL = (extraWhere = '') => `
  SELECT p.id, p.type, p.body, p.project_name, p.milestone, p.created_at, p.edited_at,
         u.id   AS author_id,
         u.first_name, u.last_name, u.headline, u.avatar_tone, u.avatar_url, u.verified_smith,
         COALESCE(
           (SELECT json_agg(
                     json_build_object(
                       'kind', pp.photo_kind,
                       'photo_url', pp.photo_url
                     ) ORDER BY pp.position)
              FROM post_photos pp WHERE pp.post_id = p.id),
           '[]'::json
         ) AS photos,
         (SELECT array_agg(pt.tag ORDER BY pt.tag) FROM post_tags pt WHERE pt.post_id = p.id) AS tags,
         (SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
         (SELECT COUNT(*)::int FROM post_comments pc WHERE pc.post_id = p.id) AS comments,
         EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS liked_by_me
    FROM posts p JOIN users u ON u.id = p.author_id
   ${extraWhere}
   ORDER BY p.created_at DESC
   LIMIT $2 OFFSET $3
`;

// GET /api/posts/feed — your network's posts (default) or all
router.get('/feed', requireAuth, async (req, res) => {
  const scope = (req.query.scope || 'network').toString();
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const where = scope === 'all'
    ? ''
    : `WHERE p.author_id = $1 OR p.author_id IN (
         SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END
           FROM connections WHERE status = 'accepted' AND (user_a_id = $1 OR user_b_id = $1)
       )`;

  const { rows } = await q(FEED_SQL(where), [req.userId, limit, offset]);
  res.json({ posts: rows.map(shapePost) });
});

// GET /api/posts/by-user/:id
router.get('/by-user/:id', requireAuth, async (req, res) => {
  const uid = parseInt(req.params.id, 10);
  if (!Number.isFinite(uid)) return res.status(400).json({ error: 'Invalid id' });
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const { rows } = await q(FEED_SQL(`WHERE p.author_id = $4`), [req.userId, limit, offset, uid]);
  res.json({ posts: rows.map(shapePost) });
});

function shapePost(r) {
  // Map each photo row to the client shape: kind for placeholder render,
  // photo_urls for uploaded photo render, keys so the client can echo
  // existing uploads back via PATCH (photos are replace-all on edit).
  const photos = (r.photos || []).map(p => {
    let keys = null;
    if (p.photo_url) {
      try {
        const parsed = typeof p.photo_url === 'string' ? JSON.parse(p.photo_url) : p.photo_url;
        if (parsed && typeof parsed === 'object') keys = parsed;
      } catch { /* ignore malformed */ }
    }
    return {
      kind: p.kind,
      photo_urls: parseUrls(p.photo_url),
      keys,
    };
  });

  return {
    id: r.id,
    type: r.type,
    body: r.body,
    project_name: r.project_name,
    milestone: r.milestone,
    created_at: r.created_at,
    edited_at: r.edited_at,
    author: {
      id: r.author_id,
      name: `${r.first_name} ${r.last_name}`.trim(),
      initials: ((r.first_name[0] || '') + (r.last_name[0] || '')).toUpperCase(),
      headline: r.headline,
      avatar_tone: r.avatar_tone,
      avatar_urls: parseUrls(r.avatar_url),
      verified: r.verified_smith,
    },
    photos,
    tags: r.tags || [],
    stats: { likes: r.likes, comments: r.comments, liked_by_me: r.liked_by_me },
  };
}

// Normalize a photos array from request body into rows for post_photos.
// Accepts ['frame', 'wood'] (legacy) OR [{kind, keys}]. Caps at 4.
function normalizePhotos(photos) {
  const raw = Array.isArray(photos) ? photos.slice(0, 4) : [];
  return raw.map(p => {
    if (typeof p === 'string') {
      return PHOTO_KINDS.has(p) ? { kind: p, photo_url: null } : null;
    }
    if (p && typeof p === 'object') {
      const kind = (typeof p.kind === 'string' && PHOTO_KINDS.has(p.kind)) ? p.kind : null;
      let photo_url = null;
      if (p.keys && typeof p.keys === 'object'
          && typeof p.keys.medium === 'string') {
        const clean = {};
        for (const k of ['thumb', 'medium', 'full']) {
          if (typeof p.keys[k] === 'string') clean[k] = p.keys[k];
        }
        if (Object.keys(clean).length > 0) photo_url = JSON.stringify(clean);
      }
      if (!kind && !photo_url) return null;
      return { kind: kind || 'frame', photo_url };
    }
    return null;
  }).filter(Boolean);
}

function normalizeTags(tags) {
  return (Array.isArray(tags) ? tags : [])
    .map(t => String(t).trim()).filter(Boolean).slice(0, 6);
}

// POST /api/posts
// Body: {
//   type, body, project_name?, milestone?,
//   photos?: [
//     { kind: 'frame' }                                            // placeholder
//     | { keys: { thumb, medium, full } }                          // uploaded (from /api/photos/post)
//     | { kind: 'frame', keys: { thumb, medium, full } }           // both (upload wins)
//   ],
//   tags?: ['Hiring']
// }
//
// For backward compat we also accept the old `photos: ['frame','wood']`
// shape (array of strings) and silently coerce it into [{kind: 'frame'}, ...].
router.post('/', requireAuth, async (req, res) => {
  const { type = 'project', body, project_name = null, milestone = null,
          photos = [], tags = [] } = req.body || {};
  if (!body || typeof body !== 'string') return res.status(400).json({ error: 'body required' });
  if (!['project', 'hiring', 'milestone', 'photo'].includes(type))
    return res.status(400).json({ error: 'invalid type' });

  const cleanPhotos = normalizePhotos(photos);
  const cleanTags = normalizeTags(tags);

  const post = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO posts (author_id, type, body, project_name, milestone)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.userId, type, body, project_name, milestone]
    );
    const id = rows[0].id;
    for (let i = 0; i < cleanPhotos.length; i++) {
      const ph = cleanPhotos[i];
      await c.query(
        `INSERT INTO post_photos (post_id, photo_kind, photo_url, position)
           VALUES ($1,$2,$3,$4)`,
        [id, ph.kind, ph.photo_url, i]
      );
    }
    for (const t of cleanTags) {
      await c.query(
        `INSERT INTO post_tags (post_id, tag) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [id, t]
      );
    }
    return id;
  });

  // Return the freshly created post in feed shape so the UI can prepend it.
  const { rows } = await q(FEED_SQL(`WHERE p.id = $4`), [req.userId, 1, 0, post]);
  res.status(201).json({ post: shapePost(rows[0]) });
});

// PATCH /api/posts/:id
// Partial update of a post by its author. Fields:
//   - body            (string, must be non-empty if present)
//   - project_name    (string | null — null clears)
//   - milestone       (string | null — null clears)
//   - photos          (array — REPLACES all photos; omit to leave alone)
//   - tags            (array — REPLACES all tags; omit to leave alone)
// Type is immutable; changing a post's type would shift its meaning too much.
// Sets edited_at = NOW() on any successful update.
router.patch('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const { body, project_name, milestone, photos, tags } = req.body || {};

  if (body !== undefined && (typeof body !== 'string' || !body.trim())) {
    return res.status(400).json({ error: 'body required' });
  }

  // Ownership check up front so we can 404 cleanly without partial writes.
  const owned = await q(
    `SELECT 1 FROM posts WHERE id = $1 AND author_id = $2`,
    [id, req.userId]
  );
  if (!owned.rowCount) return res.status(404).json({ error: 'Not found' });

  await tx(async (c) => {
    // Build a dynamic SET clause for the scalar fields. edited_at always bumps.
    const sets = ['edited_at = NOW()'];
    const params = [];
    if (body !== undefined)         { params.push(body);        sets.push(`body = $${params.length}`); }
    if (project_name !== undefined) { params.push(project_name); sets.push(`project_name = $${params.length}`); }
    if (milestone !== undefined)    { params.push(milestone);    sets.push(`milestone = $${params.length}`); }
    params.push(id);
    await c.query(`UPDATE posts SET ${sets.join(', ')} WHERE id = $${params.length}`, params);

    if (photos !== undefined) {
      const cleanPhotos = normalizePhotos(photos);
      await c.query(`DELETE FROM post_photos WHERE post_id = $1`, [id]);
      for (let i = 0; i < cleanPhotos.length; i++) {
        const ph = cleanPhotos[i];
        await c.query(
          `INSERT INTO post_photos (post_id, photo_kind, photo_url, position)
             VALUES ($1,$2,$3,$4)`,
          [id, ph.kind, ph.photo_url, i]
        );
      }
    }

    if (tags !== undefined) {
      const cleanTags = normalizeTags(tags);
      await c.query(`DELETE FROM post_tags WHERE post_id = $1`, [id]);
      for (const t of cleanTags) {
        await c.query(
          `INSERT INTO post_tags (post_id, tag) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [id, t]
        );
      }
    }
  });

  const { rows } = await q(FEED_SQL(`WHERE p.id = $4`), [req.userId, 1, 0, id]);
  res.json({ post: shapePost(rows[0]) });
});

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = await q(`DELETE FROM posts WHERE id = $1 AND author_id = $2`, [id, req.userId]);
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// POST /api/posts/:id/like  (toggle)
router.post('/:id/like', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const exists = await q(
    `SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (exists.rows.length) {
    await q(`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, [id, req.userId]);
    return res.json({ liked: false });
  }
  const ok = await q(
    `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING post_id`,
    [id, req.userId]
  );
  if (!ok.rowCount) return res.status(404).json({ error: 'Post not found' });

  // Notify author (skip self-likes).
  const author = await q(`SELECT author_id FROM posts WHERE id = $1`, [id]);
  if (author.rows[0] && author.rows[0].author_id !== req.userId) {
    await q(
      `INSERT INTO notifications (user_id, kind, actor_id, subject_id, body)
         VALUES ($1,'post_like',$2,$3,'liked your post')`,
      [author.rows[0].author_id, req.userId, id]
    );
  }
  res.json({ liked: true });
});

// GET /api/posts/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows } = await q(
    `SELECT pc.id, pc.body, pc.created_at,
            u.id AS author_id, u.first_name, u.last_name,
            u.avatar_tone, u.avatar_url, u.headline
       FROM post_comments pc JOIN users u ON u.id = pc.author_id
      WHERE pc.post_id = $1 ORDER BY pc.created_at ASC`,
    [id]
  );
  res.json({
    comments: rows.map(r => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      author: {
        id: r.author_id,
        name: `${r.first_name} ${r.last_name}`.trim(),
        initials: ((r.first_name[0] || '') + (r.last_name[0] || '')).toUpperCase(),
        avatar_tone: r.avatar_tone,
        avatar_urls: parseUrls(r.avatar_url),
        headline: r.headline,
      },
    })),
  });
});

// POST /api/posts/:id/comments  Body: { body }
router.post('/:id/comments', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = (req.body?.body || '').toString().trim();
  if (!body) return res.status(400).json({ error: 'body required' });
  if (body.length > 2000) return res.status(400).json({ error: 'body too long' });

  const post = await q(`SELECT author_id FROM posts WHERE id = $1`, [id]);
  if (!post.rows.length) return res.status(404).json({ error: 'Post not found' });

  const { rows } = await q(
    `INSERT INTO post_comments (post_id, author_id, body) VALUES ($1,$2,$3)
       RETURNING id, body, created_at`,
    [id, req.userId, body]
  );
  if (post.rows[0].author_id !== req.userId) {
    await q(
      `INSERT INTO notifications (user_id, kind, actor_id, subject_id, body)
         VALUES ($1,'post_comment',$2,$3,'commented on your post')`,
      [post.rows[0].author_id, req.userId, id]
    );
  }
  res.status(201).json({ comment: rows[0] });
});

export default router;
