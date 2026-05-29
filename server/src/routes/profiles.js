// Smith — Profile routes
// Endpoints:
//   GET    /api/profiles/me            — full profile object for the signed-in user
//   GET    /api/profiles/:id           — public profile of any user (incl. self)
//   PATCH  /api/profiles/me            — edit header fields
//   POST   /api/profiles/me/trades     — replace trade list (atomic)
//   POST   /api/profiles/me/licenses   — add a license
//   DELETE /api/profiles/me/licenses/:lid
//   POST   /api/profiles/me/skills     — replace skill list
//   POST   /api/profiles/me/skills/:sid/endorse
//   GET    /api/profiles/me/strength   — % complete + checklist
//
// Patch B: jobsite rows now carry photo_urls (when uploaded); company rows
// in work_history carry company_logo_urls (when uploaded). The frontend
// prefers uploaded photos and falls back to placeholder photo_kind / logo_tone.

import { Router } from 'express';
import multer from 'multer';
import { q, tx } from '../db.js';
import { requireAuth } from '../middleware.js';
import { deleteDocFile } from './credential-docs.js';
import { publicUrl } from '../storage.js';
import { parseResumeBuffer } from '../resume-parse.js';

const router = Router();

// PDF resume upload — kept separate from photos.js's multer instance so the
// limits (10 MB for a PDF) and field name ("file") stay local to this route.
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// avatar_url, cover_url, jobsite photo_url, company logo_url are all stored
// as JSON strings like { "thumb": "<key>", ... }. parseUrls() turns that
// into { thumb, medium, full } of URLs the frontend can render.
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

async function loadProfile(userId, viewerId) {
  const userP = q(
    `SELECT id, email, email_verified, first_name, last_name, headline, location, about,
            avatar_tone, cover_kind, avatar_url, cover_url, verified_smith, years_experience,
            union_name, union_member_since, apprentice_hours, apprentice_required, apprentice_status,
            insurance_carrier, insurance_limit, insurance_verified,
            insurance_doc_url, insurance_doc_mime, insurance_share_public,
            onboarding_step, onboarding_done
       FROM users WHERE id = $1`,
    [userId]
  );
  const tradesP = q(
    `SELECT t.id, t.name, t.icon, ut.years, ut.position
       FROM user_trades ut JOIN trades t ON t.id = ut.trade_id
      WHERE ut.user_id = $1 ORDER BY ut.position ASC`,
    [userId]
  );
  const licensesP = q(
    `SELECT id, name, number, expiration, verified, position,
            doc_url, doc_mime, share_public
       FROM licenses WHERE user_id = $1 ORDER BY position ASC, id ASC`,
    [userId]
  );
  // Pull company.logo_url so the work-history card can render an uploaded logo.
  const workP = q(
    `SELECT wh.id, wh.role, wh.from_year, wh.to_year, wh.is_current, wh.position,
            c.id as company_id, c.name as company_name, c.type as company_type,
            c.logo_tone as company_logo_tone,
            c.logo_url  as company_logo_url,
            c.claimed_by IS NOT NULL as company_claimed
       FROM work_history wh JOIN companies c ON c.id = wh.company_id
      WHERE wh.user_id = $1
      ORDER BY wh.position ASC, wh.id DESC`,
    [userId]
  );
  // Include jobsite.photo_url so cards can render the primary photo, plus the
  // new structured fields (structure_type / job_type / year). kind + duration
  // are kept for backward-compatible display of pre-refactor rows.
  const jobsitesP = q(
    `SELECT js.id, js.work_history_id, js.title, js.kind, js.location, js.duration,
            js.structure_type, js.job_type, js.year,
            js.photo_kind, js.photo_url, js.is_featured, js.position
       FROM jobsites js JOIN work_history wh ON wh.id = js.work_history_id
      WHERE wh.user_id = $1
      ORDER BY js.position ASC, js.id ASC`,
    [userId]
  );
  // Full photo gallery for every jobsite owned by this user, ordered so the
  // primary (lowest position) comes first. Stitched into each jobsite as
  // photos[]; jobsites.photo_url still mirrors the primary for legacy reads.
  const jobsitePhotosP = q(
    `SELECT jp.id, jp.jobsite_id, jp.photo_url, jp.position
       FROM jobsite_photos jp
       JOIN jobsites js ON js.id = jp.jobsite_id
       JOIN work_history wh ON wh.id = js.work_history_id
      WHERE wh.user_id = $1
      ORDER BY jp.position ASC, jp.id ASC`,
    [userId]
  );
  const skillsP = q(
    `SELECT s.id, s.name, s.level, s.position,
            (SELECT COUNT(*)::int FROM skill_endorsements WHERE skill_id = s.id) AS endorsements,
            EXISTS (
              SELECT 1 FROM skill_endorsements
               WHERE skill_id = s.id AND endorser_id = $2
            ) AS endorsed_by_me
       FROM skills s WHERE s.user_id = $1
      ORDER BY s.position ASC`,
    [userId, viewerId || 0]
  );
  const networkSizeP = q(
    `SELECT COUNT(*)::int AS n FROM connections
      WHERE status = 'accepted' AND (user_a_id = $1 OR user_b_id = $1)`,
    [userId]
  );

  let connection = null;
  if (viewerId && viewerId !== userId) {
    const [a, b] = viewerId < userId ? [viewerId, userId] : [userId, viewerId];
    const r = await q(
      `SELECT status, requested_by FROM connections WHERE user_a_id = $1 AND user_b_id = $2`,
      [a, b]
    );
    if (r.rows.length) connection = r.rows[0];
  }

  const [user, trades, licenses, work, jobsites, jobsitePhotos, skills, networkSize] = await Promise.all([
    userP, tradesP, licensesP, workP, jobsitesP, jobsitePhotosP, skillsP, networkSizeP,
  ]);

  // Group gallery photos by jobsite (already ordered by position).
  const photosByJobsite = new Map();
  for (const p of jobsitePhotos.rows) {
    if (!photosByJobsite.has(p.jobsite_id)) photosByJobsite.set(p.jobsite_id, []);
    photosByJobsite.get(p.jobsite_id).push({
      id: p.id,
      urls: parseUrls(p.photo_url),
      position: p.position,
    });
  }

  if (!user.rows.length) return null;
  const u = user.rows[0];

  // Stitch jobsites into their work_history entries. Each jobsite gets
  // photo_urls; each work_history row gets company_logo_urls.
  const workById = new Map(work.rows.map(w => [w.id, {
    ...w,
    company_logo_urls: parseUrls(w.company_logo_url),
    jobsites: [],
  }]));
  for (const js of jobsites.rows) {
    if (workById.has(js.work_history_id)) {
      workById.get(js.work_history_id).jobsites.push({
        id: js.id,
        work_history_id: js.work_history_id,
        title: js.title,
        kind: js.kind,
        location: js.location,
        duration: js.duration,
        structure_type: js.structure_type,
        job_type: js.job_type,
        year: js.year,
        photo_kind: js.photo_kind,
        photo_urls: parseUrls(js.photo_url),
        photos: photosByJobsite.get(js.id) || [],
        is_featured: js.is_featured,
        position: js.position,
      });
    }
  }

  return {
    id: u.id,
    email: viewerId === userId ? u.email : undefined,
    name: `${u.first_name} ${u.last_name}`.trim() || 'Unnamed',
    initials: ((u.first_name[0] || '') + (u.last_name[0] || '')).toUpperCase() || 'U',
    first_name: u.first_name,
    last_name: u.last_name,
    headline: u.headline,
    location: u.location,
    about: u.about,
    avatar_tone: u.avatar_tone,
    cover_kind: u.cover_kind,
    avatar_urls: parseUrls(u.avatar_url),
    cover_urls:  parseUrls(u.cover_url),
    verified_smith: u.verified_smith,
    years_experience: u.years_experience,
    union: u.union_name ? {
      name: u.union_name,
      since: u.union_member_since,
    } : null,
    apprentice: {
      hours: u.apprentice_hours,
      required: u.apprentice_required,
      status: u.apprentice_status,
    },
    insurance: u.insurance_carrier ? (() => {
      const isOwner = !!viewerId && viewerId === userId;
      const showDoc = isOwner || u.insurance_share_public;
      return {
        carrier: u.insurance_carrier,
        limit: u.insurance_limit,
        verified: u.insurance_verified,
        share_public: u.insurance_share_public,
        doc_url: (showDoc && u.insurance_doc_url) ? `/api/credential-docs/${u.insurance_doc_url}` : null,
        doc_mime: showDoc ? u.insurance_doc_mime : null,
        has_doc: !!u.insurance_doc_url && (isOwner || u.insurance_share_public),
      };
    })() : null,
    onboarding: {
      step: u.onboarding_step,
      done: u.onboarding_done,
    },
    trades: trades.rows,
    // Patch C: Public viewers only see licenses that have an uploaded doc.
    // Owners see everything (the missing-doc rows are the user's "fill me in"
    // checklist in Edit Profile). This makes the public profile credentials
    // section read as "credentials with proof attached", not "checklist of
    // claimed credentials". A license without a doc is essentially unbacked.
    licenses: licenses.rows
      .filter(l => {
        const isOwner = !!viewerId && viewerId === userId;
        return isOwner || !!l.doc_url;
      })
      .map(l => {
      const isOwner = !!viewerId && viewerId === userId;
      const showDoc = isOwner || l.share_public;
      return {
        id: l.id,
        name: l.name,
        number: l.number,
        expiration: l.expiration,
        verified: l.verified,
        position: l.position,
        share_public: l.share_public,
        doc_url: (showDoc && l.doc_url) ? `/api/credential-docs/${l.doc_url}` : null,
        doc_mime: showDoc ? l.doc_mime : null,
        has_doc: !!l.doc_url && (isOwner || l.share_public),
      };
    }),
    work_history: [...workById.values()].sort((a, b) => a.position - b.position),
    skills: skills.rows,
    network_size: networkSize.rows[0].n,
    connection,
  };
}

router.get('/me', requireAuth, async (req, res) => {
  const profile = await loadProfile(req.userId, req.userId);
  if (!profile) return res.status(404).json({ error: 'Not found' });
  res.json({ profile });
});

router.get('/:id', requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid id' });
  const profile = await loadProfile(targetId, req.userId);
  if (!profile) return res.status(404).json({ error: 'Not found' });
  res.json({ profile });
});

router.patch('/me', requireAuth, async (req, res) => {
  const allowed = [
    'first_name', 'last_name', 'headline', 'location', 'about',
    'avatar_tone', 'cover_kind', 'years_experience',
    'union_name', 'union_member_since',
    'apprentice_hours', 'apprentice_required', 'apprentice_status',
    'insurance_carrier', 'insurance_limit',
    'insurance_doc_url', 'insurance_doc_mime', 'insurance_share_public',
    'onboarding_step', 'onboarding_done',
  ];
  const updates = {};
  for (const k of allowed) if (k in (req.body || {})) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No fields to update' });

  let oldInsDoc = null;
  if ('insurance_doc_url' in updates) {
    const cur = await q(`SELECT insurance_doc_url FROM users WHERE id = $1`, [req.userId]);
    oldInsDoc = cur.rows[0]?.insurance_doc_url;
    updates.insurance_doc_uploaded_at = updates.insurance_doc_url ? new Date() : null;
  }

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
  const vals = [req.userId, ...Object.values(updates)];
  await q(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, vals);

  if (oldInsDoc && oldInsDoc !== updates.insurance_doc_url) {
    deleteDocFile(oldInsDoc, req.userId);
  }

  const profile = await loadProfile(req.userId, req.userId);
  res.json({ profile });
});

router.post('/me/trades', requireAuth, async (req, res) => {
  const list = Array.isArray(req.body?.trades) ? req.body.trades.slice(0, 6) : [];
  await tx(async (c) => {
    await c.query('DELETE FROM user_trades WHERE user_id = $1', [req.userId]);
    for (let i = 0; i < list.length; i++) {
      const { name, years = 0 } = list[i] || {};
      if (!name) continue;
      let { rows } = await c.query('SELECT id FROM trades WHERE LOWER(name) = LOWER($1)', [name]);
      let tradeId = rows[0]?.id;
      if (!tradeId) {
        const ins = await c.query(
          'INSERT INTO trades (name, icon) VALUES ($1, $2) RETURNING id',
          [name, 'tool']
        );
        tradeId = ins.rows[0].id;
      }
      await c.query(
        `INSERT INTO user_trades (user_id, trade_id, years, position)
           VALUES ($1,$2,$3,$4)`,
        [req.userId, tradeId, Math.max(0, parseInt(years, 10) || 0), i]
      );
    }
  });
  const profile = await loadProfile(req.userId, req.userId);
  res.json({ profile });
});

router.post('/me/licenses', requireAuth, async (req, res) => {
  const {
    name, number, expiration, verified = false,
    doc_url = null, doc_mime = null, share_public = false,
  } = req.body || {};
  if (!name || !number || !expiration)
    return res.status(400).json({ error: 'name, number, expiration required' });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(expiration))
    return res.status(400).json({ error: 'expiration must be YYYY-MM' });

  const { rows: pos } = await q(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM licenses WHERE user_id = $1`,
    [req.userId]
  );
  const docUploadedAt = doc_url ? new Date() : null;
  const { rows } = await q(
    `INSERT INTO licenses (user_id, name, number, expiration, verified, position,
                           doc_url, doc_mime, doc_uploaded_at, share_public)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, name, number, expiration, verified, position,
                 doc_url, doc_mime, share_public`,
    [req.userId, name, number, expiration, !!verified, pos[0].next,
     doc_url, doc_mime, docUploadedAt, !!share_public]
  );
  res.status(201).json({ license: rows[0] });
});

router.patch('/me/licenses/:lid', requireAuth, async (req, res) => {
  const lid = parseInt(req.params.lid, 10);
  if (!Number.isFinite(lid)) return res.status(400).json({ error: 'Invalid id' });

  const cur = await q(
    `SELECT doc_url FROM licenses WHERE id = $1 AND user_id = $2`,
    [lid, req.userId]
  );
  if (!cur.rows.length) return res.status(404).json({ error: 'Not found' });
  const oldDoc = cur.rows[0].doc_url;

  const allowed = ['name', 'number', 'expiration', 'doc_url', 'doc_mime', 'share_public'];
  const updates = {};
  for (const k of allowed) if (k in (req.body || {})) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No fields to update' });

  if ('doc_url' in updates) updates.doc_uploaded_at = updates.doc_url ? new Date() : null;

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`);
  const vals = [lid, req.userId, ...Object.values(updates)];
  await q(
    `UPDATE licenses SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2`,
    vals
  );

  if ('doc_url' in updates && oldDoc && oldDoc !== updates.doc_url) {
    deleteDocFile(oldDoc, req.userId);
  }

  res.json({ ok: true });
});

router.delete('/me/licenses/:lid', requireAuth, async (req, res) => {
  const lid = parseInt(req.params.lid, 10);
  if (!Number.isFinite(lid)) return res.status(400).json({ error: 'Invalid id' });
  const cur = await q(
    `SELECT doc_url FROM licenses WHERE id = $1 AND user_id = $2`,
    [lid, req.userId]
  );
  const r = await q(`DELETE FROM licenses WHERE id = $1 AND user_id = $2`, [lid, req.userId]);
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  if (cur.rows[0]?.doc_url) deleteDocFile(cur.rows[0].doc_url, req.userId);
  res.json({ ok: true });
});

router.post('/me/skills', requireAuth, async (req, res) => {
  const list = Array.isArray(req.body?.skills) ? req.body.skills : [];
  await tx(async (c) => {
    await c.query('DELETE FROM skills WHERE user_id = $1', [req.userId]);
    for (let i = 0; i < list.length; i++) {
      const { name, level = 3 } = list[i] || {};
      if (!name) continue;
      const lv = Math.max(1, Math.min(5, parseInt(level, 10) || 3));
      await c.query(
        `INSERT INTO skills (user_id, name, level, position) VALUES ($1,$2,$3,$4)`,
        [req.userId, name, lv, i]
      );
    }
  });
  const profile = await loadProfile(req.userId, req.userId);
  res.json({ profile });
});

router.post('/:id/skills/:sid/endorse', requireAuth, async (req, res) => {
  const sid = parseInt(req.params.sid, 10);
  if (!Number.isFinite(sid)) return res.status(400).json({ error: 'Invalid skill id' });

  const skillRes = await q(
    `SELECT s.id, s.name, s.user_id AS owner_id
       FROM skills s WHERE s.id = $1`,
    [sid]
  );
  if (!skillRes.rows.length) return res.status(404).json({ error: 'Skill not found' });
  const skill = skillRes.rows[0];

  if (skill.owner_id === req.userId) {
    return res.status(400).json({ error: 'Cannot endorse your own skills' });
  }

  const ins = await q(
    `INSERT INTO skill_endorsements (skill_id, endorser_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING skill_id`,
    [sid, req.userId]
  );

  if (ins.rowCount > 0) {
    await q(
      `INSERT INTO notifications (user_id, kind, actor_id, subject_id, body)
         VALUES ($1, 'skill_endorse', $2, $3, $4)`,
      [skill.owner_id, req.userId, sid, `endorsed you for ${skill.name}`]
    );
  }

  const count = await q(
    `SELECT COUNT(*)::int AS n FROM skill_endorsements WHERE skill_id = $1`,
    [sid]
  );
  res.json({ ok: true, endorsed_by_me: true, endorsements: count.rows[0].n });
});

router.delete('/:id/skills/:sid/endorse', requireAuth, async (req, res) => {
  const sid = parseInt(req.params.sid, 10);
  if (!Number.isFinite(sid)) return res.status(400).json({ error: 'Invalid skill id' });

  await q(
    `DELETE FROM skill_endorsements WHERE skill_id = $1 AND endorser_id = $2`,
    [sid, req.userId]
  );

  const count = await q(
    `SELECT COUNT(*)::int AS n FROM skill_endorsements WHERE skill_id = $1`,
    [sid]
  );
  res.json({ ok: true, endorsed_by_me: false, endorsements: count.rows[0].n });
});

router.get('/:id/skills/:sid/endorsers', requireAuth, async (req, res) => {
  const sid = parseInt(req.params.sid, 10);
  if (!Number.isFinite(sid)) return res.status(400).json({ error: 'Invalid skill id' });

  const { rows } = await q(
    `SELECT u.id, u.first_name, u.last_name, u.headline, u.avatar_tone,
            se.created_at
       FROM skill_endorsements se
       JOIN users u ON u.id = se.endorser_id
      WHERE se.skill_id = $1
      ORDER BY se.created_at DESC`,
    [sid]
  );

  res.json({
    endorsers: rows.map(r => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name}`.trim(),
      initials: ((r.first_name[0] || '') + (r.last_name[0] || '')).toUpperCase(),
      headline: r.headline,
      avatar_tone: r.avatar_tone,
      created_at: r.created_at,
    })),
  });
});

// ════════════════════════════════════════════════════════════════════════
// RESUME / PROFILE GENERATION (Jobs module — phase 1)
// ════════════════════════════════════════════════════════════════════════
//
// Three surfaces:
//   1. POST /me/resume/parse     — upload a PDF, get a pre-fill (no writes)
//   2. POST /me/interview/step   — incremental save per section
//   3. GET  /me/resume           — render the profile as a printable resume
//   4. GET  /me/completeness     — outcome-linked unlocks (NOT a vanity %)
//
// Writes go into the existing work_history / companies / user_trades / skills
// / licenses / users tables — no migration needed for phase 1.

// 1) Upload a resume PDF → return parsed pre-fill (does not persist).
router.post('/me/resume/parse', requireAuth, (req, res, next) => {
  resumeUpload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'PDF too large (10 MB max).'
        : (err.message || 'Upload failed.');
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    next();
  });
}, async (req, res) => {
  try {
    const parsed = await parseResumeBuffer(req.file.buffer);
    res.json({ prefill: parsed });
  } catch (e) {
    const status = e.status || 500;
    const msg = e.publicMessage || e.message || 'Could not parse resume';
    console.error('[resume/parse]', e);
    res.status(status).json({ error: msg });
  }
});

// 2) Interview step — accept one section at a time so the wizard can save as
// the user advances. Body: { step: 'header'|'trades'|'skills'|'licenses'|'work_history', data: {...} }
// Each step is idempotent for re-runs (trades/skills replace; licenses +
// work_history append, deduping companies by name).
router.post('/me/interview/step', requireAuth, async (req, res) => {
  const { step, data } = req.body || {};
  if (!step || typeof data !== 'object' || data === null) {
    return res.status(400).json({ error: 'step and data required' });
  }

  try {
    switch (step) {
      case 'header': {
        const allowed = ['first_name', 'last_name', 'headline', 'about', 'location', 'years_experience'];
        const updates = {};
        for (const k of allowed) if (k in data) updates[k] = data[k];
        if (Object.keys(updates).length === 0) break;
        const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
        const vals = [req.userId, ...Object.values(updates)];
        await q(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, vals);
        break;
      }

      case 'trades': {
        // Same shape as POST /me/trades: replace the user's trade list atomically.
        const list = Array.isArray(data.trades) ? data.trades.slice(0, 6) : [];
        await tx(async (c) => {
          await c.query('DELETE FROM user_trades WHERE user_id = $1', [req.userId]);
          for (let i = 0; i < list.length; i++) {
            const { name, years = 0 } = list[i] || {};
            if (!name) continue;
            let { rows } = await c.query('SELECT id FROM trades WHERE LOWER(name) = LOWER($1)', [name]);
            let tradeId = rows[0]?.id;
            if (!tradeId) {
              const ins = await c.query(
                'INSERT INTO trades (name, icon) VALUES ($1, $2) RETURNING id',
                [name, 'tool']
              );
              tradeId = ins.rows[0].id;
            }
            await c.query(
              `INSERT INTO user_trades (user_id, trade_id, years, position) VALUES ($1,$2,$3,$4)`,
              [req.userId, tradeId, Math.max(0, parseInt(years, 10) || 0), i]
            );
          }
        });
        break;
      }

      case 'skills': {
        const list = Array.isArray(data.skills) ? data.skills : [];
        await tx(async (c) => {
          await c.query('DELETE FROM skills WHERE user_id = $1', [req.userId]);
          for (let i = 0; i < list.length; i++) {
            const { name, level = 3 } = list[i] || {};
            if (!name) continue;
            const lv = Math.max(1, Math.min(5, parseInt(level, 10) || 3));
            await c.query(
              `INSERT INTO skills (user_id, name, level, position) VALUES ($1,$2,$3,$4)`,
              [req.userId, name, lv, i]
            );
          }
        });
        break;
      }

      case 'licenses': {
        // Append (don't replace) — the user may have manually added licenses
        // already. Each license must have name/number/expiration; we ignore
        // malformed rows rather than rejecting the whole batch.
        const list = Array.isArray(data.licenses) ? data.licenses : [];
        await tx(async (c) => {
          for (const lic of list) {
            const { name, number, expiration } = lic || {};
            if (!name || !number || !expiration) continue;
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(expiration)) continue;
            const { rows: pos } = await c.query(
              `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM licenses WHERE user_id = $1`,
              [req.userId]
            );
            await c.query(
              `INSERT INTO licenses (user_id, name, number, expiration, verified, position)
                 VALUES ($1,$2,$3,$4,FALSE,$5)`,
              [req.userId, name, number, expiration, pos[0].next]
            );
          }
        });
        break;
      }

      case 'work_history': {
        // Append work_history rows. Each entry needs a company name; we
        // find-or-create the company (case-insensitive) so the same employer
        // referenced in two parses doesn't duplicate.
        const list = Array.isArray(data.work_history) ? data.work_history : [];
        await tx(async (c) => {
          for (let i = 0; i < list.length; i++) {
            const row = list[i] || {};
            const { company_name, role, from_year, to_year = '', is_current = false } = row;
            if (!company_name || !role || !from_year) continue;

            let { rows } = await c.query(
              `SELECT id FROM companies WHERE LOWER(name) = LOWER($1) LIMIT 1`,
              [company_name]
            );
            let companyId = rows[0]?.id;
            if (!companyId) {
              const ins = await c.query(
                `INSERT INTO companies (name, type, created_by) VALUES ($1, $2, $3) RETURNING id`,
                [company_name, 'General Contractor', req.userId]
              );
              companyId = ins.rows[0].id;
            }

            const { rows: pos } = await c.query(
              `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM work_history WHERE user_id = $1`,
              [req.userId]
            );
            await c.query(
              `INSERT INTO work_history (user_id, company_id, role, from_year, to_year, is_current, position)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [req.userId, companyId, role, String(from_year), is_current ? null : (to_year || null), !!is_current, pos[0].next]
            );
          }
        });
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown step: ${step}` });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[interview/step]', e);
    res.status(500).json({ error: e.message || 'Could not save step' });
  }
});

// 3) Resume render (HTML). Browser print → PDF. Defer real server-side PDF
// generation (puppeteer/pdfkit) to a later phase; HTML covers the case.
router.get('/me/resume', requireAuth, async (req, res) => {
  const profile = await loadProfile(req.userId, req.userId);
  if (!profile) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderResumeHtml(profile));
});

// 4) Completeness — outcome-linked unlocks. Distinct from /me/strength's
// vanity %: each item names a real product feature the user gets when done.
router.get('/me/completeness', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT
       (SELECT COUNT(*) FROM user_trades WHERE user_id = $1)::int AS trades,
       (SELECT COUNT(*) FROM licenses WHERE user_id = $1)::int AS licenses,
       (SELECT COUNT(*) FROM licenses WHERE user_id = $1 AND doc_url IS NOT NULL)::int AS licenses_with_doc,
       (SELECT COUNT(*) FROM work_history WHERE user_id = $1)::int AS work_history,
       (SELECT COUNT(*) FROM skills WHERE user_id = $1)::int AS skills,
       (SELECT COUNT(*) FROM jobsites js
          JOIN work_history wh ON wh.id = js.work_history_id WHERE wh.user_id = $1)::int AS jobsites`,
    [req.userId]
  );
  const c = rows[0];
  const { rows: u } = await q(
    `SELECT headline, about, location FROM users WHERE id = $1`,
    [req.userId]
  );
  const me = u[0] || {};
  const hasHeadline = !!(me.headline && me.headline.trim());
  const hasAbout    = !!(me.about && me.about.trim());
  const hasLocation = !!(me.location && me.location.trim());

  const unlocks = [
    {
      id: 'searchable',
      title: 'Show up in tradesman search',
      need: 'Headline + at least one trade',
      done: hasHeadline && c.trades >= 1,
      cta: hasHeadline ? 'Add your trade' : 'Add your headline',
    },
    {
      id: 'verified_badge',
      title: 'Verified badge on your profile',
      need: 'Attach proof to a credential',
      done: c.licenses_with_doc >= 1,
      cta: c.licenses >= 1 ? 'Upload a license doc' : 'Add a credential',
    },
    {
      id: 'resume_ready',
      title: 'Generate your Smith resume',
      need: 'Headline, about, location, ≥1 trade, ≥1 role',
      done: hasHeadline && hasAbout && hasLocation && c.trades >= 1 && c.work_history >= 1,
      cta: !hasAbout ? 'Write your about section' :
           !hasLocation ? 'Add your location' :
           c.work_history < 1 ? 'Add a role' : 'Review your resume',
    },
    {
      id: 'hire_me_ready',
      title: 'Your Hire Me page looks complete',
      need: '2+ projects with photos, headline + about',
      done: hasHeadline && hasAbout && c.jobsites >= 2,
      cta: c.jobsites < 2 ? `Add ${2 - c.jobsites} more project${c.jobsites === 1 ? '' : 's'}` : 'Polish your profile',
    },
  ];

  res.json({ unlocks });
});

// ── Resume HTML renderer (server-side template) ──────────────────────────
// Plain HTML + inline styles so it prints cleanly without external assets.
// Not pretty-pixel-perfect — it's a working resume the user can browser-print.
function renderResumeHtml(p) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const trades = (p.trades || []).map(t => esc(t.name) + (t.years ? ` (${t.years}y)` : '')).join(' · ');
  const skills = (p.skills || []).map(s => esc(s.name)).join(' · ');
  const work = (p.work_history || []).map(w => {
    const jobsites = (w.jobsites || []).map(j => `<li>${esc(j.title)}${j.location ? ` — ${esc(j.location)}` : ''}${j.year ? ` (${esc(j.year)})` : ''}</li>`).join('');
    return `
      <div class="role">
        <div class="role-head">
          <strong>${esc(w.role)}</strong> — ${esc(w.company_name)}
          <span class="years">${esc(w.from_year)}${w.is_current ? '–Present' : (w.to_year ? '–' + esc(w.to_year) : '')}</span>
        </div>
        ${jobsites ? `<ul class="jobsites">${jobsites}</ul>` : ''}
      </div>`;
  }).join('');
  const licenses = (p.licenses || []).map(l => `<li>${esc(l.name)} — #${esc(l.number)} (exp. ${esc(l.expiration)})${l.verified ? ' ✓' : ''}</li>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(p.name)} — Smith resume</title>
<style>
  @page { margin: 0.6in; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111; max-width: 820px; margin: 24px auto; padding: 0 24px; line-height: 1.45; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 22px 0 10px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 8px; }
  .headline { font-style: italic; color: #333; margin-bottom: 18px; }
  .about { font-size: 14px; white-space: pre-wrap; }
  .role { margin: 0 0 12px; }
  .role-head { font-size: 14px; }
  .role-head .years { color: #555; margin-left: 6px; font-size: 13px; }
  .jobsites { margin: 4px 0 0 18px; padding: 0; color: #333; font-size: 13px; }
  ul { margin: 4px 0 0 18px; padding: 0; }
  li { margin-bottom: 3px; font-size: 13px; }
  .tag-row { font-size: 13px; color: #333; }
  @media print { body { margin: 0; } }
</style></head>
<body>
  <h1>${esc(p.name)}</h1>
  <div class="meta">${esc(p.location || '')}${p.years_experience ? ` · ${p.years_experience} years` : ''}${p.email ? ` · ${esc(p.email)}` : ''}</div>
  ${p.headline ? `<div class="headline">${esc(p.headline)}</div>` : ''}
  ${p.about ? `<div class="about">${esc(p.about)}</div>` : ''}

  ${trades ? `<h2>Trades</h2><div class="tag-row">${trades}</div>` : ''}
  ${work ? `<h2>Where I've worked</h2>${work}` : ''}
  ${licenses ? `<h2>Credentials</h2><ul>${licenses}</ul>` : ''}
  ${skills ? `<h2>Skills</h2><div class="tag-row">${skills}</div>` : ''}
</body></html>`;
}

router.get('/me/strength', requireAuth, async (req, res) => {
  const u = req.user;
  const counts = await q(
    `SELECT
       (SELECT COUNT(*) FROM user_trades WHERE user_id = $1)::int AS trades,
       (SELECT COUNT(*) FROM licenses WHERE user_id = $1)::int    AS licenses,
       (SELECT COUNT(*) FROM jobsites js
          JOIN work_history wh ON wh.id = js.work_history_id WHERE wh.user_id = $1)::int AS jobsites`,
    [req.userId]
  );
  const c = counts.rows[0];
  const checklist = [
    { key: 'photo',     label: 'Photo & cover added',      done: !!u.first_name },
    { key: 'about',     label: 'Headline & about written', done: false },
    { key: 'trades',    label: 'Trades selected',          done: c.trades > 0 },
    { key: 'licenses',  label: 'Add 2 more credentials',   done: c.licenses >= 3 },
    { key: 'projects',  label: 'Add 5+ project photos',    done: c.jobsites >= 5 },
  ];
  const meta = await q(`SELECT headline, about FROM users WHERE id = $1`, [req.userId]);
  checklist[1].done = !!(meta.rows[0]?.headline && meta.rows[0]?.about);
  const done = checklist.filter(x => x.done).length;
  const pct = Math.round((done / checklist.length) * 100);
  res.json({ pct, checklist });
});

export default router;
