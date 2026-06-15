// Smith — Stub property-data provider
//
// Returns hardcoded data for one canonical Salt Lake address (the same one
// the old in-route stub used) so local dev works without burning Rentcast
// calls, and tests run offline. Any other address gets a sparse-but-valid
// fallback so the UI never breaks.

const EMPTY_FACTS = {
  year_built: null, square_feet: null, bedrooms: null, bathrooms: null,
  lot_acres: null, stories: null, last_sold_date: null, last_sold_price: null,
  roof_material: null, roof_year: null, heating: null,
};

const CANONICAL = {
  match: /847.*e.*9th.*ave/i,
  canonical_address: {
    line1: '847 E 9th Ave',
    city: 'Salt Lake City',
    state: 'UT',
    postal_code: '84103',
    neighborhood: 'The Avenues',
  },
  latitude: 40.7651,
  longitude: -111.8676,
  facts: {
    year_built: 1924,
    square_feet: 2840,
    bedrooms: 4,
    bathrooms: 2.5,
    lot_acres: 0.18,
    stories: '2 + basement',
    last_sold_date: 'Sep 2022',
    last_sold_price: 726000,
    roof_material: 'Asphalt',
    roof_year: 2021,
    heating: 'Forced air · gas',
  },
  value: { estimate: 892000, low: 845000, high: 938000 },
  attribution: 'Stub data · Salt Lake County Assessor (mocked)',
};

export class StubProvider {
  get name() { return 'stub'; }

  async lookupByAddress(address) {
    if (CANONICAL.match.test(address)) {
      return {
        canonical_address: { ...CANONICAL.canonical_address },
        latitude: CANONICAL.latitude,
        longitude: CANONICAL.longitude,
        facts: { ...CANONICAL.facts },
        value: { ...CANONICAL.value },
        provider: this.name,
        attribution: CANONICAL.attribution,
      };
    }
    // Anything else: echo the address back with no facts. The UI degrades
    // gracefully — confirm address with sparse coverage.
    const parts = String(address || '').split(',').map(s => s.trim()).filter(Boolean);
    return {
      canonical_address: {
        line1: parts[0] || address || '',
        city: parts[1] || '',
        state: (parts[2] || '').split(/\s+/)[0] || '',
        postal_code: (parts[2] || '').split(/\s+/)[1] || '',
        neighborhood: null,
      },
      latitude: null,
      longitude: null,
      facts: { ...EMPTY_FACTS },
      value: null,
      provider: this.name,
      attribution: 'Stub provider · sparse coverage',
    };
  }
}
