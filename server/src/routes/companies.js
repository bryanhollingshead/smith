// Smith — Companies, work-history, and jobsites
//
// The profile page's "Where I've worked" timeline is the unique structural piece
// of Smith — companies, with jobsites stacked under each. Endpoints here let
// users add a company tenure, then attach jobsites to it.
//
// Patch B: companies + jobsites grew a photo upload (logo, jobsite photo). The
// upload itself lives in routes/photos.js; this file mostly cares about
// surfacing logo_urls + photo_urls in the returned shape and accepting them
// where it makes sense.

import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth } from '../middleware.js';
import { publicUrl } from '../storage.js';

const router = Router();

// Translate a JSON shape of storage keys to URLs the client can render.
// Shared with profiles.js's parser — kept inline here for module isolation.
function parseUrls(stored) {
  if (!stored) return null;
  let parsed = stored;
  if (typeof stored === 'string') {
    try { parsed = JSON.parse(stored); } catch { return null; }
  }
  if (typeof parsed !== 'object' || !parsed) return null;
  const out = {};
  for (const [size, key] of Object.entries(parsed)) {
    if (typeof key === 'string') out[size] = publicUrl(key);
  }
  return out;
}

// GET /api/companies?search=... — autocomplete during "Add company" flow.
// Returns logo_urls so the dropdown can show real logos for companies that
// have one.
router.get('/companies', requireAuth, async (req, res) => {
  const search = (req.query.search || '').toString().trim();
  if (!search) return res.json({ companies: [] });
  const { rows } = await q(
    `SELECT id, name, type, logo_tone, logo_url,
            claimed_by IS NOT NULL AS claimed
       FROM companies
      WHERE LOWER(name) LIKE LOWER($1)
      ORDER BY claimed_by IS NOT NULL DESC, name ASC
      LIMIT 10`,
    [`%${search}%`]
  );
  res.json({
    companies: rows.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      logo_tone: c.logo_tone,
      logo_urls: parseUrls(c.logo_url),
      claimed: c.claimed,
    })),
  });
});

// POST /api/companies — create a new company (will be unclaimed unless claim=true)
router.post('/companies', requireAuth, async (req, res) => {
  const { name, type = 'General Contractor', logo_tone = 'rust', claim = false } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await q(
    `INSERT INTO companies (name, type, logo_tone, claimed_by, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, type, logo_tone, logo_url,
                 claimed_by IS NOT NULL AS claimed`,
    [name, type, logo_tone, claim ? req.userId : null, req.userId]
  );
  const c = rows[0];
  res.status(201).json({
    company: {
      id: c.id,
      name: c.name,
      type: c.type,
      logo_tone: c.logo_tone,
      logo_urls: parseUrls(c.logo_url),
      claimed: c.claimed,
    },
  });
});

// POST /api/companies/:id/claim — immediate claim (solo case only).
//
// Only granted if (a) the requester has work-history at the company AND
// (b) no other Smith user does. In that case there's no one to witness, so
// the requester becomes steward straight away. For any company with two or
// more workers in its work-history, use the request/cosign flow below.
router.post('/companies/:id/claim', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  // Verify the company exists and is unclaimed.
  const co = await q(
    `SELECT id, name, claimed_by FROM companies WHERE id = $1`,
    [id]
  );
  if (!co.rowCount) return res.status(404).json({ error: 'Company not found' });
  if (co.rows[0].claimed_by) return res.status(409).json({ error: 'Already claimed' });

  // Caller must have work-history at this company.
  const mine = await q(
    `SELECT 1 FROM work_history WHERE company_id = $1 AND user_id = $2 LIMIT 1`,
    [id, req.userId]
  );
  if (!mine.rowCount) {
    return res.status(403).json({ error: 'You can only claim a company you have work history at.' });
  }

  // Solo guard — any other worker means a witnessed claim is required.
  const others = await q(
    `SELECT 1 FROM work_history WHERE company_id = $1 AND user_id <> $2 LIMIT 1`,
    [id, req.userId]
  );
  if (others.rowCount) {
    return res.status(409).json({
      error: 'Other workers have this company in their work history. Send a claim request instead.',
      code: 'cosign_required',
    });
  }

  await q(`UPDATE companies SET claimed_by = $1 WHERE id = $2`, [req.userId, id]);
  res.json({ ok: true, granted: true });
});

// POST /api/companies/:id/claim-request — start a witnessed claim.
// Body: { cosigner_user_ids: number[] }
//
// The caller must have work-history at this company. The named cosigners
// must also have work-history at the same company (and not be the caller).
// Threshold defaults to 1 — see migration 018 for min_cosigns. Cosigners
// receive a 'company_claim_request' notification.
router.post('/companies/:id/claim-request', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const cosignerIds = Array.isArray(req.body?.cosigner_user_ids)
    ? [...new Set(req.body.cosigner_user_ids.map(n => parseInt(n, 10)).filter(Number.isFinite))]
    : [];
  if (cosignerIds.length === 0) {
    return res.status(400).json({ error: 'At least one cosigner is required.' });
  }
  if (cosignerIds.includes(req.userId)) {
    return res.status(400).json({ error: 'You cannot cosign your own claim.' });
  }

  const co = await q(
    `SELECT id, name, claimed_by FROM companies WHERE id = $1`,
    [id]
  );
  if (!co.rowCount) return res.status(404).json({ error: 'Company not found' });
  if (co.rows[0].claimed_by) return res.status(409).json({ error: 'Already claimed' });
  const companyName = co.rows[0].name;

  // Caller must have work-history at this company.
  const mine = await q(
    `SELECT 1 FROM work_history WHERE company_id = $1 AND user_id = $2 LIMIT 1`,
    [id, req.userId]
  );
  if (!mine.rowCount) {
    return res.status(403).json({ error: 'You can only claim a company you have work history at.' });
  }

  // Reject if there's already a pending request by this user (the DB unique
  // partial index would catch it, but the error message is friendlier here).
  const existing = await q(
    `SELECT id FROM company_claim_requests
      WHERE company_id = $1 AND requester_id = $2 AND status = 'pending'`,
    [id, req.userId]
  );
  if (existing.rowCount) {
    return res.status(409).json({ error: 'You already have a pending claim for this company.' });
  }

  // Every cosigner must themselves be in this company's work-history.
  const valid = await q(
    `SELECT DISTINCT user_id FROM work_history
      WHERE company_id = $1 AND user_id = ANY($2::bigint[])`,
    [id, cosignerIds]
  );
  const validSet = new Set(valid.rows.map(r => Number(r.user_id)));
  const invalid = cosignerIds.filter(uid => !validSet.has(uid));
  if (invalid.length) {
    return res.status(400).json({
      error: 'Cosigners must have work history at this company.',
      invalid_user_ids: invalid,
    });
  }

  const result = await tx(async (c) => {
    const { rows: rr } = await c.query(
      `INSERT INTO company_claim_requests (company_id, requester_id)
         VALUES ($1,$2) RETURNING id, min_cosigns, created_at`,
      [id, req.userId]
    );
    const request = rr[0];
    for (const uid of cosignerIds) {
      await c.query(
        `INSERT INTO company_claim_cosigns (request_id, cosigner_id) VALUES ($1,$2)`,
        [request.id, uid]
      );
      await c.query(
        `INSERT INTO notifications (user_id, kind, actor_id, subject_id, body)
           VALUES ($1, 'company_claim_request', $2, $3, $4)`,
        [uid, req.userId, request.id, `is claiming ${companyName}. Confirm?`]
      );
    }
    return request;
  });

  res.status(201).json({
    request: {
      id: result.id,
      company_id: id,
      min_cosigns: result.min_cosigns,
      created_at: result.created_at,
    },
  });
});

// POST /api/company-claim-requests/:id/cosign — confirm or decline.
// Body: { decision: 'confirm' | 'decline' }
//
// Caller must be a named cosigner on the request with decision='pending'.
// On a confirm that reaches the threshold, the company is granted to the
// requester and the requester gets a 'company_claim_granted' notification.
router.post('/company-claim-requests/:id/cosign', requireAuth, async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (!Number.isFinite(requestId)) return res.status(400).json({ error: 'Invalid id' });
  const decision = String(req.body?.decision || '');
  if (!['confirm', 'decline'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be confirm or decline' });
  }

  const reqRow = await q(
    `SELECT ccr.id, ccr.company_id, ccr.requester_id, ccr.status, ccr.min_cosigns,
            c.name AS company_name, c.claimed_by
       FROM company_claim_requests ccr JOIN companies c ON c.id = ccr.company_id
      WHERE ccr.id = $1`,
    [requestId]
  );
  if (!reqRow.rowCount) return res.status(404).json({ error: 'Request not found' });
  const r = reqRow.rows[0];
  if (r.status !== 'pending') return res.status(409).json({ error: 'Request is no longer pending' });

  const mine = await q(
    `SELECT decision FROM company_claim_cosigns
      WHERE request_id = $1 AND cosigner_id = $2`,
    [requestId, req.userId]
  );
  if (!mine.rowCount) return res.status(403).json({ error: 'You are not a cosigner on this request.' });
  if (mine.rows[0].decision !== 'pending') {
    return res.status(409).json({ error: 'You have already decided on this request.' });
  }

  const outcome = await tx(async (c) => {
    await c.query(
      `UPDATE company_claim_cosigns SET decision = $1, decided_at = NOW()
        WHERE request_id = $2 AND cosigner_id = $3`,
      [decision, requestId, req.userId]
    );

    if (decision !== 'confirm') return { granted: false };

    const { rows: cnt } = await c.query(
      `SELECT COUNT(*)::int AS n FROM company_claim_cosigns
        WHERE request_id = $1 AND decision = 'confirm'`,
      [requestId]
    );
    if (cnt[0].n < r.min_cosigns) return { granted: false, confirms: cnt[0].n };

    // Reached threshold — grant if company is still unclaimed.
    if (r.claimed_by) return { granted: false, confirms: cnt[0].n, raced: true };
    await c.query(`UPDATE companies SET claimed_by = $1 WHERE id = $2 AND claimed_by IS NULL`,
      [r.requester_id, r.company_id]);
    await c.query(
      `UPDATE company_claim_requests SET status = 'granted', granted_at = NOW() WHERE id = $1`,
      [requestId]
    );
    await c.query(
      `INSERT INTO notifications (user_id, kind, actor_id, subject_id, body)
         VALUES ($1, 'company_claim_granted', $2, $3, $4)`,
      [r.requester_id, req.userId, r.company_id,
       `confirmed your claim to ${r.company_name}. You are now its steward.`]
    );
    return { granted: true, confirms: cnt[0].n };
  });

  res.json({ ok: true, decision, ...outcome });
});

// GET /api/companies/:id/claim-state — current claim state for a company.
// Returns claimed_by user (if any), and the pending request with its cosigns
// (if any). Used by the claim modal + the work-history badge.
router.get('/companies/:id/claim-state', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const co = await q(
    `SELECT c.id, c.name, c.claimed_by,
            u.first_name AS steward_first, u.last_name AS steward_last
       FROM companies c LEFT JOIN users u ON u.id = c.claimed_by
      WHERE c.id = $1`,
    [id]
  );
  if (!co.rowCount) return res.status(404).json({ error: 'Company not found' });
  const row = co.rows[0];

  let claimed_by = null;
  if (row.claimed_by) {
    claimed_by = {
      id: row.claimed_by,
      name: `${row.steward_first || ''} ${row.steward_last || ''}`.trim(),
    };
  }

  let pending_request = null;
  if (!claimed_by) {
    const reqRow = await q(
      `SELECT ccr.id, ccr.requester_id, ccr.min_cosigns, ccr.created_at,
              ru.first_name AS req_first, ru.last_name AS req_last
         FROM company_claim_requests ccr JOIN users ru ON ru.id = ccr.requester_id
        WHERE ccr.company_id = $1 AND ccr.status = 'pending'
        ORDER BY ccr.created_at ASC LIMIT 1`,
      [id]
    );
    if (reqRow.rowCount) {
      const rr = reqRow.rows[0];
      const cs = await q(
        `SELECT ccc.cosigner_id, ccc.decision,
                u.first_name, u.last_name, u.avatar_tone, u.avatar_url
           FROM company_claim_cosigns ccc JOIN users u ON u.id = ccc.cosigner_id
          WHERE ccc.request_id = $1
          ORDER BY ccc.cosigner_id`,
        [rr.id]
      );
      const cosigns = cs.rows.map(c => ({
        user_id: c.cosigner_id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        avatar_urls: parseUrls(c.avatar_url),
        avatar_tone: c.avatar_tone,
        decision: c.decision,
      }));
      pending_request = {
        id: rr.id,
        requester: {
          id: rr.requester_id,
          name: `${rr.req_first || ''} ${rr.req_last || ''}`.trim(),
        },
        min_cosigns: rr.min_cosigns,
        confirms: cosigns.filter(c => c.decision === 'confirm').length,
        cosigns,
        created_at: rr.created_at,
      };
    }
  }

  res.json({ claimed_by, pending_request });
});

// GET /api/companies/:id/workers — Smith users with work-history at the
// company. Used by the claim modal to populate the cosigner picker.
// Excludes the caller (you can't cosign your own claim).
router.get('/companies/:id/workers', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const { rows } = await q(
    `SELECT DISTINCT u.id, u.first_name, u.last_name, u.avatar_tone, u.avatar_url,
            u.headline
       FROM work_history wh JOIN users u ON u.id = wh.user_id
      WHERE wh.company_id = $1 AND wh.user_id <> $2
      ORDER BY u.first_name ASC, u.last_name ASC`,
    [id, req.userId]
  );

  res.json({
    workers: rows.map(r => ({
      id: r.id,
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      initials: ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase(),
      headline: r.headline,
      avatar_tone: r.avatar_tone,
      avatar_urls: parseUrls(r.avatar_url),
    })),
  });
});

// GET /api/me/claim-requests — claim requests touching the current user.
// outgoing = pending requests this user filed
// incoming = pending requests where this user is a cosigner with decision='pending'
router.get('/me/claim-requests', requireAuth, async (req, res) => {
  const outP = q(
    `SELECT ccr.id, ccr.company_id, c.name AS company_name, ccr.min_cosigns, ccr.created_at,
            (SELECT COUNT(*)::int FROM company_claim_cosigns
              WHERE request_id = ccr.id AND decision = 'confirm') AS confirms
       FROM company_claim_requests ccr JOIN companies c ON c.id = ccr.company_id
      WHERE ccr.requester_id = $1 AND ccr.status = 'pending'
      ORDER BY ccr.created_at DESC`,
    [req.userId]
  );
  const inP = q(
    `SELECT ccr.id, ccr.company_id, c.name AS company_name, ccr.min_cosigns, ccr.created_at,
            ccr.requester_id, u.first_name AS req_first, u.last_name AS req_last,
            u.avatar_tone AS req_avatar_tone, u.avatar_url AS req_avatar_url
       FROM company_claim_cosigns ccc
       JOIN company_claim_requests ccr ON ccr.id = ccc.request_id
       JOIN companies c ON c.id = ccr.company_id
       JOIN users u ON u.id = ccr.requester_id
      WHERE ccc.cosigner_id = $1 AND ccc.decision = 'pending' AND ccr.status = 'pending'
      ORDER BY ccr.created_at DESC`,
    [req.userId]
  );
  const [out, inc] = await Promise.all([outP, inP]);
  res.json({
    outgoing: out.rows.map(r => ({
      id: r.id,
      company_id: r.company_id,
      company_name: r.company_name,
      min_cosigns: r.min_cosigns,
      confirms: r.confirms,
      created_at: r.created_at,
    })),
    incoming: inc.rows.map(r => ({
      id: r.id,
      company_id: r.company_id,
      company_name: r.company_name,
      min_cosigns: r.min_cosigns,
      requester: {
        id: r.requester_id,
        name: `${r.req_first || ''} ${r.req_last || ''}`.trim(),
        avatar_urls: parseUrls(r.req_avatar_url),
        avatar_tone: r.req_avatar_tone,
      },
      created_at: r.created_at,
    })),
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Company public profile
// ────────────────────────────────────────────────────────────────────────────

// GET /api/companies/:id/profile — read view of a company's page.
// Returns company fields + steward (if claimed) + crew (users with work-history
// here, with tenure derived from the work_history row) + jobsites attached to
// the company, with the signature jobsite split out for the hero block.
// is_steward tells the client whether to render edit affordances.
router.get('/companies/:id/profile', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const coP = q(
    `SELECT c.id, c.name, c.type, c.logo_tone, c.logo_url,
            c.tagline, c.founded_year, c.primary_location, c.about,
            c.signature_jobsite_id, c.claimed_by, c.created_at, c.updated_at,
            u.first_name AS steward_first, u.last_name AS steward_last,
            u.avatar_tone AS steward_avatar_tone, u.avatar_url AS steward_avatar_url
       FROM companies c LEFT JOIN users u ON u.id = c.claimed_by
      WHERE c.id = $1`,
    [id]
  );
  // Crew = anyone with a work_history row at this company. Tenure from
  // work_history's from_year/to_year. One row per user (collapsing multiple
  // tenures) keeps the crew list clean; we pick the latest by from_year.
  const crewP = q(
    `SELECT DISTINCT ON (u.id)
            u.id, u.first_name, u.last_name, u.avatar_tone, u.avatar_url, u.headline,
            wh.role, wh.from_year, wh.to_year, wh.is_current
       FROM work_history wh JOIN users u ON u.id = wh.user_id
      WHERE wh.company_id = $1
      ORDER BY u.id, wh.from_year DESC NULLS LAST, wh.id DESC`,
    [id]
  );
  // All jobsites attached to this company (via work-history). Used both for
  // the work feed and for the steward's signature-pick affordance.
  const jobsitesP = q(
    `SELECT js.id, js.title, js.structure_type, js.job_type, js.year,
            js.kind, js.location, js.duration, js.photo_kind, js.photo_url,
            js.is_featured, js.position, wh.user_id AS worker_id,
            wu.first_name AS worker_first, wu.last_name AS worker_last
       FROM jobsites js
       JOIN work_history wh ON wh.id = js.work_history_id
       JOIN users wu ON wu.id = wh.user_id
      WHERE wh.company_id = $1
      ORDER BY js.year DESC NULLS LAST, js.id DESC
      LIMIT 60`,
    [id]
  );

  const [co, crew, jobsites] = await Promise.all([coP, crewP, jobsitesP]);
  if (!co.rowCount) return res.status(404).json({ error: 'Company not found' });
  const c = co.rows[0];

  // Gallery photos for any jobsite shown here (signature + recent work).
  const jobsiteIds = jobsites.rows.map(j => j.id);
  let photosBySite = new Map();
  if (jobsiteIds.length) {
    const { rows: jp } = await q(
      `SELECT jobsite_id, photo_url, position
         FROM jobsite_photos
        WHERE jobsite_id = ANY($1::bigint[])
        ORDER BY position ASC, id ASC`,
      [jobsiteIds]
    );
    for (const p of jp) {
      if (!photosBySite.has(p.jobsite_id)) photosBySite.set(p.jobsite_id, []);
      photosBySite.get(p.jobsite_id).push({ urls: parseUrls(p.photo_url), position: p.position });
    }
  }

  const shapeJobsite = (j) => ({
    id: j.id,
    title: j.title,
    structure_type: j.structure_type,
    job_type: j.job_type,
    year: j.year,
    kind: j.kind,
    location: j.location,
    duration: j.duration,
    photo_kind: j.photo_kind,
    photo_urls: parseUrls(j.photo_url),
    photos: photosBySite.get(j.id) || [],
    worker: {
      id: j.worker_id,
      name: `${j.worker_first || ''} ${j.worker_last || ''}`.trim(),
    },
  });

  const signature = c.signature_jobsite_id
    ? jobsites.rows.find(j => j.id === c.signature_jobsite_id)
    : null;
  const recent = jobsites.rows.filter(j => j.id !== c.signature_jobsite_id).slice(0, 12);

  res.json({
    company: {
      id: c.id,
      name: c.name,
      type: c.type,
      logo_tone: c.logo_tone,
      logo_urls: parseUrls(c.logo_url),
      tagline: c.tagline,
      founded_year: c.founded_year,
      primary_location: c.primary_location,
      about: c.about,
      created_at: c.created_at,
      updated_at: c.updated_at,
    },
    steward: c.claimed_by ? {
      id: c.claimed_by,
      name: `${c.steward_first || ''} ${c.steward_last || ''}`.trim(),
      avatar_urls: parseUrls(c.steward_avatar_url),
      avatar_tone: c.steward_avatar_tone,
    } : null,
    is_steward: c.claimed_by === req.userId,
    crew: crew.rows.map(u => ({
      id: u.id,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
      initials: ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase(),
      avatar_urls: parseUrls(u.avatar_url),
      avatar_tone: u.avatar_tone,
      headline: u.headline,
      role: u.role,
      from_year: u.from_year,
      to_year: u.to_year,
      is_current: u.is_current,
    })),
    signature_jobsite: signature ? shapeJobsite(signature) : null,
    recent_work: recent.map(shapeJobsite),
  });
});

// PATCH /api/companies/:id — steward-only updates to the company profile.
// Allowed fields: name, type, tagline, founded_year, primary_location, about,
// signature_jobsite_id. Logo upload is a separate endpoint (POST /photos/company/:id/logo).
router.patch('/companies/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  // Steward gate.
  const own = await q(
    `SELECT claimed_by FROM companies WHERE id = $1`,
    [id]
  );
  if (!own.rowCount) return res.status(404).json({ error: 'Company not found' });
  if (own.rows[0].claimed_by !== req.userId) {
    return res.status(403).json({ error: 'Only the steward can edit this company.' });
  }

  const body = req.body || {};
  const sets = [];
  const params = [];
  const push = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

  if ('name' in body) {
    const v = String(body.name || '').trim();
    if (!v) return res.status(400).json({ error: 'name cannot be empty' });
    push('name', v);
  }
  if ('type' in body) {
    push('type', body.type == null ? null : String(body.type).trim());
  }
  if ('tagline' in body) {
    push('tagline', body.tagline == null ? null : String(body.tagline).trim().slice(0, 280));
  }
  if ('founded_year' in body) {
    const v = body.founded_year;
    if (v === null || v === '') {
      push('founded_year', null);
    } else {
      const n = parseInt(v, 10);
      if (!Number.isFinite(n) || n < 1700 || n > 2200) {
        return res.status(400).json({ error: 'founded_year must be a reasonable year' });
      }
      push('founded_year', n);
    }
  }
  if ('primary_location' in body) {
    push('primary_location', body.primary_location == null ? null : String(body.primary_location).trim());
  }
  if ('about' in body) {
    push('about', body.about == null ? null : String(body.about));
  }
  if ('signature_jobsite_id' in body) {
    if (body.signature_jobsite_id == null) {
      push('signature_jobsite_id', null);
    } else {
      const sjid = parseInt(body.signature_jobsite_id, 10);
      if (!Number.isFinite(sjid)) {
        return res.status(400).json({ error: 'signature_jobsite_id must be a number or null' });
      }
      // The pinned jobsite must belong to a worker at this company.
      const valid = await q(
        `SELECT 1 FROM jobsites js
           JOIN work_history wh ON wh.id = js.work_history_id
          WHERE js.id = $1 AND wh.company_id = $2 LIMIT 1`,
        [sjid, id]
      );
      if (!valid.rowCount) {
        return res.status(400).json({ error: 'signature jobsite must belong to this company' });
      }
      push('signature_jobsite_id', sjid);
    }
  }

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  await q(`UPDATE companies SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  res.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────────────
// Work history (a tenure at a company)
// ────────────────────────────────────────────────────────────────────────────

// POST /api/work-history
// Body: { company_id, role, from_year, to_year?, is_current?, jobsites?: [{title,kind,location,duration,photo_kind}] }
router.post('/work-history', requireAuth, async (req, res) => {
  const { company_id, role, from_year, to_year, is_current, jobsites = [] } = req.body || {};
  if (!company_id || !role || !from_year)
    return res.status(400).json({ error: 'company_id, role, from_year required' });

  const result = await tx(async (c) => {
    const { rows: pos } = await c.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM work_history WHERE user_id = $1`,
      [req.userId]
    );
    const { rows } = await c.query(
      `INSERT INTO work_history (user_id, company_id, role, from_year, to_year, is_current, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.userId, company_id, role, String(from_year), to_year ? String(to_year) : null,
       !!is_current, pos[0].next]
    );
    const whId = rows[0].id;
    for (let i = 0; i < jobsites.length; i++) {
      const js = jobsites[i] || {};
      if (!js.title) continue;
      const yr = (js.year === '' || js.year == null) ? null : (parseInt(js.year, 10) || null);
      await c.query(
        `INSERT INTO jobsites
           (work_history_id, title, structure_type, job_type, year, kind, location, duration, photo_kind, position)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [whId, js.title, js.structure_type || '', js.job_type || '', yr,
         js.kind || '', js.location || '', js.duration || '', js.photo_kind || 'frame', i]
      );
    }
    return whId;
  });

  res.status(201).json({ work_history_id: result });
});

router.delete('/work-history/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = await q(
    `DELETE FROM work_history WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// POST /api/work-history/:id/jobsites — append a jobsite
//
// New schema fields: structure_type, job_type, year. The legacy freeform
// `kind` / `duration` are still accepted (for any old client) but optional;
// new clients send the structured fields instead.
router.post('/work-history/:id/jobsites', requireAuth, async (req, res) => {
  const whId = parseInt(req.params.id, 10);
  const {
    title, structure_type = '', job_type = '', year = null,
    kind = '', location = '', duration = '', photo_kind = 'frame', is_featured = false,
  } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });

  // year is a single integer (e.g. 2024); coerce empty/invalid to NULL.
  const yr = (year === '' || year == null) ? null : (parseInt(year, 10) || null);

  // Verify the work-history row belongs to this user.
  const { rows: own } = await q(
    `SELECT id FROM work_history WHERE id = $1 AND user_id = $2`,
    [whId, req.userId]
  );
  if (!own.length) return res.status(404).json({ error: 'Not found' });

  const { rows: pos } = await q(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM jobsites WHERE work_history_id = $1`,
    [whId]
  );
  const { rows } = await q(
    `INSERT INTO jobsites
       (work_history_id, title, structure_type, job_type, year, kind, location, duration, photo_kind, is_featured, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, title, structure_type, job_type, year, kind, location, duration,
                 photo_kind, photo_url, is_featured, position`,
    [whId, title, structure_type, job_type, yr, kind, location, duration, photo_kind, !!is_featured, pos[0].next]
  );
  const j = rows[0];
  res.status(201).json({
    jobsite: {
      id: j.id,
      title: j.title,
      structure_type: j.structure_type,
      job_type: j.job_type,
      year: j.year,
      kind: j.kind,
      location: j.location,
      duration: j.duration,
      photo_kind: j.photo_kind,
      photo_urls: parseUrls(j.photo_url),
      photos: [],
      is_featured: j.is_featured,
      position: j.position,
    },
  });
});

router.delete('/jobsites/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = await q(
    `DELETE FROM jobsites js USING work_history wh
       WHERE js.id = $1 AND js.work_history_id = wh.id AND wh.user_id = $2`,
    [id, req.userId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// PATCH /api/jobsites/:id — toggle featured, edit fields
router.patch('/jobsites/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const allowed = [
    'title', 'structure_type', 'job_type', 'year',
    'kind', 'location', 'duration', 'photo_kind', 'is_featured',
  ];
  const updates = {};
  for (const k of allowed) if (k in (req.body || {})) updates[k] = req.body[k];
  // year is an integer column; coerce empty string / invalid to NULL.
  if ('year' in updates) {
    updates.year = (updates.year === '' || updates.year == null)
      ? null : (parseInt(updates.year, 10) || null);
  }
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No fields to update' });

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`);
  const vals = [id, req.userId, ...Object.values(updates)];
  const r = await q(
    `UPDATE jobsites js SET ${sets.join(', ')}
       FROM work_history wh
      WHERE js.id = $1 AND js.work_history_id = wh.id AND wh.user_id = $2
      RETURNING js.id`,
    vals
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
