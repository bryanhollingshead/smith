// Smith — client feature flags
//
// Mirrors server/src/flags.js. Three cluster flags hide nav items, routes,
// and CTAs for surfaces that aren't ready for public traffic. Each defaults
// OFF when the corresponding VITE_* env var is unset, so a stale build with
// no env file is safe in prod.
//
// Vite inlines `import.meta.env.VITE_*` at build time. Local override:
//   client/.env (gitignored):
//     VITE_FEATURE_JOBS=true
//     VITE_FEATURE_HOMEOWNER=true
//     VITE_FEATURE_HIRE_ME=true

const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY  = new Set(['false', '0', 'no', 'off']);

function v(name, defaultOn = false) {
  const raw = String(import.meta.env[name] ?? '').trim().toLowerCase();
  if (TRUTHY.has(raw)) return true;
  if (FALSY.has(raw))  return false;
  return defaultOn;
}

export const FEATURE_JOBS      = v('VITE_FEATURE_JOBS',      false);
export const FEATURE_HOMEOWNER = v('VITE_FEATURE_HOMEOWNER', false);
export const FEATURE_HIRE_ME   = v('VITE_FEATURE_HIRE_ME',   false);
