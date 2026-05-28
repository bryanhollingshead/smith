-- Smith — Migration 009: Smith God accounts
--
-- Flags a small set of existing accounts (smith deities — Hephaestus, Vulcan,
-- Ptah, Ilmarinen, etc.) so they can be surfaced as network "Suggestions" for
-- new / under-connected users, as a branding/onboarding device.
--
-- This migration ONLY adds the column. Which accounts are gods is set by hand
-- afterward (the email list lives outside the codebase), e.g. in Render Shell:
--   UPDATE users SET is_smith_god = TRUE WHERE email IN ('hephaestus@smith.app', ...);
--
-- Additive + idempotent, like every migration since 006.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_smith_god BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: only the handful of god rows get indexed, so the
-- "WHERE is_smith_god = TRUE" lookup in the suggestions endpoint stays cheap
-- as the users table grows.
CREATE INDEX IF NOT EXISTS users_smith_god_idx ON users (id) WHERE is_smith_god;

COMMIT;
