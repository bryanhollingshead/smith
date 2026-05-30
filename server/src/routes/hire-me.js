// Smith — Hire Me authed endpoints (target user's inbox)
//
// The structured intake side. The thread itself lives in /api/messages — it
// reuses the existing infra; this file is just the inquiry list + status
// management.

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

function shapeInquiry(row) {
  return {
    id:                row.id,
    target_user_id:    row.target_user_id,
    inquirer_name:     row.inquirer_name,
    inquirer_email:    row.inquirer_email,
    inquirer_phone:    row.inquirer_phone,
    structure_type:    row.structure_type,
    job_type:          row.job_type,
    location:          row.location,
    timeline:          row.timeline,
    message:           row.message,
    message_thread_id: row.message_thread_id,
    status:            row.status,
    is_connection_of:  !!row.is_connection_of,
    created_at:        row.created_at,
  };
}

// ── GET /api/hire-me/inbox ──────────────────────────────────────────────
// All inquiries directed at the authed user. Filters: ?status=  ?limit=
router.get('/hire-me/inbox', requireAuth, async (req, res) => {
  const status = req.query.status;
  const limit  = Math.min(60, Math.max(1, parseInt(req.query.limit, 10)  || 25));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const where  = ['target_user_id = $1'];
  const params = [req.userId];
  if (['new','replied','archived','spam'].includes(status)) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  params.push(limit, offset);

  const { rows } = await q(
    `SELECT * FROM hire_me_inquiries
      WHERE ${where.join(' AND ')}
      ORDER BY (status = 'new') DESC, is_connection_of DESC, created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  // Counts per status for the inbox header.
  const { rows: counts } = await q(
    `SELECT status, COUNT(*)::int AS n
       FROM hire_me_inquiries
      WHERE target_user_id = $1
      GROUP BY status`,
    [req.userId]
  );
  const countsByStatus = Object.fromEntries(counts.map(r => [r.status, r.n]));

  res.json({
    inquiries: rows.map(shapeInquiry),
    counts: {
      new:      countsByStatus.new      || 0,
      replied:  countsByStatus.replied  || 0,
      archived: countsByStatus.archived || 0,
      spam:     countsByStatus.spam     || 0,
    },
  });
});

// ── GET /api/hire-me/inbox/:id ──────────────────────────────────────────
router.get('/hire-me/inbox/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const { rows } = await q(
    `SELECT * FROM hire_me_inquiries WHERE id = $1 AND target_user_id = $2`,
    [id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ inquiry: shapeInquiry(rows[0]) });
});

// ── PATCH /api/hire-me/:id ──────────────────────────────────────────────
// Set status: new → replied / archived / spam. Only the target can change.
router.patch('/hire-me/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const { status } = req.body || {};
  if (!['new','replied','archived','spam'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const r = await q(
    `UPDATE hire_me_inquiries SET status = $1
       WHERE id = $2 AND target_user_id = $3
       RETURNING *`,
    [status, id, req.userId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ inquiry: shapeInquiry(r.rows[0]) });
});

export default router;
