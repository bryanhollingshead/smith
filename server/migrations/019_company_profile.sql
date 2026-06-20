-- Company profile fields for the steward-edited public page.
-- tagline:          one-sentence "what they build"
-- founded_year:     integer year
-- primary_location: free-text town/region
-- about:            longer-form description
-- signature_jobsite_id: pinned work the steward wants foregrounded
-- updated_at:       bumped by a trigger on every UPDATE, mirrors the users table

ALTER TABLE companies
  ADD COLUMN tagline             TEXT,
  ADD COLUMN founded_year        INTEGER,
  ADD COLUMN primary_location    TEXT,
  ADD COLUMN about               TEXT,
  ADD COLUMN signature_jobsite_id BIGINT REFERENCES jobsites(id) ON DELETE SET NULL,
  ADD COLUMN updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Reuse the set_updated_at function from 001_init.sql.
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
