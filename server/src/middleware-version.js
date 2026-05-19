// Smith — Client version header middleware
//
// Reads the `Smith-Version` request header (a date string identifying when
// the client was built, e.g. "2026-05-19") and attaches it to req.smithVersion.
//
// This middleware is currently informational — no route uses req.smithVersion
// for behavior gating. We ship the plumbing so that if we ever NEED to gate
// behavior on client version (rare, see docs/API_COMMANDMENT.md), the wiring
// is in place.
//
// The header is OPTIONAL. Older clients that don't send it just get
// req.smithVersion === null.

const HEADER_NAME = 'smith-version'; // express lowercases headers
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function readClientVersion(req, _res, next) {
  const raw = req.headers[HEADER_NAME];
  if (typeof raw === 'string' && DATE_PATTERN.test(raw)) {
    req.smithVersion = raw;
  } else {
    req.smithVersion = null;
  }
  next();
}
