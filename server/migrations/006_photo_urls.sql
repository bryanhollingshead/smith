-- Smith — Photo URLs on user profiles
--
-- Adds avatar_url and cover_url to users. These are nullable; when null,
-- the frontend falls back to the existing avatar_tone (initial-letter
-- monogram with a colored background) and cover_kind (colored gradient).
--
-- This is purely additive: existing data keeps rendering exactly as before.
-- Old clients (mobile builds that haven't shipped yet, but planning ahead)
-- that don't know about these columns just ignore them.
--
-- Per the API Commandment: never remove avatar_tone or cover_kind. They
-- remain the canonical fallbacks forever.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url  TEXT;

-- avatar_url and cover_url store JSON like
-- { "thumb": "users/42/avatar-abc.webp", "medium": "...", "full": "..." }
-- We keep them as TEXT (not jsonb) because we only ever read them whole;
-- jsonb would add complexity without a payoff at this scale.

COMMIT;
