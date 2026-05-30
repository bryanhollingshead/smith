// Smith — Dev-only fake jobs seed
//
// Lets us verify matching + the Jobs feed UI locally without Adzuna
// credentials. Inserts a small set of varied jobs (different trades,
// locations, salaries, direct vs. aggregator) so the score blend has
// something to actually rank.
//
// Run:    npm run seed-jobs-dev
// Safe to re-run — dedupes on (source_driver, source_job_id).
//
// Source driver is 'dev_seed' so these are visually distinct from real
// Adzuna rows. Delete from prod (which will never have a 'dev_seed' source
// row anyway) with:
//   DELETE FROM jobs WHERE source_driver = 'dev_seed';

import 'dotenv/config';
import { pool, q } from './db.js';
import { recomputeAllMatches } from './jobs/match.js';

const FAKE_JOBS = [
  {
    source_job_id: 'dev-1',
    title: 'Master Carpenter — Custom Homes',
    company: 'Wasatch Build Co.',
    description: 'Lead carpenter for high-end custom home builds across the Salt Lake valley. Framing, finish carpentry, millwork.',
    location: 'Salt Lake City, UT',
    salary_min: 75000, salary_max: 95000, salary_period: 'year', salary_currency: 'USD',
    url: 'https://example.com/jobs/dev-1',
    contact_email: 'hiring@wasatchbuild.example',
    trade_tags: ['Carpentry', 'Custom Millwork'],
    skill_tags: ['Framing', 'Trim & molding', 'Cabinet install'],
    is_prevailing_wage: false,
    is_direct_post: false,
    posted_at: new Date(Date.now() - 3 * 86400000), // 3 days ago
  },
  {
    source_job_id: 'dev-2',
    title: 'Journeyman Electrician',
    company: 'Mountain Power Services',
    description: 'Residential electrical service upgrades, panel replacements, EV charger installs. Salt Lake metro.',
    location: 'Murray, UT',
    salary_min: 60000, salary_max: 80000, salary_period: 'year', salary_currency: 'USD',
    url: 'https://example.com/jobs/dev-2',
    contact_phone: '+1-801-555-0101',
    trade_tags: ['Electrical'],
    skill_tags: ['Service upgrade', 'Panel replacement', 'EV charger install'],
    is_prevailing_wage: false,
    is_direct_post: false,
    posted_at: new Date(Date.now() - 5 * 86400000),
  },
  {
    source_job_id: 'dev-3',
    title: 'Concrete Foreman — Davis-Bacon Project',
    company: 'Granite Civil Inc.',
    description: 'Lead foreman for prevailing wage public works project. Foundation pours, flatwork, retaining walls.',
    location: 'Salt Lake City, UT',
    salary_min: 85000, salary_max: 110000, salary_period: 'year', salary_currency: 'USD',
    url: 'https://example.com/jobs/dev-3',
    trade_tags: ['Concrete & Masonry'],
    skill_tags: ['Foundation pour', 'Slab pour'],
    is_prevailing_wage: true,
    is_direct_post: false,
    posted_at: new Date(Date.now() - 1 * 86400000),
  },
  {
    source_job_id: 'dev-4',
    title: 'Finish Carpenter',
    company: 'Park City Custom Homes',
    description: 'Cabinet install, trim, custom millwork on luxury Park City builds.',
    location: 'Park City, UT',
    salary_min: 70000, salary_max: 90000, salary_period: 'year', salary_currency: 'USD',
    url: 'https://example.com/jobs/dev-4',
    contact_email: 'jobs@parkcitycustom.example',
    trade_tags: ['Carpentry'],
    skill_tags: ['Trim & molding', 'Cabinet install', 'Custom Millwork'],
    is_prevailing_wage: false,
    is_direct_post: false,
    posted_at: new Date(Date.now() - 8 * 86400000),
  },
  {
    source_job_id: 'dev-5',
    title: 'HVAC Service Tech',
    company: 'Cascade Mechanical',
    description: 'Residential HVAC install + service. Mini-splits, heat pumps, boiler work.',
    location: 'Sandy, UT',
    salary_min: 55000, salary_max: 75000, salary_period: 'year', salary_currency: 'USD',
    url: 'https://example.com/jobs/dev-5',
    contact_phone: '+1-801-555-0102',
    trade_tags: ['HVAC'],
    skill_tags: ['Mini-split install', 'Heat pump install', 'Boiler install'],
    is_prevailing_wage: false,
    is_direct_post: false,
    posted_at: new Date(Date.now() - 12 * 86400000),
  },
  {
    source_job_id: 'dev-6',
    title: 'Plumber — New Construction',
    company: 'Wasatch Build Co.',
    description: 'Rough-in plumbing, fixture install, water heater install on new residential builds.',
    location: 'Salt Lake City, UT',
    salary_min: 65000, salary_max: 85000, salary_period: 'year', salary_currency: 'USD',
    url: 'https://example.com/jobs/dev-6',
    trade_tags: ['Plumbing'],
    skill_tags: ['Repipe', 'Water heater install'],
    is_prevailing_wage: false,
    is_direct_post: false,
    posted_at: new Date(Date.now() - 20 * 86400000),
  },
  {
    source_job_id: 'dev-7',
    title: 'Cabinet Maker',
    company: 'Sundance Woodworks',
    description: 'Custom cabinets and built-ins. Shop-based plus install. Excellent finish work required.',
    location: 'Provo, UT',
    salary_min: 55000, salary_max: 75000, salary_period: 'year', salary_currency: 'USD',
    url: 'https://example.com/jobs/dev-7',
    trade_tags: ['Cabinetry', 'Custom Millwork', 'Carpentry'],
    skill_tags: ['Cabinet install', 'Custom Millwork'],
    is_prevailing_wage: false,
    is_direct_post: false,
    posted_at: new Date(Date.now() - 45 * 86400000), // older — recency penalty
  },
  {
    source_job_id: 'dev-8',
    title: 'Senior Project Manager — Commercial',
    company: 'Continental Builders',
    description: 'Commercial GC seeking PM for tenant improvement and ground-up commercial projects. Bay Area.',
    location: 'San Francisco, CA',
    salary_min: 140000, salary_max: 180000, salary_period: 'year', salary_currency: 'USD',
    url: 'https://example.com/jobs/dev-8',
    trade_tags: ['Project Management', 'General Contracting'],
    skill_tags: ['Tenant improvement'],
    is_prevailing_wage: false,
    is_direct_post: false,
    posted_at: new Date(Date.now() - 7 * 86400000),
  },
];

async function ensureDevSource() {
  // Find-or-create a job_sources row so jobs have a source_id to reference.
  // Disabled so the ingest scheduler ignores it (there's no driver to call).
  const { rows } = await q(`SELECT id FROM job_sources WHERE driver = 'dev_seed' LIMIT 1`);
  if (rows[0]) return rows[0].id;
  const ins = await q(
    `INSERT INTO job_sources (driver, name, config, enabled)
       VALUES ('dev_seed', 'Dev seed jobs (local only)', '{}'::jsonb, FALSE)
       RETURNING id`
  );
  return ins.rows[0].id;
}

async function seed() {
  const sourceId = await ensureDevSource();
  let inserted = 0, updated = 0;
  for (const j of FAKE_JOBS) {
    const r = await q(
      `INSERT INTO jobs (
         source_id, source_driver, source_job_id,
         title, company, description, location,
         salary_min, salary_max, salary_currency, salary_period,
         url, contact_email, contact_phone,
         trade_tags, skill_tags,
         is_prevailing_wage, is_direct_post, posted_at
       ) VALUES (
         $1, 'dev_seed', $2,
         $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13,
         $14, $15,
         $16, $17, $18
       )
       ON CONFLICT (source_driver, source_job_id) DO UPDATE SET
         title = EXCLUDED.title,
         posted_at = EXCLUDED.posted_at,
         trade_tags = EXCLUDED.trade_tags,
         skill_tags = EXCLUDED.skill_tags
       RETURNING (xmax = 0) AS inserted`,
      [
        sourceId, j.source_job_id,
        j.title, j.company, j.description, j.location,
        j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
        j.url, j.contact_email || null, j.contact_phone || null,
        j.trade_tags, j.skill_tags,
        j.is_prevailing_wage, j.is_direct_post, j.posted_at,
      ]
    );
    if (r.rows[0]?.inserted) inserted++; else updated++;
  }
  console.log(`[seed-jobs-dev] ${inserted} new, ${updated} updated`);
  const m = await recomputeAllMatches();
  console.log(`[seed-jobs-dev] recomputed matches — ${m.users} users, ${m.totalScored} jobs scored`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => pool.end())
    .catch((e) => { console.error(e); pool.end(); process.exit(1); });
}
