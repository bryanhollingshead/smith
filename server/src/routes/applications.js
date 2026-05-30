// Smith — Application drafts (Jobs module phase 4)
//
// Endpoints (all require auth):
//   POST   /api/jobs/:id/draft                 generate or return existing
//   GET    /api/applications                   list user's drafts + sent
//   GET    /api/applications/:id               single draft
//   PATCH  /api/applications/:id               edit body, channel, recipient
//   POST   /api/applications/:id/send          dispatch by channel
//   DELETE /api/applications/:id               remove (lets user re-draft)
//
// Channels:
//   email     — delivered via mailer.js (Resend, falls back to mock_emails log)
//   deeplink  — no real send; user copies the body and pastes into the
//               original posting. status flips to 'sent' with sent_at = NOW().
//   sms       — schema in place, send not wired yet (no Twilio) — returns 501
//   onsite    — schema in place, requires recipient to be a Smith user —
//               not wired in phase 4, returns 501
//
// Per the journal Trusted Auto-Send entry: this is the foundation. Phase 6
// adds status='auto_sent' + a user-approved template registry, NO schema
// changes here.

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { loadProfile } from './profiles.js';
import { draftApplicationMessage } from '../llm.js';
import { sendMockEmail } from '../mailer.js';

const router = Router();

// Shape an application_drafts row + job join into the API response.
function shapeDraft(row) {
  return {
    id:              row.id,
    user_id:         row.user_id,
    job_id:          row.job_id,
    generated_body:  row.generated_body,
    edited_body:     row.edited_body,
    body:            row.edited_body || row.generated_body,   // effective body
    channel:         row.channel,
    status:          row.status,
    recipient_email: row.recipient_email,
    recipient_phone: row.recipient_phone,
    sent_at:         row.sent_at,
    send_error:      row.send_error,
    llm_model:       row.llm_model,
    created_at:      row.created_at,
    updated_at:      row.updated_at,
    // Job snapshot — saves a roundtrip in the inbox UI
    job: row.job_title ? {
      id:       row.job_id,
      title:    row.job_title,
      company:  row.job_company,
      location: row.job_location,
      url:      row.job_url,
      contact_email: row.job_contact_email,
      contact_phone: row.job_contact_phone,
    } : null,
  };
}

// Decide which channel + recipient is the default for a job. Direct contact
// wins; otherwise deeplink and rely on the external posting URL.
function defaultChannelFor(job) {
  if (job.contact_email) return { channel: 'email',    recipient_email: job.contact_email,    recipient_phone: null };
  if (job.contact_phone) return { channel: 'sms',      recipient_email: null,                recipient_phone: job.contact_phone };
  return                       { channel: 'deeplink', recipient_email: null,                recipient_phone: null };
}

// ── POST /api/jobs/:id/draft ─────────────────────────────────────────────
// Idempotent: returns the existing draft if one exists for this (user, job),
// generating a new one only on first call. To regenerate from scratch:
// DELETE the application then POST /jobs/:id/draft again.
router.post('/jobs/:id/draft', requireAuth, async (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  if (!Number.isFinite(jobId)) return res.status(400).json({ error: 'Invalid id' });

  // Existing draft?
  const existing = await q(
    `SELECT a.*, j.title AS job_title, j.company AS job_company,
            j.location AS job_location, j.url AS job_url,
            j.contact_email AS job_contact_email, j.contact_phone AS job_contact_phone
       FROM application_drafts a JOIN jobs j ON j.id = a.job_id
      WHERE a.user_id = $1 AND a.job_id = $2`,
    [req.userId, jobId]
  );
  if (existing.rows.length) {
    return res.json({ draft: shapeDraft(existing.rows[0]) });
  }

  // Load job + profile, generate, persist.
  const { rows: jobRows } = await q(`SELECT * FROM jobs WHERE id = $1 AND NOT hidden`, [jobId]);
  if (!jobRows.length) return res.status(404).json({ error: 'Job not found' });
  const job = jobRows[0];

  const profile = await loadProfile(req.userId, req.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const { body, model } = await draftApplicationMessage(profile, job);
  const channelInfo = defaultChannelFor(job);

  const ins = await q(
    `INSERT INTO application_drafts
       (user_id, job_id, generated_body, channel, recipient_email, recipient_phone, llm_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [req.userId, jobId, body, channelInfo.channel,
     channelInfo.recipient_email, channelInfo.recipient_phone, model]
  );

  // Re-fetch with job join so the response shape matches the existing-draft path.
  const full = await q(
    `SELECT a.*, j.title AS job_title, j.company AS job_company,
            j.location AS job_location, j.url AS job_url,
            j.contact_email AS job_contact_email, j.contact_phone AS job_contact_phone
       FROM application_drafts a JOIN jobs j ON j.id = a.job_id
      WHERE a.id = $1`,
    [ins.rows[0].id]
  );
  res.status(201).json({ draft: shapeDraft(full.rows[0]) });
});

// ── GET /api/applications ────────────────────────────────────────────────
// Filters: ?status=draft|sent  ?limit=  ?offset=
router.get('/applications', requireAuth, async (req, res) => {
  const status = req.query.status;
  const limit  = Math.min(60, Math.max(1, parseInt(req.query.limit, 10)  || 25));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const where  = ['a.user_id = $1'];
  const params = [req.userId];
  if (status === 'draft' || status === 'sent' || status === 'auto_sent') {
    params.push(status);
    where.push(`a.status = $${params.length}`);
  }
  params.push(limit, offset);

  const { rows } = await q(
    `SELECT a.*, j.title AS job_title, j.company AS job_company,
            j.location AS job_location, j.url AS job_url,
            j.contact_email AS job_contact_email, j.contact_phone AS job_contact_phone
       FROM application_drafts a JOIN jobs j ON j.id = a.job_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({ applications: rows.map(shapeDraft) });
});

// ── GET /api/applications/:id ────────────────────────────────────────────
router.get('/applications/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const { rows } = await q(
    `SELECT a.*, j.title AS job_title, j.company AS job_company,
            j.location AS job_location, j.url AS job_url,
            j.contact_email AS job_contact_email, j.contact_phone AS job_contact_phone
       FROM application_drafts a JOIN jobs j ON j.id = a.job_id
      WHERE a.id = $1 AND a.user_id = $2`,
    [id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ draft: shapeDraft(rows[0]) });
});

// ── PATCH /api/applications/:id ──────────────────────────────────────────
// Edit body, switch channel, change recipient. Sent rows are frozen.
router.patch('/applications/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const cur = await q(
    `SELECT status FROM application_drafts WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!cur.rows.length) return res.status(404).json({ error: 'Not found' });
  if (cur.rows[0].status !== 'draft') {
    return res.status(409).json({ error: 'Cannot edit a sent application' });
  }

  const allowed = ['edited_body', 'channel', 'recipient_email', 'recipient_phone'];
  const updates = {};
  for (const k of allowed) if (k in (req.body || {})) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  if ('channel' in updates && !['email','sms','onsite','deeplink'].includes(updates.channel)) {
    return res.status(400).json({ error: 'Invalid channel' });
  }

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`);
  const vals = [id, req.userId, ...Object.values(updates)];
  const upd = await q(
    `UPDATE application_drafts SET ${sets.join(', ')}
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
    vals
  );
  res.json({ draft: shapeDraft(upd.rows[0]) });
});

// ── POST /api/applications/:id/send ──────────────────────────────────────
router.post('/applications/:id/send', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const { rows } = await q(
    `SELECT a.*, j.title AS job_title, j.url AS job_url
       FROM application_drafts a JOIN jobs j ON j.id = a.job_id
      WHERE a.id = $1 AND a.user_id = $2`,
    [id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const draft = rows[0];

  if (draft.status !== 'draft') {
    return res.status(409).json({ error: 'Already sent', sent_at: draft.sent_at });
  }

  const body = draft.edited_body || draft.generated_body;
  let sendErr = null;
  let didSend = false;

  switch (draft.channel) {
    case 'email': {
      const to = draft.recipient_email;
      if (!to) {
        sendErr = 'No recipient email set';
      } else {
        try {
          // sendMockEmail never throws; it always writes to mock_emails +
          // logs + tries Resend. We treat the row as "sent" regardless of
          // Resend success — the user can see the trail in mock_emails.
          await sendMockEmail({
            to,
            subject: `Re: ${draft.job_title}`,
            body,
            kind: 'application_send',
            meta: { application_id: id, job_id: draft.job_id },
          });
          didSend = true;
        } catch (e) {
          sendErr = e.message || String(e);
        }
      }
      break;
    }
    case 'deeplink': {
      // No real send. The user clicks through to the source posting and
      // pastes the body. Flipping to 'sent' marks it complete in their
      // history; the body is preserved verbatim for receipts.
      didSend = true;
      break;
    }
    case 'sms':
    case 'onsite':
      return res.status(501).json({ error: `Channel ${draft.channel} is not yet supported` });
    default:
      return res.status(400).json({ error: 'Invalid channel' });
  }

  if (!didSend) {
    await q(
      `UPDATE application_drafts SET send_error = $2 WHERE id = $1`,
      [id, sendErr]
    );
    return res.status(502).json({ error: sendErr || 'Send failed' });
  }

  const upd = await q(
    `UPDATE application_drafts
        SET status = 'sent', sent_at = NOW(), send_error = NULL
      WHERE id = $1
      RETURNING *`,
    [id]
  );
  res.json({ draft: shapeDraft({ ...upd.rows[0], job_title: draft.job_title, job_url: draft.job_url }) });
});

// ── DELETE /api/applications/:id ─────────────────────────────────────────
// Lets the user re-draft from scratch (POST /jobs/:id/draft again). Sent
// rows can also be deleted — that's just history cleanup.
router.delete('/applications/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const r = await q(
    `DELETE FROM application_drafts WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
