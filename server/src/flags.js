// Smith — feature flags
//
// Three cluster-level flags gate the half-built / not-ready-for-public
// surfaces (Jobs, Homeowner mode + projects, Hire Me inbound) so production
// shows only the working networking app. Each defaults OFF when the env
// var is unset, so a missing var in prod is safe.
//
// Sentinel parser: ON when env value is one of true/1/yes/on (case-
// insensitive, trimmed); OFF when one of false/0/no/off; otherwise the
// default. Mirrors the REQUIRE_EMAIL_VERIFICATION parser in routes/auth.js.
//
// Local override: set FEATURE_JOBS=true / FEATURE_HOMEOWNER=true /
// FEATURE_HIRE_ME=true in server/.env (gitignored).

const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY  = new Set(['false', '0', 'no', 'off']);

function flag(name, defaultOn = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (TRUTHY.has(raw)) return true;
  if (FALSY.has(raw))  return false;
  return defaultOn;
}

export const FEATURE_JOBS      = flag('FEATURE_JOBS',      false);
export const FEATURE_HOMEOWNER = flag('FEATURE_HOMEOWNER', false);
export const FEATURE_HIRE_ME   = flag('FEATURE_HIRE_ME',   false);

// Log resolved flag state on boot so the server logs make it obvious which
// surfaces are exposed in this process.
export function logFlags() {
  console.log(
    `[flags] jobs=${FEATURE_JOBS} homeowner=${FEATURE_HOMEOWNER} hire_me=${FEATURE_HIRE_ME}`
  );
}
