// Smith — Job ingester
//
// Mirror of ingest-news.js, one layer wider. Walks every enabled row in
// job_sources, asks each row's driver for pages of NormalizedJob items,
// upserts each item into `jobs` (dedup on UNIQUE (source_driver,
// source_job_id)), and records last_status / last_count on the source.
//
// Run from CLI:    npm run ingest-jobs
// Run from admin:  POST /api/admin/jobs/ingest

import 'dotenv/config';
import { pool, q } from './db.js';
import { getDriver } from './jobs/sources/index.js';

// Max pages drained per source per cycle. Driver-level max_pages can lower
// this further (Adzuna defaults to 3). Hard global cap keeps a misconfigured
// source from spinning all night.
const HARD_PAGE_CAP = 20;

async function upsertJob(item, sourceId) {
  // ON CONFLICT (source_driver, source_job_id) updates the row in place so
  // edits at the source (salary changes, location fixes) propagate. We
  // touch ingested_at on every refresh so the source-health view can say
  // "last seen N hours ago."
  const r = await q(
    `INSERT INTO jobs (
       source_id, source_driver, source_job_id,
       title, company, description, location, lat, lng,
       salary_min, salary_max, salary_currency, salary_period, salary_is_predicted,
       url, contact_email, contact_phone,
       trade_tags, skill_tags, structure_type, job_type,
       is_prevailing_wage, is_direct_post, posted_by_user_id,
       posted_at, ingested_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,
       $10,$11,$12,$13,$14,
       $15,$16,$17,
       $18,$19,$20,$21,
       $22,$23,$24,
       $25, NOW()
     )
     ON CONFLICT (source_driver, source_job_id) DO UPDATE SET
       title               = EXCLUDED.title,
       company             = EXCLUDED.company,
       description         = EXCLUDED.description,
       location            = EXCLUDED.location,
       lat                 = EXCLUDED.lat,
       lng                 = EXCLUDED.lng,
       salary_min          = EXCLUDED.salary_min,
       salary_max          = EXCLUDED.salary_max,
       salary_currency     = EXCLUDED.salary_currency,
       salary_period       = EXCLUDED.salary_period,
       salary_is_predicted = EXCLUDED.salary_is_predicted,
       url                 = EXCLUDED.url,
       trade_tags          = EXCLUDED.trade_tags,
       skill_tags          = EXCLUDED.skill_tags,
       is_prevailing_wage  = EXCLUDED.is_prevailing_wage,
       posted_at           = EXCLUDED.posted_at,
       ingested_at         = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [
      sourceId,
      item.source_driver,
      item.source_job_id,
      item.title,
      item.company,
      item.description,
      item.location,
      item.lat,
      item.lng,
      item.salary_min,
      item.salary_max,
      item.salary_currency,
      item.salary_period,
      !!item.salary_is_predicted,
      item.url,
      item.contact_email,
      item.contact_phone,
      item.trade_tags || [],
      item.skill_tags || [],
      item.structure_type,
      item.job_type,
      !!item.is_prevailing_wage,
      !!item.is_direct_post,
      item.posted_by_user_id,
      item.posted_at,
    ]
  );
  // `xmax = 0` on the returning row means it was a fresh INSERT (no prior
  // tuple); otherwise it was an UPDATE. Standard Postgres trick.
  return r.rows[0]?.inserted === true;
}

async function ingestOne(source) {
  let inserted = 0, updated = 0, error = null;
  try {
    const driver = getDriver(source.driver);
    let cursor = null;
    for (let page = 0; page < HARD_PAGE_CAP; page++) {
      const { items, nextCursor } = await driver.fetchPage(source.config || {}, cursor);
      for (const item of items) {
        // Defensive: skip items the driver returned without the dedup key.
        if (!item || !item.source_driver || !item.source_job_id || !item.title) continue;
        try {
          const wasInsert = await upsertJob(item, source.id);
          if (wasInsert) inserted++; else updated++;
        } catch (e) {
          // One bad row doesn't tank the whole cycle.
          console.error(`[ingest-jobs] upsert failed for ${item.source_driver}:${item.source_job_id}`, e.message);
        }
      }
      cursor = nextCursor;
      if (!cursor) break;
    }
  } catch (e) {
    // Missing creds and HTTP errors land here. Recorded to last_status so
    // the admin UI can surface "Adzuna creds missing" without log diving.
    error = e.message || String(e);
  }

  await q(
    `UPDATE job_sources
        SET last_ingested_at = NOW(),
            last_status      = $2,
            last_count       = $3
      WHERE id = $1`,
    [source.id, error || 'ok', inserted]
  );

  return { source: source.name, inserted, updated, error };
}

export async function ingestAllJobs({ onlyEnabled = true } = {}) {
  const { rows: sources } = await q(
    `SELECT id, driver, name, config, enabled
       FROM job_sources
      ${onlyEnabled ? `WHERE enabled = TRUE` : ''}
      ORDER BY id`
  );
  const summary = [];
  for (const s of sources) {
    const r = await ingestOne(s);
    summary.push(r);
    console.log(
      r.error
        ? `[ingest-jobs] ✗ ${r.source} — ${r.error}`
        : `[ingest-jobs] ✓ ${r.source} — ${r.inserted} new, ${r.updated} updated`
    );
  }
  return summary;
}

// CLI: `npm run ingest-jobs`
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestAllJobs()
    .then(() => pool.end())
    .catch((err) => { console.error('[ingest-jobs] failed:', err); pool.end(); process.exit(1); });
}
