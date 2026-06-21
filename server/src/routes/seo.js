// Smith — SEO + AI discoverability endpoints
//
// Mounted at the server ROOT (not /api), BEFORE the SPA fallback. Routes here
// are reachable by humans, search crawlers, and LLM agents alike. Auth-free.
//
// Provides:
//   GET /robots.txt           welcomes AI bots explicitly
//   GET /sitemap.xml          all public profiles + claimed companies
//   GET /llms.txt             curated markdown map for LLM agents
//   GET /company/:slug.md     AI-friendly company digest
//   GET /profile/:slug.md     AI-friendly user digest
//
// Principle (per project_brand_voice_hypothesis + project_ai_discoverability):
// reverence through attention. The text we emit here is precise, structured,
// honest, and skips marketing fluff.

import { Router } from 'express';
import { q } from '../db.js';
import { publicUrl } from '../storage.js';
import { loadProfile } from './profiles.js';

const router = Router();

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://smithpro.io').replace(/\/$/, '');

// Same translator the other route files use — parse stored key JSON to URLs.
function parseUrls(stored) {
  if (!stored) return null;
  let parsed = stored;
  if (typeof stored === 'string') {
    try { parsed = JSON.parse(stored); } catch { return null; }
  }
  if (typeof parsed !== 'object' || !parsed) return null;
  const out = {};
  for (const [size, key] of Object.entries(parsed)) {
    if (typeof key === 'string') out[size] = publicUrl(key);
  }
  return out;
}

// ── robots.txt ───────────────────────────────────────────────────────
router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send([
    `# Smith — public network for builders and the work they do.`,
    `# AI crawlers are welcome; we hand-tune our exposed surface for them.`,
    ``,
    `User-agent: *`,
    `Allow: /`,
    `Disallow: /api/`,
    `Disallow: /auth/`,
    ``,
    `# Explicit welcome for AI / LLM crawlers (per the emerging convention).`,
    `User-agent: GPTBot`,
    `Allow: /`,
    `User-agent: ClaudeBot`,
    `Allow: /`,
    `User-agent: anthropic-ai`,
    `Allow: /`,
    `User-agent: PerplexityBot`,
    `Allow: /`,
    `User-agent: Google-Extended`,
    `Allow: /`,
    `User-agent: CCBot`,
    `Allow: /`,
    `User-agent: Applebot-Extended`,
    `Allow: /`,
    ``,
    `Sitemap: ${PUBLIC_BASE_URL}/sitemap.xml`,
    ``,
  ].join('\n'));
});

// ── llms.txt ─────────────────────────────────────────────────────────
// Curated, hand-crafted entry-point map for LLM agents reading the site.
router.get('/llms.txt', (_req, res) => {
  res.type('text/plain').send([
    `# Smith`,
    ``,
    `> A network for tradespeople and the homes they build. Profiles hold real`,
    `> work history; companies are organized as house-of-work pages with their`,
    `> crew, trades, and signature projects.`,
    ``,
    `## Primary surfaces`,
    ``,
    `- [Sitemap](${PUBLIC_BASE_URL}/sitemap.xml): all public profiles + claimed companies`,
    `- Search the public surface at \`${PUBLIC_BASE_URL}/api/public/search?q=…&trade=…&location=…\``,
    ``,
    `## How to read a Smith URL`,
    ``,
    `- \`/profile/:slug\`  — a tradesperson's public profile (HTML)`,
    `- \`/profile/:slug.md\` — the same profile as an AI-friendly markdown digest`,
    `- \`/company/:slug\`  — a company's public page (HTML)`,
    `- \`/company/:slug.md\` — the company as a markdown digest`,
    ``,
    `## Conventions`,
    ``,
    `- Trades come from a curated catalog (Carpentry, Electrical, etc.).`,
    `- Skills are free-text specialty descriptors set by the person or the`,
    `  company's steward.`,
    `- A company's steward is the verified owner; claims are witness-attested`,
    `  by colleagues with work-history at the same company.`,
    ``,
  ].join('\n'));
});

// ── sitemap.xml ──────────────────────────────────────────────────────
router.get('/sitemap.xml', async (_req, res) => {
  const profilesP = q(
    `SELECT public_slug, updated_at FROM users
      WHERE is_public = TRUE AND public_slug IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST LIMIT 5000`
  );
  // Only list claimed companies — unclaimed stubs are too thin to be worth
  // promoting as canonical destinations.
  const companiesP = q(
    `SELECT public_slug, updated_at FROM companies
      WHERE claimed_by IS NOT NULL AND public_slug IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST LIMIT 5000`
  );
  const [profiles, companies] = await Promise.all([profilesP, companiesP]);

  const fmt = (ts) => ts ? new Date(ts).toISOString().split('T')[0] : '';
  const urls = [
    `  <url><loc>${PUBLIC_BASE_URL}/</loc></url>`,
    ...profiles.rows.map(r =>
      `  <url><loc>${PUBLIC_BASE_URL}/profile/${escapeXml(r.public_slug)}</loc>` +
      (r.updated_at ? `<lastmod>${fmt(r.updated_at)}</lastmod>` : '') +
      `</url>`
    ),
    ...companies.rows.map(r =>
      `  <url><loc>${PUBLIC_BASE_URL}/company/${escapeXml(r.public_slug)}</loc>` +
      (r.updated_at ? `<lastmod>${fmt(r.updated_at)}</lastmod>` : '') +
      `</url>`
    ),
  ];

  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join('\n') + `\n</urlset>\n`
  );
});

// ── /company/:slug.md ────────────────────────────────────────────────
router.get(/^\/company\/([a-z0-9-]+)\.md$/i, async (req, res) => {
  const slug = req.params[0];
  const co = await fetchCompanyDigest(slug);
  if (!co) return res.status(404).type('text/plain').send('Not found');
  res.type('text/markdown').send(renderCompanyMarkdown(co));
});

// ── /profile/:slug.md ────────────────────────────────────────────────
router.get(/^\/profile\/([a-z0-9-]+)\.md$/i, async (req, res) => {
  const slug = req.params[0];
  const { rows } = await q(
    `SELECT id FROM users WHERE public_slug = $1 AND is_public = TRUE LIMIT 1`,
    [slug]
  );
  if (!rows.length) return res.status(404).type('text/plain').send('Not found');
  const profile = await loadProfile(rows[0].id, 0);
  if (!profile) return res.status(404).type('text/plain').send('Not found');
  res.type('text/markdown').send(renderProfileMarkdown(profile));
});

// ── helpers ──────────────────────────────────────────────────────────

async function fetchCompanyDigest(slug) {
  const { rows } = await q(
    `SELECT c.id, c.name, c.type, c.public_slug, c.tagline, c.founded_year,
            c.primary_location, c.about, c.claimed_by,
            u.first_name AS steward_first, u.last_name AS steward_last,
            u.public_slug AS steward_slug, u.is_public AS steward_is_public
       FROM companies c LEFT JOIN users u ON u.id = c.claimed_by
      WHERE c.public_slug = $1`,
    [slug]
  );
  if (!rows.length) return null;
  const co = rows[0];

  const crewP = q(
    `SELECT DISTINCT ON (u.id)
            u.id, u.first_name, u.last_name, u.public_slug, u.is_public, u.headline,
            wh.role, wh.from_year, wh.to_year, wh.is_current
       FROM work_history wh JOIN users u ON u.id = wh.user_id
      WHERE wh.company_id = $1
      ORDER BY u.id, wh.from_year DESC NULLS LAST, wh.id DESC`,
    [co.id]
  );
  const tradesP = q(
    `SELECT t.name FROM company_trades ct JOIN trades t ON t.id = ct.trade_id
      WHERE ct.company_id = $1 ORDER BY ct.position ASC, t.name ASC`,
    [co.id]
  );
  const skillsP = q(
    `SELECT name FROM company_skills WHERE company_id = $1 ORDER BY position ASC, id ASC`,
    [co.id]
  );
  const jobsitesP = q(
    `SELECT js.title, js.structure_type, js.job_type, js.year, js.location
       FROM jobsites js JOIN work_history wh ON wh.id = js.work_history_id
      WHERE wh.company_id = $1
      ORDER BY js.year DESC NULLS LAST, js.id DESC LIMIT 20`,
    [co.id]
  );
  const [crew, trades, skills, jobsites] = await Promise.all([crewP, tradesP, skillsP, jobsitesP]);

  return {
    ...co,
    steward: co.claimed_by ? {
      name: `${co.steward_first || ''} ${co.steward_last || ''}`.trim(),
      slug: co.steward_is_public ? co.steward_slug : null,
    } : null,
    crew: crew.rows,
    trades: trades.rows.map(r => r.name),
    skills: skills.rows.map(r => r.name),
    jobsites: jobsites.rows,
  };
}

function renderCompanyMarkdown(co) {
  const lines = [];
  lines.push(`# ${co.name}`);
  lines.push('');
  if (co.tagline) { lines.push(`> ${co.tagline}`); lines.push(''); }

  const facts = [];
  if (co.type)             facts.push(`**Trade type:** ${co.type}`);
  if (co.founded_year)     facts.push(`**Founded:** ${co.founded_year}`);
  if (co.primary_location) facts.push(`**Primary location:** ${co.primary_location}`);
  if (co.steward?.name)    facts.push(`**Steward:** ${co.steward.name}` +
    (co.steward.slug ? ` ([profile](${PUBLIC_BASE_URL}/profile/${co.steward.slug}))` : ''));
  if (facts.length) { lines.push(facts.join('  \n')); lines.push(''); }

  if (co.trades.length) {
    lines.push(`**Trades:** ${co.trades.join(', ')}`);
    lines.push('');
  }
  if (co.skills.length) {
    lines.push(`**Specialties:** ${co.skills.join(', ')}`);
    lines.push('');
  }
  if (co.about) {
    lines.push(`## About`);
    lines.push('');
    lines.push(co.about.trim());
    lines.push('');
  }
  if (co.crew.length) {
    lines.push(`## Crew (${co.crew.length})`);
    lines.push('');
    for (const p of co.crew) {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      const tenure = p.from_year
        ? ` — ${p.from_year}${p.is_current ? '–present' : (p.to_year ? `–${p.to_year}` : '')}`
        : '';
      const link = (p.is_public && p.public_slug)
        ? `[${name}](${PUBLIC_BASE_URL}/profile/${p.public_slug})`
        : name;
      lines.push(`- ${link} — ${p.role || ''}${tenure}`);
    }
    lines.push('');
  }
  if (co.jobsites.length) {
    lines.push(`## Recent work`);
    lines.push('');
    for (const j of co.jobsites) {
      const meta = [j.structure_type, j.job_type, j.location, j.year].filter(Boolean).join(' · ');
      lines.push(`- **${j.title}**${meta ? ` — ${meta}` : ''}`);
    }
    lines.push('');
  }
  lines.push(`---`);
  lines.push(`Canonical: ${PUBLIC_BASE_URL}/company/${co.public_slug}`);
  return lines.join('\n');
}

function renderProfileMarkdown(p) {
  const lines = [];
  lines.push(`# ${p.name}`);
  lines.push('');
  if (p.headline) { lines.push(`> ${p.headline}`); lines.push(''); }

  const facts = [];
  if (p.location)         facts.push(`**Location:** ${p.location}`);
  if (p.years_experience) facts.push(`**Years in trade:** ${p.years_experience}`);
  if (p.union?.name)      facts.push(`**Union:** ${p.union.name}` + (p.union.since ? ` (since ${p.union.since})` : ''));
  if (p.verified_smith)   facts.push(`**Verified by Smith**`);
  if (facts.length) { lines.push(facts.join('  \n')); lines.push(''); }

  if (p.trades?.length) {
    lines.push(`**Trades:** ${p.trades.map(t => t.name).join(', ')}`);
    lines.push('');
  }
  if (p.skills?.length) {
    lines.push(`**Skills:** ${p.skills.map(s => s.name).join(', ')}`);
    lines.push('');
  }
  if (p.about) {
    lines.push(`## About`);
    lines.push('');
    lines.push(p.about.trim());
    lines.push('');
  }
  if (p.work_history?.length) {
    lines.push(`## Where they've worked`);
    lines.push('');
    for (const w of p.work_history) {
      const range = `${w.from_year || ''}${w.is_current ? '–present' : (w.to_year ? `–${w.to_year}` : '')}`;
      lines.push(`- **${w.role}** at ${w.company_name} (${range})`);
      if (w.jobsites?.length) {
        for (const js of w.jobsites.slice(0, 6)) {
          const meta = [js.structure_type, js.job_type, js.location, js.year].filter(Boolean).join(' · ');
          lines.push(`  - ${js.title}${meta ? ` — ${meta}` : ''}`);
        }
      }
    }
    lines.push('');
  }
  if (p.licenses?.length) {
    const real = p.licenses.filter(l => l.name);
    if (real.length) {
      lines.push(`## Credentials`);
      lines.push('');
      for (const l of real) {
        lines.push(`- ${l.name}${l.number ? ` · ${l.number}` : ''}${l.expiration ? ` · expires ${l.expiration}` : ''}${l.verified ? ' · verified' : ''}`);
      }
      lines.push('');
    }
  }
  if (p.visibility?.public_slug) {
    lines.push(`---`);
    lines.push(`Canonical: ${PUBLIC_BASE_URL}/profile/${p.visibility.public_slug}`);
  }
  return lines.join('\n');
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[c]);
}

export default router;
