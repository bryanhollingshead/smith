-- is_owner on work_history: the user's self-asserted ownership of the
-- company tied to this tenure. Source of truth for "who runs this
-- company" — distinct from the existing companies.claimed_by steward
-- field, which we'll retire once the owner flow is live.
--
-- Edit rights on the company profile are derived from
-- (is_owner = TRUE AND is_current = TRUE) for the requesting user.
-- A worker who adds a company to their resume gets a basic profile
-- created but does NOT get edit rights; an actual owner asserts via
-- this flag when populating their own work history.

ALTER TABLE work_history
  ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT FALSE;

-- Index supports the "is this user a current owner of company X?" check
-- on every company edit, and the "owners of company X" lookup on the
-- public profile.
CREATE INDEX work_history_owner_idx
  ON work_history (company_id, user_id)
  WHERE is_owner AND is_current;
