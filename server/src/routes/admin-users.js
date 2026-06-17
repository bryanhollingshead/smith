// Smith — Admin user-management routes
//
// Lets an is_admin user act on demo accounts (is_demo = TRUE) — and ONLY demo
// accounts. The is_demo gate is the hard safety boundary: admin power can
// never reach a real user via these endpoints.
//
// Endpoints (all require requireAuth + requireAdmin):
//   GET    /api/admin/demo-users             list demos (for the View-as picker)
//   GET    /api/admin/users                  list ALL users (for the delete picker)
//   POST   /api/admin/users/:id/impersonate  mint a JWT for the target demo
//   POST   /api/admin/users/:id/password     set a known password on the demo
//   DELETE /api/admin/users/:id              hard-delete any user except self
//
// The impersonate + password routes 404 if the target isn't is_demo (admin
// can never log in as or rewrite a real user's password).
//
// Delete is broader (admin can delete any user, demo or real) because the
// founder has to be able to clean up real accounts on request. Safety on
// delete is enforced by:
//   - body.confirmation_email must match the target's email exactly
//   - target cannot be the caller (admin must use the self-serve DELETE
//     /api/auth/me route to delete their own account — gives password
//     re-verification + only-admin-remaining safety)
//   - target cannot be the only remaining is_admin

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

// ── GET /api/admin/users ──────────────────────────────────────────────────
// Lists ALL users — used by the delete-user picker. Returns the same fields
// as /demo-users plus is_demo / is_admin so the UI can render badges that
// make the dangerous targets visually obvious.
router.get('/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await q(
    `SELECT id, email, first_name, last_name, headline, avatar_tone, role,
            is_admin, is_demo, created_at
       FROM users
      ORDER BY created_at DESC, id DESC`
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

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────
// Hard-delete any user. The confirmation_email body field must match the
// target's email exactly so an accidental click can never destroy data.
// Cannot be used on self (the admin's own account) — that's what the
// self-serve DELETE /api/auth/me route is for.
router.delete('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Bad user id' });
  if (targetId === req.userId) {
    return res.status(400).json({
      error: 'Use the self-serve account-deletion flow to delete your own account.',
    });
  }

  const { confirmation_email } = req.body || {};
  if (!confirmation_email) {
    return res.status(400).json({ error: 'confirmation_email required' });
  }

  const { rows } = await q(
    `SELECT id, email, is_admin FROM users WHERE id = $1`,
    [targetId]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });

  // CITEXT equality is case-insensitive in Postgres, but we compare in JS
  // here so the error message is the same regardless of casing mismatch.
  if (String(confirmation_email).toLowerCase().trim() !== rows[0].email.toLowerCase().trim()) {
    return res.status(400).json({ error: 'confirmation_email does not match target user.' });
  }

  if (rows[0].is_admin) {
    const others = await q(
      `SELECT 1 FROM users WHERE is_admin = TRUE AND id <> $1 LIMIT 1`,
      [targetId]
    );
    if (!others.rowCount) {
      return res.status(409).json({
        error: 'Cannot delete the only remaining admin.',
      });
    }
  }

  await q(`DELETE FROM users WHERE id = $1`, [targetId]);
  console.log(
    `[admin] user_id=${req.userId} deleted target_user_id=${targetId} email=${rows[0].email}`
  );
  res.json({ ok: true, deleted_user_id: targetId, email: rows[0].email });
});

export default router;
