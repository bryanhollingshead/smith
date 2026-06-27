-- Smith — Migration 025: Project photos with pin annotations
--
-- One row per photo attached to a project spec. Photos accumulate at the
-- home level as a side effect (twelve years from now the next owner
-- inherits photos of every project that touched the house — see memory:
-- project-homeowner-mode-vision). Annotations are stored as JSONB so the
-- v1 pin-and-caption shape can grow into richer overlays without schema
-- churn. Mirrors the jobsite_photos pattern (migration 008) so the same
-- R2 + Sharp pipeline serves both.

BEGIN;

CREATE TABLE IF NOT EXISTS project_photos (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Variant keys (thumb / medium / full) as a JSON object of R2 storage
  -- keys, same shape as jobsite_photos.photo_url.
  photo_url       JSONB NOT NULL,

  -- Pin annotations: array of { id, x, y, caption }. x and y are
  -- fractions of the image (0..1) so overlays scale with rendered size.
  -- Caption is plain text. id is sequential within the photo.
  annotations     JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Display order within the project's gallery (0 = primary).
  position        INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_photos_project_idx
  ON project_photos (project_id, position ASC, id ASC);

COMMIT;
