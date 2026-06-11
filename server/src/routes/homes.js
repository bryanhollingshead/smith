// Smith — Homes (homeowner-acquisition) API
//
// Mints + manages the seed home profile from the four homeowner-entry
// screens (HireMeEntry → HomeownerSignup → AddressFound → SeedDashboard).
//
// Endpoints in this file split between PUBLIC and AUTHED:
//   Public (pre-signup, called from the entry screens):
//     GET  /api/places/autocomplete?q=…       — stubbed Google Places result
//     POST /api/places/records                — stubbed assessor + imagery pull
//   Authed (post-signup, called from confirmation + dashboard):
//     POST /api/homes                         — mint a seed home from confirmed facts
//     GET  /api/homes/me/primary              — load current user's seed home (or 404)
//     GET  /api/homes/:id                     — load one home (must be owner)
//     PATCH /api/homes/:id                    — inline-edit a fact, confirm, etc.
//
// The places/records endpoints are stubs — README explicitly defers wiring
// the real providers (Google Places, ATTOM, Street View). They return data
// shaped like the real providers so the swap is one-line later.

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

// ── Stubbed external data ─────────────────────────────────────────────────
// All mock entries share the same lat/lon / neighborhood / fact pattern as
// the design. The slug is the "place_id" — opaque on the client.

const STUB_PLACES = [
  // The canonical confirm-able address — the only one with full facts.
  {
    place_id: 'sl-847-e-9th-ave-84103',
    address_line1: '847 E 9th Ave',
    city: 'Salt Lake City', state: 'UT', postal_code: '84103',
    neighborhood: 'The Avenues',
  },
  // Distractors so autocomplete reads right.
  {
    place_id: 'sl-847-e-9th-st-84105',
    address_line1: '847 E 9th St',
    city: 'Salt Lake City', state: 'UT', postal_code: '84105',
    neighborhood: 'Liberty Wells',
  },
  {
    place_id: 'sl-847-n-900-e-84102',
    address_line1: '847 N 900 E',
    city: 'Salt Lake City', state: 'UT', postal_code: '84102',
    neighborhood: 'Capitol Hill',
  },
  {
    place_id: 'sl-901-e-9th-ave-84103',
    address_line1: '901 E 9th Ave',
    city: 'Salt Lake City', state: 'UT', postal_code: '84103',
    neighborhood: 'The Avenues',
  },
];

// One mocked records set per known place_id. Only the canonical one has
// full data; the others return enough to confirm the home but with sparser
// facts — gives the AddressFound screen something realistic to render
// regardless of which suggestion the user picks.
const STUB_RECORDS = {
  'sl-847-e-9th-ave-84103': {
    year_built: 1924,
    square_feet: 2840,
    bedrooms: 4,
    bathrooms: 2.5,
    lot_acres: 0.18,
    stories: '2 + basement',
    last_sold_date: 'Sep 2022',
    last_sold_price: 726000,
    roof_material: 'Asphalt',
    roof_year: 2021,
    heating: 'Forced air · gas',
    facts_source_attribution: 'Salt Lake County Assessor · est. 2024',
    imagery: [
      // Placeholder kinds — match Photo component variants. Real impl would
      // be Street View Static URLs.
      { kind: 'frame', caption: 'Street view · 2024', primary: true },
      { kind: 'detail',   caption: 'Front elevation' },
      { kind: 'workshop', caption: 'Side yard' },
      { kind: 'concrete', caption: 'Driveway' },
    ],
  },
};

function recordsFor(place_id) {
  return STUB_RECORDS[place_id] || {
    facts_source_attribution: 'Public records · sparse coverage',
    imagery: [{ kind: 'frame', caption: 'Approximate location', primary: true }],
  };
}

// ── Public: address autocomplete ──────────────────────────────────────────
router.get('/places/autocomplete', (req, res) => {
  const term = String(req.query.q || '').trim().toLowerCase();
  // Empty query → top result (the canonical demo address).
  const matches = !term
    ? STUB_PLACES.slice(0, 3)
    : STUB_PLACES.filter(p => {
        const hay = `${p.address_line1} ${p.city} ${p.neighborhood}`.toLowerCase();
        return term.split(/\s+/).every(tok => hay.includes(tok));
      });
  res.json({
    suggestions: matches.slice(0, 5).map(p => ({
      place_id: p.place_id,
      main: p.address_line1,
      sub: `${p.city}, ${p.state} ${p.postal_code}${p.neighborhood ? ' · ' + p.neighborhood : ''}`,
      _components: p, // mock-only: real Places call wouldn't return raw components
    })),
    // TODO: wire Google Places Autocomplete (replace STUB_PLACES + this handler)
  });
});

// ── Public: assessor + imagery pull for a place_id ────────────────────────
router.post('/places/records', (req, res) => {
  const { place_id } = req.body || {};
  if (!place_id) return res.status(400).json({ error: 'place_id required' });
  const place = STUB_PLACES.find(p => p.place_id === place_id);
  if (!place) return res.status(404).json({ error: 'Place not found' });
  const records = recordsFor(place_id);
  res.json({
    place: {
      place_id: place.place_id,
      address_line1: place.address_line1,
      city: place.city, state: place.state, postal_code: place.postal_code,
      neighborhood: place.neighborhood,
    },
    facts: records,
    // TODO: wire ATTOM / Estated / CoreLogic for facts; Google Street View Static for imagery.
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
    facts_source: row.facts_source,
    facts_source_attribution: row.facts_source_attribution,
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
// Body: { place_id, facts: {…records subset}, entry_source, pending_pro_slug }
router.post('/homes', requireAuth, async (req, res) => {
  const {
    place_id, facts = {}, entry_source = 'self-serve', pending_pro_slug = null,
  } = req.body || {};
  if (!place_id) return res.status(400).json({ error: 'place_id required' });

  // Re-resolve the place from the stub (no client trust on address shape).
  const place = STUB_PLACES.find(p => p.place_id === place_id);
  if (!place) return res.status(404).json({ error: 'Place not found' });
  const records = recordsFor(place_id);

  // Most users get one home. If they already minted one (e.g. they bailed
  // mid-flow and restarted), reuse it — don't pile up unconfirmed rows.
  // Match by place_id so a user with two homes at different addresses can
  // still mint distinct rows.
  const existing = await q(
    `SELECT * FROM homes WHERE owner_user_id = $1 AND place_id = $2 LIMIT 1`,
    [req.userId, place_id]
  );
  if (existing.rowCount) {
    return res.status(200).json({ home: shapeHome(existing.rows[0]) });
  }

  const { rows } = await q(
    `INSERT INTO homes (
       owner_user_id,
       address_line1, city, state, postal_code, neighborhood,
       place_id,
       year_built, square_feet, bedrooms, bathrooms, lot_acres, stories,
       last_sold_date, last_sold_price, roof_material, roof_year, heating,
       facts_source, facts_source_attribution,
       entry_source, pending_pro_slug
     )
     VALUES (
       $1,
       $2, $3, $4, $5, $6,
       $7,
       $8, $9, $10, $11, $12, $13,
       $14, $15, $16, $17, $18,
       'public_records', $19,
       $20, $21
     )
     RETURNING *`,
    [
      req.userId,
      place.address_line1, place.city, place.state, place.postal_code, place.neighborhood,
      place.place_id,
      facts.year_built       ?? records.year_built       ?? null,
      facts.square_feet      ?? records.square_feet      ?? null,
      facts.bedrooms         ?? records.bedrooms         ?? null,
      facts.bathrooms        ?? records.bathrooms        ?? null,
      facts.lot_acres        ?? records.lot_acres        ?? null,
      facts.stories          ?? records.stories          ?? null,
      facts.last_sold_date   ?? records.last_sold_date   ?? null,
      facts.last_sold_price  ?? records.last_sold_price  ?? null,
      facts.roof_material    ?? records.roof_material    ?? null,
      facts.roof_year        ?? records.roof_year        ?? null,
      facts.heating          ?? records.heating          ?? null,
      records.facts_source_attribution || null,
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
