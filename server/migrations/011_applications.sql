-- Smith — Migration 011: Application drafts
--
-- Phase 4 of the Jobs module — assisted apply. Schema also covers Trusted
-- Auto-Send (phase 6) with no migration: a new `auto_sent` status value
-- and (later) an auto_send_templates table for the user-approved templates.
-- Both extensions are additive.
--
-- One row per (user, job) pair. The user reviews the LLM-generated body
-- (or template fallback when ASSISTED_APPLY_LLM is off), optionally edits
-- it, then sends. Sending records sent_at and freezes the row in status
-- 'sent' — re-applying to the same job needs a manual delete first.
--
-- Idempotent + additive — same convention as 006+.

BEGIN;

CREATE TABLE IF NOT EXISTS application_drafts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  -- What the model wrote. Kept verbatim so we can see the original even
  -- after the user edits.
  generated_body  TEXT NOT NULL,
  -- The user's edited version. NULL = unchanged from generated_body.
  edited_body     TEXT,

  -- How the apply is delivered. 'deeplink' means we don't actually send —
  -- the user copies the body and pastes it into the source site. 'email'
  -- and 'sms' route through mailer / (future) sms provider. 'onsite'
  -- (deferred) would post a Smith message thread when the recipient is
  -- itself a Smith user.
  channel         TEXT NOT NULL,                   -- 'email' | 'sms' | 'onsite' | 'deeplink'

  -- 'draft' until sent; 'sent' after. Phase 6 (Trusted Auto-Send) adds
  -- 'auto_sent' here without a schema change.
  status          TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'sent' | 'auto_sent'

  -- Resolved recipient. For email/sms this is the address/number used at
  -- send-time (could differ from jobs.contact_email if the user overrode).
  recipient_email TEXT,
  recipient_phone TEXT,

  sent_at         TIMESTAMPTZ,
  send_error      TEXT,                            -- last error if a send attempt failed

  -- Which Anthropic model wrote the draft. NULL means template fallback
  -- (ASSISTED_APPLY_LLM was off). Useful for cost attribution.
  llm_model       TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, job_id),
  CHECK (channel IN ('email','sms','onsite','deeplink')),
  CHECK (status  IN ('draft','sent','auto_sent'))
);

-- Inbox + history reads are always per-user, status-filtered or not.
CREATE INDEX IF NOT EXISTS application_drafts_user_idx
  ON application_drafts (user_id, status, created_at DESC);

-- updated_at trigger — reuse the same set_updated_at function migration 001
-- defines for users.
CREATE TRIGGER application_drafts_updated_at BEFORE UPDATE ON application_drafts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
