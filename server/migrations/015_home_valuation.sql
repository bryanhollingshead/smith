-- Smith — Migration 015: Home valuation + provider provenance
--
-- Adds the columns we need to surface the "your home is worth ~$X" magic
-- moment at signup, plus the geocoded coordinates and a provider tag so we
-- know where each row's facts came from (rentcast | stub | unavailable).
--
-- All additive + idempotent. No existing rows are touched.

BEGIN;

ALTER TABLE homes ADD COLUMN IF NOT EXISTS latitude            NUMERIC(9,6);
ALTER TABLE homes ADD COLUMN IF NOT EXISTS longitude           NUMERIC(9,6);

-- Sale value estimate (whole dollars). Pulled from the property-data
-- provider's AVM at signup, refreshed on demand later. Low/high are the
-- provider's confidence band — Rentcast uses ~85%.
ALTER TABLE homes ADD COLUMN IF NOT EXISTS value_estimate      INTEGER;
ALTER TABLE homes ADD COLUMN IF NOT EXISTS value_estimate_low  INTEGER;
ALTER TABLE homes ADD COLUMN IF NOT EXISTS value_estimate_high INTEGER;
ALTER TABLE homes ADD COLUMN IF NOT EXISTS value_estimated_at  TIMESTAMPTZ;

-- Which provider produced the facts on this row. Separate from
-- facts_source ('public_records' | 'user' | 'stub') because that one
-- describes *kind* of source while this names the specific upstream.
ALTER TABLE homes ADD COLUMN IF NOT EXISTS facts_provider TEXT;

COMMIT;
