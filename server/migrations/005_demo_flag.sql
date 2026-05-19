-- Smith — is_demo flag
--
-- Marks an account as a demo profile. Demos are visible everywhere (search,
-- suggestions, news authorship if applicable) but the connection-request and
-- messaging endpoints exclude them server-side and the UI tags them with a
-- small "Demo" badge.
--
-- Why a column on users (not a separate demos table): demos and real users
-- share every other table (profiles, work history, skills, etc.). Splitting
-- them would require duplicating dozens of joins. A boolean flag is cheaper.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS users_is_demo ON users (is_demo) WHERE is_demo = TRUE;

COMMIT;
