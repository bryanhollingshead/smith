// Smith — Dev seed
//
// Rich cast of fictional Salt Lake metro tradespeople for local development.
// This DEV seed is destructive (wipes app data) and seeds the realistic-looking
// personas Marcus, Diane, et al. plus the founder account (Bryan Hollingshead).
//
// For PRODUCTION seed (just the 4 trade-archetype "Demo:" accounts, idempotent,
// safe to run against a live DB) see seed-demo.js. The dev seed and the prod
// seed share zero data — they live separately on purpose.

import 'dotenv/config';
import { pool, q, tx } from './db.js';
import { hashPassword } from './auth-utils.js';
import { seedDemoArticlesIfEmpty } from './seed-news.js';

// ── Canonical trades catalog (matches the onboarding screen) ───────────────
const CANONICAL_TRADES = [
  { name: 'Carpentry',           icon: 'tool' },
  { name: 'Electrical',          icon: 'tool' },
  { name: 'Plumbing',            icon: 'tool' },
  { name: 'Concrete & Masonry',  icon: 'tool' },
  { name: 'Roofing',             icon: 'tool' },
  { name: 'HVAC',                icon: 'tool' },
  { name: 'Painting & Finishing',icon: 'tool' },
  { name: 'Tile & Flooring',     icon: 'tool' },
  { name: 'Project Management',  icon: 'briefcase' },
  { name: 'General Contracting', icon: 'hardhat' },
  { name: 'Framing',             icon: 'tool' },
  { name: 'Custom Millwork',     icon: 'tool' },
  { name: 'Cabinetry',           icon: 'tool' },
  { name: 'Stonemasonry',        icon: 'tool' },
];

// Salt Lake metro locations used across this seed. Spread across the valley so
// "people in your area" looks like a real region, not one zip code.
//   Salt Lake City · Sandy · West Jordan · Park City · Provo · Lehi
//   West Valley City · Ogden · Murray · Cottonwood Heights · Holladay · Heber

// ── People (cast of SLC tradespeople; same character names as before, just relocated) ──
const PASSWORD = 'framer-2024-mt';   // shared dev password — same for everyone

const PEOPLE = [
  {
    email: 'marcus.whitfield@smith.test', first: 'Marcus', last: 'Whitfield',
    headline: 'Master Carpenter · Custom Millwork & Framing',
    location: 'Cottonwood Heights, UT',
    avatar_tone: 'wood', cover_kind: 'frame', verified_smith: true, years: 18,
    union: { name: 'Local 184 — Carpenters (Mountain West)', since: '2008' },
    apprentice: { hours: 8400, required: 8000, status: 'Journeyman' },
    insurance: { carrier: 'Liberty Mutual', limit: '$2M GL', verified: true },
    about: 'Eighteen years building custom homes and millwork across the Wasatch Front. Apprenticed in timber frame, sharpened on cabinetry, now leading carpentry crews on high-end residential builds from Park City to the Avenues.',
    trades: [
      { name: 'Carpentry', years: 18 }, { name: 'Framing', years: 14 },
      { name: 'Custom Millwork', years: 11 }, { name: 'Cabinetry', years: 8 },
    ],
    licenses: [
      { name: 'UT Contractor License',          number: 'CON-UT-44219', expiration: '2027-03', verified: true },
      { name: 'OSHA 30 — Construction',         number: 'OSH-30-882140', expiration: '2026-08', verified: true },
      { name: 'Lead-Safe Certified Renovator',  number: 'LSC-887421',    expiration: '2027-01', verified: true },
    ],
    skills: [
      { name: 'Custom Millwork',  level: 5 },
      { name: 'Framing',          level: 5 },
      { name: 'Cabinetry',        level: 4 },
      { name: 'Stair Building',   level: 4 },
      { name: 'Timber Frame',     level: 3 },
    ],
    work: [
      {
        company: { name: 'Wasatch Build Co.', type: 'General Contractor', logo_tone: 'rust' },
        role: 'Lead Carpenter', from: '2021', to: null, current: true,
        jobsites: [
          { title: 'Bonneville Residence',     kind: 'Custom Home · 4,200 sqft', loc: 'Park City, UT',         dur: '2023–2024', photo: 'frame', featured: true },
          { title: 'Deer Valley Lodge',        kind: 'Hospitality · Renovation', loc: 'Park City, UT',         dur: '2022–2023', photo: 'wood',  featured: true },
          { title: 'Liberty Wells Townhomes',  kind: 'Multi-family · 8 units',   loc: 'Salt Lake City, UT',    dur: '2021–2022', photo: 'brick', featured: false },
        ],
      },
      {
        company: { name: 'Whitfield Millwork', type: 'Sub · Carpentry', logo_tone: 'wood', claim: true },
        role: 'Owner / Operator', from: '2018', to: '2021', current: false,
        jobsites: [
          { title: 'Sugar House Kitchen',      kind: 'Custom Cabinetry',         loc: 'Salt Lake City, UT',    dur: '2020',      photo: 'kitchen',  featured: true },
          { title: 'Marmalade Library Restoration', kind: 'Built-ins · Restoration',  loc: 'Salt Lake City, UT',    dur: '2019',      photo: 'workshop', featured: true },
        ],
      },
      {
        company: { name: 'Paramount Construction', type: 'General Contractor', logo_tone: 'steel' },
        role: 'Carpenter', from: '2012', to: '2018', current: false,
        jobsites: [
          { title: 'Empire Pass Phase II',     kind: 'Custom Homes',             loc: 'Park City, UT',         dur: '2015–2018', photo: 'frame', featured: false },
        ],
      },
    ],
  },
  // Connections — given fuller-but-lighter profiles, relocated to SLC metro.
  { email: 'diane.okafor@smith.test',     first: 'Diane',   last: 'Okafor',     headline: 'Project Manager',           location: 'Sugar House, Salt Lake City, UT', avatar_tone: 'sage',  cover_kind: 'crew',     trades: [{ name: 'Project Management', years: 12 }, { name: 'General Contracting', years: 8 }] },
  { email: 'beto.salinas@smith.test',     first: 'Roberto', last: 'Salinas',    headline: 'Master Electrician',        location: 'West Jordan, UT',                 avatar_tone: 'rust',  cover_kind: 'workshop', trades: [{ name: 'Electrical', years: 22 }] },
  { email: 'tasha.coleman@smith.test',    first: 'Tasha',   last: 'Coleman',    headline: 'GC · Owner',                location: 'Sandy, UT',                       avatar_tone: 'brick', cover_kind: 'frame',    verified_smith: true, trades: [{ name: 'General Contracting', years: 15 }] },
  { email: 'henrik.lindqvist@smith.test', first: 'Henrik',  last: 'Lindqvist',  headline: 'Stonemason',                location: 'Heber, UT',                       avatar_tone: 'slate', cover_kind: 'steel',    trades: [{ name: 'Stonemasonry', years: 16 }] },
  { email: 'aiyana.redfeather@smith.test',first: 'Aiyana',  last: 'Redfeather', headline: 'Architect · Range Studio',  location: 'Salt Lake City, UT',              avatar_tone: 'sage',  cover_kind: 'blueprint',trades: [{ name: 'Project Management', years: 9 }] },
  { email: 'mac.mckenna@smith.test',      first: 'Frank',   last: 'McKenna',    headline: 'Foreman · Concrete',        location: 'West Valley City, UT',            avatar_tone: 'steel', cover_kind: 'concrete', trades: [{ name: 'Concrete & Masonry', years: 21 }] },
  { email: 'yuki.tanaka@smith.test',      first: 'Yuki',    last: 'Tanaka',     headline: 'Tile · Mosaic',             location: 'Holladay, UT',                    avatar_tone: 'sand',  cover_kind: 'tile',     trades: [{ name: 'Tile & Flooring', years: 11 }] },
  { email: 'wendell.brooks@smith.test',   first: 'Wendell', last: 'Brooks',     headline: 'Plumber · Master',          location: 'Murray, UT',                      avatar_tone: 'rust',  cover_kind: 'kitchen',  trades: [{ name: 'Plumbing', years: 19 }] },
];

const FEED = [
  // (author email, type, body, photos, tags, milestone, project_name, age in hours)
  { who: 'tasha.coleman@smith.test', type: 'project',
    body: 'Wrapped framing on the Wasatch cabin today. 28 days from foundation pour. Crew of 6 — proud of every one of them.',
    photos: ['frame', 'roof'], project_name: 'Wasatch Cabin', age_hours: 2 },

  { who: 'beto.salinas@smith.test', type: 'hiring',
    body: 'Looking for a journeyman electrician to join Salinas Electric — residential work, Salt Lake / West Jordan area. DM if interested or know someone.',
    tags: ['Hiring', 'Journeyman', 'Residential'], age_hours: 5 },

  { who: 'henrik.lindqvist@smith.test', type: 'milestone',
    body: 'Just hit 10,000 hours of stonework. Started as an apprentice in 2009 — a lot of stone has passed through these hands.',
    photos: ['brick'], milestone: '10,000 hours', age_hours: 24 },

  { who: 'diane.okafor@smith.test', type: 'project',
    body: 'Bonneville Residence — final walkthrough today. From breaking ground in May 2023 to handing over the keys. Marcus Whitfield led a hell of a crew.',
    photos: ['kitchen', 'wood', 'frame'], project_name: 'Bonneville Residence', age_hours: 48 },
];

// ── Wipe app data (keep migrations) ─────────────────────────────────────────
async function wipe(c) {
  const tables = [
    // Messaging (newest, but cascades from users anyway — explicit for clarity)
    'messages', 'message_participants', 'message_threads',
    'news_saves', 'news_articles', 'news_feeds',
    'notifications', 'mock_emails',
    'post_likes', 'post_comments', 'post_tags', 'post_photos', 'posts',
    'skill_endorsements', 'skills',
    'jobsites', 'work_history',
    'connections',
    'licenses', 'user_trades',
    'email_verification_codes', 'password_reset_tokens', 'sessions',
    'companies',
    'users',
    'trades',
  ];
  for (const t of tables) {
    // Tables added by later migrations may not exist yet on older DBs — skip
    // gracefully so an old database can still be reseeded after migrate.
    try { await c.query(`TRUNCATE ${t} RESTART IDENTITY CASCADE`); }
    catch (e) { if (e.code !== '42P01') throw e; /* 42P01 = undefined table */ }
  }
}

async function main() {
  console.log('[seed] starting');
  const hash = await hashPassword(PASSWORD);

  await tx(async (c) => {
    await wipe(c);

    // Trades catalog
    for (let i = 0; i < CANONICAL_TRADES.length; i++) {
      await c.query(
        `INSERT INTO trades (name, icon, position) VALUES ($1,$2,$3)`,
        [CANONICAL_TRADES[i].name, CANONICAL_TRADES[i].icon, i]
      );
    }

    // Users
    const userIds = {};
    for (const p of PEOPLE) {
      const { rows } = await c.query(
        `INSERT INTO users (
            email, password_hash, email_verified, first_name, last_name,
            headline, location, about, avatar_tone, cover_kind,
            verified_smith, years_experience,
            union_name, union_member_since,
            apprentice_hours, apprentice_required, apprentice_status,
            insurance_carrier, insurance_limit, insurance_verified,
            onboarding_done, onboarding_step
         )
         VALUES ($1,$2,TRUE,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,TRUE,5)
         RETURNING id`,
        [
          p.email, hash, p.first, p.last,
          p.headline || '', p.location || '', p.about || '',
          p.avatar_tone || 'wood', p.cover_kind || 'frame',
          !!p.verified_smith, p.years || 0,
          p.union?.name || null, p.union?.since || null,
          p.apprentice?.hours || 0, p.apprentice?.required || 8000, p.apprentice?.status || 'Apprentice',
          p.insurance?.carrier || null, p.insurance?.limit || null, !!p.insurance?.verified,
        ]
      );
      userIds[p.email] = rows[0].id;
    }

    // Marcus is our admin user (powers the /admin/news queue).
    await c.query(
      `UPDATE users SET is_admin = TRUE WHERE email = $1`,
      ['marcus.whitfield@smith.test']
    );

    // Seed the curated RSS feed list. The ingester reads this table; we can
    // add/disable feeds from the DB (or eventually a UI) without code changes.
    const FEEDS = [
      // The Trade — operations & big-picture coverage
      { name: 'Construction Dive',          url: 'https://www.constructiondive.com/feeds/news/',                          category: 'The Trade',  default_tags: [] },
      { name: 'ENR — Engineering News-Record', url: 'https://www.enr.com/rss/all',                                          category: 'The Trade',  default_tags: [] },
      { name: 'Construction Executive',     url: 'https://www.constructionexec.com/rss',                                  category: 'The Trade',  default_tags: [] },
      { name: 'For Construction Pros',      url: 'https://www.forconstructionpros.com/rss',                               category: 'The Trade',  default_tags: [] },

      // Career — workforce, hiring, training
      { name: 'ENR Workforce',              url: 'https://www.enr.com/topics/177/rss',                                    category: 'Career',     default_tags: ['Apprenticeship'] },
      { name: 'Construction Citizen',       url: 'https://constructioncitizen.com/rss.xml',                               category: 'Career',     default_tags: [] },

      // Materials & equipment
      { name: 'Equipment World',            url: 'https://www.equipmentworld.com/rss',                                    category: 'Materials',  default_tags: [] },
      { name: 'Concrete Construction',      url: 'https://www.concreteconstruction.net/rss/',                             category: 'Materials',  default_tags: ['Concrete & Masonry'] },
      { name: 'BUILDINGS',                  url: 'https://www.buildings.com/rss',                                         category: 'Materials',  default_tags: [] },
      { name: 'Architectural Record',       url: 'https://www.architecturalrecord.com/rss/all',                           category: 'Materials',  default_tags: [] },

      // Labor — wages, union, workforce data
      { name: 'AGC of America News',        url: 'https://www.agc.org/news/rss.xml',                                      category: 'Labor',      default_tags: ['Wages'] },
      { name: 'ABC News Releases',          url: 'https://www.abc.org/News-Media/News-Releases/RSS',                      category: 'Labor',      default_tags: [] },
      { name: 'BLS Construction',           url: 'https://www.bls.gov/feed/iag23.rss',                                    category: 'Labor',      default_tags: ['Wages'] },

      // Safety
      { name: 'OSHA News Releases',         url: 'https://www.osha.gov/news/newsreleases.xml',                            category: 'Safety',     default_tags: ['Safety'] },
      { name: 'CPWR Research',              url: 'https://www.cpwr.com/feed/',                                            category: 'Safety',     default_tags: ['Safety'] },

      // Codes & compliance
      { name: 'ICC Public News',            url: 'https://www.iccsafe.org/news/feed/',                                    category: 'Codes',      default_tags: ['Codes'] },

      // Tech & AI
      { name: 'BuiltWorlds',                url: 'https://builtworlds.com/feed/',                                         category: 'Tech & AI',  default_tags: ['Technology'] },
      { name: 'Construction Dive — Tech',   url: 'https://www.constructiondive.com/topic/construction-tech/feeds/',       category: 'Tech & AI',  default_tags: ['Technology'] },
      { name: 'AEC Magazine',               url: 'https://aecmag.com/feed/',                                              category: 'Tech & AI',  default_tags: ['Technology'] },
    ];
    for (const f of FEEDS) {
      await c.query(
        `INSERT INTO news_feeds (name, url, category, default_tags)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (url) DO NOTHING`,
        [f.name, f.url, f.category, f.default_tags]
      );
    }

    // Trades + licenses + skills
    for (const p of PEOPLE) {
      const uid = userIds[p.email];
      const tradeList = p.trades || [];
      for (let i = 0; i < tradeList.length; i++) {
        const t = tradeList[i];
        const found = await c.query('SELECT id FROM trades WHERE LOWER(name) = LOWER($1)', [t.name]);
        let tid = found.rows[0]?.id;
        if (!tid) {
          const ins = await c.query(
            'INSERT INTO trades (name, icon) VALUES ($1, $2) RETURNING id', [t.name, 'tool']
          );
          tid = ins.rows[0].id;
        }
        await c.query(
          `INSERT INTO user_trades (user_id, trade_id, years, position) VALUES ($1,$2,$3,$4)`,
          [uid, tid, t.years || 0, i]
        );
      }
      const licList = p.licenses || [];
      for (let i = 0; i < licList.length; i++) {
        const l = licList[i];
        await c.query(
          `INSERT INTO licenses (user_id, name, number, expiration, verified, position)
             VALUES ($1,$2,$3,$4,$5,$6)`,
          [uid, l.name, l.number, l.expiration, !!l.verified, i]
        );
      }
      const skillList = p.skills || [];
      for (let i = 0; i < skillList.length; i++) {
        const s = skillList[i];
        await c.query(
          `INSERT INTO skills (user_id, name, level, position) VALUES ($1,$2,$3,$4)`,
          [uid, s.name, s.level, i]
        );
      }
    }

    // Companies + work history + jobsites (only Marcus has full history seeded)
    for (const p of PEOPLE) {
      const uid = userIds[p.email];
      const work = p.work || [];
      for (let i = 0; i < work.length; i++) {
        const w = work[i];
        // Find or create company
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
    }

    // Connections — Marcus is connected with all 8 others (accepted).
    const me = userIds['marcus.whitfield@smith.test'];
    for (const p of PEOPLE) {
      if (p.email === 'marcus.whitfield@smith.test') continue;
      const them = userIds[p.email];
      const [a, b] = me < them ? [me, them] : [them, me];
      await c.query(
        `INSERT INTO connections (user_a_id, user_b_id, status, requested_by, responded_at)
           VALUES ($1,$2,'accepted',$3, NOW() - INTERVAL '30 days')`,
        [a, b, them]
      );
    }
    // Inter-connections so "mutuals" looks realistic.
    const others = PEOPLE.filter(p => p.email !== 'marcus.whitfield@smith.test')
      .map(p => userIds[p.email]);
    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        if ((i + j) % 3 !== 0) continue; // sparse
        const [a, b] = others[i] < others[j] ? [others[i], others[j]] : [others[j], others[i]];
        await c.query(
          `INSERT INTO connections (user_a_id, user_b_id, status, requested_by, responded_at)
             VALUES ($1,$2,'accepted',$3, NOW() - INTERVAL '60 days')
           ON CONFLICT DO NOTHING`,
          [a, b, others[i]]
        );
      }
    }

    // Seed a handful of people who are NOT connected to Marcus, so the
    // "Suggestions" tab is populated with same-metro candidates.
    for (const stranger of [
      { email: 'lila.rojas@smith.test',     first: 'Lila',    last: 'Rojas',    headline: 'Drywaller · Finisher',          location: 'Salt Lake City, UT' },
      { email: 'sam.kowalski@smith.test',   first: 'Sam',     last: 'Kowalski', headline: 'HVAC Tech',                     location: 'Salt Lake City, UT' },
      { email: 'reggie.dupont@smith.test',  first: 'Reggie',  last: 'Dupont',   headline: 'Roofer · Owner',                location: 'West Jordan, UT' },
      { email: 'omar.farouk@smith.test',    first: 'Omar',    last: 'Farouk',   headline: 'Glazier · Commercial',          location: 'Salt Lake City, UT' },
      { email: 'sarah.becker@smith.test',   first: 'Sarah',   last: 'Becker',   headline: 'Painter · Finishing',           location: 'Sandy, UT' },
    ]) {
      await c.query(
        `INSERT INTO users (email, password_hash, email_verified, first_name, last_name,
                            headline, location, avatar_tone, onboarding_done, onboarding_step)
           VALUES ($1,$2,TRUE,$3,$4,$5,$6,'sand',TRUE,5)`,
        [stranger.email, hash, stranger.first, stranger.last,
         stranger.headline, stranger.location]
      );
    }

    // Two pending requests TO Marcus (so the Pending tab isn't empty).
    // Create two new "stranger" users for this — keeps them out of the connection list.
    for (const stranger of [
      { email: 'jordan.kemper@smith.test', first: 'Jordan', last: 'Kemper', headline: 'Welder · Structural', location: 'Ogden, UT',  avatar_tone: 'steel' },
      { email: 'priya.shastri@smith.test', first: 'Priya',  last: 'Shastri', headline: 'Civil Engineer',     location: 'Provo, UT',  avatar_tone: 'sage' },
    ]) {
      const ins = await c.query(
        `INSERT INTO users (email, password_hash, email_verified, first_name, last_name,
                            headline, location, avatar_tone, onboarding_done, onboarding_step)
           VALUES ($1,$2,TRUE,$3,$4,$5,$6,$7,TRUE,5) RETURNING id`,
        [stranger.email, hash, stranger.first, stranger.last,
         stranger.headline, stranger.location, stranger.avatar_tone]
      );
      const sid = ins.rows[0].id;
      const [a, b] = me < sid ? [me, sid] : [sid, me];
      await c.query(
        `INSERT INTO connections (user_a_id, user_b_id, status, requested_by, created_at)
           VALUES ($1,$2,'pending',$3, NOW() - INTERVAL '2 days')`,
        [a, b, sid]
      );
      await c.query(
        `INSERT INTO notifications (user_id, kind, actor_id, body, created_at)
           VALUES ($1,'connection_request',$2,'sent you a connection request', NOW() - INTERVAL '2 days')`,
        [me, sid]
      );
    }

    // Bryan Hollingshead — founder account, lives in dev seed only. In prod
    // Bryan signs up like any other user; this dev entry is so the dev DB
    // has him present at id 15 (after the strangers above) with admin powers.
    await c.query(
      `INSERT INTO users (
          email, password_hash, email_verified, first_name, last_name,
          headline, location, avatar_tone, cover_kind, verified_smith,
          onboarding_done, onboarding_step, is_admin
        )
        VALUES ($1,$2,TRUE,$3,$4,$5,$6,$7,$8,TRUE,TRUE,5,TRUE)`,
      [
        'bryan.hollingshead@gmail.com', hash, 'Bryan', 'Hollingshead',
        'Smith — Founder', 'Salt Lake City, UT', 'rust', 'frame',
      ]
    );

    // Feed posts
    for (const p of FEED) {
      const author = userIds[p.who];
      const ins = await c.query(
        `INSERT INTO posts (author_id, type, body, project_name, milestone, created_at)
           VALUES ($1,$2,$3,$4,$5, NOW() - INTERVAL '${p.age_hours} hours')
           RETURNING id`,
        [author, p.type, p.body, p.project_name || null, p.milestone || null]
      );
      const pid = ins.rows[0].id;
      const photos = p.photos || [];
      for (let i = 0; i < photos.length; i++) {
        await c.query(
          `INSERT INTO post_photos (post_id, photo_kind, position) VALUES ($1,$2,$3)`,
          [pid, photos[i], i]
        );
      }
      const tags = p.tags || [];
      for (const t of tags) {
        await c.query(`INSERT INTO post_tags (post_id, tag) VALUES ($1,$2)`, [pid, t]);
      }
    }

    // A sprinkle of likes & one comment so the feed numbers aren't all zero.
    const likers = others.slice(0, 5);
    const allPosts = await c.query('SELECT id FROM posts');
    for (const post of allPosts.rows) {
      for (const u of likers) {
        if ((post.id + u) % 3 === 0) continue;
        await c.query(
          `INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [post.id, u]
        );
      }
    }
    if (allPosts.rows[0]) {
      await c.query(
        `INSERT INTO post_comments (post_id, author_id, body)
           VALUES ($1,$2,$3)`,
        [allPosts.rows[0].id, me, 'Crew did real work on this one. Wasatch is going to look sharp.']
      );
    }
  });

  // Add demo news articles if the table is empty (e.g. you haven't run
  // `npm run ingest` yet). Once you have, real articles take over and this
  // is a no-op.
  await seedDemoArticlesIfEmpty();

  // Also seed the production demo accounts in dev so the dev DB looks
  // identical to prod from the demos' perspective. seed-demo.js is idempotent
  // so this is safe.
  const { seedDemos } = await import('./seed-demo.js');
  await seedDemos({ silent: true });

  console.log(`[seed] done.`);
  console.log(`[seed] sign in with any of:`);
  for (const p of PEOPLE) console.log(`         ${p.email}  /  ${PASSWORD}`);
  console.log(`         bryan.hollingshead@gmail.com  /  ${PASSWORD}`);
}

main()
  .then(() => pool.end())
  .catch((err) => { console.error('[seed] failed:', err); pool.end(); process.exit(1); });
