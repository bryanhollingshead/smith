-- Smith — News (phase 1)
-- Adds:
--   - users.is_admin flag (Marcus gets it in the seed; powers /admin/news)
--   - news_articles: ingested or seeded articles
--   - news_feeds: list of RSS feeds we pull from (the ingester reads this)
--   - news_saves: bookmarks per user

BEGIN;

ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- One article per row. We dedupe ingestion on source_url.
-- categories and tags are TEXT[] for query simplicity at our scale; this
-- keeps the ingester boring and lets us GIN-index for tag lookups.
CREATE TABLE news_articles (
  id           BIGSERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  summary      TEXT,                          -- 1-line excerpt; nullable
  source       TEXT NOT NULL,                 -- e.g. 'Construction Dive'
  source_url   TEXT UNIQUE NOT NULL,          -- canonical link to original
  author       TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_minutes INTEGER NOT NULL DEFAULT 3,
  image_kind   TEXT NOT NULL DEFAULT 'frame', -- matches our Photo placeholder kinds
  category     TEXT NOT NULL,                 -- one of the 7 top-level categories
  tags         TEXT[] NOT NULL DEFAULT '{}',
  featured     BOOLEAN NOT NULL DEFAULT FALSE, -- admin pin to hero strip
  hidden       BOOLEAN NOT NULL DEFAULT FALSE, -- admin hide from public lists
  ingested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX news_articles_category_idx ON news_articles (category, published_at DESC) WHERE NOT hidden;
CREATE INDEX news_articles_featured_idx ON news_articles (published_at DESC) WHERE featured AND NOT hidden;
CREATE INDEX news_articles_tags_idx     ON news_articles USING GIN (tags);
CREATE INDEX news_articles_published_idx ON news_articles (published_at DESC) WHERE NOT hidden;

-- RSS feeds we pull from. Editable in the DB (and eventually a UI).
CREATE TABLE news_feeds (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,                -- human label, becomes the article's `source`
  url         TEXT UNIQUE NOT NULL,
  category    TEXT NOT NULL,                -- default category for items from this feed
  default_tags TEXT[] NOT NULL DEFAULT '{}',
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  last_ingested_at TIMESTAMPTZ,
  last_status      TEXT,                    -- 'ok' / error message
  last_count       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE news_saves (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id BIGINT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX news_saves_user_idx ON news_saves (user_id, saved_at DESC);

COMMIT;
