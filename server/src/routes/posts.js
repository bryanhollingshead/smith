// Smith — Feed posts
//
// Feed shape mirrors SAMPLE.feed in the design files:
//   - type: 'project' | 'hiring' | 'milestone' | 'photo'
//   - body, photos[], tags[], milestone, project_name
//   - stats: { likes, comments }, plus liked_by_me for button state.

import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

const PHOTO_KINDS = new Set([
  'concrete','wood','steel','frame','roof','brick','sky','crew',
  'blueprint','tile','kitchen','workshop',
]);

// Build the feed-row shape the frontend renders.
const FEED_SQL = (extraWhere = '') => `
  SELECT p.id, p.type, p.body, p.project_name, p.milestone, p.created_at,
         u.id   AS author_id,
         u.first_name, u.last_name, u.headline, u.avatar_tone, u.verified_smith,
         (SELECT array_agg(pp.photo_kind ORDER BY pp.position)
            FROM post_photos pp WHERE pp.post_id = p.id) AS photos,
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
  return {
    id: r.id,
    type: r.type,
    body: r.body,
    project_name: r.project_name,
    milestone: r.milestone,
    created_at: r.created_at,
    author: {
      id: r.author_id,
      name: `${r.first_name} ${r.last_name}`.trim(),
      initials: ((r.first_name[0] || '') + (r.last_name[0] || '')).toUpperCase(),
      headline: r.headline,
      avatar_tone: r.avatar_tone,
      verified: r.verified_smith,
    },
    photos: r.photos || [],
    tags: r.tags || [],
    stats: { likes: r.likes, comments: r.comments, liked_by_me: r.liked_by_me },
  };
}

// POST /api/posts
// Body: { type, body, project_name?, milestone?, photos?: ['frame','wood'], tags?: ['Hiring'] }
router.post('/', requireAuth, async (req, res) => {
  const { type = 'project', body, project_name = null, milestone = null,
          photos = [], tags = [] } = req.body || {};
  if (!body || typeof body !== 'string') return res.status(400).json({ error: 'body required' });
  if (!['project', 'hiring', 'milestone', 'photo'].includes(type))
    return res.status(400).json({ error: 'invalid type' });

  const cleanPhotos = (Array.isArray(photos) ? photos : [])
    .filter(p => PHOTO_KINDS.has(p)).slice(0, 4);
  const cleanTags = (Array.isArray(tags) ? tags : [])
    .map(t => String(t).trim()).filter(Boolean).slice(0, 6);

  const post = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO posts (author_id, type, body, project_name, milestone)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.userId, type, body, project_name, milestone]
    );
    const id = rows[0].id;
    for (let i = 0; i < cleanPhotos.length; i++) {
      await c.query(
        `INSERT INTO post_photos (post_id, photo_kind, position) VALUES ($1,$2,$3)`,
        [id, cleanPhotos[i], i]
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
            u.id AS author_id, u.first_name, u.last_name, u.avatar_tone, u.headline
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
