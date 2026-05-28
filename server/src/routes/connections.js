// Smith — Connections (network)
// Three tabs in the UI: Connections, Pending, Suggestions.

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { publicUrl } from '../storage.js';

const router = Router();

// Order user ids so (a, b) is canonical for the row.
const pair = (x, y) => (x < y ? [x, y] : [y, x]);

// avatar_url and cover_url store a JSON map of storage KEYS, shape
// {thumb, medium, full}. Convert each key into a client-usable URL via
// publicUrl() — exactly like profiles.js. (Previously this returned the raw
// keys, so connection-card images 404'd and silently fell back to the
// initials monogram.)
function parseUrls(value) {
  if (!value) return null;
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return null; }
  }
  if (typeof parsed !== 'object' || !parsed) return null;
  const out = {};
  for (const [size, key] of Object.entries(parsed)) {
    if (typeof key === 'string') out[size] = publicUrl(key);
  }
  return out;
}

// Re-shape a raw DB row into the wire shape the client expects. Flips the
// avatar_url + cover_url JSON columns into avatar_urls / cover_urls so the
// client's <SmithAvatar> can read them. Other fields pass through.
function shapeCard(row) {
  const { avatar_url, cover_url, ...rest } = row;
  return {
    ...rest,
    avatar_urls: parseUrls(avatar_url),
    cover_urls:  parseUrls(cover_url),
  };
}

// Common SELECT shape for a connection-card row (matches design fields:
// name, role/co/loc, mutual, tone, photos). "Role" is sourced from the user's
// most recent work_history entry; falls back to headline.
//
// Patch: added u.avatar_url, u.cover_url so connection cards can render
// uploaded profile + cover photos (previously cards always fell back to
// placeholders since these columns weren't selected).
const CARD_SQL = `
  SELECT u.id, u.first_name, u.last_name, u.headline, u.location, u.avatar_tone,
         u.avatar_url, u.cover_url,
         (SELECT c.name FROM work_history w JOIN companies c ON c.id = w.company_id
            WHERE w.user_id = u.id ORDER BY w.position ASC LIMIT 1) AS company_name,
         (SELECT w.role FROM work_history w
            WHERE w.user_id = u.id ORDER BY w.position ASC LIMIT 1) AS current_role
`;

// Mutual count = users connected to both viewer and target.
async function mutualCount(viewerId, otherId) {
  const { rows } = await q(
    `WITH me AS (
       SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS friend
         FROM connections WHERE status = 'accepted' AND (user_a_id = $1 OR user_b_id = $1)
     ), them AS (
       SELECT CASE WHEN user_a_id = $2 THEN user_b_id ELSE user_a_id END AS friend
         FROM connections WHERE status = 'accepted' AND (user_a_id = $2 OR user_b_id = $2)
     )
     SELECT COUNT(*)::int AS n FROM me JOIN them USING (friend);`,
    [viewerId, otherId]
  );
  return rows[0]?.n || 0;
}

// GET /api/connections — accepted connections for the viewer
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await q(
    `${CARD_SQL}
       FROM users u JOIN connections cn
         ON ((cn.user_a_id = u.id AND cn.user_b_id = $1)
          OR (cn.user_b_id = u.id AND cn.user_a_id = $1))
        AND cn.status = 'accepted'
      ORDER BY u.first_name, u.last_name`,
    [req.userId]
  );
  // Add mutual counts in one extra query each — fine at expected scale; can
  // batch later if needed.
  const out = await Promise.all(rows.map(async r => ({
    ...shapeCard(r),
    mutual: await mutualCount(req.userId, r.id),
  })));
  res.json({ connections: out });
});

// GET /api/connections/pending — incoming requests
router.get('/pending', requireAuth, async (req, res) => {
  const { rows } = await q(
    `${CARD_SQL}, cn.id AS connection_id, cn.created_at
       FROM users u JOIN connections cn
         ON ((cn.user_a_id = u.id AND cn.user_b_id = $1)
          OR (cn.user_b_id = u.id AND cn.user_a_id = $1))
        AND cn.status = 'pending' AND cn.requested_by <> $1
      ORDER BY cn.created_at DESC`,
    [req.userId]
  );
  res.json({ pending: rows.map(shapeCard) });
});

// GET /api/connections/suggestions — people you may know
// Strategy: prefer 2nd-degree (friends-of-friends) by mutual count, then
// fall back to same-location, then anyone you're not already connected to.
router.get('/suggestions', requireAuth, async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const { rows: friendsOfFriends } = await q(
    `WITH my_friends AS (
       SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS fid
         FROM connections WHERE status = 'accepted' AND (user_a_id = $1 OR user_b_id = $1)
     ), candidates AS (
       SELECT CASE WHEN user_a_id IN (SELECT fid FROM my_friends) THEN user_b_id
                   ELSE user_a_id END AS uid
         FROM connections cn
        WHERE status = 'accepted'
          AND (user_a_id IN (SELECT fid FROM my_friends) OR user_b_id IN (SELECT fid FROM my_friends))
     ), tally AS (
       SELECT uid, COUNT(*)::int AS mutual FROM candidates
        WHERE uid <> $1
          AND uid NOT IN (SELECT fid FROM my_friends)
          AND uid NOT IN (
            SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END
              FROM connections WHERE user_a_id = $1 OR user_b_id = $1
          )
        GROUP BY uid
     )
     ${CARD_SQL.replace('SELECT', 'SELECT t.mutual,')}
       FROM tally t JOIN users u ON u.id = t.uid
      ORDER BY t.mutual DESC, u.first_name
      LIMIT $2`,
    [req.userId, limit]
  );

  if (friendsOfFriends.length >= limit) {
    return res.json({ suggestions: friendsOfFriends.map(shapeCard) });
  }

  // Top-up with same-location candidates (excluding existing).
  const me = await q('SELECT location FROM users WHERE id = $1', [req.userId]);
  const loc = me.rows[0]?.location;
  const remaining = limit - friendsOfFriends.length;
  const haveIds = new Set(friendsOfFriends.map(r => r.id));

  const fillSql = `
    ${CARD_SQL}
       FROM users u
      WHERE u.id <> $1
        AND u.id NOT IN (
          SELECT CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END
            FROM connections WHERE user_a_id = $1 OR user_b_id = $1
        )
        ${loc ? `AND u.location = $3` : ''}
      ORDER BY u.first_name
      LIMIT $2
  `;
  const params = loc ? [req.userId, remaining, loc] : [req.userId, remaining];
  const fill = await q(fillSql, params);

  const merged = [
    ...friendsOfFriends,
    ...fill.rows.filter(r => !haveIds.has(r.id)).map(r => ({ ...r, mutual: 0 })),
  ].slice(0, limit);

  res.json({ suggestions: merged.map(shapeCard) });
});

// POST /api/connections/request  Body: { target_id }
router.post('/request', requireAuth, async (req, res) => {
  const target = parseInt(req.body?.target_id, 10);
  if (!Number.isFinite(target)) return res.status(400).json({ error: 'target_id required' });
  if (target === req.userId) return res.status(400).json({ error: 'Cannot connect with yourself' });

  const exists = await q('SELECT 1 FROM users WHERE id = $1', [target]);
  if (!exists.rows.length) return res.status(404).json({ error: 'User not found' });

  const [a, b] = pair(req.userId, target);
  // ON CONFLICT lets us flip a previously-blocked or pending row sensibly.
  const { rows } = await q(
    `INSERT INTO connections (user_a_id, user_b_id, status, requested_by)
       VALUES ($1, $2, 'pending', $3)
       ON CONFLICT (user_a_id, user_b_id) DO NOTHING
       RETURNING id, status`,
    [a, b, req.userId]
  );
  if (!rows.length) {
    const cur = await q(
      `SELECT id, status FROM connections WHERE user_a_id = $1 AND user_b_id = $2`,
      [a, b]
    );
    return res.json({ ok: true, status: cur.rows[0]?.status, already: true });
  }

  // Notify target.
  await q(
    `INSERT INTO notifications (user_id, kind, actor_id, subject_id, body)
       VALUES ($1, 'connection_request', $2, $3, 'sent you a connection request')`,
    [target, req.userId, rows[0].id]
  );

  res.status(201).json({ ok: true, connection: rows[0] });
});

// POST /api/connections/:id/accept | /reject
router.post('/:id/accept', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = await q(
    `UPDATE connections SET status = 'accepted', responded_at = NOW()
       WHERE id = $1 AND status = 'pending' AND requested_by <> $2
         AND (user_a_id = $2 OR user_b_id = $2)
       RETURNING id, requested_by`,
    [id, req.userId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });

  await q(
    `INSERT INTO notifications (user_id, kind, actor_id, subject_id, body)
       VALUES ($1, 'connection_accepted', $2, $3, 'accepted your connection request')`,
    [r.rows[0].requested_by, req.userId, id]
  );
  res.json({ ok: true });
});

router.post('/:id/reject', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = await q(
    `DELETE FROM connections
       WHERE id = $1 AND status = 'pending' AND requested_by <> $2
         AND (user_a_id = $2 OR user_b_id = $2)`,
    [id, req.userId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// DELETE /api/connections/:id — disconnect
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = await q(
    `DELETE FROM connections WHERE id = $1 AND status = 'accepted'
       AND (user_a_id = $1 OR user_b_id = $1) AND (user_a_id = $2 OR user_b_id = $2)`,
    [id, req.userId]
  );
  res.json({ ok: r.rowCount > 0 });
});

export default router;
