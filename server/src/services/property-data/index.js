// Smith — Property-data provider abstraction
//
// One internal interface (`lookupByAddress`) that the rest of the app calls
// regardless of which upstream is configured. Swap providers by flipping
// PROPERTY_PROVIDER in env — no other code changes.
//
// Canonical response shape every provider returns:
//   {
//     canonical_address: { line1, city, state, postal_code, neighborhood },
//     latitude: number | null,
//     longitude: number | null,
//     facts: {
//       year_built, square_feet, bedrooms, bathrooms, lot_acres, stories,
//       last_sold_date, last_sold_price, roof_material, roof_year, heating
//     },
//     value: { estimate, low, high } | null,
//     provider: 'rentcast' | 'stub' | ...,
//     attribution: string | null
//   }
//
// All facts fields are nullable — providers fill what they have. `value`
// can be null when an AVM isn't available for that address.

import { RentcastProvider } from './rentcast.js';
import { StubProvider } from './stub.js';

const which = (process.env.PROPERTY_PROVIDER || 'stub').toLowerCase();

let provider;
switch (which) {
  case 'rentcast':
    provider = new RentcastProvider({
      apiKey: process.env.RENTCAST_API_KEY,
      timeoutMs: 4000,
    });
    break;
  case 'stub':
  default:
    provider = new StubProvider();
    break;
}

console.log(`[property-data] provider = ${provider.name}`);

export { provider };

// Best-effort wrapper. Signup must NEVER be blocked by an upstream outage —
// if the provider throws or times out, we return a result with an empty
// facts/value payload and degraded=true so the caller can mint the home on
// whatever canonical address they typed, and the dashboard can show a
// gentle "we're still fetching details" affordance instead of an error.
export async function lookupByAddress(address) {
  try {
    const result = await provider.lookupByAddress(address);
    return { ...result, degraded: false };
  } catch (err) {
    console.error('[property-data] lookup failed:', err.message);
    return {
      canonical_address: parseAddressFallback(address),
      latitude: null,
      longitude: null,
      facts: emptyFacts(),
      value: null,
      provider: 'unavailable',
      attribution: null,
      degraded: true,
      error: err.message,
    };
  }
}

// Last-resort address parse when the provider can't tell us anything. We
// take the user-typed string and split on commas — good enough to mint
// SOMETHING so the user isn't stuck.
function parseAddressFallback(address) {
  const parts = String(address || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    line1: parts[0] || address || '',
    city: parts[1] || '',
    state: (parts[2] || '').split(/\s+/)[0] || '',
    postal_code: (parts[2] || '').split(/\s+/)[1] || '',
    neighborhood: null,
  };
}

export function emptyFacts() {
  return {
    year_built: null,
    square_feet: null,
    bedrooms: null,
    bathrooms: null,
    lot_acres: null,
    stories: null,
    last_sold_date: null,
    last_sold_price: null,
    roof_material: null,
    roof_year: null,
    heating: null,
  };
}
