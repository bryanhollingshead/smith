// Smith — Job-matching algorithm
//
// Computes per-user scores against the jobs table and materializes them
// into job_matches. Read path (GET /api/jobs) is then a JOIN + ORDER BY —
// no compute on the hot path.
//
// Scoring (blended, not strictly tiered — a same-trade local with 0 mutuals
// can still rank highly):
//
//   Trade match     +20 if primary trade in trade_tags
//                   +10 per non-primary trade in trade_tags
//   Skill overlap   +2 per shared skill (case-insensitive name match)
//   Proximity       +10 same city, +5 same state (string match on location)
//   Recency         multiplier 1.0 / 0.8 / 0.6 / 0.4 by 14/30/60+ day buckets
//
//   final = (trade + skill + proximity) × recency
//
// Deferred (per the SLC algo improvements section of the journal):
//   - Company-overlap referral signal (+5 if a Smith connection works there)
//   - Same-trade boost beyond what the trade-name match already gives
//
// Recompute is sync v1: small loops at our scale (hundreds of users x
// hundreds of jobs = sub-second). When this gets expensive, move to a
// background queue or differential recompute (only score new/updated jobs
// for each user).

import { q, tx } from '../db.js';

const RECENCY_BUCKETS = [
  { days: 14,    mult: 1.0  },
  { days: 30,    mult: 0.8  },
  { days: 60,    mult: 0.6  },
  { days: 9999,  mult: 0.4  },
];

function recencyMultiplier(postedAt) {
  if (!postedAt) return 0.6; // unknown → middle of the road
  const ageMs = Date.now() - new Date(postedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  for (const b of RECENCY_BUCKETS) if (ageDays <= b.days) return b.mult;
  return 0.4;
}

// Lowercase a trade name → canonical lower form for set membership tests.
// jobs.trade_tags carry canonical Smith names (Electrical, Carpentry, ...);
// users have the same shape via the trades catalog. Direct lowercase compare
// is enough.
function lower(s) { return String(s || '').trim().toLowerCase(); }

// Pull city + state heuristics out of a "City, ST" or "City, State, Country"
// string. We don't need a real geocoder for v1 — a substring + comma split
// gets us the right answer 95% of the time.
function locationBits(loc) {
  if (!loc) return { city: '', state: '', raw: '' };
  const raw = String(loc).trim();
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  return { city: parts[0] || '', state: parts[1] || '', raw };
}

export function scoreJobForUser(job, userCtx) {
  // userCtx: { tradeNames: string[] (position-0 first), skillNames: string[], location: string }
  const tradeTags  = (job.trade_tags || []).map(lower);
  const skillTags  = (job.skill_tags || []).map(lower);
  const userTrades = userCtx.tradeNames.map(lower);
  const userSkills = (userCtx.skillNames || []).map(lower);

  // ── Trade ───────────────────────────────────────────────────────────────
  let tradeScore = 0;
  if (userTrades.length > 0) {
    const primary = userTrades[0];
    if (tradeTags.includes(primary)) tradeScore += 20;
    for (let i = 1; i < userTrades.length; i++) {
      if (tradeTags.includes(userTrades[i])) tradeScore += 10;
    }
  }

  // ── Skill overlap ───────────────────────────────────────────────────────
  let skillScore = 0;
  if (userSkills.length > 0 && skillTags.length > 0) {
    const skillSet = new Set(userSkills);
    for (const t of skillTags) if (skillSet.has(t)) skillScore += 2;
  }

  // ── Proximity ───────────────────────────────────────────────────────────
  let locScore = 0;
  const u = locationBits(userCtx.location);
  const j = locationBits(job.location);
  if (u.city && j.raw && j.raw.toLowerCase().includes(u.city.toLowerCase())) {
    locScore += 10;
  } else if (u.state && j.raw && j.raw.toLowerCase().includes(u.state.toLowerCase())) {
    locScore += 5;
  }

  const base = tradeScore + skillScore + locScore;
  const final = base * recencyMultiplier(job.posted_at);
  // Round to 2 decimals so the DB column stores a clean number.
  return Math.round(final * 100) / 100;
}

// Pull the user's context needed for scoring. One round-trip; called by every
// recompute path.
async function loadUserCtx(userId) {
  const userP = q(
    `SELECT id, location FROM users WHERE id = $1`,
    [userId]
  );
  const tradesP = q(
    `SELECT t.name
       FROM user_trades ut JOIN trades t ON t.id = ut.trade_id
      WHERE ut.user_id = $1
      ORDER BY ut.position ASC`,
    [userId]
  );
  const skillsP = q(
    `SELECT name FROM skills WHERE user_id = $1`,
    [userId]
  );
  const [user, trades, skills] = await Promise.all([userP, tradesP, skillsP]);
  if (!user.rows.length) return null;
  return {
    id: user.rows[0].id,
    location: user.rows[0].location || '',
    tradeNames: trades.rows.map(r => r.name),
    skillNames: skills.rows.map(r => r.name),
  };
}

// Recompute every job's score for ONE user. Used after a user edits their
// profile (PATCH /me, trades, skills, interview/step). Sync; idempotent.
//
// We score every NOT-hidden job — including ones the user has dismissed (we
// preserve dismissed_at via the ON CONFLICT update) so the dismiss is sticky
// across recomputes. Same for saved_at.
export async function recomputeMatchesForUser(userId) {
  const ctx = await loadUserCtx(userId);
  if (!ctx) return { user_id: userId, scored: 0 };

  const { rows: jobs } = await q(
    `SELECT id, trade_tags, skill_tags, location, posted_at
       FROM jobs WHERE NOT hidden`
  );

  if (jobs.length === 0) return { user_id: userId, scored: 0 };

  // Bulk upsert in a single transaction. ON CONFLICT preserves dismissed_at
  // and saved_at — those are user actions, not derived. Score + computed_at
  // refresh.
  await tx(async (c) => {
    for (const j of jobs) {
      const score = scoreJobForUser(j, ctx);
      await c.query(
        `INSERT INTO job_matches (user_id, job_id, score, computed_at)
           VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, job_id) DO UPDATE
           SET score = EXCLUDED.score, computed_at = NOW()`,
        [userId, j.id, score]
      );
    }
  });
  return { user_id: userId, scored: jobs.length };
}

// Recompute matches for EVERY user. Used at the end of each ingest cycle so
// freshly-ingested jobs surface for everyone without per-edit triggers.
// At our scale this is ~100 users × ~hundreds of jobs = a few hundred ms.
// When this gets expensive, move to:
//   (a) only-recompute-for-active-users (last_seen within N days), or
//   (b) differential: score only NEW jobs against all users
export async function recomputeAllMatches() {
  const { rows: users } = await q(`SELECT id FROM users`);
  let totalScored = 0;
  for (const u of users) {
    const r = await recomputeMatchesForUser(u.id);
    totalScored += r.scored;
  }
  return { users: users.length, totalScored };
}

// Fire-and-forget wrapper for the hot path. Callers (route handlers) don't
// want to block their response on a recompute. Errors get logged, not raised.
export function recomputeMatchesForUserAsync(userId) {
  Promise.resolve()
    .then(() => recomputeMatchesForUser(userId))
    .catch(e => console.error('[match] recompute failed for user', userId, e.message));
}
