-- Smith — Migration 024: Projects (homeowner spec flow)
--
-- One row per spec the homeowner is building or has built. Single-trade
-- projects are flat (parent_project_id NULL, coordination_role 'standalone').
-- Multi-trade projects are one parent + N children: the parent carries the
-- master scope/budget/timeline, each child carries a single trade's scope.
-- See memory: project-spec-flow-architecture.

BEGIN;

CREATE TABLE IF NOT EXISTS projects (
  id                  BIGSERIAL PRIMARY KEY,
  home_id             BIGINT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  parent_project_id   BIGINT REFERENCES projects(id) ON DELETE CASCADE,

  -- Project type slug. Stored as text for v1 (no project_types table yet);
  -- becomes a FK when the data-driven catalog ships.
  kind                TEXT NOT NULL,

  -- User-editable title. Defaulted from `kind` on creation.
  title               TEXT,

  -- Lifecycle status.
  status              TEXT NOT NULL DEFAULT 'draft',

  -- Coordination shape:
  --   standalone   — single-trade flat project
  --   self_gc      — multi-trade parent, homeowner coordinates trades
  --   gc_managed   — multi-trade parent, a GC will coordinate
  --   gc_child     — child SOW under a multi-trade parent
  coordination_role   TEXT NOT NULL DEFAULT 'standalone',

  -- Hire-me path: the slug of the pro this project is bound to (if any).
  -- Mirrors homes.pending_pro_slug for projects minted from hire-me.
  pending_pro_slug    TEXT,

  -- In-progress spec data. Schema-light for v1; the SOW skeleton + per-type
  -- extensions live here as the user moves through the flow.
  draft               JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Finalized SOW (post-Claude). Null until the SOW is generated.
  sow                 JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (status IN ('draft','sent','bidding','awarded','in_progress','done','archived')),
  CHECK (coordination_role IN ('standalone','self_gc','gc_managed','gc_child'))
);

CREATE INDEX IF NOT EXISTS projects_home_idx ON projects (home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS projects_parent_idx ON projects (parent_project_id) WHERE parent_project_id IS NOT NULL;

COMMIT;
