-- Smith — Database schema
-- Construction networking platform
-- All tables use BIGSERIAL for ids and UTC timestamps.

BEGIN;

-- ==========================================================================
-- USERS & AUTH
-- ==========================================================================

CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,

  first_name      TEXT NOT NULL DEFAULT '',
  last_name       TEXT NOT NULL DEFAULT '',
  headline        TEXT NOT NULL DEFAULT '',
  location        TEXT NOT NULL DEFAULT '',
  about           TEXT NOT NULL DEFAULT '',

  -- Profile look
  avatar_tone     TEXT NOT NULL DEFAULT 'wood',     -- maps to <Avatar tone>
  cover_kind      TEXT NOT NULL DEFAULT 'frame',    -- maps to <Photo kind>

  -- Verification badge ("Verified Smith") — set by ops/admin in real life
  verified_smith  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Career-level facts
  years_experience INTEGER NOT NULL DEFAULT 0,
  union_name       TEXT,
  union_member_since TEXT,        -- year as text — designs show "since 2008"
  apprentice_hours INTEGER NOT NULL DEFAULT 0,
  apprentice_required INTEGER NOT NULL DEFAULT 8000,
  apprentice_status TEXT NOT NULL DEFAULT 'Apprentice', -- e.g. Journeyman, Master

  insurance_carrier TEXT,
  insurance_limit   TEXT,
  insurance_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- Onboarding tracking
  onboarding_step INTEGER NOT NULL DEFAULT 1,  -- 1..5; 5 means done
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX users_location_idx ON users (location);

-- 6-digit signup verification codes. One active per user.
CREATE TABLE email_verification_codes (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX evc_user_idx ON email_verification_codes (user_id) WHERE consumed_at IS NULL;

-- Forgot-password tokens. 30 min expiry per the design copy.
CREATE TABLE password_reset_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX prt_user_idx ON password_reset_tokens (user_id);

-- Issued auth sessions (so password-reset can revoke siblings, per design copy).
CREATE TABLE sessions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  user_agent  TEXT,
  ip          TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;

-- Mock email outbox — lets tests / the dev UI read what was "sent".
CREATE TABLE mock_emails (
  id          BIGSERIAL PRIMARY KEY,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  kind        TEXT NOT NULL,   -- 'verification' | 'reset' | 'notification'
  meta        JSONB,           -- e.g. { code: '842316' } so tests can read it directly
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================================================
-- TRADES (canonical list — picked during onboarding)
-- ==========================================================================
CREATE TABLE trades (
  id     BIGSERIAL PRIMARY KEY,
  name   TEXT UNIQUE NOT NULL,
  icon   TEXT NOT NULL DEFAULT 'tool',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_trades (
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trade_id  BIGINT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  years     INTEGER NOT NULL DEFAULT 0,
  position  INTEGER NOT NULL DEFAULT 0,  -- 0 = primary
  PRIMARY KEY (user_id, trade_id)
);
CREATE INDEX user_trades_user_pos_idx ON user_trades (user_id, position);

-- ==========================================================================
-- LICENSES / CREDENTIALS
-- ==========================================================================
CREATE TABLE licenses (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  number      TEXT NOT NULL,
  expiration  TEXT NOT NULL,       -- "YYYY-MM" — designs show truncated dates
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  document_path TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX licenses_user_idx ON licenses (user_id);

-- ==========================================================================
-- COMPANIES & WORK HISTORY
-- ==========================================================================
-- Companies are entities anyone can create / claim.
CREATE TABLE companies (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'General Contractor', -- e.g. 'GC', 'Sub · Carpentry'
  logo_tone   TEXT NOT NULL DEFAULT 'rust',
  claimed_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX companies_name_idx ON companies (LOWER(name));

-- A user's tenure at a company (rolewise — the "Where I've worked" timeline).
CREATE TABLE work_history (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id   BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role         TEXT NOT NULL,
  from_year    TEXT NOT NULL,           -- "2021"
  to_year      TEXT,                    -- NULL = current; design shows "Present"
  is_current   BOOLEAN NOT NULL DEFAULT FALSE,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX work_history_user_idx ON work_history (user_id, position);

-- Jobsites attached to a tenure (the unique structural piece).
CREATE TABLE jobsites (
  id              BIGSERIAL PRIMARY KEY,
  work_history_id BIGINT NOT NULL REFERENCES work_history(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,           -- e.g. "Sweetgrass Residence"
  kind            TEXT NOT NULL,           -- e.g. "Custom Home · 4,200 sqft"
  location        TEXT NOT NULL,
  duration        TEXT NOT NULL,           -- e.g. "2023–2024"
  photo_kind      TEXT NOT NULL DEFAULT 'frame',
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX jobsites_wh_idx ON jobsites (work_history_id, position);
CREATE INDEX jobsites_featured_idx ON jobsites (is_featured) WHERE is_featured;

-- ==========================================================================
-- SKILLS (right-rail "Skills" list with endorsements)
-- ==========================================================================
CREATE TABLE skills (
  id        BIGSERIAL PRIMARY KEY,
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  level     INTEGER NOT NULL DEFAULT 3,    -- 1..5 (designs show 5 dots)
  position  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);
CREATE INDEX skills_user_idx ON skills (user_id, position);

CREATE TABLE skill_endorsements (
  skill_id    BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  endorser_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (skill_id, endorser_id)
);

-- ==========================================================================
-- CONNECTIONS (network)
-- ==========================================================================
-- Modeled as directed pending requests, undirected once accepted.
-- We always store with user_a_id < user_b_id once accepted to avoid duplicates.
CREATE TABLE connections (
  id           BIGSERIAL PRIMARY KEY,
  user_a_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,              -- 'pending' | 'accepted' | 'blocked'
  requested_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (user_a_id <> user_b_id),
  CHECK (status IN ('pending','accepted','blocked')),
  UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX connections_a_status_idx ON connections (user_a_id, status);
CREATE INDEX connections_b_status_idx ON connections (user_b_id, status);

-- ==========================================================================
-- POSTS (feed)
-- ==========================================================================
-- type values mirror the SAMPLE.feed designs:
--   project    — "wrapped framing on the Hyalite cabin"
--   hiring     — "Looking for a journeyman electrician"
--   milestone  — "Just hit 10,000 hours"
CREATE TABLE posts (
  id           BIGSERIAL PRIMARY KEY,
  author_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'project',
  body         TEXT NOT NULL,
  project_name TEXT,             -- optional pinned project label
  milestone    TEXT,              -- e.g. "10,000 hours"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX posts_author_idx ON posts (author_id, created_at DESC);
CREATE INDEX posts_created_idx ON posts (created_at DESC);

CREATE TABLE post_photos (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  photo_kind TEXT NOT NULL,    -- frame, wood, brick, kitchen, ...
  position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX post_photos_post_idx ON post_photos (post_id, position);

CREATE TABLE post_tags (
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL,    -- e.g. 'Hiring', 'Journeyman'
  PRIMARY KEY (post_id, tag)
);

CREATE TABLE post_likes (
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_likes_user_idx ON post_likes (user_id, created_at DESC);

CREATE TABLE post_comments (
  id         BIGSERIAL PRIMARY KEY,
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX post_comments_post_idx ON post_comments (post_id, created_at);

-- ==========================================================================
-- NOTIFICATIONS (top bar bell)
-- ==========================================================================
CREATE TABLE notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,        -- 'connection_request' | 'connection_accepted' | 'post_like' | 'post_comment'
  actor_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  subject_id BIGINT,                -- post id, connection id, etc
  body       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

-- ==========================================================================
-- updated_at triggers
-- ==========================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
