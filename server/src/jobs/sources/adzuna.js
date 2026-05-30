// Smith — Adzuna driver
//
// One driver in the JobSource pattern (see ./index.js for the interface).
// Calls Adzuna's REST search endpoint and normalizes each result into the
// `jobs` table's row shape.
//
// Adzuna API reference (free tier):
//   GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
//     ?app_id=...&app_key=...&results_per_page=50&what=...&where=...
//
// Config (from job_sources.config JSONB):
//   {
//     "country":          "us",                  // required, ISO 3166-1 alpha-2 lowercase
//     "where":            "Salt Lake City",      // optional, free-text location
//     "what":             "electrician",         // optional, free-text query
//     "results_per_page": 50,                    // 1-50; default 50
//     "max_days_old":     14,                    // skip postings older than N days
//     "max_pages":        3                      // safety cap per ingest cycle
//   }
//
// Credentials live in env (ADZUNA_APP_ID + ADZUNA_APP_KEY) — never in the
// config blob. Same pattern as Anthropic + R2 secrets.
//
// Trade/skill tagging is keyword-based (mirrors ingest-news.js) for phase 2;
// phase 3 wraps a richer matcher on top via job-types.js.

const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs';
const FETCH_TIMEOUT_MS = 20_000;

// Keyword → canonical tag. First match wins per key. Lowercase, exact-match
// against the lowercased haystack (title + description). Keep specific terms
// first; broad terms last to avoid over-tagging.
//
// Trade tags map to Smith's canonical trade list (see migration 001 trades
// catalog + the seeds in seed.js). Skill tags map to job-types.js vocabulary.
const TRADE_KEYWORDS = [
  ['electrician',           'Electrical'],
  ['electrical',            'Electrical'],
  ['lineman',               'Electrical'],
  ['plumber',               'Plumbing'],
  ['plumbing',              'Plumbing'],
  ['pipefitter',            'Plumbing'],
  ['carpenter',             'Carpentry'],
  ['carpentry',             'Carpentry'],
  ['framer',                'Carpentry'],
  ['framing',               'Carpentry'],
  ['hvac',                  'HVAC'],
  ['heating',               'HVAC'],
  ['ventilation',           'HVAC'],
  ['refrigeration',         'HVAC'],
  ['mason',                 'Concrete & Masonry'],
  ['masonry',               'Concrete & Masonry'],
  ['concrete',              'Concrete & Masonry'],
  ['bricklayer',            'Concrete & Masonry'],
  ['roofer',                'Roofing'],
  ['roofing',               'Roofing'],
  ['painter',               'Painting & Finishing'],
  ['drywall',               'Painting & Finishing'],
  ['tile',                  'Tile & Flooring'],
  ['flooring',              'Tile & Flooring'],
  ['cabinet',               'Cabinetry'],
  ['millwork',              'Custom Millwork'],
  ['general contractor',    'General Contracting'],
  ['project manager',       'Project Management'],
  ['superintendent',        'Project Management'],
];

const SKILL_KEYWORDS = [
  ['service upgrade',       'Service upgrade'],
  ['panel',                 'Panel replacement'],
  ['rewire',                'Rewire / remodel wiring'],
  ['ev charger',            'EV charger install'],
  ['generator',             'Generator & transfer switch'],
  ['recessed lighting',     'Recessed lighting'],
  ['solar',                 'Solar PV install'],
  ['water heater',          'Water heater install'],
  ['tankless',              'Tankless conversion'],
  ['drain',                 'Drain cleaning'],
  ['sewer',                 'Sewer line repair'],
  ['gas line',              'Gas line install'],
  ['repipe',                'Repipe'],
  ['cabinet install',       'Cabinet install'],
  ['trim',                  'Trim & molding'],
  ['stair',                 'Stair build'],
  ['deck',                  'Deck build'],
  ['siding',                'Siding install'],
  ['foundation',            'Foundation pour'],
  ['slab',                  'Slab pour'],
  ['driveway',              'Driveway'],
  ['stamped concrete',      'Stamped concrete'],
  ['mini-split',            'Mini-split install'],
  ['heat pump',             'Heat pump install'],
  ['ductwork',              'Ductwork install'],
  ['boiler',                'Boiler install'],
  ['tear-off',              'Tear-off & re-roof'],
  ['metal roof',            'Metal roof'],
  ['standing seam',         'Standing seam'],
  ['gutter',                'Gutter install'],
  ['brick',                 'Brick laying'],
  ['stone veneer',          'Stone veneer'],
  ['chimney',               'Fireplace & chimney'],
  ['tuckpointing',          'Tuckpointing / repair'],
  ['paver',                 'Pavers & hardscape'],
  ['hardwood',              'Hardwood install'],
  ['kitchen remodel',       'Kitchen remodel'],
  ['bathroom remodel',      'Bathroom remodel'],
  ['adu',                   'ADU build'],
  ['basement finish',       'Basement finish'],
];

// "Prevailing wage" surfaces in public-works / Davis-Bacon / union postings.
// Cheap flag; phase 3 surfaces it as a feed filter.
const PREVAILING_WAGE_NEEDLES = [
  'prevailing wage', 'davis-bacon', 'davis bacon', 'public works',
];

function inferTags(text, table) {
  const hay = text.toLowerCase();
  const out = new Set();
  for (const [needle, tag] of table) {
    if (hay.includes(needle)) out.add(tag);
  }
  return [...out].slice(0, 8);
}

export const adzunaDriver = {
  name: 'adzuna',

  // fetchPage(config, cursor) → { items, nextCursor }
  //
  // cursor is an opaque object the driver owns — we use { page } so the
  // ingester can iterate page-by-page until nextCursor is null. The
  // ingester's job is dumb: keep calling fetchPage with the returned cursor
  // and upsert items, stopping when nextCursor is null OR max_pages reached.
  async fetchPage(config, cursor) {
    const appId  = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      const err = new Error('ADZUNA_APP_ID + ADZUNA_APP_KEY not set');
      err.code = 'NO_CREDS';
      throw err;
    }

    const country         = (config.country || 'us').toLowerCase();
    const where           = config.where || '';
    const what            = config.what  || '';
    const resultsPerPage  = Math.max(1, Math.min(50, parseInt(config.results_per_page, 10) || 50));
    const maxDaysOld      = parseInt(config.max_days_old, 10) || 14;
    const maxPages        = Math.max(1, Math.min(10, parseInt(config.max_pages, 10) || 3));

    const page = (cursor?.page) || 1;

    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(resultsPerPage),
      max_days_old: String(maxDaysOld),
      content_type: 'application/json',
    });
    if (where) params.set('where', where);
    if (what)  params.set('what', what);

    const url = `${ADZUNA_BASE}/${encodeURIComponent(country)}/search/${page}?${params.toString()}`;

    const res = await fetch(url, {
      // Adzuna's edge (Chef-managed) returns 503 on UAs containing "Bot".
      // Drop the suffix so the request looks like a regular client.
      headers: { 'User-Agent': 'Smith/0.1 (+https://smith.app)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Adzuna HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    const items = results.map(r => normalize(r));

    // Adzuna doesn't expose a definitive "no more pages" signal beyond
    // results.length < resultsPerPage. Stop when we get a short page OR
    // when we've hit max_pages.
    const isLastPage = results.length < resultsPerPage || page >= maxPages;
    const nextCursor = isLastPage ? null : { page: page + 1 };

    return { items, nextCursor };
  },
};

function normalize(r) {
  const title       = String(r.title || '').slice(0, 500);
  const description = String(r.description || '').slice(0, 8000);
  const company     = r.company?.display_name ? String(r.company.display_name).slice(0, 200) : null;
  const location    = r.location?.display_name ? String(r.location.display_name).slice(0, 200) : null;

  // Adzuna salary fields are nullable; values are annual USD by default.
  // `salary_is_predicted` (boolean) marks Adzuna's own estimate vs an
  // employer-stated number.
  const salaryMin = r.salary_min != null ? Number(r.salary_min) : null;
  const salaryMax = r.salary_max != null ? Number(r.salary_max) : null;

  const haystack = `${title} ${description}`;
  const tradeTags = inferTags(haystack, TRADE_KEYWORDS);
  const skillTags = inferTags(haystack, SKILL_KEYWORDS);

  const lower = haystack.toLowerCase();
  const isPrevailingWage = PREVAILING_WAGE_NEEDLES.some(n => lower.includes(n));

  return {
    source_driver:       'adzuna',
    source_job_id:       String(r.id),
    title,
    company,
    description,
    location,
    lat:                 r.latitude  != null ? Number(r.latitude)  : null,
    lng:                 r.longitude != null ? Number(r.longitude) : null,
    salary_min:          Number.isFinite(salaryMin) ? salaryMin : null,
    salary_max:          Number.isFinite(salaryMax) ? salaryMax : null,
    salary_currency:     salaryMin != null || salaryMax != null ? 'USD' : null,
    salary_period:       salaryMin != null || salaryMax != null ? 'year' : null,
    salary_is_predicted: !!r.salary_is_predicted,
    url:                 r.redirect_url || null,
    contact_email:       null,                    // Adzuna doesn't expose direct contact
    contact_phone:       null,
    trade_tags:          tradeTags,
    skill_tags:          skillTags,
    structure_type:      null,                    // phase 3 — richer inference
    job_type:            null,
    is_prevailing_wage:  isPrevailingWage,
    is_direct_post:      false,
    posted_by_user_id:   null,
    posted_at:           r.created ? new Date(r.created) : new Date(),
  };
}
