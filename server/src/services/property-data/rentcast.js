// Smith — Rentcast property-data provider
//
// Hits GET https://api.rentcast.io/v1/avm/value with the typed address and
// lookupSubjectAttributes=true so the response includes the subject
// property's facts (year_built, sqft, beds/baths, last sale) alongside the
// AVM (price + 85% confidence band). One call covers the whole signup-
// moment magic.
//
// Auth header is X-Api-Key per Rentcast docs. Constructor accepts a
// timeoutMs so the caller (lookupByAddress in index.js) enforces signup
// never blocks more than a few seconds on this upstream.

const RENTCAST_BASE = 'https://api.rentcast.io/v1';

export class RentcastProvider {
  constructor({ apiKey, timeoutMs = 4000 }) {
    if (!apiKey) {
      throw new Error('RENTCAST_API_KEY is required when PROPERTY_PROVIDER=rentcast');
    }
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  get name() { return 'rentcast'; }

  async lookupByAddress(address) {
    const url = new URL(`${RENTCAST_BASE}/avm/value`);
    url.searchParams.set('address', address);
    url.searchParams.set('lookupSubjectAttributes', 'true');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let res;
    try {
      res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Rentcast ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    return shapeRentcast(data);
  }
}

// Map Rentcast's /avm/value response onto our canonical shape. Real shape
// (confirmed against the API on 2026-06-17):
//   root: { price, priceRangeLow, priceRangeHigh, latitude, longitude,
//           subjectProperty: {...}, comparables: [...] }
// Subject attributes live under `subjectProperty` when
// lookupSubjectAttributes=true is passed — NOT at the response root.
// Rentcast does NOT return last sale PRICE (just date), nor neighborhood,
// stories, roof, or heating — those stay null in our schema.
function shapeRentcast(data) {
  const root = data || {};
  const subject = root.subjectProperty || {};
  const lotSqft = num(subject.lotSize);
  const lotAcres = lotSqft != null ? +(lotSqft / 43560).toFixed(2) : null;

  return {
    canonical_address: {
      line1: subject.addressLine1
        || (subject.formattedAddress ? String(subject.formattedAddress).split(',')[0].trim() : ''),
      city: subject.city || '',
      state: subject.state || '',
      postal_code: subject.zipCode || subject.postalCode || '',
      neighborhood: null,                               // not in Rentcast
    },
    // lat/lng appear at BOTH root and subjectProperty — prefer subject's
    // (parcel-level) when present, fall back to root (geocode-level).
    latitude:  num(subject.latitude  ?? root.latitude),
    longitude: num(subject.longitude ?? root.longitude),
    facts: {
      year_built: int(subject.yearBuilt),
      square_feet: int(subject.squareFootage),
      bedrooms: int(subject.bedrooms),
      bathrooms: num(subject.bathrooms),
      lot_acres: lotAcres,
      stories: null,                                    // not in Rentcast
      last_sold_date: subject.lastSaleDate
        ? String(subject.lastSaleDate).slice(0, 10)     // ISO timestamp → YYYY-MM-DD
        : null,
      last_sold_price: null,                            // Rentcast doesn't return it
      roof_material: null,                              // not in Rentcast
      roof_year: null,                                  // not in Rentcast
      heating: null,                                    // not in Rentcast
    },
    value: root.price != null
      ? {
          estimate: int(root.price),
          low: int(root.priceRangeLow),
          high: int(root.priceRangeHigh),
        }
      : null,
    provider: 'rentcast',
    attribution: 'Rentcast AVM · public records',
  };
}

function num(v)  { return v == null || v === '' ? null : Number(v); }
function int(v)  { const n = num(v); return n == null ? null : Math.round(n); }
