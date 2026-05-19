// Smith — Production demo accounts
//
// Seeds 4 demo trade-archetype accounts marked is_demo=TRUE. Demos are visible
// in suggestions, search, and profile pages so new users can see what a
// populated Smith profile looks like — but the backend prevents anyone from
// connecting to them or messaging them, and the UI shows a "Demo" badge.
//
// This script is *idempotent*. It checks for the existence of each demo by
// email and only creates the missing ones. Real users are never touched.
// Safe to run against a production database at any time. Usage:
//   npm run seed-demo
//
// When the time comes to retire the demos (after Smith has ~50 real users),
// delete this script and DELETE FROM users WHERE is_demo = TRUE in prod.

import 'dotenv/config';
import { pool, q, tx } from './db.js';
import { hashPassword } from './auth-utils.js';

// Demo accounts use an obviously-fake password since no one should ever sign
// in as them. The backend ALSO prevents signin for is_demo users (defense in
// depth — see seed-demo precondition + the demo-signin block in routes/auth.js).
const DEMO_PASSWORD = 'demo-account-' + Math.random().toString(36).slice(2);

// Avatar tone for demos: a consistent "demo" cream so they read visually
// distinct from real users at a glance.
const DEMO_TONE = 'cream';

const DEMOS = [
  {
    email: 'demo-carpenter@smith.app',
    first: 'Demo', last: 'Master Carpenter',
    headline: 'Master Carpenter · Custom Homes & Millwork',
    location: 'Salt Lake City, UT',
    cover_kind: 'frame', years: 22,
    union: { name: 'Local 184 — Carpenters (Mountain West)', since: '2003' },
    apprentice: { hours: 10800, required: 8000, status: 'Master' },
    insurance: { carrier: 'Liberty Mutual', limit: '$2M GL', verified: true },
    about: 'Demo profile · Twenty-two years of residential carpentry across the Wasatch Front. From foundation-to-finish on custom homes — framing, millwork, cabinetry, finish work. Crew lead for the past decade.',
    trades: [
      { name: 'Carpentry', years: 22 },
      { name: 'Framing', years: 18 },
      { name: 'Custom Millwork', years: 14 },
      { name: 'Cabinetry', years: 10 },
    ],
    licenses: [
      { name: 'UT Contractor License',         number: 'CON-UT-DEMO01', expiration: '2027-06', verified: true },
      { name: 'OSHA 30 — Construction',        number: 'OSH-30-DEMO01', expiration: '2026-10', verified: true },
      { name: 'Lead-Safe Certified Renovator', number: 'LSC-DEMO01',    expiration: '2027-04', verified: true },
    ],
    skills: [
      { name: 'Custom Millwork',  level: 5 },
      { name: 'Stair Building',   level: 5 },
      { name: 'Timber Frame',     level: 5 },
      { name: 'Cabinetry',        level: 4 },
      { name: 'Built-ins',        level: 4 },
      { name: 'Trim & Finish',    level: 5 },
    ],
    work: [
      {
        company: { name: 'Demo Wasatch Builders', type: 'General Contractor', logo_tone: 'rust' },
        role: 'Lead Carpenter', from: '2018', to: null, current: true,
        jobsites: [
          { title: 'Avenues Historic Renovation', kind: 'Restoration · 3,400 sqft',  loc: 'Salt Lake City, UT', dur: '2024',      photo: 'frame',    featured: true },
          { title: 'Park City Mountain Home',     kind: 'Custom Home · 5,800 sqft',  loc: 'Park City, UT',      dur: '2023',      photo: 'wood',     featured: true },
          { title: 'Holladay Hillside Estate',    kind: 'Custom Home · 7,200 sqft',  loc: 'Holladay, UT',       dur: '2022',      photo: 'kitchen',  featured: true },
        ],
      },
      {
        company: { name: 'Demo Mountain Millwork', type: 'Sub · Carpentry', logo_tone: 'wood' },
        role: 'Owner / Lead', from: '2010', to: '2018', current: false,
        jobsites: [
          { title: 'Sundance Lodge Built-ins',    kind: 'Custom Millwork',           loc: 'Sundance, UT',       dur: '2016–2017', photo: 'workshop', featured: false },
        ],
      },
    ],
  },

  {
    email: 'demo-electrician@smith.app',
    first: 'Demo', last: 'Master Electrician',
    headline: 'Master Electrician · Commercial & Industrial',
    location: 'West Valley City, UT',
    cover_kind: 'workshop', years: 19,
    union: { name: 'IBEW Local 354', since: '2006' },
    apprentice: { hours: 9200, required: 8000, status: 'Master' },
    insurance: { carrier: 'The Hartford', limit: '$3M GL', verified: true },
    about: 'Demo profile · Master electrician with nineteen years on commercial and light-industrial jobs across the Salt Lake Valley. Specializing in service upgrades, panel work, and code-driven retrofits.',
    trades: [
      { name: 'Electrical', years: 19 },
    ],
    licenses: [
      { name: 'UT Master Electrician',        number: 'EL-UT-DEMO02',  expiration: '2027-08', verified: true },
      { name: 'OSHA 30 — Construction',       number: 'OSH-30-DEMO02', expiration: '2026-12', verified: true },
      { name: 'NFPA 70E — Arc Flash',         number: 'AF-DEMO02',     expiration: '2026-09', verified: true },
    ],
    skills: [
      { name: 'Service Upgrades',     level: 5 },
      { name: 'Commercial Wiring',    level: 5 },
      { name: 'Panel Work',           level: 5 },
      { name: 'Code Compliance',      level: 5 },
      { name: 'EV Charging Install',  level: 4 },
      { name: 'Solar Tie-In',         level: 3 },
    ],
    work: [
      {
        company: { name: 'Demo Valley Power Co.', type: 'Sub · Electrical', logo_tone: 'steel' },
        role: 'Master Electrician / Foreman', from: '2015', to: null, current: true,
        jobsites: [
          { title: 'Daybreak Office Complex',    kind: 'Commercial · Service & Lighting', loc: 'South Jordan, UT',  dur: '2024',      photo: 'workshop', featured: true },
          { title: 'Granary District Restaurant',kind: 'Commercial · TI Build-Out',       loc: 'Salt Lake City, UT',dur: '2023',      photo: 'concrete', featured: true },
          { title: 'Sandy Industrial Retrofit',  kind: 'Industrial · Panel & Service',    loc: 'Sandy, UT',         dur: '2022',      photo: 'steel',    featured: false },
        ],
      },
      {
        company: { name: 'Demo Salinas Electric (Apprenticeship)', type: 'Sub · Electrical', logo_tone: 'rust' },
        role: 'Apprentice → Journeyman', from: '2006', to: '2015', current: false,
        jobsites: [
          { title: 'Multi-residential Build-Outs', kind: 'Residential · New Construction', loc: 'West Jordan, UT',  dur: '2012–2015', photo: 'frame',    featured: false },
        ],
      },
    ],
  },

  {
    email: 'demo-gc@smith.app',
    first: 'Demo', last: 'General Contractor',
    headline: 'General Contractor · Wasatch Front Custom Homes',
    location: 'Sandy, UT',
    cover_kind: 'frame', years: 15, verified_smith: true,
    insurance: { carrier: 'Travelers', limit: '$5M GL', verified: true },
    about: 'Demo profile · Salt Lake based GC with a focus on high-end custom residential along the Wasatch Front. We run small crews end-to-end — design coordination through punch list. 30+ homes delivered.',
    trades: [
      { name: 'General Contracting', years: 15 },
      { name: 'Project Management',  years: 12 },
    ],
    licenses: [
      { name: 'UT Contractor License (B100)',  number: 'GC-UT-DEMO03',  expiration: '2027-05', verified: true },
      { name: 'OSHA 30 — Construction',        number: 'OSH-30-DEMO03', expiration: '2026-11', verified: true },
      { name: 'EPA Lead-Safe Firm',            number: 'LSF-DEMO03',    expiration: '2027-02', verified: true },
      { name: 'Building Performance Institute',number: 'BPI-DEMO03',    expiration: '2026-07', verified: false },
    ],
    skills: [
      { name: 'Project Management',  level: 5 },
      { name: 'Estimating',          level: 5 },
      { name: 'Permitting',          level: 5 },
      { name: 'Crew Scheduling',     level: 4 },
      { name: 'Custom Residential',  level: 5 },
      { name: 'Owner Communication', level: 5 },
    ],
    work: [
      {
        company: { name: 'Demo Front Range Builders', type: 'General Contractor', logo_tone: 'rust', claim: true },
        role: 'Owner / GC', from: '2014', to: null, current: true,
        jobsites: [
          { title: 'Cottonwood Modern',        kind: 'Custom Home · 5,400 sqft',         loc: 'Cottonwood Heights, UT', dur: '2024',      photo: 'wood',     featured: true },
          { title: 'Heber Valley Compound',    kind: 'Custom Estate · 8,900 sqft',       loc: 'Heber, UT',              dur: '2023–2024', photo: 'frame',    featured: true },
          { title: 'Sugar House Infill',       kind: 'New-Build · 3,200 sqft',           loc: 'Salt Lake City, UT',     dur: '2022',      photo: 'brick',    featured: true },
          { title: 'Deer Crest Remodel',       kind: 'Major Remodel · 4,100 sqft',       loc: 'Park City, UT',          dur: '2022',      photo: 'kitchen',  featured: false },
        ],
      },
    ],
  },

  {
    email: 'demo-plumber@smith.app',
    first: 'Demo', last: 'Master Plumber',
    headline: 'Master Plumber · Residential & Light Commercial',
    location: 'Murray, UT',
    cover_kind: 'kitchen', years: 17,
    union: { name: 'UA Local 140 — Plumbers & Pipefitters', since: '2008' },
    apprentice: { hours: 8800, required: 8000, status: 'Master' },
    insurance: { carrier: 'State Farm Business', limit: '$2M GL', verified: true },
    about: 'Demo profile · Salt Lake-based master plumber. New construction, gut renovations, service work, water heaters, gas lines. Seventeen years across residential and small commercial.',
    trades: [
      { name: 'Plumbing', years: 17 },
    ],
    licenses: [
      { name: 'UT Master Plumber',             number: 'PL-UT-DEMO04',  expiration: '2027-07', verified: true },
      { name: 'OSHA 10 — Construction',        number: 'OSH-10-DEMO04', expiration: '2026-09', verified: true },
      { name: 'Backflow Prevention Tester',    number: 'BPT-DEMO04',    expiration: '2026-08', verified: true },
    ],
    skills: [
      { name: 'New Construction Plumbing',  level: 5 },
      { name: 'Gas Line Installation',      level: 5 },
      { name: 'Water Heater · Tankless',    level: 4 },
      { name: 'Drain & Vent Layout',        level: 5 },
      { name: 'PEX & Copper',               level: 5 },
      { name: 'Service & Repair',           level: 4 },
    ],
    work: [
      {
        company: { name: 'Demo Beehive Plumbing', type: 'Sub · Plumbing', logo_tone: 'wood', claim: true },
        role: 'Owner / Master Plumber', from: '2016', to: null, current: true,
        jobsites: [
          { title: 'Millcreek Custom Home',       kind: 'Residential · New Construction', loc: 'Millcreek, UT',     dur: '2024', photo: 'kitchen', featured: true },
          { title: 'Liberty Park Restaurant',     kind: 'Commercial · TI Build-Out',       loc: 'Salt Lake City, UT',dur: '2023', photo: 'workshop',featured: true },
          { title: 'Holladay Whole-House Repipe', kind: 'Service · Repipe',                loc: 'Holladay, UT',      dur: '2023', photo: 'concrete',featured: true },
        ],
      },
      {
        company: { name: 'Demo Brooks & Sons (Apprenticeship)', type: 'Sub · Plumbing', logo_tone: 'rust' },
        role: 'Apprentice → Journeyman', from: '2008', to: '2016', current: false,
        jobsites: [],
      },
    ],
  },
];

// ── Demo upsert ────────────────────────────────────────────────────────────
// Idempotent: for each demo, check by email. If user exists AND is_demo=TRUE,
// skip silently. If user exists but is NOT a demo, throw — refuse to overwrite
// a real user even if the email collides. If user doesn't exist, create it
// with full profile data.

async function ensureDemo(c, demo, hash) {
  const found = await c.query('SELECT id, is_demo FROM users WHERE email = $1', [demo.email]);
  if (found.rows.length > 0) {
    if (!found.rows[0].is_demo) {
      throw new Error(`User ${demo.email} exists but is not flagged as is_demo — refusing to overwrite.`);
    }
    return { id: found.rows[0].id, created: false };
  }

  // Create user
  const userIns = await c.query(
    `INSERT INTO users (
        email, password_hash, email_verified, is_demo, first_name, last_name,
        headline, location, about, avatar_tone, cover_kind,
        verified_smith, years_experience,
        union_name, union_member_since,
        apprentice_hours, apprentice_required, apprentice_status,
        insurance_carrier, insurance_limit, insurance_verified,
        onboarding_done, onboarding_step
     )
     VALUES ($1,$2,TRUE,TRUE,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,TRUE,5)
     RETURNING id`,
    [
      demo.email, hash, demo.first, demo.last,
      demo.headline || '', demo.location || '', demo.about || '',
      DEMO_TONE, demo.cover_kind || 'frame',
      !!demo.verified_smith, demo.years || 0,
      demo.union?.name || null, demo.union?.since || null,
      demo.apprentice?.hours || 0, demo.apprentice?.required || 8000, demo.apprentice?.status || 'Master',
      demo.insurance?.carrier || null, demo.insurance?.limit || null, !!demo.insurance?.verified,
    ]
  );
  const uid = userIns.rows[0].id;

  // Trades — look up existing trade ids (canonical catalog was seeded earlier
  // in dev; in prod, by migrations / first-run seeding logic). If a needed
  // trade name doesn't exist yet, create it on the fly.
  const tradeList = demo.trades || [];
  for (let i = 0; i < tradeList.length; i++) {
    const t = tradeList[i];
    const found = await c.query('SELECT id FROM trades WHERE LOWER(name) = LOWER($1)', [t.name]);
    let tid = found.rows[0]?.id;
    if (!tid) {
      const ins = await c.query(
        'INSERT INTO trades (name, icon) VALUES ($1,$2) RETURNING id', [t.name, 'tool']
      );
      tid = ins.rows[0].id;
    }
    await c.query(
      `INSERT INTO user_trades (user_id, trade_id, years, position) VALUES ($1,$2,$3,$4)`,
      [uid, tid, t.years || 0, i]
    );
  }

  // Licenses
  const licList = demo.licenses || [];
  for (let i = 0; i < licList.length; i++) {
    const l = licList[i];
    await c.query(
      `INSERT INTO licenses (user_id, name, number, expiration, verified, position)
         VALUES ($1,$2,$3,$4,$5,$6)`,
      [uid, l.name, l.number, l.expiration, !!l.verified, i]
    );
  }

  // Skills
  const skillList = demo.skills || [];
  for (let i = 0; i < skillList.length; i++) {
    const s = skillList[i];
    await c.query(
      `INSERT INTO skills (user_id, name, level, position) VALUES ($1,$2,$3,$4)`,
      [uid, s.name, s.level, i]
    );
  }

  // Companies + work history + jobsites. Companies are looked up by exact
  // (case-insensitive) name match to keep demos sharing one demo-company per
  // trade across re-creates.
  const work = demo.work || [];
  for (let i = 0; i < work.length; i++) {
    const w = work[i];
    let { rows } = await c.query('SELECT id FROM companies WHERE LOWER(name) = LOWER($1)', [w.company.name]);
    let cid = rows[0]?.id;
    if (!cid) {
      const ins = await c.query(
        `INSERT INTO companies (name, type, logo_tone, claimed_by, created_by)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [w.company.name, w.company.type, w.company.logo_tone || 'rust',
         w.company.claim ? uid : null, uid]
      );
      cid = ins.rows[0].id;
    }
    const wh = await c.query(
      `INSERT INTO work_history (user_id, company_id, role, from_year, to_year, is_current, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [uid, cid, w.role, w.from, w.to, !!w.current, i]
    );
    const whId = wh.rows[0].id;
    const sites = w.jobsites || [];
    for (let j = 0; j < sites.length; j++) {
      const js = sites[j];
      await c.query(
        `INSERT INTO jobsites (work_history_id, title, kind, location, duration, photo_kind, is_featured, position)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [whId, js.title, js.kind, js.loc, js.dur, js.photo, !!js.featured, j]
      );
    }
  }

  return { id: uid, created: true };
}

// Exported so the dev seed can call this directly (skipping the standalone
// CLI exit/pool-close behavior). `silent` suppresses log output during dev.
export async function seedDemos({ silent = false } = {}) {
  const hash = await hashPassword(DEMO_PASSWORD);
  await tx(async (c) => {
    // Canonical trades — if seed-demo runs in a virgin prod DB, the trades
    // table will be empty. Seed it before referencing.
    const TRADE_LIST = [
      { name: 'Carpentry', icon: 'tool' }, { name: 'Electrical', icon: 'tool' },
      { name: 'Plumbing', icon: 'tool' }, { name: 'Concrete & Masonry', icon: 'tool' },
      { name: 'Roofing', icon: 'tool' }, { name: 'HVAC', icon: 'tool' },
      { name: 'Painting & Finishing', icon: 'tool' }, { name: 'Tile & Flooring', icon: 'tool' },
      { name: 'Project Management', icon: 'briefcase' }, { name: 'General Contracting', icon: 'hardhat' },
      { name: 'Framing', icon: 'tool' }, { name: 'Custom Millwork', icon: 'tool' },
      { name: 'Cabinetry', icon: 'tool' }, { name: 'Stonemasonry', icon: 'tool' },
    ];
    for (let i = 0; i < TRADE_LIST.length; i++) {
      const t = TRADE_LIST[i];
      await c.query(
        `INSERT INTO trades (name, icon, position) VALUES ($1,$2,$3)
           ON CONFLICT (name) DO NOTHING`,
        [t.name, t.icon, i]
      );
    }

    let created = 0, existing = 0;
    for (const demo of DEMOS) {
      const r = await ensureDemo(c, demo, hash);
      if (r.created) created++; else existing++;
    }
    if (!silent) {
      console.log(`[seed-demo] ${created} created, ${existing} already present.`);
    }
  });
}

// CLI entrypoint — only run if invoked directly (`node src/seed-demo.js`),
// not when imported by seed.js.
const isDirect = import.meta.url === `file://${process.argv[1]}`;
if (isDirect) {
  console.log('[seed-demo] starting (idempotent — safe in production)');
  seedDemos({ silent: false })
    .then(() => { console.log('[seed-demo] done.'); pool.end(); })
    .catch((err) => { console.error('[seed-demo] failed:', err); pool.end(); process.exit(1); });
}
