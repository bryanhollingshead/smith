// Smith — Projects (homeowner spec flow) API
//
// One row per spec the homeowner is building. Picker creates a draft row;
// the spec flow fills the `draft` JSONB; the final Claude call writes `sow`.
// See memory: project-spec-flow-architecture.

import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

// V1 project type catalog. Kept in sync with client/src/lib/project-types.js
// (the picker UI source). Moves to a project_types table once the
// data-driven eligibility-rule catalog ships.
const KIND_TITLES = {
  'bathroom-remodel':  'Remodel a bathroom',
  'kitchen-remodel':   'Remodel a kitchen',
  'finish-basement':   'Finish a basement',
  'hvac-replacement':  'Replace HVAC system',
  'roof-replacement':  'Replace roof',
  'electrical-panel':  'Upgrade electrical panel',
  'custom':            'New project',
};

// V1 SOW templates. Stub data the generator overlays the draft onto; same
// shape Claude will populate in v2 (memory: project-spec-flow-architecture).
// Each template carries trade tags, an ordered scope (in/out), exclusions,
// and assumptions — the per-type defaults a real bidder would expect.
const STUB_SOW_TEMPLATES = {
  'bathroom-remodel': {
    trade: ['general', 'plumbing', 'electrical'],
    scope: [
      { line: 'Demo existing fixtures and finishes to studs as needed', in_or_out: 'in' },
      { line: 'Reuse existing plumbing rough-in locations where possible', in_or_out: 'in' },
      { line: 'New vanity, toilet, mirror, lighting (per homeowner selection)', in_or_out: 'in' },
      { line: 'Tile floor and wet walls; painted drywall elsewhere', in_or_out: 'in' },
      { line: 'New ventilation fan with exterior duct termination', in_or_out: 'in' },
      { line: 'Permit pull and final inspection coordination', in_or_out: 'in' },
      { line: 'Smoke / CO detector upgrades outside the bathroom', in_or_out: 'out' },
    ],
    exclusions: [
      'Whole-house re-plumb of pipes outside the bathroom',
      'Floor structural repair beyond minor patching',
      'Hazmat abatement (asbestos / lead) — priced separately if discovered',
    ],
    assumptions: [
      'Existing waste line is in serviceable condition',
      'Subfloor is sound; new tile underlayment to be installed',
      'Standard 8-ft ceiling height',
    ],
  },
  'kitchen-remodel': {
    trade: ['general', 'plumbing', 'electrical'],
    scope: [
      { line: 'Demo existing cabinets, countertops, and flooring per scope', in_or_out: 'in' },
      { line: 'Install new cabinets (semi-custom or custom per selection)', in_or_out: 'in' },
      { line: 'Install new countertops and backsplash', in_or_out: 'in' },
      { line: 'Update electrical circuits to current code (GFCI, dedicated)', in_or_out: 'in' },
      { line: 'Plumbing connections for sink, dishwasher, fridge water/ice', in_or_out: 'in' },
      { line: 'Paint walls and ceilings within the work area', in_or_out: 'in' },
      { line: 'Permit pull and final inspection coordination', in_or_out: 'in' },
      { line: 'Appliance purchase (homeowner-provided)', in_or_out: 'out' },
    ],
    exclusions: [
      'Structural changes (load-bearing walls)',
      'Re-routing of gas lines beyond the kitchen footprint',
      'HVAC modifications',
    ],
    assumptions: [
      'Existing flooring layer count permits direct install or removal',
      'Adequate electrical service for the added load',
      'No hidden moisture damage behind cabinets',
    ],
  },
  'finish-basement': {
    trade: ['general', 'framing', 'electrical', 'plumbing', 'hvac', 'drywall', 'flooring'],
    scope: [
      { line: 'Frame walls and ceilings per layout', in_or_out: 'in' },
      { line: 'Electrical rough-in: outlets, lighting, switches per code', in_or_out: 'in' },
      { line: 'Plumbing rough-in for bath and utility connections', in_or_out: 'in' },
      { line: 'Insulation in framed walls and ceiling', in_or_out: 'in' },
      { line: 'Drywall hang, tape, mud, paint', in_or_out: 'in' },
      { line: 'Flooring throughout finished area', in_or_out: 'in' },
      { line: 'HVAC supply and return for finished-space requirements', in_or_out: 'in' },
      { line: 'Trim, doors, baseboards', in_or_out: 'in' },
      { line: 'Permit pull and final inspection coordination', in_or_out: 'in' },
      { line: 'Foundation repair or waterproofing', in_or_out: 'out' },
    ],
    exclusions: [
      'Egress window cutting and well installation (priced separately if needed)',
      'Foundation waterproofing or sump pump installation',
      'Major plumbing relocation (sewer ejector, main stack)',
    ],
    assumptions: [
      'Basement is dry; no active moisture or drainage issues',
      'Existing electrical panel has capacity for the added load',
      'Ceiling height meets local code for habitable space',
    ],
  },
  'hvac-replacement': {
    trade: ['hvac'],
    scope: [
      { line: 'Remove existing equipment and dispose per regulations', in_or_out: 'in' },
      { line: 'Install new system sized per Manual J load calc', in_or_out: 'in' },
      { line: 'Reuse existing ductwork if condition permits', in_or_out: 'in' },
      { line: 'New smart-capable thermostat', in_or_out: 'in' },
      { line: 'Refrigerant line set replacement if mismatched', in_or_out: 'in' },
      { line: 'Startup, balance, and homeowner walkthrough', in_or_out: 'in' },
      { line: 'Permit pull and final inspection coordination', in_or_out: 'in' },
      { line: 'Duct cleaning service (separate quote available)', in_or_out: 'out' },
    ],
    exclusions: [
      'Full duct replacement (separate scope)',
      'Electrical panel upgrade if existing service is insufficient',
      'Asbestos abatement on existing ductwork (priced separately if discovered)',
    ],
    assumptions: [
      'Existing ductwork is in serviceable condition',
      'Existing flue / venting meets code for new equipment',
      'Electrical service is sufficient for new equipment',
    ],
  },
  'roof-replacement': {
    trade: ['roofing'],
    scope: [
      { line: 'Tear off existing roof material to deck', in_or_out: 'in' },
      { line: 'Inspect and replace damaged decking as found (priced per sheet)', in_or_out: 'in' },
      { line: 'Install ice and water shield at eaves and valleys', in_or_out: 'in' },
      { line: 'Install synthetic underlayment across deck', in_or_out: 'in' },
      { line: 'Install new roofing material per homeowner selection', in_or_out: 'in' },
      { line: 'Install ridge vent, drip edge, flashings, and boots', in_or_out: 'in' },
      { line: 'Site cleanup and magnetic nail sweep', in_or_out: 'in' },
      { line: 'Permit pull and final inspection coordination', in_or_out: 'in' },
      { line: 'Gutter replacement (separate scope)', in_or_out: 'out' },
    ],
    exclusions: [
      'Gutter replacement or repair',
      'Solar panel removal and reinstall (coordinated separately if applicable)',
      'Skylight replacement (priced per unit if requested)',
    ],
    assumptions: [
      'Existing roof structure is sound; rafter spacing meets material spec',
      'No more than 2 existing layers (3rd layer requires full tear-off)',
      'Attic ventilation meets current code or will be brought to code',
    ],
  },
  'electrical-panel': {
    trade: ['electrical'],
    scope: [
      { line: 'Coordinate utility disconnect and reconnect', in_or_out: 'in' },
      { line: 'Remove existing panel and meter base if upgrading service', in_or_out: 'in' },
      { line: 'Install new panel of specified amperage', in_or_out: 'in' },
      { line: 'Replace service entrance conductors as required by code', in_or_out: 'in' },
      { line: 'Re-terminate existing branch circuits to new panel', in_or_out: 'in' },
      { line: 'Install whole-house surge protection (if selected)', in_or_out: 'in' },
      { line: 'Update grounding electrode system to current code', in_or_out: 'in' },
      { line: 'Permit pull and final inspection coordination', in_or_out: 'in' },
      { line: 'Branch circuit upgrades inside the house', in_or_out: 'out' },
    ],
    exclusions: [
      'Knob-and-tube replacement throughout the house',
      'EV charger installation (separate scope)',
      'Solar interconnection (separate scope)',
    ],
    assumptions: [
      'Existing branch circuits are in code-compliant condition for re-termination',
      'Utility service drop is adequate for new amperage',
      'Outdoor mast and weather head meet current code',
    ],
  },
  'custom': {
    trade: ['general'],
    scope: [
      { line: 'Scope to be finalized with the bidding pro based on homeowner description', in_or_out: 'in' },
      { line: 'Permit and inspection coordination as the project requires', in_or_out: 'in' },
    ],
    exclusions: [
      'Items outside the scope as finalized with the pro',
    ],
    assumptions: [
      'Final scope reflects the homeowner intent captured in this spec',
    ],
  },
};

// Build the home_facts array for the SOW from the home row. Only includes
// fields that have a value — empty home file just shows fewer facts.
function buildHomeFacts(home) {
  const facts = [];
  if (home.year_built)  facts.push({ label: 'Year built',   value: String(home.year_built),      source: 'public_records' });
  if (home.square_feet) facts.push({ label: 'Square feet',  value: home.square_feet.toLocaleString(), source: 'public_records' });
  if (home.bedrooms != null || home.bathrooms != null) {
    facts.push({
      label: 'Beds / baths',
      value: `${home.bedrooms ?? '—'} / ${home.bathrooms ?? '—'}`,
      source: 'public_records',
    });
  }
  if (home.stories)        facts.push({ label: 'Stories',         value: String(home.stories),  source: 'public_records' });
  if (home.roof_material)  facts.push({ label: 'Roof material',   value: home.roof_material,    source: 'public_records' });
  if (home.heating)        facts.push({ label: 'Heating system',  value: home.heating,          source: 'public_records' });
  return facts;
}

// Build the structured SOW from the draft + home + per-kind template. Same
// shape Claude will populate in v2 — only the `generated_by` field changes.
function buildStubSow({ project, home, draft }) {
  const template = STUB_SOW_TEMPLATES[project.kind] || STUB_SOW_TEMPLATES.custom;
  return {
    homeowner_words:    draft.homeowner_words || '',
    scope:              template.scope,
    home_facts:         buildHomeFacts(home),
    trade:              template.trade,
    style:              draft.style || null,
    budget:             draft.budget || null,
    decision_criteria:  draft.decision_criteria || null,
    exclusions:         template.exclusions,
    assumptions:        template.assumptions,
    context_qa:         draft.qa || [],
    type_extension:     {},
    generated_at:       new Date().toISOString(),
    generated_by:       'stub',
  };
}

function shapeProject(row) {
  return {
    id: row.id,
    home_id: row.home_id,
    parent_project_id: row.parent_project_id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    coordination_role: row.coordination_role,
    pending_pro_slug: row.pending_pro_slug,
    draft: row.draft || {},
    sow: row.sow,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadOwnedHome(homeId, userId) {
  const { rows } = await q(
    `SELECT * FROM homes WHERE id = $1 AND owner_user_id = $2`,
    [homeId, userId]
  );
  return rows[0] || null;
}

// ── POST /api/projects ────────────────────────────────────────────────────
// Create a draft project for a home the user owns.
// Body: { home_id, kind, pending_pro_slug? }
router.post('/projects', requireAuth, async (req, res) => {
  const { home_id, kind, pending_pro_slug } = req.body || {};
  const homeId = parseInt(home_id, 10);
  if (!Number.isFinite(homeId)) return res.status(400).json({ error: 'home_id required' });
  if (!kind || typeof kind !== 'string') return res.status(400).json({ error: 'kind required' });
  if (!Object.prototype.hasOwnProperty.call(KIND_TITLES, kind)) {
    return res.status(400).json({ error: 'unknown kind' });
  }

  const home = await loadOwnedHome(homeId, req.userId);
  if (!home) return res.status(404).json({ error: 'home not found' });

  const title = KIND_TITLES[kind];
  const proSlug = pending_pro_slug ? String(pending_pro_slug).trim() : null;

  const { rows } = await q(
    `INSERT INTO projects (home_id, kind, title, pending_pro_slug)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [homeId, kind, title, proSlug]
  );
  res.status(201).json({ project: shapeProject(rows[0]) });
});

// ── GET /api/projects?home_id=… ───────────────────────────────────────────
// List the user's projects at a given home. Newest first.
router.get('/projects', requireAuth, async (req, res) => {
  const homeId = parseInt(req.query.home_id, 10);
  if (!Number.isFinite(homeId)) return res.status(400).json({ error: 'home_id required' });

  const home = await loadOwnedHome(homeId, req.userId);
  if (!home) return res.status(404).json({ error: 'home not found' });

  const { rows } = await q(
    `SELECT * FROM projects
       WHERE home_id = $1
       ORDER BY created_at DESC`,
    [homeId]
  );
  res.json({ projects: rows.map(shapeProject) });
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────
router.get('/projects/:id', requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'invalid id' });

  const { rows } = await q(
    `SELECT p.* FROM projects p
       JOIN homes h ON h.id = p.home_id
      WHERE p.id = $1 AND h.owner_user_id = $2`,
    [projectId, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ project: shapeProject(rows[0]) });
});

// ── PATCH /api/projects/:id ───────────────────────────────────────────────
// Update an in-progress draft. v1 accepts `draft` (full JSONB replace) and
// `title`. Status/coordination_role move through dedicated flows (classifier,
// send) which don't exist yet.
router.patch('/projects/:id', requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'invalid id' });

  const { rows: existing } = await q(
    `SELECT p.* FROM projects p
       JOIN homes h ON h.id = p.home_id
      WHERE p.id = $1 AND h.owner_user_id = $2`,
    [projectId, req.userId]
  );
  if (!existing.length) return res.status(404).json({ error: 'not found' });

  const body = req.body || {};
  const cols = [];
  const vals = [];
  if (body.draft !== undefined) {
    if (body.draft === null || typeof body.draft !== 'object') {
      return res.status(400).json({ error: 'draft must be an object' });
    }
    cols.push('draft');
    vals.push(JSON.stringify(body.draft));
  }
  if (body.title !== undefined) {
    cols.push('title');
    vals.push(String(body.title));
  }
  if (!cols.length) {
    return res.json({ project: shapeProject(existing[0]) });
  }

  const setStr = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  vals.push(projectId);
  const { rows } = await q(
    `UPDATE projects SET ${setStr}, updated_at = NOW()
       WHERE id = $${vals.length}
       RETURNING *`,
    vals
  );
  res.json({ project: shapeProject(rows[0]) });
});

// ── POST /api/projects/:id/generate-sow ───────────────────────────────────
// Build the structured SOW from draft + home + per-kind template, write it
// to project.sow, and advance the step to 'review'. Body optionally carries
// a `draft` patch that gets merged before generation (so the criteria step
// can save its pick and trigger generation in one round-trip).
//
// V1: deterministic stub. V2: Claude call — same response shape, same
// `sow` schema, only `generated_by` changes.
router.post('/projects/:id/generate-sow', requireAuth, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'invalid id' });

  const { rows: projectRows } = await q(
    `SELECT p.*,
            h.year_built, h.square_feet, h.bedrooms, h.bathrooms,
            h.stories, h.roof_material, h.heating
       FROM projects p
       JOIN homes h ON h.id = p.home_id
      WHERE p.id = $1 AND h.owner_user_id = $2`,
    [projectId, req.userId]
  );
  if (!projectRows.length) return res.status(404).json({ error: 'not found' });
  const row = projectRows[0];

  const mergedDraft = {
    ...(row.draft || {}),
    ...(req.body?.draft || {}),
    step: 'review',
  };

  const sow = buildStubSow({
    project: row,
    home: row,
    draft: mergedDraft,
  });

  const { rows } = await q(
    `UPDATE projects
        SET draft = $1, sow = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *`,
    [JSON.stringify(mergedDraft), JSON.stringify(sow), projectId]
  );
  res.json({ project: shapeProject(rows[0]) });
});

export default router;
