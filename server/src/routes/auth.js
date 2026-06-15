// Smith — Auth routes
import { Router } from 'express';
import { q, tx } from '../db.js';
import {
  hashPassword,
  checkPassword,
  signToken,
  make6DigitCode,
  makeResetToken,
  validatePassword,
} from '../auth-utils.js';
import { sendVerificationEmail, sendResetEmail } from '../mailer.js';
import { requireAuth } from '../middleware.js';

const router = Router();

const CODE_TTL_MIN = parseInt(process.env.EMAIL_CODE_TTL_MIN || '15', 10);
const RESET_TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10);

// ── Shape the user payload returned by signup / signin / /me ──────────────
// Adds the derived `profiles` flags so the client knows which modes the user
// has actually set up. The flags are derived (never stored) so they can't
// drift from the underlying entities:
//   tradesman: onboarding_done AND role-tradesperson-history (i.e. they've
//              completed trade selection at least once)
//   homeowner: at least one row in homes owned by them
// The client uses these to decide whether a mode switch needs a setup flow.
async function shapeAuthedUser(row) {
  const [homes, trades] = await Promise.all([
    q(`SELECT 1 FROM homes WHERE owner_user_id = $1 LIMIT 1`, [row.id]),
    q(`SELECT 1 FROM user_trades WHERE user_id = $1 LIMIT 1`, [row.id]).catch(() => ({ rowCount: 0 })),
  ]);
  return {
    id: row.id,
    email: row.email,
    email_verified: row.email_verified !== undefined
      ? (REQUIRE_EMAIL_VERIFICATION ? row.email_verified : true)
      : true,
    role: row.role,
    hiring_context: row.hiring_context ?? null,
    onboarding_done: row.onboarding_done,
    is_admin: !!row.is_admin,
    is_demo: !!row.is_demo,
    profiles: {
      tradesman: !!trades.rowCount,
      homeowner: !!homes.rowCount,
    },
  };
}

// Email verification can be switched off during soft launch (no verified
// sending domain yet, so codes can't be delivered). When REQUIRE_EMAIL_-
// VERIFICATION is falsey, signup creates already-verified accounts and the
// auth responses report email_verified:true — which bypasses the client's
// confirm-email gate for BOTH new signups and accounts already stuck on it,
// with no DB migration or client rebuild. Default: verification required.
// Flip back to "true" (and redeploy) once the domain + Resend are live.
const REQUIRE_EMAIL_VERIFICATION =
  !['false', '0', 'no', 'off'].includes(
    (process.env.REQUIRE_EMAIL_VERIFICATION ?? 'true').trim().toLowerCase()
  );

// ─── POST /api/auth/signup ──────────────────────────────────────────────────
// Body: { email, password, first_name?, last_name?, role? }
// Side effects: creates user, issues 6-digit code, sends verification email.
//
// role: 'tradesperson' (default) | 'homeowner'. Homeowners skip the trade-
// selection onboarding — they go straight to the seed-home flow, so we
// stamp onboarding_done=TRUE on creation.
router.post('/signup', async (req, res) => {
  const {
    email, password,
    first_name = '', last_name = '',
    role: roleIn,
    hiring_context: hiringIn,
  } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const role = roleIn === 'homeowner' ? 'homeowner' : 'tradesperson';
  const skipOnboarding = role === 'homeowner';
  // hiring_context is asked one-tap during the homeowner signup. NULL means
  // "never asked" → display label defaults to "Homeowner". Validate against
  // the enum so the DB check constraint never fires on user-facing requests.
  const hiringContext =
    role === 'homeowner' && (hiringIn === 'own_home' || hiringIn === 'property_manager')
      ? hiringIn
      : null;

  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  const existing = await q('SELECT id, email_verified FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    // Don't leak account existence — but we can hint by returning the same shape.
    // The UI flow after signup is "check your email" either way.
    if (existing.rows[0].email_verified) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    // Resend code for an unverified, half-finished signup.
    const code = make6DigitCode();
    const exp = new Date(Date.now() + CODE_TTL_MIN * 60_000);
    await q(
      `UPDATE email_verification_codes SET consumed_at = NOW()
        WHERE user_id = $1 AND consumed_at IS NULL`,
      [existing.rows[0].id]
    );
    await q(
      `INSERT INTO email_verification_codes (user_id, code, expires_at) VALUES ($1,$2,$3)`,
      [existing.rows[0].id, code, exp]
    );
    await sendVerificationEmail(email, code);
    return res.json({ ok: true, status: 'verification_resent' });
  }

  const hash = await hashPassword(password);

  // Soft-launch path: verification disabled → create the account already
  // verified, no code emailed, and let the user straight in.
  if (!REQUIRE_EMAIL_VERIFICATION) {
    const { rows } = await q(
      `INSERT INTO users (email, password_hash, first_name, last_name, role,
                          hiring_context,
                          onboarding_step, onboarding_done, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
         RETURNING id, email, role, hiring_context, onboarding_done`,
      [email, hash, first_name, last_name, role, hiringContext,
       skipOnboarding ? 5 : 1, skipOnboarding]
    );
    const token = signToken({ sub: rows[0].id });
    return res.status(201).json({
      ok: true,
      token,
      user: await shapeAuthedUser(rows[0]),
    });
  }

  const result = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role,
                          hiring_context,
                          onboarding_step, onboarding_done)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, email, role, hiring_context, onboarding_done`,
      [email, hash, first_name, last_name, role, hiringContext,
       skipOnboarding ? 5 : 1, skipOnboarding]
    );
    const user = rows[0];
    const code = make6DigitCode();
    const exp = new Date(Date.now() + CODE_TTL_MIN * 60_000);
    await c.query(
      `INSERT INTO email_verification_codes (user_id, code, expires_at) VALUES ($1,$2,$3)`,
      [user.id, code, exp]
    );
    return { user, code };
  });
  await sendVerificationEmail(email, result.code);

  // Issue a token now so the user can hit /auth/verify-email while logged in.
  // The endpoints they need before verification all use requireAuth (no requireVerified).
  const token = signToken({ sub: result.user.id });
  res.status(201).json({
    ok: true,
    token,
    user: { ...(await shapeAuthedUser(result.user)), email_verified: false },
  });
});

// ─── POST /api/auth/verify-email ────────────────────────────────────────────
// Body: { code }
router.post('/verify-email', requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code required' });

  const { rows } = await q(
    `SELECT id, expires_at, consumed_at FROM email_verification_codes
      WHERE user_id = $1 AND code = $2
      ORDER BY id DESC LIMIT 1`,
    [req.userId, String(code)]
  );
  if (!rows.length) return res.status(400).json({ error: 'Invalid code' });

  const row = rows[0];
  if (row.consumed_at) return res.status(400).json({ error: 'Code already used' });
  if (new Date(row.expires_at) < new Date())
    return res.status(400).json({ error: 'Code expired' });

  await tx(async (c) => {
    await c.query(`UPDATE email_verification_codes SET consumed_at = NOW() WHERE id = $1`, [row.id]);
    await c.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [req.userId]);
  });

  res.json({ ok: true });
});

// ─── POST /api/auth/resend-code ─────────────────────────────────────────────
router.post('/resend-code', requireAuth, async (req, res) => {
  if (req.user.email_verified) return res.json({ ok: true, already_verified: true });

  const code = make6DigitCode();
  const exp = new Date(Date.now() + CODE_TTL_MIN * 60_000);
  await q(
    `UPDATE email_verification_codes SET consumed_at = NOW()
      WHERE user_id = $1 AND consumed_at IS NULL`,
    [req.userId]
  );
  await q(
    `INSERT INTO email_verification_codes (user_id, code, expires_at) VALUES ($1,$2,$3)`,
    [req.userId, code, exp]
  );
  await sendVerificationEmail(req.user.email, code);
  res.json({ ok: true });
});

// ─── POST /api/auth/signin ──────────────────────────────────────────────────
// Body: { email, password }
router.post('/signin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  const { rows } = await q(
    `SELECT id, email, password_hash, email_verified, onboarding_done, role, hiring_context,
            is_admin, is_demo
       FROM users WHERE email = $1`,
    [email]
  );
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await checkPassword(password, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ sub: rows[0].id });
  res.json({
    ok: true,
    token,
    user: await shapeAuthedUser(rows[0]),
  });
});

// ─── POST /api/auth/forgot ──────────────────────────────────────────────────
// Body: { email }
// Always returns ok — never confirm whether the address is on file (per design copy).
router.post('/forgot', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  const { rows } = await q('SELECT id FROM users WHERE email = $1', [email]);
  if (rows.length) {
    const token = makeResetToken();
    const exp = new Date(Date.now() + RESET_TTL_MIN * 60_000);
    await q(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`,
      [rows[0].id, token, exp]
    );
    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    await sendResetEmail(email, token, origin);
  }
  res.json({ ok: true });
});

// ─── POST /api/auth/reset ───────────────────────────────────────────────────
// Body: { token, password }
router.post('/reset', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });

  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  const { rows } = await q(
    `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens
      WHERE token = $1`,
    [token]
  );
  if (!rows.length) return res.status(400).json({ error: 'Invalid token' });
  const row = rows[0];
  if (row.used_at) return res.status(400).json({ error: 'Token already used' });
  if (new Date(row.expires_at) < new Date())
    return res.status(400).json({ error: 'Token expired' });

  const hash = await hashPassword(password);
  await tx(async (c) => {
    await c.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, row.user_id]);
    await c.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
    // The design copy says "Setting a new password signs out other devices"
    await c.query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [row.user_id]
    );
  });

  // Sign them back in immediately ("Save & sign in" button).
  const newToken = signToken({ sub: row.user_id });
  res.json({ ok: true, token: newToken });
});

// ─── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT id, email, email_verified, first_name, last_name, headline, location,
            onboarding_step, onboarding_done, avatar_tone, verified_smith,
            role, hiring_context, is_admin, is_demo
       FROM users WHERE id = $1`,
    [req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  const shaped = await shapeAuthedUser(rows[0]);
  // Preserve the richer profile fields that callers other than the shell
  // depend on (TopNav uses first/last/avatar_tone, etc).
  res.json({
    user: {
      ...shaped,
      first_name: rows[0].first_name,
      last_name: rows[0].last_name,
      headline: rows[0].headline,
      location: rows[0].location,
      onboarding_step: rows[0].onboarding_step,
      avatar_tone: rows[0].avatar_tone,
      verified_smith: rows[0].verified_smith,
    },
  });
});

// ─── PATCH /api/auth/me/mode ───────────────────────────────────────────────
// Switch the persisted active mode for this account. Body: { mode }
//   'tradesman' | 'homeowner'        ('tradesman' is the product-facing label;
//                                     the DB column users.role keeps the older
//                                     'tradesperson' value for this side so
//                                     we don't touch existing rows.)
// Returns the full shaped user — including profiles.{tradesman,homeowner}
// flags so the client knows whether the target mode needs a setup flow.
router.patch('/me/mode', requireAuth, async (req, res) => {
  const { mode } = req.body || {};
  if (mode !== 'tradesman' && mode !== 'homeowner') {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  const stored = mode === 'homeowner' ? 'homeowner' : 'tradesperson';
  const { rows } = await q(
    `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, email, email_verified, first_name, last_name, headline, location,
                 onboarding_step, onboarding_done, avatar_tone, verified_smith,
                 role, hiring_context, is_admin, is_demo`,
    [stored, req.userId]
  );
  const shaped = await shapeAuthedUser(rows[0]);
  res.json({
    user: {
      ...shaped,
      first_name: rows[0].first_name,
      last_name: rows[0].last_name,
      headline: rows[0].headline,
      location: rows[0].location,
      onboarding_step: rows[0].onboarding_step,
      avatar_tone: rows[0].avatar_tone,
      verified_smith: rows[0].verified_smith,
    },
    // Convenience: client uses this to decide whether to route to a setup flow.
    needs_setup: !shaped.profiles[mode],
  });
});

// ─── DEV ONLY: GET /api/auth/dev/last-email ─────────────────────────────────
// Lets test scripts (and the auth UI) read the latest mock email for a user.
// Disabled outside development.
router.get('/dev/last-email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  const { email, kind } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });

  const params = [email];
  let where = `to_email = $1`;
  if (kind) { where += ` AND kind = $2`; params.push(kind); }
  const { rows } = await q(
    `SELECT id, to_email, subject, body, kind, meta, created_at
       FROM mock_emails WHERE ${where} ORDER BY id DESC LIMIT 1`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'No email found' });
  res.json(rows[0]);
});

export default router;
