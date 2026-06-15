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

// Map Rentcast's response onto our canonical shape. The exact field names
// for subject-attributes ride on top of the value endpoint when
// lookupSubjectAttributes=true. Field names like `formattedAddress`, `city`,
// `state`, `zipCode`, `latitude`, `longitude`, `yearBuilt`, `squareFootage`,
// `bedrooms`, `bathrooms`, `lotSize`, `lastSaleDate`, `lastSalePrice`
// match Rentcast's property-data conventions; we read defensively so a
// missing field is just null, not a thrown error.
function shapeRentcast(data) {
  const subject = data || {};
  const lotSqft = num(subject.lotSize);
  const lotAcres = lotSqft != null ? +(lotSqft / 43560).toFixed(2) : null;

  return {
    canonical_address: {
      line1: subject.formattedAddress
        ? String(subject.formattedAddress).split(',')[0].trim()
        : (subject.addressLine1 || ''),
      city: subject.city || '',
      state: subject.state || '',
      postal_code: subject.zipCode || subject.postalCode || '',
      neighborhood: null,
    },
    latitude: num(subject.latitude),
    longitude: num(subject.longitude),
    facts: {
      year_built: int(subject.yearBuilt),
      square_feet: int(subject.squareFootage),
      bedrooms: int(subject.bedrooms),
      bathrooms: num(subject.bathrooms),
      lot_acres: lotAcres,
      stories: null,                                    // Rentcast doesn't expose this
      last_sold_date: subject.lastSaleDate || null,
      last_sold_price: int(subject.lastSalePrice),
      roof_material: null,                              // not in Rentcast
      roof_year: null,                                  // not in Rentcast
      heating: null,                                    // not in Rentcast
    },
    value: subject.price != null
      ? {
          estimate: int(subject.price),
          low: int(subject.priceRangeLow),
          high: int(subject.priceRangeHigh),
        }
      : null,
    provider: 'rentcast',
    attribution: 'Rentcast AVM · public records',
  };
}

function num(v)  { return v == null || v === '' ? null : Number(v); }
function int(v)  { const n = num(v); return n == null ? null : Math.round(n); }
