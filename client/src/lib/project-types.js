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
