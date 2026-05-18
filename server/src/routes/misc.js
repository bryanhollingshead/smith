// Smith — Search & supporting endpoints
//
// The top-bar search box reads "Search trades, companies, jobsites…" — so this
// endpoint returns a unified result set across users, companies, and jobsites.

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

router.get('/search', requireAuth, async (req, res) => {
  const term = (req.query.q || '').toString().trim();
  if (term.length < 2) return res.json({ users: [], companies: [], jobsites: [], trades: [] });
  const like = `%${term}%`;

  const [users, companies, jobsites, trades] = await Promise.all([
    q(
      `SELECT id, first_name, last_name, headline, avatar_tone, location
         FROM users
        WHERE LOWER(first_name || ' ' || last_name) LIKE LOWER($1)
           OR LOWER(headline) LIKE LOWER($1)
        LIMIT 10`,
      [like]
    ),
    q(
      `SELECT id, name, type, logo_tone, claimed_by IS NOT NULL AS claimed
         FROM companies WHERE LOWER(name) LIKE LOWER($1) LIMIT 10`,
      [like]
    ),
    q(
      `SELECT js.id, js.title, js.kind, js.location, js.duration, js.photo_kind,
              c.name AS company_name
         FROM jobsites js
         JOIN work_history wh ON wh.id = js.work_history_id
         JOIN companies c ON c.id = wh.company_id
        WHERE LOWER(js.title) LIKE LOWER($1) OR LOWER(js.kind) LIKE LOWER($1)
        LIMIT 10`,
      [like]
    ),
    q(`SELECT id, name FROM trades WHERE LOWER(name) LIKE LOWER($1) LIMIT 10`, [like]),
  ]);

  res.json({
    users: users.rows,
    companies: companies.rows,
    jobsites: jobsites.rows,
    trades: trades.rows,
  });
});

// ── Notifications ───────────────────────────────────────────────────────────
router.get('/notifications', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT n.id, n.kind, n.body, n.read_at, n.created_at,
            u.id AS actor_id, u.first_name, u.last_name, u.avatar_tone
       FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC LIMIT 50`,
    [req.userId]
  );
  const unread = await q(
    `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [req.userId]
  );
  res.json({
    unread: unread.rows[0].n,
    notifications: rows.map(r => ({
      id: r.id,
      kind: r.kind,
      body: r.body,
      read_at: r.read_at,
      created_at: r.created_at,
      actor: r.actor_id ? {
        id: r.actor_id,
        name: `${r.first_name} ${r.last_name}`.trim(),
        initials: ((r.first_name[0] || '') + (r.last_name[0] || '')).toUpperCase(),
        avatar_tone: r.avatar_tone,
      } : null,
    })),
  });
});

router.post('/notifications/read', requireAuth, async (req, res) => {
  await q(
    `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
    [req.userId]
  );
  res.json({ ok: true });
});

// ── Trades catalog (for onboarding & edit) ──────────────────────────────────
router.get('/trades', async (_req, res) => {
  const { rows } = await q(
    `SELECT id, name, icon FROM trades ORDER BY position ASC, name ASC`
  );
  res.json({ trades: rows });
});

export default router;
