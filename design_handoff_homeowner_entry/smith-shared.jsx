/* Smith — Shared primitives & helpers
   Used by both Direction A (Jobsite) and Direction B (Foreman).
*/

// Tiny icon set (stroke icons, no emoji).
const Icon = ({ name, size = 18, stroke = 1.6, ...rest }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', ...rest };
  switch (name) {
    case 'home':       return <svg {...common}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>;
    case 'search':     return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'users':      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'message':    return <svg {...common}><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 21 11.5z"/></svg>;
    case 'bell':       return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>;
    case 'user':       return <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'briefcase':  return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case 'mappin':     return <svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'check':      return <svg {...common}><path d="M20 6L9 17l-5-5"/></svg>;
    case 'verified':   return <svg {...common}><path d="M12 2l2.4 2.2 3.2-.4.8 3.2 2.6 2-1.4 3 1.4 3-2.6 2-.8 3.2-3.2-.4L12 22l-2.4-2.2-3.2.4-.8-3.2-2.6-2 1.4-3-1.4-3 2.6-2 .8-3.2 3.2.4z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'plus':       return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'arrow-r':    return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'chevron-r':  return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron-d':  return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case 'send':       return <svg {...common}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>;
    case 'image':      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
    case 'tool':       return <svg {...common}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 1 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z"/></svg>;
    case 'mail':       return <svg {...common}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>;
    case 'hardhat':    return <svg {...common}><path d="M3 17h18M5 17v-3a7 7 0 0 1 14 0v3M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
    case 'building':   return <svg {...common}><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/></svg>;
    case 'calendar':   return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
    case 'award':      return <svg {...common}><circle cx="12" cy="8" r="6"/><path d="M15.5 12.5L17 22l-5-3-5 3 1.5-9.5"/></svg>;
    case 'shield':     return <svg {...common}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'star':       return <svg {...common}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>;
    case 'menu':       return <svg {...common}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    case 'x':          return <svg {...common}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case 'filter':     return <svg {...common}><path d="M22 3H2l8 9.5V19l4 2v-8.5z"/></svg>;
    case 'settings':   return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'logout':     return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
    case 'sun':        return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
    case 'cloud':      return <svg {...common}><path d="M18 10a6 6 0 0 0-11.6-2A4 4 0 0 0 7 16h11a4 4 0 0 0 0-8z"/></svg>;
    case 'wind':       return <svg {...common}><path d="M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2M17.6 7.6A2.5 2.5 0 1 1 19 12H2"/></svg>;
    case 'link':       return <svg {...common}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>;
    case 'eye':        return <svg {...common}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'phone':      return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></svg>;
    case 'globe':      return <svg {...common}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>;
    case 'thumb':      return <svg {...common}><path d="M7 10v12M15 5.9L14 10h6.6a2 2 0 0 1 2 2.4l-1.4 8a2 2 0 0 1-2 1.6H7V10l5-9a3 3 0 0 1 3 3z"/></svg>;
    case 'comment':    return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'share':      return <svg {...common}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>;
    case 'edit':       return <svg {...common}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>;
    case 'more':       return <svg {...common}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
    default: return null;
  }
};

// Avatar placeholder — initials over a tinted gradient
const Avatar = ({ initials, size = 40, tone = 'wood', ring }) => {
  const tones = {
    wood: 'linear-gradient(135deg, #8a5a2f, #4a3520)',
    steel: 'linear-gradient(135deg, #6b7178, #2d3137)',
    brick: 'linear-gradient(135deg, #a55c45, #6a3525)',
    sage: 'linear-gradient(135deg, #6b7560, #3d4a3a)',
    sand: 'linear-gradient(135deg, #c8b89a, #8a7758)',
    rust: 'linear-gradient(135deg, #C8731F, #6b3e15)',
    slate: 'linear-gradient(135deg, #4a5057, #232629)',
    cream: 'linear-gradient(135deg, #d8cfb8, #a8a085)',
  };
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: tones[tone] || tones.wood,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.36,
      letterSpacing: '0.02em', flexShrink: 0,
      boxShadow: ring ? `0 0 0 2px ${ring}` : 'none',
      fontFamily: "'Inter Tight', sans-serif",
    }}>{initials}</div>
  );
};

// Photo placeholder block
const Photo = ({ kind = 'frame', label, height = 200, style = {}, tex = false, children }) => (
  <div
    className={`ph ph-${kind}${tex ? ' ph-tex' : ''}`}
    style={{
      '--ph-label': `"${label || kind + ' photo'}"`,
      height,
      width: '100%',
      ...style,
    }}
  >
    {children}
  </div>
);

// Sample data — same people across both directions for consistency
const SAMPLE = {
  me: {
    name: 'Marcus Whitfield',
    initials: 'MW',
    headline: 'Master Carpenter · Custom Millwork & Framing',
    location: 'Salt Lake City, UT',
    avatar: 'wood',
    verified: true,
    yearsExp: 18,
    union: 'Local 184 — Carpenters',
    apprentice: { hours: 8400, of: 8000, status: 'Journeyman' },
    trades: [
      { name: 'Carpentry', years: 18 },
      { name: 'Framing', years: 14 },
      { name: 'Custom Millwork', years: 11 },
      { name: 'Cabinetry', years: 8 },
    ],
    licenses: [
      { name: 'MT Contractor License', no: 'CON-UT-44219', exp: '2027-03', verified: true },
      { name: 'OSHA 30 — Construction', no: 'OSH-30-882140', exp: '2026-08', verified: true },
      { name: 'Lead-Safe Certified Renovator', no: 'LSC-887421', exp: '2027-01', verified: true },
    ],
    insurance: { carrier: 'Liberty Mutual', limit: '$2M GL', verified: true },
  },
  companies: [
    {
      id: 'highline',
      name: 'Highline Build Co.',
      role: 'Lead Carpenter',
      type: 'General Contractor',
      from: '2021', to: 'Present',
      logo: 'rust',
      claimed: true,
      jobsites: [
        { title: 'Avenues Residence', kind: 'Custom Home · 4,200 sqft', loc: 'Park City, UT', dur: '2023–2024', photo: 'frame' },
        { title: 'Snowbird Lodge', kind: 'Hospitality · Renovation', loc: 'Park City, UT', dur: '2022–2023', photo: 'wood' },
        { title: '14th & Grand Townhomes', kind: 'Multi-family · 8 units', loc: 'Salt Lake City, UT', dur: '2021–2022', photo: 'brick' },
      ],
    },
    {
      id: 'whitfield',
      name: 'Whitfield Millwork',
      role: 'Owner / Operator',
      type: 'Sub · Carpentry',
      from: '2018', to: '2021',
      logo: 'wood',
      claimed: true,
      jobsites: [
        { title: 'Aspen Grove Kitchen', kind: 'Custom Cabinetry', loc: 'Salt Lake City, UT', dur: '2020', photo: 'kitchen' },
        { title: 'Granary Row Library', kind: 'Built-ins · Restoration', loc: 'Salt Lake City, UT', dur: '2019', photo: 'workshop' },
      ],
    },
    {
      id: 'paramount',
      name: 'Paramount Construction',
      role: 'Carpenter',
      type: 'General Contractor',
      from: '2012', to: '2018',
      logo: 'steel',
      claimed: false,
      jobsites: [
        { title: 'Yellowstone Club Phase II', kind: 'Custom Homes', loc: 'Park City, UT', dur: '2015–2018', photo: 'frame' },
      ],
    },
  ],
  featured: [
    { title: 'Avenues Residence', tag: 'Custom Home', photo: 'frame', size: 'lg' },
    { title: 'Aspen Grove Kitchen', tag: 'Millwork', photo: 'kitchen', size: 'sm' },
    { title: 'Snowbird Lodge', tag: 'Renovation', photo: 'wood', size: 'sm' },
    { title: 'Granary Row Library', tag: 'Restoration', photo: 'workshop', size: 'sm' },
  ],
  connections: [
    { name: 'Diane Okafor', initials: 'DO', role: 'Project Manager', co: 'Highline Build Co.', loc: 'Salt Lake City, UT', tone: 'sage', mutual: 14 },
    { name: 'Roberto "Beto" Salinas', initials: 'RS', role: 'Master Electrician', co: 'Salinas Electric', loc: 'Belgrade, MT', tone: 'rust', mutual: 8 },
    { name: 'Tasha Coleman', initials: 'TC', role: 'GC · Owner', co: 'Coleman & Daughters', loc: 'Livingston, MT', tone: 'brick', mutual: 22 },
    { name: 'Henrik Lindqvist', initials: 'HL', role: 'Stonemason', co: 'Independent', loc: 'Park City, UT', tone: 'slate', mutual: 5 },
    { name: 'Aiyana Redfeather', initials: 'AR', role: 'Architect', co: 'Range Studio', loc: 'Salt Lake City, UT', tone: 'sage', mutual: 11 },
    { name: 'Frank "Mac" McKenna', initials: 'FM', role: 'Foreman · Concrete', co: 'McKenna Concrete', loc: 'Ogden, UT', tone: 'steel', mutual: 17 },
    { name: 'Yuki Tanaka', initials: 'YT', role: 'Tile · Mosaic', co: 'Tanaka Tileworks', loc: 'Salt Lake City, UT', tone: 'sand', mutual: 3 },
    { name: 'Wendell Brooks', initials: 'WB', role: 'Plumber · Master', co: 'Brooks & Sons', loc: 'Belgrade, MT', tone: 'rust', mutual: 9 },
  ],
  feed: [
    {
      type: 'project',
      who: { name: 'Tasha Coleman', initials: 'TC', tone: 'brick', role: 'GC · Coleman & Daughters' },
      time: '2h',
      copy: 'Wrapped framing on the Millcreek cabin today. 28 days from foundation pour. Crew of 6 — proud of every one of them.',
      photos: ['frame', 'roof'],
      stats: { likes: 84, comments: 12, project: 'Millcreek Cabin' },
    },
    {
      type: 'connection',
      who: { name: 'Roberto Salinas', initials: 'RS', tone: 'rust', role: 'Master Electrician' },
      time: '5h',
      copy: 'Looking for a journeyman electrician to join Salinas Electric — residential work, Salt Lake City/Belgrade area. DM if interested or know someone.',
      tags: ['Hiring', 'Journeyman', 'Residential'],
      stats: { likes: 23, comments: 7 },
    },
    {
      type: 'milestone',
      who: { name: 'Henrik Lindqvist', initials: 'HL', tone: 'slate', role: 'Stonemason' },
      time: '1d',
      copy: 'Just hit 10,000 hours of stonework. Started as an apprentice in 2009 — a lot of stone has passed through these hands.',
      photos: ['brick'],
      milestone: '10,000 hours',
      stats: { likes: 156, comments: 34 },
    },
    {
      type: 'project',
      who: { name: 'Diane Okafor', initials: 'DO', tone: 'sage', role: 'PM · Highline Build Co.' },
      time: '2d',
      copy: 'Avenues Residence — final walkthrough today. From breaking ground in May 2023 to handing over the keys. Marcus Whitfield led a hell of a crew.',
      photos: ['kitchen', 'wood', 'frame'],
      stats: { likes: 211, comments: 28, project: 'Avenues Residence' },
    },
  ],
};

// Expose to other scripts
Object.assign(window, { Icon, Avatar, Photo, SAMPLE });
