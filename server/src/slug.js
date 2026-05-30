// Smith — Public slug generation
//
// Slug shape (locked in the plan): `first-last-####` — always has letters
// (the name) so the React router can disambiguate slug vs numeric id on
// `/profile/<param>` without a lookup. The 4-digit suffix gives ~10K slots
// per name, more than enough at our scale.
//
// Collisions: retry with a fresh number. Pathological case (every suffix
// already taken for one name) falls through to a longer random suffix.

import crypto from 'node:crypto';
import { q } from './db.js';

function normalizeNamePart(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

function randomSuffix(digits = 4) {
  // crypto.randomInt is uniform; Math.random is good enough but this matches
  // the rest of the codebase's defensive habits.
  const max = 10 ** digits;
  return String(crypto.randomInt(max)).padStart(digits, '0');
}

// Find a unique slug for a (first, last) name pair. Returns the slug string.
// 12 retries on collision, then falls through to a longer suffix.
export async function generateUniqueSlug(firstName, lastName) {
  const first = normalizeNamePart(firstName) || 'smith';
  const last  = normalizeNamePart(lastName)  || 'member';
  const base  = `${first}-${last}`;

  for (let i = 0; i < 12; i++) {
    const candidate = `${base}-${randomSuffix(4)}`;
    const { rows } = await q(
      `SELECT 1 FROM users WHERE public_slug = $1 LIMIT 1`,
      [candidate]
    );
    if (rows.length === 0) return candidate;
  }
  // Extreme collision fallback: 8-digit suffix (1B slots).
  return `${base}-${randomSuffix(8)}`;
}

// Generate a magic-link token. 32 url-safe chars, ~190 bits of entropy.
// Stored verbatim in hire_me_tokens.token (which is UNIQUE — collisions
// at this entropy are vanishingly rare but the DB enforces anyway).
export function newMagicToken() {
  return crypto.randomBytes(24).toString('base64url');
}
