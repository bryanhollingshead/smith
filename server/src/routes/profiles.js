// Smith — Profile routes
// Endpoints:
//   GET    /api/profiles/me            — full profile object for the signed-in user
//   GET    /api/profiles/:id           — public profile of any user (incl. self)
//   PATCH  /api/profiles/me            — edit header fields (name, headline, location, about, ...)
//   POST   /api/profiles/me/trades     — replace trade list (atomic)
//   POST   /api/profiles/me/licenses   — add a license
//   DELETE /api/profiles/me/licenses/:lid
//   POST   /api/profiles/me/skills     — replace skill list
//   POST   /api/profiles/me/skills/:sid/endorse
//   GET    /api/profiles/me/strength   — % complete + checklist (matches design widget)

import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth } from '../middleware.js';
import { deleteDocFile } from './credential-docs.js';

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

// avatar_url and cover_url are stored as JSON strings like
// { "thumb": "users/42/avatar-thumb-abc.webp", ... }. We parse them and
// rewrite each variant to a /api/files URL so the frontend can render them
// without knowing storage internals.
function parseUrls(stored) {
  if (!stored) return null;
  let parsed = stored;
  if (typeof stored === 'string') {
    try { parsed = JSON.parse(stored); } catch { return null; }
  }
  if (typeof parsed !== 'object' || !parsed) return null;
  const out = {};
  for (const [size, key] of Object.entries(parsed)) {
    if (typeof key === 'string') {
      // Encode each path segment, keep the slashes structural.
      const encoded = key.split('/').map(encodeURIComponent).join('/');
      out[size] = `/api/files/${encoded}`;
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// loadProfile — assembles the full profile object the frontend uses everywhere.
// Keeping this in one function means the profile page, feed sidebar, and
// network card all see consistent shapes.
// ────────────────────────────────────────────────────────────────────────────
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
  const workP = q(
    `SELECT wh.id, wh.role, wh.from_year, wh.to_year, wh.is_current, wh.position,
            c.id as company_id, c.name as company_name, c.type as company_type,
            c.logo_tone as company_logo_tone, c.claimed_by IS NOT NULL as company_claimed
       FROM work_history wh JOIN companies c ON c.id = wh.company_id
      WHERE wh.user_id = $1
      ORDER BY wh.position ASC, wh.id DESC`,
    [userId]
  );
  const jobsitesP = q(
    `SELECT js.id, js.work_history_id, js.title, js.kind, js.location, js.duration,
            js.photo_kind, js.is_featured, js.position
       FROM jobsites js JOIN work_history wh ON wh.id = js.work_history_id
      WHERE wh.user_id = $1
      ORDER BY js.position ASC, js.id ASC`,
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

  // Connection status between viewer and target (for "Connect" / "Connected" buttons).
  let connection = null;
  if (viewerId && viewerId !== userId) {
    const [a, b] = viewerId < userId ? [viewerId, userId] : [userId, viewerId];
    const r = await q(
      `SELECT status, requested_by FROM connections WHERE user_a_id = $1 AND user_b_id = $2`,
      [a, b]
    );
    if (r.rows.length) connection = r.rows[0];
  }

  const [user, trades, licenses, work, jobsites, skills, networkSize] = await Promise.all([
    userP, tradesP, licensesP, workP, jobsitesP, skillsP, networkSizeP,
  ]);

  if (!user.rows.length) return null;
  const u = user.rows[0];

  // Stitch jobsites into their work_history entries.
  const workById = new Map(work.rows.map(w => [w.id, { ...w, jobsites: [] }]));
  for (const js of jobsites.rows) {
    if (workById.has(js.work_history_id)) workById.get(js.work_history_id).jobsites.push(js);
  }

  return {
    id: u.id,
    email: viewerId === userId ? u.email : undefined,  // keep email private
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
    licenses: licenses.rows.map(l => {
      // Doc URL only goes out to the owner, or to anyone if share_public is on.
      // Either way we send back share_public so the edit UI can show the toggle
      // state when the owner is viewing.
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
        // Owner needs to know there IS a doc even if they wanted it private;
        // others don't need the signal.
        has_doc: !!l.doc_url && (isOwner || l.share_public),
      };
    }),
    work_history: [...workById.values()].sort((a, b) => a.position - b.position),
    skills: skills.rows,
    network_size: networkSize.rows[0].n,
    connection, // null | { status, requested_by }
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────

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

  // If the insurance doc is being changed, capture the old filename so we
  // can clean it up after the UPDATE succeeds.
  let oldInsDoc = null;
  if ('insurance_doc_url' in updates) {
    const cur = await q(`SELECT insurance_doc_url FROM users WHERE id = $1`, [req.userId]);
    oldInsDoc = cur.rows[0]?.insurance_doc_url;
    // Touch the uploaded_at timestamp alongside the doc change.
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

// Replace the user's trade list atomically. Body: { trades: [{ name, years }, ...] }
// First entry becomes the primary trade. Up to 6 (matches "Up to 6" UI hint).
router.post('/me/trades', requireAuth, async (req, res) => {
  const list = Array.isArray(req.body?.trades) ? req.body.trades.slice(0, 6) : [];
  await tx(async (c) => {
    await c.query('DELETE FROM user_trades WHERE user_id = $1', [req.userId]);
    for (let i = 0; i < list.length; i++) {
      const { name, years = 0 } = list[i] || {};
      if (!name) continue;
      // Find or create canonical trade row.
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

// Add a license. Body: { name, number, expiration, verified?, doc_url?,
// doc_mime?, share_public? }. The doc fields are optional; populate them
// by first uploading via POST /api/credential-docs to get the filename.
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

// Patch an existing license — used to toggle share_public, attach a newly
// uploaded doc, or update name/number/expiration after creation.
// Whitelist of fields so a user can't write anywhere they shouldn't.
router.patch('/me/licenses/:lid', requireAuth, async (req, res) => {
  const lid = parseInt(req.params.lid, 10);
  if (!Number.isFinite(lid)) return res.status(400).json({ error: 'Invalid id' });

  // Look up current state — needed to clean up old doc file if it's being replaced.
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

  // If a new doc is being attached or doc is being cleared, also touch doc_uploaded_at.
  if ('doc_url' in updates) updates.doc_uploaded_at = updates.doc_url ? new Date() : null;

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 3}`);
  const vals = [lid, req.userId, ...Object.values(updates)];
  await q(
    `UPDATE licenses SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2`,
    vals
  );

  // If doc was replaced or cleared, delete the old file from disk.
  if ('doc_url' in updates && oldDoc && oldDoc !== updates.doc_url) {
    deleteDocFile(oldDoc, req.userId);
  }

  res.json({ ok: true });
});

router.delete('/me/licenses/:lid', requireAuth, async (req, res) => {
  const lid = parseInt(req.params.lid, 10);
  if (!Number.isFinite(lid)) return res.status(400).json({ error: 'Invalid id' });
  // Look up the doc filename before deleting so we can also clean up disk.
  const cur = await q(
    `SELECT doc_url FROM licenses WHERE id = $1 AND user_id = $2`,
    [lid, req.userId]
  );
  const r = await q(`DELETE FROM licenses WHERE id = $1 AND user_id = $2`, [lid, req.userId]);
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  if (cur.rows[0]?.doc_url) deleteDocFile(cur.rows[0].doc_url, req.userId);
  res.json({ ok: true });
});

// Replace the skills list. Body: { skills: [{ name, level }, ...] }
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

// Endorse a skill. Idempotent — repeated POSTs don't double up. Fires a
// notification to the skill's owner the first time (skips on no-ops and
// self-endorsement).
//
// Returns the new endorsement count + whether the viewer is endorsing,
// so the UI can update without re-fetching the whole profile.
router.post('/:id/skills/:sid/endorse', requireAuth, async (req, res) => {
  const sid = parseInt(req.params.sid, 10);
  if (!Number.isFinite(sid)) return res.status(400).json({ error: 'Invalid skill id' });

  // Look up the skill to find its owner — needed for notification + self-check.
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

  // Insert. The ON CONFLICT clause makes this idempotent. We use RETURNING so
  // we can tell whether this was a new endorsement (worth notifying) or a
  // duplicate click (silent no-op).
  const ins = await q(
    `INSERT INTO skill_endorsements (skill_id, endorser_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING skill_id`,
    [sid, req.userId]
  );

  if (ins.rowCount > 0) {
    // First endorsement from this viewer for this skill — fire a notification.
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

// Un-endorse — toggle off. No notification (don't pester the user when
// someone changes their mind).
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

// List the people who've endorsed a given skill — drives the modal that
// pops on row click. Ordered most-recent-first.
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

// Profile-strength widget — matches the "72% / Add 2 more credentials / Add 5+ project photos" UI.
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
    { key: 'about',     label: 'Headline & about written', done: false },          // populated below
    { key: 'trades',    label: 'Trades selected',          done: c.trades > 0 },
    { key: 'licenses',  label: 'Add 2 more credentials',   done: c.licenses >= 3 },
    { key: 'projects',  label: 'Add 5+ project photos',    done: c.jobsites >= 5 },
  ];
  // Pull headline/about to flip the second checkbox.
  const meta = await q(`SELECT headline, about FROM users WHERE id = $1`, [req.userId]);
  checklist[1].done = !!(meta.rows[0]?.headline && meta.rows[0]?.about);
  const done = checklist.filter(x => x.done).length;
  const pct = Math.round((done / checklist.length) * 100);
  res.json({ pct, checklist });
});

export default router;