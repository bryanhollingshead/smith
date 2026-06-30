// Smith — Public endpoints (no auth required)
//
// All routes here are reachable WITHOUT a Bearer token. Used by:
//   - Public profile pages   /profile/:slug
//   - Tradesperson search    /api/public/search
//   - Hire Me submit         from a public profile, by any visitor
//   - Magic-link reply       inquirer replies without a Smith account
//
// Mounted at /api/public/* in index.js. The router itself is the trust
// boundary — anything mounted at /api/public assumes "no auth, treat caller
// as untrusted". No middleware here imports requireAuth.

import { Router } from 'express';
import { q } from '../db.js';
import { loadProfile } from './profiles.js';
import { createInquiry, resolveMagicToken, postInquirerReplyViaToken } from '../hire-me.js';
import { FEATURE_HIRE_ME } from '../flags.js';

const router = Router();

// Per-handler gate for the three hire-me endpoints inside this router.
// The router itself stays mounted because /profiles/:slug and /search are
// core; only the hire-me submission + magic-link reply get hidden when
// FEATURE_HIRE_ME is off.
function requireHireMe(_req, res, next) {
  if (!FEATURE_HIRE_ME) return res.status(404).json({ error: 'Not found' });
  next();
}

// ── In-memory rate limit — minimal abuse protection ──────────────────────
// Per-IP token bucket. 5 submits per IP per 10 minutes is more than a real
// inquirer needs and not so generous a bot can scale. Resets on server
// restart — adequate for soft launch. Move to Redis when prod load justifies.
const RL_LIMIT  = 5;
const RL_WINDOW_MS = 10 * 60 * 1000;
const rl = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const arr = (rl.get(ip) || []).filter(t => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_LIMIT) return false;
  arr.push(now);
  rl.set(ip, arr);
  return true;
}

function clientIp(req) {
  // First entry in X-Forwarded-For (Render sets this); fallback to socket.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// ── GET /api/public/profiles/:slug ───────────────────────────────────────
// Loads the profile by slug. Returns a scrubbed view (no email visible to
// strangers; insurance + license docs only when share_public=TRUE, which
// loadProfile already handles for non-owner viewers).
router.get('/profiles/:slug', async (req, res) => {
  const slug = req.params.slug;
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug' });
  }
  const { rows } = await q(
    `SELECT id FROM users WHERE public_slug = $1 AND is_public = TRUE LIMIT 1`,
    [slug]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });

  // viewerId = 0 → no owner privileges, no connection state lookup
  const profile = await loadProfile(rows[0].id, 0);
  if (!profile) return res.status(404).json({ error: 'Not found' });

  // Extra scrubbing beyond loadProfile's visitor defaults: drop email +
  // onboarding details (no reason to expose those in a public render).
  delete profile.email;
  delete profile.onboarding;
  res.json({ profile });
});

// ── GET /api/public/search?q=&trade=&location= ──────────────────────────
// Trigram-backed public search across is_public users. Always returns a
// trimmed card shape (id, name, slug, headline, trades). No emails, no
// detailed bio.
router.get('/search', async (req, res) => {
  const term     = (req.query.q || '').toString().trim();
  const trade    = (req.query.trade || '').toString().trim();
  const location = (req.query.location || '').toString().trim();
  const limit    = Math.min(40, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const where  = ['u.is_public = TRUE', 'u.public_slug IS NOT NULL'];
  const params = [];
  if (term) {
    params.push(`%${term.toLowerCase()}%`);
    // GIN trigram index supports `text LIKE '%pattern%'` (the trgm operator
    // class indexes for that exact pattern). No `LOWER(col) LIKE LOWER(...)`
    // here — we already index by LOWER() in the migration.
    where.push(`LOWER(u.first_name || ' ' || u.last_name || ' ' || COALESCE(u.headline, '') || ' ' || COALESCE(u.location, '')) LIKE $${params.length}`);
  }
  if (location) {
    params.push(`%${location.toLowerCase()}%`);
    where.push(`LOWER(COALESCE(u.location, '')) LIKE $${params.length}`);
  }
  if (trade) {
    params.push(trade);
    where.push(`EXISTS (
      SELECT 1 FROM user_trades ut JOIN trades t ON t.id = ut.trade_id
       WHERE ut.user_id = u.id AND LOWER(t.name) = LOWER($${params.length})
    )`);
  }
  params.push(limit);

  const { rows } = await q(
    `SELECT u.id, u.first_name, u.last_name, u.public_slug, u.headline,
            u.location, u.verified_smith, u.avatar_url, u.avatar_tone,
            COALESCE(ARRAY(
              SELECT t.name FROM user_trades ut JOIN trades t ON t.id = ut.trade_id
               WHERE ut.user_id = u.id ORDER BY ut.position
            ), '{}') AS trade_names
       FROM users u
      WHERE ${where.join(' AND ')}
      ORDER BY u.verified_smith DESC, u.id
      LIMIT $${params.length}`,
    params
  );

  res.json({
    results: rows.map(r => ({
      id: r.id,
      slug: r.public_slug,
      name: `${r.first_name} ${r.last_name}`.trim(),
      headline: r.headline || '',
      location: r.location || '',
      trades: r.trade_names,
      verified_smith: !!r.verified_smith,
    })),
    total: rows.length,
  });
});

// ── POST /api/public/hire-me/:slug ───────────────────────────────────────
// Creates the inquiry + message thread + notification. Returns a friendly
// confirmation (no internal IDs visible to the public). Required fields are
// gated; rate limited per IP.
router.post('/hire-me/:slug', requireHireMe, async (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many inquiries from your network. Try again later.' });
  }
  const slug = req.params.slug;
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  const {
    inquirer_name, inquirer_email, inquirer_phone,
    structure_type, job_type, location, timeline, message,
  } = req.body || {};

  const nameStr  = String(inquirer_name  || '').trim();
  const emailStr = String(inquirer_email || '').trim();
  const msgStr   = String(message        || '').trim();

  if (!nameStr || !emailStr || !msgStr) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return res.status(400).json({ error: 'Email looks invalid.' });
  }
  if (nameStr.length  > 120 || emailStr.length > 200 || msgStr.length > 4000) {
    return res.status(400).json({ error: 'Submission too long.' });
  }

  const { rows } = await q(
    `SELECT id, first_name, last_name FROM users WHERE public_slug = $1 AND is_public = TRUE LIMIT 1`,
    [slug]
  );
  if (!rows.length) return res.status(404).json({ error: 'Profile not found' });

  const result = await createInquiry({
    targetUserId:   rows[0].id,
    targetName:     `${rows[0].first_name} ${rows[0].last_name}`.trim(),
    inquirerName:   nameStr,
    inquirerEmail:  emailStr,
    inquirerPhone:  inquirer_phone ? String(inquirer_phone).trim().slice(0, 60) : null,
    structureType:  structure_type ? String(structure_type).trim().slice(0, 100) : null,
    jobType:        job_type       ? String(job_type).trim().slice(0, 100)       : null,
    location:       location       ? String(location).trim().slice(0, 200)       : null,
    timeline:       timeline       ? String(timeline).trim().slice(0, 100)       : null,
    message:        msgStr,
    ip,
  });

  res.status(201).json({
    ok: true,
    note: 'Inquiry sent. They\'ll get a notification right away; you\'ll get a magic-link email if they reply.',
    inquiry_id: result.inquiry.id, // safe to expose — sequential id, public surface treats as opaque
  });
});

// ── GET /api/public/hire-me/thread/:token ────────────────────────────────
// Loads the thread view for the inquirer. Returns messages + the original
// inquiry structured data, but NOT a way to know other Smith users.
router.get('/hire-me/thread/:token', requireHireMe, async (req, res) => {
  const resolved = await resolveMagicToken(req.params.token);
  if (!resolved) return res.status(404).json({ error: 'Not found' });
  if (resolved.expired) return res.status(410).json({ error: 'Link expired' });
  if (!resolved.inquiry) return res.status(404).json({ error: 'Not found' });

  // Pull thread + messages + the target's display name.
  const inquiry = resolved.inquiry;
  const { rows: targetRows } = await q(
    `SELECT first_name, last_name, public_slug, headline FROM users WHERE id = $1`,
    [inquiry.target_user_id]
  );
  const target = targetRows[0] || {};

  const { rows: msgs } = await q(
    `SELECT id, sender_id, sender_name_override, body, created_at
       FROM messages
      WHERE thread_id = $1
      ORDER BY created_at ASC`,
    [resolved.thread_id]
  );

  res.json({
    inquiry: {
      structure_type: inquiry.structure_type,
      job_type:       inquiry.job_type,
      location:       inquiry.location,
      timeline:       inquiry.timeline,
    },
    target: {
      name:     `${target.first_name || ''} ${target.last_name || ''}`.trim() || 'Smith member',
      headline: target.headline || '',
      slug:     target.public_slug || null,
    },
    messages: msgs.map(m => ({
      id: m.id,
      from_target: m.sender_id != null,
      name: m.sender_id != null
        ? `${target.first_name} ${target.last_name}`.trim()
        : (m.sender_name_override || 'You'),
      body: m.body,
      created_at: m.created_at,
    })),
    token: {
      used: resolved.used,
      expires_at: resolved.token_row.expires_at,
    },
  });
});

// ── POST /api/public/hire-me/thread/:token/reply ─────────────────────────
// Inquirer's reply via magic-link. Token is single-use — used_at flips on
// success. The next target reply generates a fresh token.
router.post('/hire-me/thread/:token/reply', requireHireMe, async (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many replies from your network. Try again later.' });
  }
  const body = (req.body?.body || '').toString();
  const r = await postInquirerReplyViaToken(req.params.token, body);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  res.status(201).json({ ok: true });
});

export default router;
