// Smith — Auth middleware
import { verifyToken } from './auth-utils.js';
import { q } from './db.js';

/**
 * Pulls Authorization: Bearer <jwt>, verifies, attaches req.user.
 * On failure: 401.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'Missing bearer token' });

  let payload;
  try {
    payload = verifyToken(m[1]);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Confirm the user still exists. Cheap query, big safety win.
  const { rows } = await q(
    `SELECT id, email, email_verified, first_name, last_name, onboarding_done
       FROM users WHERE id = $1`,
    [payload.sub]
  );
  if (!rows.length) return res.status(401).json({ error: 'User not found' });

  req.user = rows[0];
  req.userId = rows[0].id;
  next();
}

/**
 * Requires the email to be verified. Use AFTER requireAuth.
 * Onboarding endpoints can skip this (a user mid-onboarding still needs API access).
 */
export function requireVerified(req, res, next) {
  if (!req.user?.email_verified) {
    return res.status(403).json({ error: 'Email not verified', code: 'email_unverified' });
  }
  next();
}
