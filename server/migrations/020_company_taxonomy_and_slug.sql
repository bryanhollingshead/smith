-- Company taxonomy + public-slug for SEO/AI surfacing.
--
-- public_slug:        shareable URL piece, locked at first generation
--                     ("three-oaks-millwork-1234"). Mirrors users.public_slug.
-- cover_url/cover_kind: optional cover image (uploaded URL keys OR placeholder
--                     kind for the gradient render). Mirrors users.cover_*.
-- company_trades:     pulls from the existing trades catalog, replace-all per
--                     the steward (matches user_trades shape).
-- company_skills:     free-text specialty descriptors per company, replace-all
--                     (matches the skills table for users).

ALTER TABLE companies
  ADD COLUMN public_slug TEXT UNIQUE,
  ADD COLUMN cover_url   TEXT,
  ADD COLUMN cover_kind  TEXT;

CREATE TABLE company_trades (
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trade_id   BIGINT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, trade_id)
);
CREATE INDEX company_trades_trade_idx ON company_trades (trade_id);

CREATE TABLE company_skills (
  id         BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (company_id, name)
);
CREATE INDEX company_skills_company_idx ON company_skills (company_id);

-- Backfill slugs for every existing company. Slug shape mirrors users: name
-- letters then a 4-digit suffix so the React router can disambiguate slug vs
-- numeric id on /company/<param> without a lookup. Accents are not normalized
-- here (rare in company names); the slugify helper in server/src/slug.js does
-- a fuller pass for any new companies created post-migration.
UPDATE companies c
   SET public_slug = COALESCE(
         NULLIF(
           regexp_replace(
             regexp_replace(lower(c.name), '[^a-z0-9]+', '-', 'g'),
             '(^-+|-+$)', '', 'g'
           ),
           ''
         ),
         'company'
       )
       || '-' || LPAD((c.id % 10000)::text, 4, '0')
 WHERE c.public_slug IS NULL;
