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
