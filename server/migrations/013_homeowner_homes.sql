-- Smith — Migration 013: Homeowner role + homes table
--
-- Adds the homeowner-acquisition path: a `homes` table that holds a seed
-- profile minted from a confirmed address + auto-pulled public records,
-- plus a `role` column on users so we can fork the post-signup journey
-- (tradespeople still go through trade-selection onboarding; homeowners
-- skip straight to their seed home dashboard).
--
-- Additive + idempotent.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- users.role — fork the post-signup flow
-- ──────────────────────────────────────────────────────────────────────────
-- 'tradesperson' is the default to preserve existing behavior for every
-- account that already exists. 'homeowner' skips trade-selection onboarding
-- (the signup endpoint sets onboarding_done=TRUE on homeowner creation).
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'tradesperson';
ALTER TABLE users ADD CONSTRAINT users_role_chk CHECK (role IN ('tradesperson','homeowner'));

-- ──────────────────────────────────────────────────────────────────────────
-- homes — one row per home a user owns/occupies
-- ──────────────────────────────────────────────────────────────────────────
-- Almost every column is nullable: a seed home starts with just an address
-- and whatever the records provider returned. Users edit the rest in over
-- time. `confirmed_at` is the moment the user clicked "Yes, this is my
-- home" on the AddressFound screen — un-confirmed rows are abandoned
-- carts and can be GC'd later.
CREATE TABLE IF NOT EXISTS homes (
  id                       BIGSERIAL PRIMARY KEY,
  owner_user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Canonical address
  address_line1            TEXT NOT NULL,
  city                     TEXT NOT NULL,
  state                    TEXT NOT NULL,
  postal_code              TEXT NOT NULL,
  neighborhood             TEXT,

  -- External-provider place reference (Google Places / Smarty / etc.) so
  -- we can re-resolve to canonical lat/lon and re-pull records later.
  -- Stubbed string for now.
  place_id                 TEXT,

  -- Auto-pulled facts — all nullable, all user-editable.
  year_built               INTEGER,
  square_feet              INTEGER,
  bedrooms                 INTEGER,
  bathrooms                NUMERIC(3,1),
  lot_acres                NUMERIC(5,2),
  stories                  TEXT,
  last_sold_date           TEXT,           -- "Sep 2022" — text matches how the design displays it
  last_sold_price          INTEGER,        -- whole dollars
  roof_material            TEXT,
  roof_year                INTEGER,
  heating                  TEXT,

  -- Provenance
  facts_source             TEXT NOT NULL DEFAULT 'public_records', -- 'public_records' | 'user' | 'stub'
  facts_source_attribution TEXT,                                   -- "Salt Lake County Assessor · est. 2024"

  -- Entry path → drives the seed dashboard's "Your first project" card.
  entry_source             TEXT NOT NULL DEFAULT 'self-serve',
  pending_pro_slug         TEXT,                                   -- only set when entry_source='hire-me'

  confirmed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (entry_source IN ('self-serve','hire-me')),
  CHECK (facts_source IN ('public_records','user','stub'))
);
CREATE INDEX IF NOT EXISTS homes_owner_idx ON homes (owner_user_id, created_at DESC);

COMMIT;
