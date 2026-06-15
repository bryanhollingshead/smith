// Smith — Homes (homeowner-acquisition) API
//
// Mints + manages the seed home profile from the homeowner-entry screens
// (HireMeEntry / HomeownerSignup / ModeSetupHomeowner → AddressFound →
// SeedDashboard).
//
// Endpoints in this file split between PUBLIC and AUTHED:
//   Public (pre-signup, called from the entry screens):
//     POST /api/places/records          — provider lookup for a typed address;
//                                         returns canonical address + facts +
//                                         AVM value so the entry screens can
//                                         preview the magic moment.
//   Authed (post-signup, called from confirmation + dashboard):
//     POST /api/homes                   — mint a seed home from a typed address
//                                         (re-runs the provider call server-side
//                                         so the persisted row matches truth).
//     GET  /api/homes/me/primary        — load current user's seed home (or 404)
//     GET  /api/homes/:id               — load one home (must be owner)
//     PATCH /api/homes/:id              — inline-edit a fact, confirm, etc.
//
// Provider: see server/src/services/property-data/. PROPERTY_PROVIDER picks
// between rentcast (real) and stub (offline-dev/test). The provider call is
// best-effort — if the upstream throws or times out, the home still mints on
// whatever canonical address we have and the UI shows a "fetching details"
// affordance instead of a hard error.

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { lookupByAddress } from '../services/property-data/index.js';

const router = Router();

// Synthesize a stable dedup key from a canonical address. Old rows had
// Google-Places-style opaque ids; now we just normalize the canonical
// address into a slug-like string and reuse the place_id column for it.
function synthesizePlaceId(addr) {
  if (!addr) return null;
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return [norm(addr.state), norm(addr.postal_code), norm(addr.line1)]
    .filter(Boolean)
    .join('|');
}

// ── Public: provider lookup for a typed address ──────────────────────────
// Body: { address: "847 E 9th Ave, Salt Lake City, UT 84103" }
// Returns the canonical shape from the provider (or a degraded fallback if
// the upstream failed — see services/property-data/index.js).
router.post('/places/records', async (req, res) => {
  const { address } = req.body || {};
  if (!address || !String(address).trim()) {
    return res.status(400).json({ error: 'address required' });
  }
  const result = await lookupByAddress(String(address).trim());
  res.json({
    place: {
      ...result.canonical_address,
      place_id: synthesizePlaceId(result.canonical_address),
      latitude: result.latitude,
      longitude: result.longitude,
    },
    facts: result.facts,
    value: result.value,
    provider: result.provider,
    attribution: result.attribution,
    degraded: result.degraded,
  });
});

// ── Authed: shape a homes row for the client ──────────────────────────────
function shapeHome(row) {
  if (!row) return null;
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    address_line1: row.address_line1,
    city: row.city, state: row.state, postal_code: row.postal_code,
    neighborhood: row.neighborhood,
    place_id: row.place_id,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    year_built: row.year_built,
    square_feet: row.square_feet,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms != null ? Number(row.bathrooms) : null,
    lot_acres: row.lot_acres != null ? Number(row.lot_acres) : null,
    stories: row.stories,
    last_sold_date: row.last_sold_date,
    last_sold_price: row.last_sold_price,
    roof_material: row.roof_material,
    roof_year: row.roof_year,
    heating: row.heating,
    value_estimate: row.value_estimate,
    value_estimate_low: row.value_estimate_low,
    value_estimate_high: row.value_estimate_high,
    value_estimated_at: row.value_estimated_at,
    facts_source: row.facts_source,
    facts_source_attribution: row.facts_source_attribution,
    facts_provider: row.facts_provider,
    entry_source: row.entry_source,
    pending_pro_slug: row.pending_pro_slug,
    confirmed_at: row.confirmed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    progress: deriveProgress(row),
  };
}

// Progress derivation.
//
// 22 total "details" distributed across the 6 checklist rows in the design.
// Only the first two rows can be marked done programmatically in this
// build — the rest are future iterations (systems / project / photos /
// trade), so they hold zero until those flows ship.
//   Confirm address (1)            — confirmed_at populated
//   Basic facts auto-imported (3)  — any of the public-records fact columns populated
//   Add systems (5)                — future
//   Log a project (3)              — future
//   Upload photos (5)              — future
//   Connect a trade (5)            — future
function deriveProgress(row) {
  const TOTAL = 22;
  let added = 0;
  if (row.confirmed_at) added += 1;
  const hasBasic = !!(
    row.year_built || row.square_feet ||
    row.bedrooms  || row.bathrooms   ||
    row.lot_acres || row.stories     ||
    row.last_sold_date || row.last_sold_price ||
    row.roof_material  || row.heating
  );
  if (hasBasic) added += 3;
  return {
    added,
    total: TOTAL,
    pct: Math.round((added / TOTAL) * 100),
  };
}

// ── Authed: mint the seed home ────────────────────────────────────────────
// Body: { address, entry_source, pending_pro_slug }
//
// We re-run the provider lookup server-side instead of trusting the client's
// preview payload — that way the persisted row reflects what the provider
// actually returned, not whatever the client posted. Cost is one extra
// provider call per signup (a few cents), worth it for correctness.
router.post('/homes', requireAuth, async (req, res) => {
  const { address, entry_source = 'self-serve', pending_pro_slug = null } = req.body || {};
  if (!address || !String(address).trim()) {
    return res.status(400).json({ error: 'address required' });
  }

  const result = await lookupByAddress(String(address).trim());
  const canonical = result.canonical_address;
  const placeId = synthesizePlaceId(canonical);

  // Reuse an existing home at the same place — bailed-mid-flow restarts
  // should land back in the same row, not pile up unconfirmed duplicates.
  if (placeId) {
    const existing = await q(
      `SELECT * FROM homes WHERE owner_user_id = $1 AND place_id = $2 LIMIT 1`,
      [req.userId, placeId]
    );
    if (existing.rowCount) {
      return res.status(200).json({ home: shapeHome(existing.rows[0]) });
    }
  }

  const facts = result.facts || {};
  const value = result.value || {};
  const valuedAt = result.value ? new Date() : null;
  const factsSource = result.degraded ? 'stub' : 'public_records';

  const { rows } = await q(
    `INSERT INTO homes (
       owner_user_id,
       address_line1, city, state, postal_code, neighborhood,
       place_id, latitude, longitude,
       year_built, square_feet, bedrooms, bathrooms, lot_acres, stories,
       last_sold_date, last_sold_price, roof_material, roof_year, heating,
       value_estimate, value_estimate_low, value_estimate_high, value_estimated_at,
       facts_source, facts_source_attribution, facts_provider,
       entry_source, pending_pro_slug
     )
     VALUES (
       $1,
       $2, $3, $4, $5, $6,
       $7, $8, $9,
       $10, $11, $12, $13, $14, $15,
       $16, $17, $18, $19, $20,
       $21, $22, $23, $24,
       $25, $26, $27,
       $28, $29
     )
     RETURNING *`,
    [
      req.userId,
      canonical.line1, canonical.city, canonical.state, canonical.postal_code, canonical.neighborhood,
      placeId, result.latitude, result.longitude,
      facts.year_built, facts.square_feet, facts.bedrooms, facts.bathrooms, facts.lot_acres, facts.stories,
      facts.last_sold_date, facts.last_sold_price, facts.roof_material, facts.roof_year, facts.heating,
      value.estimate ?? null, value.low ?? null, value.high ?? null, valuedAt,
      factsSource, result.attribution || null, result.provider,
      entry_source === 'hire-me' ? 'hire-me' : 'self-serve',
      entry_source === 'hire-me' ? (pending_pro_slug || null) : null,
    ]
  );
  res.status(201).json({ home: shapeHome(rows[0]) });
});

// ── Authed: load the current user's primary (most-recent) home ────────────
router.get('/homes/me/primary', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT * FROM homes WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'No home yet' });
  res.json({ home: shapeHome(rows[0]) });
});

// ── Authed: load one home (owner-only) ────────────────────────────────────
router.get('/homes/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const { rows } = await q(
    `SELECT * FROM homes WHERE id = $1 AND owner_user_id = $2 LIMIT 1`,
    [id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ home: shapeHome(rows[0]) });
});

// ── Authed: patch a fact / confirm / etc. ─────────────────────────────────
// Body accepts any subset of editable fields. Special: `confirm: true`
// stamps confirmed_at; pencil edits flip facts_source to 'user' on the
// modified field's row (we only track at home level, not per-field).
router.patch('/homes/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const own = await q(`SELECT id FROM homes WHERE id = $1 AND owner_user_id = $2`, [id, req.userId]);
  if (!own.rowCount) return res.status(404).json({ error: 'Not found' });

  const body = req.body || {};
  const editable = [
    'address_line1', 'city', 'state', 'postal_code', 'neighborhood',
    'year_built', 'square_feet', 'bedrooms', 'bathrooms', 'lot_acres', 'stories',
    'last_sold_date', 'last_sold_price', 'roof_material', 'roof_year', 'heating',
  ];
  const sets = [];
  const vals = [];
  for (const k of editable) {
    if (k in body) {
      vals.push(body[k]);
      sets.push(`${k} = $${vals.length}`);
    }
  }
  // Sentinel: confirm:true → stamp confirmed_at (only if not already).
  if (body.confirm === true) {
    sets.push(`confirmed_at = COALESCE(confirmed_at, NOW())`);
  }
  // Any user-driven edit changes facts_source. Don't flip on confirm alone.
  if (sets.length > (body.confirm === true ? 1 : 0)) {
    sets.push(`facts_source = 'user'`);
  }
  sets.push(`updated_at = NOW()`);

  vals.push(id);
  const { rows } = await q(
    `UPDATE homes SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  res.json({ home: shapeHome(rows[0]) });
});

export default router;
