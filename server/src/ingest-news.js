// Smith — RSS news ingester
//
// Walks every enabled row in news_feeds, fetches it, parses, normalizes
// each item into a news_articles row. Dedupes on source_url (canonical UNIQUE
// in the schema). Records last_status / last_count back to news_feeds so the
// admin UI can show which feeds are healthy.
//
// Run from CLI:    npm run ingest
// Run from admin:  POST /api/admin/news/ingest

import 'dotenv/config';
import { pool, q } from './db.js';

// ── Tag dictionary ────────────────────────────────────────────────────────
// Keyword → canonical tag. We scan title + summary; the first match per key
// wins. Order matters: more specific terms first.
//
// EDIT THIS to refine tagging. New keywords on the left, the tag they imply
// on the right. Keep keys lowercase; we match case-insensitively.
const TAG_KEYWORDS = {
  // Trades
  'carpenter': 'Carpentry',     'carpentry': 'Carpentry',     'framing': 'Carpentry',
  'electrician': 'Electrical',  'electrical': 'Electrical',   'wiring': 'Electrical',
  'plumber': 'Plumbing',        'plumbing': 'Plumbing',
  'mason': 'Concrete & Masonry','concrete': 'Concrete & Masonry', 'masonry': 'Concrete & Masonry',
  'roofer': 'Roofing',          'roofing': 'Roofing',         'shingle': 'Roofing',
  'hvac': 'HVAC',               'mechanical contractor': 'HVAC',
  'painter': 'Painting & Finishing', 'painting': 'Painting & Finishing',
  'tile': 'Tile & Flooring',    'flooring': 'Tile & Flooring',
  'stonemason': 'Stonemasonry', 'stone mason': 'Stonemasonry',

  // Themes
  'wage':  'Wages',             'salary': 'Wages',            'pay':   'Wages',
  'hiring': 'Hiring',           'recruit': 'Hiring',          'workforce shortage': 'Hiring',
  'apprentice': 'Apprenticeship',
  'union':  'Labor',
  'osha':   'Safety',           'fall protection': 'Safety',  'injury': 'Safety',
  'permit': 'Permitting',
  'code':   'Codes',            'ibc':   'Codes',             'building code': 'Codes',
  'sustainab': 'Sustainability','green building': 'Sustainability', 'leed': 'Sustainability',
  'ai ':    'AI',               'artificial intelligence': 'AI', 'machine learning': 'AI',
  'robot':  'Robotics',         'automation': 'Robotics',
  'bim':    'BIM',
  'tariff': 'Tariffs',
  'lumber': 'Materials',        'steel prices': 'Materials',
  'license': 'Licensing',
  'energy': 'Energy',           'solar': 'Energy',            'heat pump': 'Energy',
};

// Curated image placeholder per category. Picked to evoke the topic.
const CATEGORY_IMAGE = {
  'The Trade': 'frame',
  'Career':    'crew',
  'Materials': 'wood',
  'Labor':     'crew',
  'Safety':    'workshop',
  'Codes':     'blueprint',
  'Tech & AI': 'blueprint',
};

// ── Tiny RSS parser ───────────────────────────────────────────────────────
// We accept RSS 2.0 and Atom 1.0. No DTDs, no namespaces beyond what we look
// up. Returns an array of {title, link, pubDate, summary, author} objects.
//
// Why no dep: rss-parser is ~80kb installed and pulls in xml2js. We need
// exactly five fields. A 50-line regex parser is fine here and the failure
// modes are easy to reason about.
function parseFeed(xml) {
  const items = [];
  // First detect Atom vs RSS by looking for <entry> or <item>.
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const itemTag = isAtom ? 'entry' : 'item';
  const itemRe = new RegExp(`<${itemTag}\\b[\\s\\S]*?<\\/${itemTag}>`, 'gi');
  for (const block of xml.match(itemRe) || []) {
    items.push({
      title:   pluck(block, 'title'),
      link:    isAtom ? atomLink(block) : pluck(block, 'link'),
      pubDate: pluck(block, 'pubDate') || pluck(block, 'published') || pluck(block, 'updated'),
      summary: stripTags(pluck(block, 'description') || pluck(block, 'summary') || pluck(block, 'content')),
      author:  pluck(block, 'author') || pluck(block, 'dc:creator'),
    });
  }
  return items;
}
function pluck(block, tag) {
  // Match <tag>…</tag> with optional attributes. Handles <![CDATA[]]> too.
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return null;
  return decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
}
function atomLink(block) {
  // Atom uses <link href="..." />. Pick rel="alternate" or first.
  const m = block.match(/<link\b([^>]*)\/>/i) || block.match(/<link\b([^>]*)>/i);
  if (!m) return null;
  const href = m[1].match(/href="([^"]+)"/i);
  return href ? href[1] : null;
}
function stripTags(s) {
  if (!s) return null;
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600) || null;
}
function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// ── Tag inference ─────────────────────────────────────────────────────────
function inferTags(article, defaultTags = []) {
  const hay = `${article.title || ''} ${article.summary || ''}`.toLowerCase();
  const out = new Set(defaultTags);
  for (const [needle, tag] of Object.entries(TAG_KEYWORDS)) {
    if (hay.includes(needle)) out.add(tag);
  }
  // Cap at 6 tags to keep cards visually clean.
  return [...out].slice(0, 6);
}

// Read-minutes estimate from summary length. Adequate proxy without the full
// body — ~5 words/second average reading, summary is ~5% of full article.
function estimateReadMinutes(summary) {
  if (!summary) return 3;
  const words = summary.split(/\s+/).length;
  const guessed = Math.round((words * 20) / 200); // 20× expansion, 200 wpm
  return Math.max(2, Math.min(15, guessed));
}

// ── Ingest one feed ───────────────────────────────────────────────────────
async function ingestOne(feed) {
  let inserted = 0, skipped = 0, error = null;
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'SmithBot/0.1 (+https://smith.test)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseFeed(xml);

    for (const it of items) {
      if (!it.title || !it.link) { skipped++; continue; }
      const published = it.pubDate ? new Date(it.pubDate) : new Date();
      if (isNaN(published)) { skipped++; continue; }
      const tags = inferTags(it, feed.default_tags || []);
      const readMinutes = estimateReadMinutes(it.summary);
      const imageKind = CATEGORY_IMAGE[feed.category] || 'frame';

      const r = await q(
        `INSERT INTO news_articles
           (title, summary, source, source_url, author, published_at,
            read_minutes, image_kind, category, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (source_url) DO NOTHING
           RETURNING id`,
        [
          it.title.slice(0, 500),
          it.summary,
          feed.name,
          it.link,
          it.author,
          published,
          readMinutes,
          imageKind,
          feed.category,
          tags,
        ]
      );
      if (r.rowCount) inserted++; else skipped++;
    }
  } catch (e) {
    error = e.message || String(e);
  }

  await q(
    `UPDATE news_feeds
        SET last_ingested_at = NOW(),
            last_status      = $2,
            last_count       = $3
      WHERE id = $1`,
    [feed.id, error || 'ok', inserted]
  );

  return { feed: feed.name, inserted, skipped, error };
}

// ── Public entrypoint ─────────────────────────────────────────────────────
export async function ingestAll({ onlyEnabled = true } = {}) {
  const { rows: feeds } = await q(
    `SELECT id, name, url, category, default_tags, enabled
       FROM news_feeds
      ${onlyEnabled ? `WHERE enabled = TRUE` : ''}
      ORDER BY id`
  );
  const summary = [];
  for (const f of feeds) {
    const r = await ingestOne(f);
    summary.push(r);
    console.log(
      r.error
        ? `[ingest] ✗ ${r.feed} — ${r.error}`
        : `[ingest] ✓ ${r.feed} — ${r.inserted} new, ${r.skipped} skipped`
    );
  }
  return summary;
}

// CLI: `npm run ingest`
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestAll()
    .then(() => pool.end())
    .catch((err) => { console.error('[ingest] failed:', err); pool.end(); process.exit(1); });
}
