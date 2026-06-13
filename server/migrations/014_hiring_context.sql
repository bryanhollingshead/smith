-- Smith — Migration 014: Homeowner hiring-context (label-derivation only)
--
-- One-tap question asked during the lightweight homeowner onboarding (and the
-- first-switch setup when an existing tradesman flips to homeowner mode).
-- Drives the DISPLAYED mode label everywhere a homeowner mode is rendered:
--   own_home          → "Homeowner"
--   property_manager  → "Property manager"
--   NULL (never asked) → defaults to "Homeowner" client-side
--
-- This is display-label logic only — account mode (users.role), schema, the
-- mode toggle, and every other behavior are identical regardless of value.
-- The label string is NEVER stored; client derives it via lib/mode.js.
--
-- Additive + idempotent. Existing rows stay NULL → render as "Homeowner" if
-- they ever switch to homeowner mode.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS hiring_context TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_hiring_context_chk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_hiring_context_chk
      CHECK (hiring_context IS NULL OR hiring_context IN ('own_home','property_manager'));
  END IF;
END $$;

COMMIT;
