-- is_pm: distinguishes Smith team / product-manager accounts from customer
-- accounts. Used to source-tag feedback Signals (PM feedback vs customer
-- feedback) so triage in Linear can prioritize one over the other.
--
-- Kept separate from is_admin on purpose — admin is operational permission
-- (e.g. moderation, demo-user creation, impersonation). PM is identity. The
-- two will diverge over time (an admin moderator who isn't on the PM team).

ALTER TABLE users ADD COLUMN is_pm BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill the founder so PM feedback flows the moment the widget ships.
-- Email lookup is case-insensitive to match the case-insensitive uniqueness
-- of users.email everywhere else.
UPDATE users
   SET is_pm = TRUE
 WHERE LOWER(email) = LOWER('bryan.hollingshead@gmail.com');
