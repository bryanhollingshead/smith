-- Smith — Credential document storage (phase 1: local disk)
--
-- Adds optional file-attachment columns to licenses + users.insurance fields.
-- doc_url stores ONLY the filename (e.g. "license-7-a3f2c0.pdf"), not a full
-- URL. The serving layer builds the URL at response time. This keeps the DB
-- portable when we move from local disk to S3 later — only the serving code
-- changes, not the schema.
--
-- share_public defaults FALSE. When TRUE, viewers other than the owner can
-- download the doc. When FALSE, only the owner can.

BEGIN;

ALTER TABLE licenses
  ADD COLUMN doc_url         TEXT,
  ADD COLUMN doc_mime        TEXT,
  ADD COLUMN doc_uploaded_at TIMESTAMPTZ,
  ADD COLUMN share_public    BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN insurance_doc_url         TEXT,
  ADD COLUMN insurance_doc_mime        TEXT,
  ADD COLUMN insurance_doc_uploaded_at TIMESTAMPTZ,
  ADD COLUMN insurance_share_public    BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
