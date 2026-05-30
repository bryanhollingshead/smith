-- Smith — Migration 010: Jobs module — ingestion + matching foundation
--
-- Phase 2 of the Jobs module (see journal). Schema covers phases 2-3:
--   - job_sources   — driver registry, mirrors news_feeds. Each row is one
--                     ingestion "feed" (an Adzuna query, a Jooble query, or
--                     later: a user-posted-jobs slot).
--   - jobs          — normalized destination. Every driver writes the same
--                     row shape so downstream (matching, feed UI) is dumb.
--   - job_matches   — phase-3 materialized per-user ranking. Schema lands now
--                     so phase 3 is pure code, no migration churn.
--
-- Trusted Auto-Send (phase 6) will share the same jobs table — only
-- application_drafts (migration 011) gains rows + a status value.
--
-- Additive + idempotent: every ALTER and CREATE uses IF NOT EXISTS, matching
-- the 006+ convention. Safe to re-run.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- job_sources — driver registry, mirrors news_feeds
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_sources (
  id               BIGSERIAL PRIMARY KEY,
  driver           TEXT NOT NULL,                  -- 'adzuna' | 'user_post' | 'jooble' | ...
  name             TEXT NOT NULL,                  -- human label, e.g., "Adzuna — Salt Lake City"
  config           JSONB NOT NULL DEFAULT '{}',    -- driver-specific (country, where, what, ...)
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  last_ingested_at TIMESTAMPTZ,
  last_status      TEXT,                           -- 'ok' / error message
  last_count       INTEGER NOT NULL DEFAULT 0,     -- rows inserted on the most recent run
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────
-- jobs — normalized destination table
-- ──────────────────────────────────────────────────────────────────────────
-- UNIQUE (source_driver, source_job_id) is the dedup key — same role as
-- news_articles.source_url. Driver name is stored alongside the FK so we keep
-- the unique key even if a source row is deleted.
CREATE TABLE IF NOT EXISTS jobs (
  id                  BIGSERIAL PRIMARY KEY,
  source_id           BIGINT REFERENCES job_sources(id) ON DELETE SET NULL,
  source_driver       TEXT NOT NULL,
  source_job_id       TEXT NOT NULL,
  title               TEXT NOT NULL,
  company             TEXT,
  description         TEXT,
  location            TEXT,
  lat                 NUMERIC,
  lng                 NUMERIC,
  salary_min          NUMERIC,
  salary_max          NUMERIC,
  salary_currency     TEXT,
  salary_period       TEXT,                        -- 'year' | 'hour' | NULL
  salary_is_predicted BOOLEAN NOT NULL DEFAULT FALSE,
  url                 TEXT,                        -- deep-link to original posting
  contact_email       TEXT,                        -- usually NULL from aggregators; set on user posts
  contact_phone       TEXT,
  trade_tags          TEXT[] NOT NULL DEFAULT '{}',
  skill_tags          TEXT[] NOT NULL DEFAULT '{}',
  structure_type      TEXT,                        -- from job-types.js when inferable
  job_type            TEXT,
  is_prevailing_wage  BOOLEAN NOT NULL DEFAULT FALSE,
  is_direct_post      BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE for posted_by_user_id rows
  posted_by_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  posted_at           TIMESTAMPTZ,
  ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hidden              BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (source_driver, source_job_id)
);

-- Indexes:
--   - Posted-time browse (the feed): partial on NOT hidden so the hot path
--     skips an extra filter step.
--   - Tag lookups via GIN on trade_tags + skill_tags — phase 3 ranking
--     queries these heavily.
--   - Source health: index on source_id for "show me failures from X."
CREATE INDEX IF NOT EXISTS jobs_posted_idx ON jobs (posted_at DESC) WHERE NOT hidden;
CREATE INDEX IF NOT EXISTS jobs_trade_tags_idx ON jobs USING GIN (trade_tags);
CREATE INDEX IF NOT EXISTS jobs_skill_tags_idx ON jobs USING GIN (skill_tags);
CREATE INDEX IF NOT EXISTS jobs_source_idx ON jobs (source_id, ingested_at DESC);
CREATE INDEX IF NOT EXISTS jobs_direct_post_idx ON jobs (posted_by_user_id, posted_at DESC) WHERE is_direct_post;

-- ──────────────────────────────────────────────────────────────────────────
-- job_matches — per-user materialized ranking (populated in phase 3)
-- ──────────────────────────────────────────────────────────────────────────
-- Composite PK so a recompute is just an INSERT ... ON CONFLICT UPDATE.
-- dismissed_at + saved_at are TIMESTAMPTZ rather than booleans so we can
-- show "dismissed 3 days ago" copy and reverse old dismissals if the score
-- shifts a lot.
CREATE TABLE IF NOT EXISTS job_matches (
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id       BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  score        NUMERIC NOT NULL DEFAULT 0,
  dismissed_at TIMESTAMPTZ,
  saved_at     TIMESTAMPTZ,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS job_matches_feed_idx ON job_matches (user_id, score DESC) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS job_matches_saved_idx ON job_matches (user_id, saved_at DESC) WHERE saved_at IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- Seed: one Adzuna source for Salt Lake City. Disabled by default so the
-- scheduler won't hammer Adzuna with bad credentials on first deploy —
-- flip enabled=TRUE in the admin UI (or SQL) after setting ADZUNA_APP_ID +
-- ADZUNA_APP_KEY in env. Geography lives in `config` JSONB so adding a
-- second metro is one INSERT, not a code change.
INSERT INTO job_sources (driver, name, config, enabled)
  VALUES (
    'adzuna',
    'Adzuna — Salt Lake City',
    '{"country":"us","where":"Salt Lake City","results_per_page":50,"max_days_old":14}'::jsonb,
    FALSE
  )
ON CONFLICT DO NOTHING;

COMMIT;
