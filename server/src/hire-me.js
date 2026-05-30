// Smith — Hire Me core helpers
//
// Shared between routes/public.js (inquirer-side: submit + magic-link reply)
// and routes/messages.js (target-side: detect Hire Me thread on reply and
// email the inquirer a magic-link).
//
// Why a helper module: keeping the side-effect of "a Hire Me reply emails
// the inquirer" out of the messages send endpoint avoids polluting the
// generic messaging logic with feature-specific knowledge. messages.js
// just calls one function — this module owns the rest.

import { q, tx } from './db.js';
import { newMagicToken } from './slug.js';
import { sendMockEmail } from './mailer.js';

const MAGIC_LINK_TTL_DAYS = 7;

// Look up whether a thread is a Hire Me thread. Returns the inquiry row or
// null. Cheap query; targets a single-row index hit.
export async function getInquiryForThread(threadId) {
  const { rows } = await q(
    `SELECT id, target_user_id, inquirer_name, inquirer_email, inquirer_phone,
            structure_type, job_type, location, timeline, message,
            message_thread_id, status, is_connection_of, created_at
       FROM hire_me_inquiries
      WHERE message_thread_id = $1
      LIMIT 1`,
    [threadId]
  );
  return rows[0] || null;
}

// Called from POST /api/messages/threads/:id/messages whenever the target
// user sends a reply. If the thread is Hire Me-originated, generate a fresh
// magic-link token + email the inquirer. Never throws — failures log and
// move on so the user's message still goes through.
export async function notifyInquirerOfTargetReply(threadId, replyBody, replierName) {
  try {
    const inquiry = await getInquiryForThread(threadId);
    if (!inquiry) return; // not a Hire Me thread

    const token = newMagicToken();
    const expires = new Date(Date.now() + MAGIC_LINK_TTL_DAYS * 86400_000);

    await q(
      `INSERT INTO hire_me_tokens (target_thread_id, inquirer_email, token, expires_at)
         VALUES ($1, $2, $3, $4)`,
      [threadId, inquiry.inquirer_email, token, expires]
    );

    // Flip inquiry status to 'replied' on the first reply. Idempotent — UPDATE
    // is a no-op if already 'replied'.
    if (inquiry.status === 'new') {
      await q(
        `UPDATE hire_me_inquiries SET status = 'replied' WHERE id = $1`,
        [inquiry.id]
      );
    }

    const origin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
    const link = `${origin}/h/${token}`;
    const preview = replyBody.length > 240 ? replyBody.slice(0, 240) + '…' : replyBody;
    const subject = `${replierName} replied about ${inquiry.job_type || 'your inquiry'}`;
    const body =
`${replierName} replied to your Smith inquiry.

"${preview}"

Continue the conversation:
${link}

This link is good for 7 days. If you'd like to manage all your inquiries in one
place, you can create a free Smith account at the link above.

— Smith`;

    await sendMockEmail({
      to: inquiry.inquirer_email,
      subject,
      body,
      kind: 'hire_me_reply',
      meta: { inquiry_id: inquiry.id, thread_id: threadId },
    });
  } catch (e) {
    console.error('[hire-me] notifyInquirerOfTargetReply failed:', e.message || e);
  }
}

// Resolve a magic-link token. Returns {token_row, thread_id, inquiry, used}
// or null on miss/expired. Caller decides whether to honor "used" tokens
// (GET = always honor for the most recent token for the inquirer; POST =
// require not-used).
export async function resolveMagicToken(token) {
  const { rows } = await q(
    `SELECT t.id, t.target_thread_id, t.inquirer_email, t.expires_at, t.used_at
       FROM hire_me_tokens t WHERE t.token = $1 LIMIT 1`,
    [token]
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (new Date(row.expires_at).getTime() < Date.now()) return { ...row, expired: true };
  const inquiry = await getInquiryForThread(row.target_thread_id);
  return { token_row: row, thread_id: row.target_thread_id, inquiry, used: !!row.used_at, expired: false };
}

// Create an inquiry + thread + initial message + notification.
// Returns { inquiry, thread_id, message_id }.
export async function createInquiry({
  targetUserId, targetName, inquirerName, inquirerEmail, inquirerPhone,
  structureType, jobType, location, timeline, message, ip,
}) {
  // is_connection_of: does the inquirer's email match a user that the target
  // is already connected to? Cheap query; sticky on the inquiry row.
  const conn = await q(
    `SELECT 1 FROM users u
       JOIN connections c ON c.status = 'accepted' AND (
         (c.user_a_id = $1 AND c.user_b_id = u.id) OR
         (c.user_b_id = $1 AND c.user_a_id = u.id)
       )
      WHERE LOWER(u.email) = LOWER($2)
      LIMIT 1`,
    [targetUserId, inquirerEmail]
  );
  const isConnectionOf = conn.rows.length > 0;

  // Build the initial message body — a structured intake summary the target
  // can scan at a glance, followed by the inquirer's free-text message.
  const summaryBits = [];
  if (jobType)       summaryBits.push(`Job type: ${jobType}`);
  if (structureType) summaryBits.push(`Structure: ${structureType}`);
  if (location)      summaryBits.push(`Location: ${location}`);
  if (timeline)      summaryBits.push(`Timeline: ${timeline}`);
  if (inquirerPhone) summaryBits.push(`Phone: ${inquirerPhone}`);
  const summary = summaryBits.length ? summaryBits.join(' · ') + '\n\n' : '';
  const fullBody = `Hire Me inquiry from ${inquirerName} (${inquirerEmail})\n${summary}${message}`;

  const result = await tx(async (c) => {
    // Thread + target as the only participant.
    const t = await c.query(`INSERT INTO message_threads DEFAULT VALUES RETURNING id`);
    const threadId = t.rows[0].id;
    await c.query(
      `INSERT INTO message_participants (thread_id, user_id) VALUES ($1, $2)`,
      [threadId, targetUserId]
    );
    // First message — sender_id NULL, sender_name_override carries inquirer name.
    const msg = await c.query(
      `INSERT INTO messages (thread_id, sender_id, sender_name_override, body)
         VALUES ($1, NULL, $2, $3)
         RETURNING id, created_at`,
      [threadId, inquirerName, fullBody]
    );
    await c.query(
      `UPDATE message_threads SET last_message_at = $2 WHERE id = $1`,
      [threadId, msg.rows[0].created_at]
    );

    // Inquiry row referencing the thread.
    const inquiry = await c.query(
      `INSERT INTO hire_me_inquiries
         (target_user_id, inquirer_name, inquirer_email, inquirer_phone,
          structure_type, job_type, location, timeline, message,
          message_thread_id, is_connection_of, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [targetUserId, inquirerName, inquirerEmail, inquirerPhone,
       structureType, jobType, location, timeline, message,
       threadId, isConnectionOf, ip || null]
    );

    // Target notification — surfaces in the alerts bell.
    await c.query(
      `INSERT INTO notifications (user_id, kind, subject_id, body, created_at)
         VALUES ($1, 'hire_me_inquiry', $2, $3, NOW())`,
      [targetUserId, inquiry.rows[0].id,
       `${inquirerName} wants to hire you${jobType ? ` for ${jobType.toLowerCase()}` : ''}`]
    );

    return { inquiry: inquiry.rows[0], threadId, messageId: msg.rows[0].id };
  });

  // Best-effort email to the target so they know an inquiry came in even
  // before they next sign in. Skipped if we don't know an email (defensive).
  try {
    const { rows: u } = await q(`SELECT email FROM users WHERE id = $1`, [targetUserId]);
    const targetEmail = u[0]?.email;
    if (targetEmail) {
      await sendMockEmail({
        to: targetEmail,
        subject: `${inquirerName} wants to hire you`,
        body: `${inquirerName} (${inquirerEmail}) sent you a Hire Me inquiry via Smith.\n\n${fullBody}\n\nReply in Smith → ${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/inquiries`,
        kind: 'hire_me_inquiry_notify',
        meta: { inquiry_id: result.inquiry.id, target_user_id: targetUserId },
      });
    }
  } catch { /* swallow */ }

  return { inquiry: result.inquiry, thread_id: result.threadId, message_id: result.messageId };
}

// Inquirer posts a reply via a magic-link token. The reply joins the same
// thread; sender_id stays NULL + sender_name_override carries the original
// inquirer's name. Token is invalidated (used_at = NOW). Notification fires
// to the target user.
export async function postInquirerReplyViaToken(token, body) {
  const resolved = await resolveMagicToken(token);
  if (!resolved) return { ok: false, status: 404, error: 'Token not found' };
  if (resolved.expired) return { ok: false, status: 410, error: 'Link expired' };
  if (resolved.used) return { ok: false, status: 410, error: 'Link already used — wait for the next reply' };
  if (!resolved.inquiry) return { ok: false, status: 404, error: 'Inquiry not found' };
  const trimmed = String(body || '').trim();
  if (!trimmed) return { ok: false, status: 400, error: 'Message body required' };
  if (trimmed.length > 5000) return { ok: false, status: 400, error: 'Max 5000 characters' };

  const result = await tx(async (c) => {
    const msg = await c.query(
      `INSERT INTO messages (thread_id, sender_id, sender_name_override, body)
         VALUES ($1, NULL, $2, $3)
         RETURNING id, created_at`,
      [resolved.thread_id, resolved.inquiry.inquirer_name, trimmed]
    );
    await c.query(
      `UPDATE message_threads SET last_message_at = $2 WHERE id = $1`,
      [resolved.thread_id, msg.rows[0].created_at]
    );
    // Burn the token.
    await c.query(
      `UPDATE hire_me_tokens SET used_at = NOW() WHERE id = $1`,
      [resolved.token_row.id]
    );
    // Notify target.
    await c.query(
      `INSERT INTO notifications (user_id, kind, subject_id, body, created_at)
         VALUES ($1, 'hire_me_inquiry', $2, $3, NOW())`,
      [resolved.inquiry.target_user_id, resolved.inquiry.id,
       `${resolved.inquiry.inquirer_name} replied: ${trimmed.slice(0, 80)}${trimmed.length > 80 ? '…' : ''}`]
    );
    return msg.rows[0];
  });
  return { ok: true, message_id: result.id, thread_id: resolved.thread_id };
}
