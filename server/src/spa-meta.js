// Smith — Per-route meta-tag + JSON-LD injection for the SPA fallback.
//
// The React app boots from a single index.html. AI crawlers (and many SEO
// tools) don't run JavaScript, so anything we want them to see has to be in
// the HTML they receive. This module intercepts a handful of public-facing
// routes BEFORE the bare SPA fallback, fetches just enough data, and splices
// per-route <title>, meta tags, and JSON-LD into <head>.
//
// Falls through to the bare template if the entity doesn't exist.

import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { q } from './db.js';
import { publicUrl } from './storage.js';

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://smithpro.io').replace(/\/$/, '');
const SITE_NAME = 'Smith';

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

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function truncate(s, n) {
  const x = String(s || '').trim().replace(/\s+/g, ' ');
  return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x;
}

export function createSpaMeta(clientDist) {
  const router = Router();

  // Read the template ONCE at boot. Splice meta tags before </head>.
  const tplPath = path.join(clientDist, 'index.html');
  let tpl = '';
  try { tpl = fs.readFileSync(tplPath, 'utf-8'); } catch {
    console.warn('[spa-meta] no index.html at', tplPath, '— meta injection disabled');
    return router;
  }
  const splitAt = tpl.indexOf('</head>');
  const beforeHead = splitAt >= 0 ? tpl.slice(0, splitAt) : tpl;
  const afterHead  = splitAt >= 0 ? tpl.slice(splitAt)   : '';

  function sendWithMeta(res, metaHtml) {
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(beforeHead + '\n' + metaHtml + '\n' + afterHead);
  }
  function sendBare(res) {
    res.sendFile(tplPath);
  }

  // ── /company/:idOrSlug ─────────────────────────────────────────────
  router.get('/company/:idOrSlug', async (req, res) => {
    try {
      const meta = await buildCompanyMeta(req.params.idOrSlug);
      if (!meta) return sendBare(res);
      sendWithMeta(res, meta);
    } catch (e) {
      console.error('[spa-meta] company meta failed:', e);
      sendBare(res);
    }
  });

  // ── /profile/:slug ─────────────────────────────────────────────────
  router.get('/profile/:slug', async (req, res) => {
    try {
      const meta = await buildProfileMeta(req.params.slug);
      if (!meta) return sendBare(res);
      sendWithMeta(res, meta);
    } catch (e) {
      console.error('[spa-meta] profile meta failed:', e);
      sendBare(res);
    }
  });

  return router;
}

// ── Builders ─────────────────────────────────────────────────────────

async function buildCompanyMeta(idOrSlug) {
  let row;
  if (/^\d+$/.test(String(idOrSlug))) {
    const r = await q(`SELECT * FROM companies WHERE id = $1`, [parseInt(idOrSlug, 10)]);
    row = r.rows[0];
  } else {
    const r = await q(`SELECT * FROM companies WHERE public_slug = $1`, [String(idOrSlug)]);
    row = r.rows[0];
  }
  if (!row) return null;

  const tradesP = q(
    `SELECT t.name FROM company_trades ct JOIN trades t ON t.id = ct.trade_id
      WHERE ct.company_id = $1 ORDER BY ct.position ASC LIMIT 8`,
    [row.id]
  );
  const skillsP = q(
    `SELECT name FROM company_skills WHERE company_id = $1 ORDER BY position ASC LIMIT 12`,
    [row.id]
  );
  const crewP = q(
    `SELECT DISTINCT ON (u.id) u.first_name, u.last_name, u.public_slug, u.is_public
       FROM work_history wh JOIN users u ON u.id = wh.user_id
      WHERE wh.company_id = $1
      ORDER BY u.id, wh.from_year DESC NULLS LAST LIMIT 25`,
    [row.id]
  );
  const stewardP = row.claimed_by
    ? q(`SELECT first_name, last_name, public_slug, is_public FROM users WHERE id = $1`, [row.claimed_by])
    : Promise.resolve({ rows: [] });

  const [trades, skills, crew, steward] = await Promise.all([tradesP, skillsP, crewP, stewardP]);

  const tradeNames = trades.rows.map(r => r.name);
  const skillNames = skills.rows.map(r => r.name);
  const logoUrls = parseUrls(row.logo_url);
  const coverUrls = parseUrls(row.cover_url);
  const image = coverUrls?.medium || coverUrls?.full || logoUrls?.full || logoUrls?.medium || null;

  const slug = row.public_slug || row.id;
  const canonical = `${PUBLIC_BASE_URL}/company/${slug}`;
  const title = `${row.name}${row.type ? ` — ${row.type}` : ''} · ${SITE_NAME}`;
  const desc = truncate(
    row.tagline ||
    [
      row.type,
      tradeNames.length ? `trades: ${tradeNames.slice(0, 3).join(', ')}` : null,
      row.primary_location,
      row.founded_year ? `since ${row.founded_year}` : null,
    ].filter(Boolean).join(' · '),
    220
  );

  // JSON-LD: HomeAndConstructionBusiness is the most specific Schema.org type
  // for the trades; falls back to Organization semantically when it doesn't
  // fit. Crawlers tolerate the specific subtype either way.
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name: row.name,
    url: canonical,
    description: desc || undefined,
    foundingDate: row.founded_year ? String(row.founded_year) : undefined,
    address: row.primary_location ? {
      '@type': 'PostalAddress',
      addressLocality: row.primary_location,
    } : undefined,
    logo: logoUrls?.full || logoUrls?.medium || undefined,
    image: image || undefined,
    knowsAbout: [...tradeNames, ...skillNames].length ? [...tradeNames, ...skillNames] : undefined,
    employee: crew.rows
      .filter(c => c.is_public && c.public_slug)
      .map(c => ({
        '@type': 'Person',
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        url: `${PUBLIC_BASE_URL}/profile/${c.public_slug}`,
      })),
    founder: steward.rows[0] && steward.rows[0].is_public && steward.rows[0].public_slug ? {
      '@type': 'Person',
      name: `${steward.rows[0].first_name || ''} ${steward.rows[0].last_name || ''}`.trim(),
      url: `${PUBLIC_BASE_URL}/profile/${steward.rows[0].public_slug}`,
    } : undefined,
  };

  return renderMeta({
    title, desc, canonical, image, ogType: 'profile', siteName: SITE_NAME, ld,
    alternateMd: `${PUBLIC_BASE_URL}/company/${slug}.md`,
  });
}

async function buildProfileMeta(slug) {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;
  const r = await q(
    `SELECT u.id, u.first_name, u.last_name, u.headline, u.location, u.about,
            u.avatar_url, u.cover_url, u.public_slug, u.is_public, u.verified_smith,
            u.updated_at
       FROM users u WHERE u.public_slug = $1 AND u.is_public = TRUE LIMIT 1`,
    [slug]
  );
  if (!r.rows.length) return null;
  const u = r.rows[0];

  const tradesP = q(
    `SELECT t.name FROM user_trades ut JOIN trades t ON t.id = ut.trade_id
      WHERE ut.user_id = $1 ORDER BY ut.position ASC LIMIT 8`,
    [u.id]
  );
  const skillsP = q(
    `SELECT name FROM skills WHERE user_id = $1 ORDER BY position ASC LIMIT 12`,
    [u.id]
  );
  const workP = q(
    `SELECT c.id AS company_id, c.name AS company_name, c.public_slug AS company_slug,
            wh.role
       FROM work_history wh JOIN companies c ON c.id = wh.company_id
      WHERE wh.user_id = $1
      ORDER BY wh.from_year DESC NULLS LAST, wh.id DESC LIMIT 10`,
    [u.id]
  );
  const [trades, skills, work] = await Promise.all([tradesP, skillsP, workP]);

  const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  const avatarUrls = parseUrls(u.avatar_url);
  const coverUrls = parseUrls(u.cover_url);
  const image = coverUrls?.medium || coverUrls?.full || avatarUrls?.full || avatarUrls?.medium || null;
  const canonical = `${PUBLIC_BASE_URL}/profile/${u.public_slug}`;
  const tradeNames = trades.rows.map(r => r.name);
  const skillNames = skills.rows.map(r => r.name);

  const title = `${fullName}${u.headline ? ` — ${u.headline}` : ''} · ${SITE_NAME}`;
  const desc = truncate(
    u.headline ||
    [
      tradeNames.length ? tradeNames.slice(0, 3).join(', ') : null,
      u.location,
    ].filter(Boolean).join(' · '),
    220
  );

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: fullName,
    url: canonical,
    description: desc || undefined,
    jobTitle: u.headline || undefined,
    address: u.location ? {
      '@type': 'PostalAddress',
      addressLocality: u.location,
    } : undefined,
    image: image || undefined,
    knowsAbout: [...tradeNames, ...skillNames].length ? [...tradeNames, ...skillNames] : undefined,
    worksFor: work.rows.map(w => ({
      '@type': 'Organization',
      name: w.company_name,
      url: w.company_slug ? `${PUBLIC_BASE_URL}/company/${w.company_slug}` : undefined,
    })),
  };

  return renderMeta({
    title, desc, canonical, image, ogType: 'profile', siteName: SITE_NAME, ld,
    alternateMd: `${PUBLIC_BASE_URL}/profile/${u.public_slug}.md`,
  });
}

function renderMeta({ title, desc, canonical, image, ogType, siteName, ld, alternateMd }) {
  const tags = [];
  tags.push(`    <title>${escHtml(title)}</title>`);
  if (desc) {
    tags.push(`    <meta name="description" content="${escHtml(desc)}">`);
  }
  tags.push(`    <link rel="canonical" href="${escHtml(canonical)}">`);
  if (alternateMd) {
    tags.push(`    <link rel="alternate" type="text/markdown" href="${escHtml(alternateMd)}">`);
  }
  tags.push(`    <meta property="og:type" content="${escHtml(ogType || 'website')}">`);
  tags.push(`    <meta property="og:site_name" content="${escHtml(siteName || 'Smith')}">`);
  tags.push(`    <meta property="og:title" content="${escHtml(title)}">`);
  if (desc) tags.push(`    <meta property="og:description" content="${escHtml(desc)}">`);
  tags.push(`    <meta property="og:url" content="${escHtml(canonical)}">`);
  if (image) {
    tags.push(`    <meta property="og:image" content="${escHtml(image)}">`);
    tags.push(`    <meta name="twitter:card" content="summary_large_image">`);
    tags.push(`    <meta name="twitter:image" content="${escHtml(image)}">`);
  } else {
    tags.push(`    <meta name="twitter:card" content="summary">`);
  }
  tags.push(`    <meta name="twitter:title" content="${escHtml(title)}">`);
  if (desc) tags.push(`    <meta name="twitter:description" content="${escHtml(desc)}">`);

  if (ld) {
    const cleaned = JSON.parse(JSON.stringify(ld, (_, v) => v === undefined ? undefined : v));
    tags.push(`    <script type="application/ld+json">${JSON.stringify(cleaned)}</script>`);
  }
  return tags.join('\n');
}
