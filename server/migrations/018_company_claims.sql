-- Witness-attested company claims.
-- A user with work-history at a company can request to become its steward.
-- Other Smith users with work-history at the same company co-sign the claim.
-- On enough confirms (min_cosigns), the request is granted and the requester
-- becomes the company's steward (companies.claimed_by).
--
-- Solo case (no other Smith users have work-history at this company) is
-- handled by the existing POST /api/companies/:id/claim route — no request
-- needed.

CREATE TABLE company_claim_requests (
  id           BIGSERIAL PRIMARY KEY,
  company_id   BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'granted', 'declined', 'cancelled')),
  min_cosigns  INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_at   TIMESTAMPTZ
);

-- Only one open request per (company, requester) at a time.
CREATE UNIQUE INDEX company_claim_requests_one_pending_per_user
  ON company_claim_requests (company_id, requester_id)
  WHERE status = 'pending';

CREATE INDEX company_claim_requests_company_idx
  ON company_claim_requests (company_id);

CREATE TABLE company_claim_cosigns (
  request_id   BIGINT NOT NULL REFERENCES company_claim_requests(id) ON DELETE CASCADE,
  cosigner_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision     TEXT NOT NULL DEFAULT 'pending'
               CHECK (decision IN ('pending', 'confirm', 'decline')),
  decided_at   TIMESTAMPTZ,
  PRIMARY KEY (request_id, cosigner_id)
);

CREATE INDEX company_claim_cosigns_cosigner_idx
  ON company_claim_cosigns (cosigner_id) WHERE decision = 'pending';
