-- Smith — Migration 016: Network invites
--
-- Tradesman-to-tradesman invite system. A user types an email + optional
-- personal note; we mint a token, email the invitee a magic signup link,
-- and on signup acceptance auto-create a connection between inviter and
-- new user.
--
-- The `accepted_user_id` FK lets us look up "who joined via this invite"
-- after the fact for surfacing (e.g. "Joined via Bryan Hollingshead").

BEGIN;

CREATE TABLE IF NOT EXISTS invites (
  id                BIGSERIAL PRIMARY KEY,
  inviter_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email             CITEXT NOT NULL,
  token             TEXT UNIQUE NOT NULL,
  message           TEXT,                 -- optional personal note quoted in the email
  status            TEXT NOT NULL DEFAULT 'pending',
  accepted_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS invites_inviter_idx ON invites (inviter_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS invites_email_idx   ON invites (email);

COMMIT;
