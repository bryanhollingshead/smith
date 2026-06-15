// Smith — Admin user-management routes
//
// Lets an is_admin user act on demo accounts (is_demo = TRUE) — and ONLY demo
// accounts. The is_demo gate is the hard safety boundary: admin power can
// never reach a real user via these endpoints.
//
// Endpoints (all require requireAuth + requireAdmin):
//   GET    /api/admin/demo-users             list demos (for the View-as picker)
//   POST   /api/admin/users/:id/impersonate  mint a JWT for the target demo
//   POST   /api/admin/users/:id/password     set a known password on the demo
//
// Both write endpoints 404 if the target isn't is_demo. Both touch only
// password_hash (set-password) or no DB state at all (impersonate).

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { hashPassword, signToken, validatePassword } from '../auth-utils.js';

const router = Router();

function requireAdmin(req, res, next) {
  q(`SELECT is_admin FROM users WHERE id = $1`, [req.userId])
    .then(({ rows }) => {
      if (!rows[0]?.is_admin) return res.status(403).json({ error: 'Admin required' });
      next();
    })
    .catch(next);
}

// ── GET /api/admin/demo-users ─────────────────────────────────────────────
// Lightweight list for the picker. Returns the fields the avatar row needs.
router.get('/admin/demo-users', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await q(
    `SELECT id, email, first_name, last_name, headline, avatar_tone, role
       FROM users
      WHERE is_demo = TRUE
      ORDER BY first_name, last_name, id`
  );
  res.json({ users: rows });
});

// ── POST /api/admin/users/:id/impersonate ─────────────────────────────────
// Returns a JWT signed for the target user, IF the target is_demo. The caller
// is responsible for stashing the admin's own token and swapping it in
// localStorage. No DB writes.
router.post('/admin/users/:id/impersonate', requireAuth, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Bad user id' });

  const { rows } = await q(
    `SELECT id, is_demo FROM users WHERE id = $1`,
    [targetId]
  );
  if (!rows[0] || !rows[0].is_demo) {
    // 404, not 403 — we don't want to confirm the existence of non-demo accounts.
    return res.status(404).json({ error: 'Demo user not found' });
  }

  const token = signToken({ sub: rows[0].id });
  res.json({ ok: true, token, user_id: rows[0].id });
});

// ── POST /api/admin/users/:id/password ────────────────────────────────────
// Sets a known password on a demo. Touches password_hash ONLY.
router.post('/admin/users/:id/password', requireAuth, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Bad user id' });

  const { password } = req.body || {};
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  const { rows } = await q(
    `SELECT id, email, is_demo FROM users WHERE id = $1`,
    [targetId]
  );
  if (!rows[0] || !rows[0].is_demo) {
    return res.status(404).json({ error: 'Demo user not found' });
  }

  const hash = await hashPassword(password);
  await q(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, rows[0].id]);
  res.json({ ok: true, user_id: rows[0].id, email: rows[0].email });
});

export default router;
