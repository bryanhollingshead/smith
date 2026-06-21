// Smith — Auth middleware
import { verifyToken } from './auth-utils.js';
import { q } from './db.js';

/**
 * Pulls Authorization: Bearer <jwt>, verifies, attaches req.user.
 * On failure: 401.
 *
 * Token sources (checked in order):
 *   1. Authorization: Bearer <jwt>   — primary, used by the SPA via fetch()
 *   2. ?token=<jwt> query param      — fallback for browser navigations to
 *                                       authenticated URLs (e.g., opening a
 *                                       credential doc PDF in a new tab,
 *                                       where the React app can't attach a
 *                                       header).
 *
 * The query-param path uses the SAME JWT — same expiration, same signing
 * key, same claims. The only difference is where it travels. Tokens are
 * short-lived (configured via JWT_EXPIRES_IN, default 7d). For routes that
 * surface URLs the user might paste/share, we encode a fresh token at
 * click time so the leakage window matches a normal session.
 */
export async function requireAuth(req, res, next) {
  // 1. Authorization header (primary)
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  let token = m ? m[1] : null;

  // 2. ?token=... query string (fallback)
  if (!token && typeof req.query?.token === 'string' && req.query.token.length > 0) {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  let payload;
  try {
    payload = verifyToken(token);
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
 * Like requireAuth but never 401s. If a valid token is present we attach
 * req.user / req.userId; if not, we just pass through. Use for routes that
 * are public-readable but personalize the response when a viewer is signed
 * in (e.g., setting is_steward, is_me, liked_by_me).
 */
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  let token = m ? m[1] : null;
  if (!token && typeof req.query?.token === 'string' && req.query.token.length > 0) {
    token = req.query.token;
  }
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const { rows } = await q(
      `SELECT id, email, email_verified, first_name, last_name, onboarding_done
         FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (rows.length) {
      req.user = rows[0];
      req.userId = rows[0].id;
    }
  } catch { /* ignore — anonymous */ }
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
