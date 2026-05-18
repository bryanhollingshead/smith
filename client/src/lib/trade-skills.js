// Smith — Curated trade-to-skills catalog
//
// HOW TO EDIT:
//   - Each key is a trade name (must match exactly the trade names used in the
//     trades catalog from the database — see /api/trades or seed.js).
//   - Each value is an array of skill names. Order doesn't matter; they'll
//     appear as suggestion chips in the Skills editor.
//   - Add a new trade by adding a new key. Add a new skill by adding a string
//     to an existing array. Save the file — Vite hot-reloads.
//   - Skills already on the user's profile are filtered out automatically;
//     you don't need to think about duplicates.
//
// SUGGESTION SOURCING:
//   When showing suggestions, we union the lists for ALL of a user's trades,
//   so a Carpenter who also does Custom Millwork sees skills from both buckets.
//   We also include a small set of "general construction" skills that apply
//   regardless of trade.

export const TRADE_SKILLS = {
  // Hand-curated; edit freely.
  'Carpentry': [
    'Framing', 'Custom Millwork', 'Cabinetry', 'Stair Building',
    'Timber Frame', 'Trim & Finish', 'Door Hanging', 'Hardwood Flooring',
    'Deck Building', 'Window Install',
  ],
  'Framing': [
    'Wall Framing', 'Roof Framing', 'Floor Systems', 'Engineered Lumber',
    'Steel Stud Framing', 'Truss Install', 'Layout',
  ],
  'Custom Millwork': [
    'Built-Ins', 'Wainscoting', 'Coffered Ceilings', 'Crown Molding',
    'Custom Doors', 'Architectural Trim', 'Veneer Work', 'Inlay',
  ],
  'Cabinetry': [
    'Frameless Construction', 'Face-Frame Construction', 'Drawer Boxes',
    'Hardware Install', 'Refacing', 'Custom Finishes', 'Soft-Close Systems',
  ],
  'Electrical': [
    'Residential Wiring', 'Commercial Wiring', 'Service Upgrades',
    'Smart Home Systems', 'Conduit Bending', 'Troubleshooting',
    'Solar Install', 'Low-Voltage', 'Generators & Transfer Switches',
    'EV Charger Install',
  ],
  'Plumbing': [
    'Rough-In', 'Service & Repair', 'Drain Cleaning', 'Hydronic Heating',
    'Backflow Prevention', 'Gas Lines', 'Water Heaters', 'Fixture Install',
    'Sewer Lines', 'Pipe Soldering',
  ],
  'Concrete & Masonry': [
    'Foundations', 'Slabs', 'Decorative Concrete', 'Block & Brick',
    'Stone Veneer', 'Stamped Finish', 'Repair & Restoration',
    'Form Building', 'Rebar Install', 'Polished Concrete',
  ],
  'Roofing': [
    'Asphalt Shingle', 'Metal Roofing', 'Standing Seam', 'Tile/Slate',
    'Flat/TPO', 'Tear-Off', 'Flashing', 'Storm Repair',
    'Skylight Install', 'Gutter Systems',
  ],
  'HVAC': [
    'System Install', 'Ductwork', 'Refrigerant Handling', 'Heat Pumps',
    'Mini-Split Install', 'Commercial Rooftop Units', 'Boilers',
    'Indoor Air Quality', 'Controls & Thermostats', 'Load Calculations',
  ],
  'Painting & Finishing': [
    'Interior Painting', 'Exterior Painting', 'Spray Application',
    'Faux Finishes', 'Stain & Lacquer', 'Wallpaper Install',
    'Surface Prep', 'Color Matching', 'Cabinet Refinishing',
  ],
  'Tile & Flooring': [
    'Ceramic Tile', 'Natural Stone', 'Mosaic Work', 'Large Format Tile',
    'Heated Floor Install', 'Hardwood Refinishing', 'LVP & Vinyl',
    'Carpet Install', 'Waterproofing', 'Grout Restoration',
  ],
  'Project Management': [
    'Scheduling', 'Subcontractor Management', 'Budget Tracking',
    'Permitting', 'Submittals', 'RFI Management',
    'Change Orders', 'Punch List', 'Owner Communication', 'Safety Planning',
  ],
  'General Contracting': [
    'Estimating', 'Bid Prep', 'Trade Coordination', 'Permitting',
    'Inspections', 'Safety Management', 'Quality Control',
    'Client Relations', 'Subcontractor Vetting',
  ],
  'Stonemasonry': [
    'Dry Stone', 'Wet Set', 'Stone Carving', 'Veneer Application',
    'Restoration', 'Patios & Walkways', 'Fireplaces & Chimneys',
    'Retaining Walls', 'Architectural Stone',
  ],
};

// Skills that aren't tied to any one trade — useful for everyone.
export const GENERAL_SKILLS = [
  'Blueprint Reading',
  'OSHA Compliance',
  'Fall Protection',
  'Site Cleanup',
  'Crew Leadership',
  'Estimating',
  'Mentoring Apprentices',
];

/**
 * Given a list of the user's trades and the list of skills they already
 * have, return suggested skill names — trade-specific skills first, then a
 * sprinkle of general ones, with any duplicates of existing skills filtered
 * out. Cap at `limit`.
 */
export function suggestSkills({ userTrades = [], existingSkills = [], limit = 12 }) {
  const have = new Set(existingSkills.map(s => s.toLowerCase().trim()));

  // Collect from each trade in order, deduping as we go.
  const out = [];
  const pushUnique = (name) => {
    const key = name.toLowerCase().trim();
    if (have.has(key) || out.some(x => x.toLowerCase() === key)) return;
    out.push(name);
  };

  for (const t of userTrades) {
    const list = TRADE_SKILLS[t.name] || [];
    for (const s of list) pushUnique(s);
    if (out.length >= limit) break;
  }

  // Top up with general skills if we still have room.
  if (out.length < limit) {
    for (const s of GENERAL_SKILLS) pushUnique(s);
  }

  return out.slice(0, limit);
}
