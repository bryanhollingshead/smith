// Smith — Project type catalog (v1, static)
//
// Hardcoded for the spec-flow v1. The server validates against the same
// kind keys (see server/src/routes/projects.js KIND_TITLES). When the
// data-driven catalog ships, this becomes a fetch from /api/project-types
// scoped to a specific home (eligibility rules surface dynamic types).

export const PROJECT_TYPES = [
  {
    kind: 'bathroom-remodel',
    title: 'Remodel a bathroom',
    sub:   'Single trade · common quick win',
    icon:  'tool',
    trades: ['general'],
  },
  {
    kind: 'kitchen-remodel',
    title: 'Remodel a kitchen',
    sub:   'Multi-trade · the project that brings people in',
    icon:  'home',
    trades: ['general', 'electrical', 'plumbing'],
  },
  {
    kind: 'finish-basement',
    title: 'Finish a basement',
    sub:   'Multi-trade · adds living space',
    icon:  'building',
    trades: ['general', 'electrical', 'plumbing', 'hvac'],
  },
  {
    kind: 'hvac-replacement',
    title: 'Replace HVAC system',
    sub:   'Single trade · before the season turns',
    icon:  'tool',
    trades: ['hvac'],
  },
  {
    kind: 'roof-replacement',
    title: 'Replace roof',
    sub:   'Single trade · plan for the sun side',
    icon:  'building',
    trades: ['roofing'],
  },
  {
    kind: 'electrical-panel',
    title: 'Upgrade electrical panel',
    sub:   'Single trade · often a precursor',
    icon:  'tool',
    trades: ['electrical'],
  },
  {
    kind: 'custom',
    title: "I'll tell you what I want",
    sub:   'In your own words. Smith fills in the trade details.',
    icon:  'edit',
    trades: [],
  },
];

// Playback preview — one short sentence that orients the user on what
// Smith will ask about next. Rule-based stub for v1; Claude takes over
// in v2 with a real conversational playback derived from the home file +
// homeowner's text.
export const PLAYBACK_PREVIEWS = {
  'bathroom-remodel': "Next we'll lock in layout, fixtures, and who's sourcing what.",
  'kitchen-remodel':  "Next we'll cover cabinets, appliances, and any plumbing or gas moves.",
  'finish-basement':  "Next: what the space is for, the bathroom rough-in, and egress.",
  'hvac-replacement': "Next: what's failing, ducted vs mini-splits, and efficiency options.",
  'roof-replacement': "Next: material, condition, and whether solar is in the picture.",
  'electrical-panel': "Next: what's driving the upgrade and current capacity.",
  'custom':           "Next we'll narrow the scope and the trades involved.",
};

// Hardcoded 3 questions per project type for v1. Claude generates these
// dynamically in v2 from the homeowner's free text + home file. The "other"
// freeform answer is always available regardless of these chips.
export const CLARIFYING_QUESTIONS = {
  'bathroom-remodel': [
    { q: "Are you keeping the existing layout, or open to moving fixtures?",
      options: ['Keep layout', 'Open to changes', 'Definitely moving things', 'Not sure yet'] },
    { q: "Tub or shower — what's the final move?",
      options: ['Keep the tub', 'Tub + separate shower', 'Shower only', 'Not sure yet'] },
    { q: "Who's picking the fixtures?",
      options: ['I am', 'I want recommendations', 'Pro picks within budget'] },
  ],
  'kitchen-remodel': [
    { q: "Cabinets — keep the boxes and reface, or full replace?",
      options: ['Reface', 'Full replace', 'Not sure yet'] },
    { q: "Appliances — all new, some, or keep existing?",
      options: ['All new', 'Some', 'Keep existing'] },
    { q: "Moving plumbing or gas lines?",
      options: ['No', 'Yes', "Don't know yet"] },
  ],
  'finish-basement': [
    { q: "What's the basement going to be?",
      options: ['Family / TV room', 'Guest suite + bath', 'Home office', 'Rental unit', 'Mixed use'] },
    { q: "Is the bathroom rough-in already there?",
      options: ['Yes', 'No', "Don't know"] },
    { q: "Egress windows — do you need them added?",
      options: ['Already have them', 'Need them', 'Not sure'] },
  ],
  'hvac-replacement': [
    { q: "What's failing — heating, cooling, or both?",
      options: ['Heating', 'Cooling', 'Both', 'Just old'] },
    { q: "Keeping ducts, or open to mini-splits?",
      options: ['Keep ducts', 'Mini-splits', 'Mix', 'Not sure'] },
    { q: "Open to higher-efficiency (heat pump) options?",
      options: ['Yes', 'No', 'Tell me more'] },
  ],
  'roof-replacement': [
    { q: "Material — same as current, or upgrading?",
      options: ['Same', 'Upgrade to metal', 'Upgrade to tile', 'Open to suggestions'] },
    { q: "Any leaks or visible damage we should know about?",
      options: ['No', 'Yes — small', 'Yes — major', 'Not sure'] },
    { q: "Solar in your plans?",
      options: ['No', 'Yes — soon', 'Maybe later', 'Already installed'] },
  ],
  'electrical-panel': [
    { q: "What's driving the upgrade?",
      options: ['Failing breakers', 'EV charger', 'Solar', 'Addition', 'Just old'] },
    { q: "Current amperage if you know it?",
      options: ['100A', '200A', '400A', "Don't know"] },
    { q: "Open to a whole-home surge protector with the new panel?",
      options: ['Yes', 'No', 'Tell me more'] },
  ],
  'custom': [
    { q: "Roughly how big is this project?",
      options: ['A weekend job', 'A few weeks', 'A month or more', "Don't know yet"] },
    { q: "What kind of work do you think this involves?",
      options: ['General', 'Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Other'] },
    { q: "When are you hoping to get it done?",
      options: ['ASAP', 'In a few months', 'This year', 'No rush'] },
  ],
};

// Style direction. Aesthetic projects get the rich chip set; roof gets a
// stripped color-focused set. HVAC and electrical skip the style step
// entirely (see STYLE_KINDS below). Claude generates richer style
// descriptors + reference photos in v2.
const RICH_STYLE = [
  { value: 'spa',              label: 'Spa',                  note: 'Soft, warm, calm. Stone, wood, dimmable lighting.' },
  { value: 'modern-farmhouse', label: 'Modern farmhouse',     note: 'Mixed materials, painted millwork, restrained palette.' },
  { value: 'industrial',       label: 'Industrial',           note: 'Concrete, metal, exposed structure, raw textures.' },
  { value: 'vintage',          label: 'Vintage',              note: 'Period-appropriate, restored fixtures, classic tile.' },
  { value: 'open',             label: 'Open to suggestions',  note: "Let the pro propose what fits the house." },
];

const ROOF_STYLE = [
  { value: 'earth-tones',  label: 'Earth tones',          note: 'Warm browns, slate, weathered greys.' },
  { value: 'classic-dark', label: 'Classic dark',         note: 'Black, charcoal, deep grey.' },
  { value: 'cool-greys',   label: 'Cool greys',           note: 'Cooler tones, modern profiles.' },
  { value: 'open',         label: 'Open to suggestions',  note: 'Match what fits the neighborhood and house.' },
];

export const STYLE_OPTIONS = {
  'bathroom-remodel': RICH_STYLE,
  'kitchen-remodel':  RICH_STYLE,
  'finish-basement':  RICH_STYLE,
  'roof-replacement': ROOF_STYLE,
  'custom':           RICH_STYLE,
};

const STYLE_KINDS = new Set(Object.keys(STYLE_OPTIONS));

export function hasStyleStep(kind) {
  return STYLE_KINDS.has(kind);
}

// Budget comfort — three tiers per project type with USA-median ranges.
// A comfort zone the homeowner picks before bids come in; not a quote.
// Hardcoded for v1; v2 derives from regional comps + Claude.
export const BUDGET_TIERS = {
  'bathroom-remodel': [
    { tier: 'builder-grade', label: 'Builder-grade', range: [8000, 15000],   note: 'Big-box fixtures, prefab vanity, painted trim.' },
    { tier: 'mid',           label: 'Mid-range',     range: [18000, 35000],  note: 'Custom vanity, tile shower, name-brand fixtures.' },
    { tier: 'high',          label: 'High-end',      range: [40000, 80000],  note: 'Designer-spec, luxury materials, full custom.' },
  ],
  'kitchen-remodel': [
    { tier: 'builder-grade', label: 'Builder-grade', range: [20000, 40000],   note: 'Stock cabinets, laminate or basic stone, standard layout.' },
    { tier: 'mid',           label: 'Mid-range',     range: [50000, 90000],   note: 'Semi-custom cabinets, quartz, layout updates.' },
    { tier: 'high',          label: 'High-end',      range: [100000, 200000], note: 'Custom cabinets, premium stone, full reconfigure.' },
  ],
  'finish-basement': [
    { tier: 'builder-grade', label: 'Builder-grade', range: [30000, 60000],   note: 'Open room, basic bath, carpet, painted walls.' },
    { tier: 'mid',           label: 'Mid-range',     range: [70000, 120000],  note: 'Defined rooms, full bath, quality finishes.' },
    { tier: 'high',          label: 'High-end',      range: [150000, 250000], note: 'Suite + entertainment + kitchenette, custom finishes.' },
  ],
  'hvac-replacement': [
    { tier: 'builder-grade', label: 'Builder-grade', range: [5000, 9000],   note: 'Standard-efficiency, like-for-like swap.' },
    { tier: 'mid',           label: 'Mid-range',     range: [10000, 16000], note: 'Higher-efficiency, smart thermostat.' },
    { tier: 'high',          label: 'High-end',      range: [18000, 30000], note: 'Heat pump, variable-speed, zoned.' },
  ],
  'roof-replacement': [
    { tier: 'builder-grade', label: 'Builder-grade', range: [8000, 15000],  note: 'Asphalt shingle, 25-yr warranty.' },
    { tier: 'mid',           label: 'Mid-range',     range: [18000, 30000], note: 'Architectural shingle or basic metal.' },
    { tier: 'high',          label: 'High-end',      range: [35000, 60000], note: 'Standing-seam metal, tile, or premium architectural.' },
  ],
  'electrical-panel': [
    { tier: 'builder-grade', label: 'Builder-grade', range: [2000, 4000],  note: 'Like-for-like panel swap.' },
    { tier: 'mid',           label: 'Mid-range',     range: [4000, 7000],  note: 'Upsize amperage, surge protection.' },
    { tier: 'high',          label: 'High-end',      range: [8000, 15000], note: 'Smart panel, EV-ready, solar-ready.' },
  ],
  'custom': [
    { tier: 'builder-grade', label: 'Budget-conscious', range: null, note: 'Cost is the top priority.' },
    { tier: 'mid',           label: 'Balanced',         range: null, note: 'Reasonable quality at reasonable cost.' },
    { tier: 'high',          label: 'Premium',          range: null, note: "Quality first; cost isn't the constraint." },
  ],
};

export function formatBudgetRange(range) {
  if (!range) return '';
  const [lo, hi] = range;
  const k = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  return `${k(lo)} – ${k(hi)}`;
}

// Decision criteria — load-bearing primitive per memory:
// project-spec-flow-architecture. Single-select for v1.
export const DECISION_CRITERIA = [
  { value: 'fastest-start',   label: 'Fastest start',                note: 'Whoever can mobilize first wins.' },
  { value: 'lowest-bid',      label: 'Lowest bid',                   note: 'Price is the deciding factor.' },
  { value: 'best-fit',        label: 'Best fit',                     note: 'Style, experience, and approach matter most.' },
  { value: 'know-it-when',    label: "I'll know it when I see it",   note: "Show me proposals and I'll decide." },
];
