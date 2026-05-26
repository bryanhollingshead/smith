// Smith — Structure types + job-type vocabulary for the jobsite form
//
// HOW TO EDIT:
//   - STRUCTURE_TYPES: the fixed list of "what was built." Order = display order.
//   - JOB_TYPE_CATEGORIES: one entry per trade bucket. `label` is the optgroup
//     heading shown in the picker; `jobs` is the list of job-type strings.
//   - The picker always shows EVERY category. We only re-order them so the
//     ones relevant to the user's primary trade float to the top (see
//     orderedJobTypeCategories). Nothing is hidden.
//   - These are starter vocabularies — broad on purpose. Refine after trade
//     interviews. Add a job by appending a string; add a trade bucket by
//     adding a category object.
//
// STORAGE: the picked structure_type / job_type strings are stored verbatim
// on the jobsite row (same as the old freeform `kind`). No ids.

export const STRUCTURE_TYPES = [
  'Single-family',
  'Townhome',
  'Condo',
  'Apartment',
  'Multi-family',
  'Small commercial',
  'New construction',
  'Remodel',
  'Other',
];

export const JOB_TYPE_CATEGORIES = [
  {
    label: 'Electrical',
    jobs: [
      'Service upgrade', 'Panel replacement', 'Sub panel install',
      'Rewire / remodel wiring', 'New construction wiring', 'EV charger install',
      'Generator & transfer switch', 'Lighting install', 'Recessed lighting',
      'Smart home / low-voltage', 'Solar PV install', 'Outlet & switch install',
      'Troubleshooting & repair', 'Code correction',
    ],
  },
  {
    label: 'Carpentry',
    jobs: [
      'Framing', 'Rough framing', 'Finish carpentry', 'Trim & molding',
      'Custom millwork', 'Cabinet install', 'Built-ins', 'Door & window install',
      'Stair build', 'Deck build', 'Siding install', 'Framing repair',
    ],
  },
  {
    label: 'Plumbing',
    jobs: [
      'Rough-in plumbing', 'Repipe', 'Water heater install', 'Tankless conversion',
      'Fixture install', 'Drain cleaning', 'Sewer line repair', 'Gas line install',
      'Backflow install', 'Water service line', 'Leak repair', 'Remodel plumbing',
    ],
  },
  {
    label: 'HVAC',
    jobs: [
      'System install / replacement', 'Furnace install', 'AC install',
      'Heat pump install', 'Mini-split install', 'Ductwork install',
      'Ductwork repair', 'Rooftop unit (commercial)', 'Boiler install',
      'Thermostat & controls', 'Maintenance & repair', 'Air quality install',
    ],
  },
  {
    label: 'Concrete',
    jobs: [
      'Foundation pour', 'Slab pour', 'Footings', 'Driveway',
      'Sidewalk / flatwork', 'Stamped concrete', 'Polished concrete',
      'Rebar & forming', 'Retaining wall', 'Concrete repair',
    ],
  },
  {
    label: 'Roofing',
    jobs: [
      'Tear-off & re-roof', 'Asphalt shingle', 'Metal roof', 'Standing seam',
      'Tile / slate', 'Flat / TPO', 'Flashing & repair', 'Gutter install',
      'Skylight install', 'Storm / hail repair',
    ],
  },
  {
    label: 'Masonry',
    jobs: [
      'Brick laying', 'Block wall', 'Stone veneer', 'Natural stone',
      'Fireplace & chimney', 'Tuckpointing / repair', 'Pavers & hardscape',
      'Retaining wall',
    ],
  },
  {
    label: 'Drywall & Paint',
    jobs: [
      'Drywall hang', 'Drywall finish / tape', 'Texture', 'Interior paint',
      'Exterior paint', 'Spray finish', 'Cabinet refinish', 'Patch & repair',
      'Wallpaper install',
    ],
  },
  {
    label: 'Flooring',
    jobs: [
      'Tile install', 'Hardwood install', 'Hardwood refinish', 'LVP / vinyl',
      'Laminate', 'Carpet install', 'Heated floor install', 'Natural stone',
      'Subfloor prep',
    ],
  },
  {
    label: 'Landscape',
    jobs: [
      'Hardscape / patio', 'Paver walkway', 'Retaining wall', 'Irrigation install',
      'Sod & planting', 'Grading & drainage', 'Fence install', 'Deck & pergola',
      'Outdoor lighting',
    ],
  },
  {
    label: 'General remodel',
    jobs: [
      'Kitchen remodel', 'Bathroom remodel', 'Whole-home remodel',
      'Basement finish', 'Addition', 'ADU build', 'Garage conversion',
      'New construction (whole)', 'Tenant improvement',
    ],
  },
  {
    label: 'Other',
    jobs: ['Other'],
  },
];

// Map a user's trade name (as stored in the DB trades catalog) to the
// job-type category label(s) it should surface. A trade can light up more
// than one bucket (e.g. "Concrete & Masonry" → Concrete + Masonry). Trades
// not listed here just don't get a relevance boost — every category is still
// shown.
const TRADE_TO_CATEGORIES = {
  'Electrical': ['Electrical'],
  'Carpentry': ['Carpentry'],
  'Framing': ['Carpentry'],
  'Custom Millwork': ['Carpentry'],
  'Cabinetry': ['Carpentry'],
  'Plumbing': ['Plumbing'],
  'HVAC': ['HVAC'],
  'Concrete & Masonry': ['Concrete', 'Masonry'],
  'Stonemasonry': ['Masonry'],
  'Roofing': ['Roofing'],
  'Painting & Finishing': ['Drywall & Paint'],
  'Tile & Flooring': ['Flooring'],
  'General Contracting': ['General remodel'],
  'Project Management': ['General remodel'],
};

/**
 * Return JOB_TYPE_CATEGORIES re-ordered so the categories relevant to
 * `primaryTrade` come first (in their listed order), followed by everything
 * else in catalog order. Nothing is removed — the picker always shows the
 * full vocabulary. Pass null/undefined to get the catalog order unchanged.
 */
export function orderedJobTypeCategories(primaryTrade) {
  const relevant = new Set(TRADE_TO_CATEGORIES[primaryTrade] || []);
  if (relevant.size === 0) return JOB_TYPE_CATEGORIES;
  const top = [];
  const rest = [];
  for (const cat of JOB_TYPE_CATEGORIES) {
    (relevant.has(cat.label) ? top : rest).push(cat);
  }
  return [...top, ...rest];
}

/**
 * Ghost-suggest a jobsite name from the structured fields, e.g.
 *   { location: 'Holladay, UT', jobType: 'Service upgrade' } → "Holladay service upgrade"
 *   { location: 'Murray, UT',   jobType: 'Sub panel install' } → "Murray sub panel install"
 * Falls back to structure type when there's no location, and to the job type
 * alone when there's neither. Returns '' if there's nothing to suggest.
 */
export function suggestJobsiteName({ location = '', structureType = '', jobType = '' } = {}) {
  const job = (jobType || '').trim();
  if (!job) return '';
  const city = (location || '').split(',')[0].trim();
  const lead = city || (structureType || '').trim();
  return (lead ? `${lead} ${job.toLowerCase()}` : job).trim();
}
