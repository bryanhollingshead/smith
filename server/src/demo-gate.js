// Smith — Demo account gating
//
// Centralized helper for the "demo users are visible but cannot be
// interacted with" rule. Routes that allow user-to-user actions (connection
// requests, messaging, etc.) import these checks instead of duplicating the
// SELECT is_demo logic.
//
// We never block READING demo profiles — the whole point is for new users to
// see demo profiles. We block:
//   - Sending connection requests to demos (and demos sending them)
//   - Creating message threads with demos
//   - Sending messages in any thread where the peer is a demo
// Signin AS a demo is NOT blocked — admins can set a demo password via the
// admin-users routes and sign in to test flows.

import { q } from './db.js';

/**
 * Returns TRUE if either user is a demo. Use this for symmetric blocks
 * (connection requests, message threads).
 */
export async function eitherIsDemo(userA, userB) {
  if (!userA || !userB) return false;
  const { rows } = await q(
    'SELECT id FROM users WHERE id IN ($1, $2) AND is_demo = TRUE',
    [userA, userB]
  );
  return rows.length > 0;
}

/**
 * Express middleware that 403s if either the requester or the target user
 * (resolved from req.body.target_id or req.body.peer_id) is a demo.
 * Use after requireAuth in routes that allow user-to-user actions.
 */
export function blockDemoInteraction(targetIdKey = 'target_id') {
  return async (req, res, next) => {
    const targetId = parseInt(req.body?.[targetIdKey], 10);
    if (!Number.isFinite(targetId)) return next();
    if (await eitherIsDemo(req.userId, targetId)) {
      return res.status(403).json({ error: 'Demo profiles cannot be connected to or messaged.' });
    }
    next();
  };
}
