// Smith — Messaging REST endpoints
//
// Endpoints:
//   GET    /api/messages/threads               list user's threads with last
//                                              message + unread count
//   GET    /api/messages/threads/:id           thread + message history (paginated)
//   POST   /api/messages/threads               create-or-fetch a 1:1 thread with
//                                              { peer_id } (must be a connection)
//   POST   /api/messages/threads/:id/messages  send message { body }
//   POST   /api/messages/threads/:id/read      mark thread read (sets last_read_at)
//   GET    /api/messages/unread-count          total unread across all threads
//
// Sending a message: the HTTP POST is the source of truth (durable). After the
// DB insert succeeds, we broadcast to the recipient's open sockets — but the
// message is safe even if no socket is listening. That avoids the classic "sent
// but lost in transit" problem with naive socket-first chat designs.

import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth } from '../middleware.js';
import { broadcastToUser } from './messages-ws.js';
import { keysToUrls } from '../storage.js';
import { notifyInquirerOfTargetReply } from '../hire-me.js';

const router = Router();

// Hard cap to match the DB CHECK constraint. Enforced here so we send a
// friendly error instead of a Postgres exception.
const MAX_BODY = 5000;

// ── Helper: confirm two users are connected ─────────────────────────────
// Returns true if (a,b) appear in connections with status='accepted'.
async function areConnected(userA, userB) {
  if (userA === userB) return false; // No self-DMs.
  const { rows } = await q(
    `SELECT 1 FROM connections
      WHERE status = 'accepted'
        AND ((user_a_id = $1 AND user_b_id = $2)
          OR (user_a_id = $2 AND user_b_id = $1))
      LIMIT 1`,
    [userA, userB]
  );
  return rows.length > 0;
}

// ── Helper: confirm user is in thread ───────────────────────────────────
// All thread-scoped endpoints gate on this. Returns the participant row or null.
async function getParticipant(threadId, userId) {
  const { rows } = await q(
    `SELECT thread_id, last_read_at FROM message_participants
      WHERE thread_id = $1 AND user_id = $2`,
    [threadId, userId]
  );
  return rows[0] || null;
}

// ── Helper: find peer in 1:1 thread ─────────────────────────────────────
async function getPeerId(threadId, userId) {
  const { rows } = await q(
    `SELECT user_id FROM message_participants
      WHERE thread_id = $1 AND user_id != $2 LIMIT 1`,
    [threadId, userId]
  );
  return rows[0]?.user_id || null;
}

// ── GET /threads — list with last message + unread ───────────────────────
// One query joins everything we need for the inbox list.
router.get('/threads', requireAuth, async (req, res) => {
  const { rows } = await q(
    `WITH my_threads AS (
       SELECT mp.thread_id, mp.last_read_at
         FROM message_participants mp WHERE mp.user_id = $1
     ),
     peers AS (
       -- The "other" participant in each thread (1:1 assumption).
       SELECT mp.thread_id, u.id, u.first_name, u.last_name, u.avatar_tone, u.avatar_url, u.headline
         FROM my_threads mt
         JOIN message_participants mp ON mp.thread_id = mt.thread_id AND mp.user_id != $1
         JOIN users u ON u.id = mp.user_id
     ),
     last_msgs AS (
       -- Most recent message in each thread (correlated subquery).
       SELECT m.thread_id, m.sender_id, m.body, m.created_at
         FROM messages m
        WHERE m.id = (SELECT id FROM messages m2
                       WHERE m2.thread_id = m.thread_id
                       ORDER BY m2.created_at DESC LIMIT 1)
     ),
     unread AS (
       SELECT m.thread_id, COUNT(*)::int AS n
         FROM messages m
         JOIN my_threads mt ON mt.thread_id = m.thread_id
        WHERE m.created_at > mt.last_read_at AND m.sender_id != $1
        GROUP BY m.thread_id
     )
     SELECT t.id AS thread_id,
            t.last_message_at,
            peers.id          AS peer_id,
            peers.first_name  AS peer_first_name,
            peers.last_name   AS peer_last_name,
            peers.avatar_tone AS peer_avatar_tone,
            peers.avatar_url  AS peer_avatar_url,
            peers.headline    AS peer_headline,
            last_msgs.body       AS last_body,
            last_msgs.sender_id  AS last_sender_id,
            last_msgs.created_at AS last_created_at,
            COALESCE(unread.n, 0) AS unread
       FROM my_threads mt
       JOIN message_threads t ON t.id = mt.thread_id
       JOIN peers ON peers.thread_id = mt.thread_id
       LEFT JOIN last_msgs ON last_msgs.thread_id = mt.thread_id
       LEFT JOIN unread ON unread.thread_id = mt.thread_id
      ORDER BY t.last_message_at DESC`,
    [req.userId]
  );

  res.json({
    threads: rows.map(r => ({
      id: r.thread_id,
      last_message_at: r.last_message_at,
      peer: {
        id: r.peer_id,
        first_name: r.peer_first_name,
        last_name: r.peer_last_name,
        avatar_tone: r.peer_avatar_tone,
        avatar_urls: keysToUrls(r.peer_avatar_url),
        headline: r.peer_headline,
      },
      last_message: r.last_body ? {
        body: r.last_body,
        sender_id: r.last_sender_id,
        created_at: r.last_created_at,
        from_me: r.last_sender_id === req.userId,
      } : null,
      unread: r.unread,
    })),
  });
});

// ── GET /threads/:id — thread + messages ─────────────────────────────────
router.get('/threads/:id', requireAuth, async (req, res) => {
  const threadId = parseInt(req.params.id, 10);
  if (!Number.isFinite(threadId)) return res.status(400).json({ error: 'Invalid id' });

  const me = await getParticipant(threadId, req.userId);
  if (!me) return res.status(404).json({ error: 'Thread not found' });

  // Peer lookup.
  const { rows: peerRows } = await q(
    `SELECT u.id, u.first_name, u.last_name, u.avatar_tone, u.avatar_url, u.headline
       FROM message_participants mp
       JOIN users u ON u.id = mp.user_id
      WHERE mp.thread_id = $1 AND mp.user_id != $2`,
    [threadId, req.userId]
  );
  const peer = peerRows[0]
    ? (({ avatar_url, ...p }) => ({ ...p, avatar_urls: keysToUrls(avatar_url) }))(peerRows[0])
    : null;

  // Pagination: ?before=<message_id> returns messages older than that id.
  // Default returns the most recent 50 in chronological order (oldest first
  // in the response so the client can append cleanly).
  const before = parseInt(req.query.before, 10);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  const { rows: msgRows } = await q(
    `SELECT id, sender_id, body, created_at
       FROM messages
      WHERE thread_id = $1
        ${Number.isFinite(before) ? 'AND id < $3' : ''}
      ORDER BY created_at DESC LIMIT $2`,
    Number.isFinite(before) ? [threadId, limit, before] : [threadId, limit]
  );
  const messages = msgRows.reverse().map(m => ({
    id: m.id,
    sender_id: m.sender_id,
    body: m.body,
    created_at: m.created_at,
    from_me: m.sender_id === req.userId,
  }));

  res.json({
    thread: {
      id: threadId,
      peer,
      messages,
      has_more: msgRows.length === limit,
    },
  });
});

// ── POST /threads — create-or-fetch with a connection ───────────────────
// Idempotent: if a 1:1 thread between the viewer and peer already exists, we
// return it. Otherwise we create one in a transaction so the thread and both
// participant rows go in together.
router.post('/threads', requireAuth, async (req, res) => {
  const peerId = parseInt(req.body?.peer_id, 10);
  if (!Number.isFinite(peerId)) return res.status(400).json({ error: 'peer_id required' });

  // Connection gate. Connections-only is the trust model for v1.
  if (!(await areConnected(req.userId, peerId))) {
    return res.status(403).json({ error: 'You can only message your connections.' });
  }

  // Existing thread?
  // A 1:1 thread is identified by exactly the participants {me, peer} — no
  // schema-level constraint enforces this for v1; we look for a thread where
  // both users are participants and no one else is.
  const { rows: existing } = await q(
    `SELECT t.id FROM message_threads t
      WHERE EXISTS (SELECT 1 FROM message_participants WHERE thread_id = t.id AND user_id = $1)
        AND EXISTS (SELECT 1 FROM message_participants WHERE thread_id = t.id AND user_id = $2)
        AND (SELECT COUNT(*) FROM message_participants WHERE thread_id = t.id) = 2
      LIMIT 1`,
    [req.userId, peerId]
  );
  if (existing.length) return res.json({ thread_id: existing[0].id, created: false });

  // Create new.
  const threadId = await tx(async (client) => {
    const t = await client.query(
      `INSERT INTO message_threads DEFAULT VALUES RETURNING id`
    );
    const id = t.rows[0].id;
    await client.query(
      `INSERT INTO message_participants (thread_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [id, req.userId, peerId]
    );
    return id;
  });

  res.status(201).json({ thread_id: threadId, created: true });
});

// ── POST /threads/:id/messages — send ───────────────────────────────────
router.post('/threads/:id/messages', requireAuth, async (req, res) => {
  const threadId = parseInt(req.params.id, 10);
  if (!Number.isFinite(threadId)) return res.status(400).json({ error: 'Invalid id' });
  const body = (req.body?.body || '').toString().trim();
  if (!body) return res.status(400).json({ error: 'Message body required.' });
  if (body.length > MAX_BODY) {
    return res.status(400).json({ error: `Max ${MAX_BODY} characters.` });
  }

  const me = await getParticipant(threadId, req.userId);
  if (!me) return res.status(404).json({ error: 'Thread not found' });

  const peerId = await getPeerId(threadId, req.userId);
  // Re-check connection at send time — connection could have been removed
  // since the thread was created. v1 stance: stop letting messages through.
  // (We don't auto-delete the thread; it just goes read-only.)
  if (peerId && !(await areConnected(req.userId, peerId))) {
    return res.status(403).json({ error: 'You can only message your connections.' });
  }

  // Insert message + bump thread.last_message_at + mark sender as having
  // read up to and including their own message. All in one transaction.
  const msg = await tx(async (client) => {
    const ins = await client.query(
      `INSERT INTO messages (thread_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, sender_id, body, created_at`,
      [threadId, req.userId, body]
    );
    await client.query(
      `UPDATE message_threads SET last_message_at = $2 WHERE id = $1`,
      [threadId, ins.rows[0].created_at]
    );
    await client.query(
      `UPDATE message_participants
          SET last_read_at = $3
        WHERE thread_id = $1 AND user_id = $2`,
      [threadId, req.userId, ins.rows[0].created_at]
    );
    return ins.rows[0];
  });

  // Broadcast to the recipient over websocket (if connected). Best-effort —
  // the durable record is already in the DB.
  if (peerId) {
    broadcastToUser(peerId, {
      type: 'message:new',
      thread_id: threadId,
      message: {
        id: msg.id,
        sender_id: msg.sender_id,
        body: msg.body,
        created_at: msg.created_at,
        from_me: false, // perspective of the recipient
      },
    });
    // Also create a notification record so it appears in the bell for the
    // recipient if they're not currently online. We swallow errors so the
    // primary send still succeeds even if the notifications table changes.
    try {
      await q(
        `INSERT INTO notifications (user_id, kind, actor_id, metadata, created_at)
           VALUES ($1, 'new_message', $2, $3::jsonb, now())`,
        [peerId, req.userId, JSON.stringify({ thread_id: threadId, preview: body.slice(0, 120) })]
      );
    } catch { /* notifications nice-to-have, not a hard dependency */ }
  }

  // Hire Me hook: if this thread has a hire_me_inquiries row, the inquirer
  // (no Smith account) is on the other side. Mint a fresh magic-link token
  // + email it. notifyInquirerOfTargetReply is fire-and-forget — never
  // throws, returns immediately on non-HireMe threads.
  if (!peerId) {
    const replierName = req.user
      ? `${req.user.first_name} ${req.user.last_name}`.trim()
      : 'A Smith member';
    notifyInquirerOfTargetReply(threadId, body, replierName).catch(() => {});
  }

  res.status(201).json({
    message: {
      id: msg.id,
      sender_id: msg.sender_id,
      body: msg.body,
      created_at: msg.created_at,
      from_me: true,
    },
  });
});

// ── POST /threads/:id/read — mark caught up ─────────────────────────────
// Sets the user's last_read_at to now. Frontend calls this when the thread
// is opened or scrolled to the bottom.
router.post('/threads/:id/read', requireAuth, async (req, res) => {
  const threadId = parseInt(req.params.id, 10);
  if (!Number.isFinite(threadId)) return res.status(400).json({ error: 'Invalid id' });

  const r = await q(
    `UPDATE message_participants SET last_read_at = now()
      WHERE thread_id = $1 AND user_id = $2`,
    [threadId, req.userId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Thread not found' });
  res.json({ ok: true });
});

// ── GET /unread-count — for nav badge ──────────────────────────────────
router.get('/unread-count', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT COUNT(*)::int AS n
       FROM messages m
       JOIN message_participants mp
         ON mp.thread_id = m.thread_id AND mp.user_id = $1
      WHERE m.created_at > mp.last_read_at AND m.sender_id != $1`,
    [req.userId]
  );
  res.json({ unread: rows[0].n });
});

export default router;
