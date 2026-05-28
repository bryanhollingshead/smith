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
// Body: { email, password, first_name?, last_name? }
// Side effects: creates user, issues 6-digit code, sends verification email.
router.post('/signup', async (req, res) => {
  const { email, password, first_name = '', last_name = '' } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

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
      `INSERT INTO users (email, password_hash, first_name, last_name, onboarding_step, email_verified)
         VALUES ($1,$2,$3,$4,1,TRUE)
         RETURNING id, email`,
      [email, hash, first_name, last_name]
    );
    const token = signToken({ sub: rows[0].id });
    return res.status(201).json({
      ok: true,
      token,
      user: { id: rows[0].id, email: rows[0].email, email_verified: true },
    });
  }

  const result = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, onboarding_step)
         VALUES ($1,$2,$3,$4,1)
         RETURNING id, email`,
      [email, hash, first_name, last_name]
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
    user: { id: result.user.id, email: result.user.email, email_verified: false },
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
    `SELECT id, email, password_hash, email_verified, onboarding_done
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
    user: {
      id: rows[0].id,
      email: rows[0].email,
      email_verified: REQUIRE_EMAIL_VERIFICATION ? rows[0].email_verified : true,
      onboarding_done: rows[0].onboarding_done,
    },
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
            onboarding_step, onboarding_done, avatar_tone, verified_smith
       FROM users WHERE id = $1`,
    [req.userId]
  );
  const u = rows[0];
  if (u && !REQUIRE_EMAIL_VERIFICATION) u.email_verified = true;
  res.json({ user: u });
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
