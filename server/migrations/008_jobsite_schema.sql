-- Smith — Migration 008: jobsite form refactor
--
-- Two things happen here, both additive (nothing removed, per the API
-- Commandment):
--   1. Structured fields on jobsites: structure_type, job_type, year.
--      These replace the freeform `kind` / `duration` in the new form.
--   2. A multi-photo gallery (jobsite_photos), replacing the single
--      jobsites.photo_url as the *source of truth* — though photo_url stays
--      as a denormalized mirror of the primary (position-0) photo so every
--      existing read path keeps working untouched.
--
-- Backward compatibility:
--   - `kind` and `duration` are NOT dropped. Old rows + demo data keep their
--     values; the frontend renders job_type ?? kind and year ?? duration.
--   - We only loosen their NOT NULL constraints so new rows (which use the
--     structured fields instead) don't have to populate them.

BEGIN;

-- ── 1. Structured fields ────────────────────────────────────────────
-- structure_type : what was built (Single-family, Townhome, Remodel, …)
-- job_type       : the work performed (Service upgrade, Sub panel install, …)
-- year           : single year the work happened (replaces freeform duration)
-- All nullable in the DB (old rows have none); the route + form enforce that
-- structure_type / job_type are required on create.
ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS structure_type TEXT;
ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS job_type       TEXT;
ALTER TABLE jobsites ADD COLUMN IF NOT EXISTS year           INTEGER;

-- The new form no longer collects `kind` / `duration`, but they're NOT NULL
-- today. Keep the columns (read as a fallback) and just loosen the constraint
-- so structured-only rows can leave them empty.
ALTER TABLE jobsites ALTER COLUMN kind     DROP NOT NULL;
ALTER TABLE jobsites ALTER COLUMN duration DROP NOT NULL;

-- ── 2. Multi-photo gallery ──────────────────────────────────────────
-- Mirrors the post_photos pattern (jobsite_id + position) plus a photo_url
-- holding the {thumb,medium,full} storage-key JSON used everywhere else.
-- Lowest position = primary. jobsites.photo_url (migration 007) is kept as a
-- denormalized mirror of the primary photo, maintained by the photo
-- endpoints, so profile cards / Featured Work / edit thumbnails need no
-- changes for the common "show the primary photo" case.
CREATE TABLE IF NOT EXISTS jobsite_photos (
  id          BIGSERIAL PRIMARY KEY,
  jobsite_id  BIGINT NOT NULL REFERENCES jobsites(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,            -- JSON {"thumb":"<key>","medium":"...","full":"..."}
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS jobsite_photos_idx ON jobsite_photos (jobsite_id, position);

-- Backfill: every jobsite that already has a single uploaded photo becomes
-- its position-0 gallery photo. Guarded so a manual re-run can't duplicate.
INSERT INTO jobsite_photos (jobsite_id, photo_url, position)
SELECT id, photo_url, 0
  FROM jobsites
 WHERE photo_url IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM jobsite_photos jp WHERE jp.jobsite_id = jobsites.id
   );

COMMIT;
