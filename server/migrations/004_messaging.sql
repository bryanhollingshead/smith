-- Smith — Messaging (phase 1: 1-on-1 text-only DMs)
--
-- Schema is intentionally group-thread-ready: instead of `user_a_id` and
-- `user_b_id` columns on threads, we use a participants table. v1 enforces
-- "exactly 2 participants" at the application layer; v2 will lift that cap
-- with no schema change.
--
-- Read receipts (read_at on messages) are deferred — when we ship them it's
-- ALTER TABLE messages ADD COLUMN read_at TIMESTAMPTZ. Schema noted but not
-- created so we don't pretend to have a feature we don't.

BEGIN;

-- A thread is the container for a conversation. last_message_at is denormalized
-- from messages — kept fresh in the same transaction that inserts each message
-- so we can list a user's threads sorted by recency with a single index hit.
CREATE TABLE message_threads (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX message_threads_last_at ON message_threads (last_message_at DESC);

-- Participants. A user can be in many threads; a thread has many users.
-- For v1 we enforce "exactly 2 participants" in code, not in the schema.
-- last_read_at lets us compute unread counts cheaply: count messages in the
-- thread newer than this timestamp.
CREATE TABLE message_participants (
  thread_id    BIGINT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX message_participants_user ON message_participants (user_id);

-- Actual messages. Cap on body is enforced both here and in the API.
CREATE TABLE messages (
  id          BIGSERIAL PRIMARY KEY,
  thread_id   BIGINT NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread ON messages (thread_id, created_at DESC);

COMMIT;
