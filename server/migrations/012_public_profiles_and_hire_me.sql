-- Smith — Migration 012: Public profiles + Hire Me
--
-- Phase 5 of the Jobs module — the inbound counterpart to Apply. Tradesmen
-- opt in via is_public; their profile becomes searchable + reachable via a
-- "Hire Me" form. Inquirer needs no Smith account; replies are routed via
-- single-use magic-link tokens emailed back to them.
--
-- Schema changes:
--   1. users.is_public  + users.public_slug   (opt-in surface)
--   2. messages.sender_id NULL-able + sender_name_override
--      (lets us thread inquirer messages without a Smith account — the
--       existing /api/messages infra Just Works for the target side)
--   3. hire_me_inquiries                       (structured intake form)
--   4. hire_me_tokens                          (magic-link replies)
--   5. pg_trgm + GIN index on users for /api/public/search
--
-- Additive + idempotent.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- users — public visibility (opt-in)
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_slug TEXT;

-- UNIQUE on public_slug — only enforced for non-NULL rows. Partial unique
-- index gives us this for free without blocking the NULL-default rollout.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_public_slug_uniq') THEN
    CREATE UNIQUE INDEX users_public_slug_uniq ON users (public_slug) WHERE public_slug IS NOT NULL;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- messages — let inquirer-side messages live in a normal thread without a
-- Smith user account
-- ──────────────────────────────────────────────────────────────────────────
-- Drop NOT NULL on sender_id. NULL = "message originated outside Smith"
-- (currently: only Hire Me inquirer messages). sender_name_override carries
-- the display name in that case.
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name_override TEXT;

-- ──────────────────────────────────────────────────────────────────────────
-- hire_me_inquiries — structured intake form
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hire_me_inquiries (
  id                 BIGSERIAL PRIMARY KEY,
  target_user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Inquirer is anonymous in the DB sense. Required fields gate the submit.
  inquirer_name      TEXT NOT NULL,
  inquirer_email     TEXT NOT NULL,
  inquirer_phone     TEXT,

  -- Structured fields use job-types.js vocab on the frontend; stored verbatim.
  structure_type     TEXT,
  job_type           TEXT,
  location           TEXT,
  timeline           TEXT,
  message            TEXT NOT NULL,

  -- Bridge to the reusable messages thread that holds the conversation.
  -- NULL only briefly between insert and thread creation (insert is in one
  -- transaction; tolerated for defensive reads).
  message_thread_id  BIGINT REFERENCES message_threads(id) ON DELETE SET NULL,

  status             TEXT NOT NULL DEFAULT 'new',     -- 'new' | 'replied' | 'archived' | 'spam'

  -- Denormalized at insert: TRUE iff inquirer_email matches a Smith user the
  -- target is already connected to. Lets the inbox UI prioritize warm leads.
  is_connection_of   BOOLEAN NOT NULL DEFAULT FALSE,

  ip                 TEXT,                            -- for abuse-tracking; not surfaced
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (status IN ('new','replied','archived','spam'))
);
CREATE INDEX IF NOT EXISTS hire_me_inquiries_target_idx
  ON hire_me_inquiries (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hire_me_inquiries_thread_idx
  ON hire_me_inquiries (message_thread_id) WHERE message_thread_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- hire_me_tokens — magic-link replies
-- ──────────────────────────────────────────────────────────────────────────
-- One token per email sent to the inquirer. When the target user posts a
-- reply in a Hire Me thread, we generate a fresh token here + send the
-- inquirer an email containing /h/<token>. Token is single-use on REPLY
-- (POST /api/public/hire-me/thread/:token/reply); GET-only views don't burn it.
CREATE TABLE IF NOT EXISTS hire_me_tokens (
  id                BIGSERIAL PRIMARY KEY,
  target_thread_id  BIGINT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  inquirer_email    TEXT NOT NULL,
  token             TEXT UNIQUE NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  used_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hire_me_tokens_thread_idx
  ON hire_me_tokens (target_thread_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- Public search index (pg_trgm)
-- ──────────────────────────────────────────────────────────────────────────
-- Postgres trigram extension powers fast ILIKE / similarity queries. Index
-- only is_public rows so the hot path stays small.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_public_search_trgm_idx') THEN
    CREATE INDEX users_public_search_trgm_idx
      ON users USING GIN (
        (LOWER(first_name || ' ' || last_name || ' ' || COALESCE(headline, '') || ' ' || COALESCE(location, ''))) gin_trgm_ops
      )
      WHERE is_public;
  END IF;
END $$;

COMMIT;
