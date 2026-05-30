// Smith — JobSource driver registry
//
// Mirror of storage.js: each driver exports an object with a name and a
// fetchPage(config, cursor) method. The ingester (ingest-jobs.js) is dumb
// and uniform across drivers — it doesn't know what an Adzuna page is, or
// what cursor shape any given driver uses. Drivers own that.
//
// Interface:
//   driver.name                                    // string, must match job_sources.driver
//   driver.fetchPage(config, cursor)              // → { items: NormalizedJob[], nextCursor: any | null }
//
// NormalizedJob shape matches the `jobs` table columns 1:1 (minus
// auto-generated id/ingested_at/source_id, which the ingester sets). See
// adzuna.js → normalize() for the canonical shape; new drivers must
// return the same fields.
//
// Adding a new driver:
//   1. Create server/src/jobs/sources/<driver>.js exporting <driver>Driver
//   2. Register it in DRIVERS below
//   3. INSERT a row into job_sources with the matching `driver` string

import { adzunaDriver } from './adzuna.js';

const DRIVERS = {
  adzuna: adzunaDriver,
  // user_post: userPostDriver,   // phase 5 — user-submitted job postings
  // jooble:    joobleDriver,     // later — second aggregator
};

export function getDriver(name) {
  const d = DRIVERS[name];
  if (!d) {
    const err = new Error(`Unknown job source driver: ${name}`);
    err.code = 'UNKNOWN_DRIVER';
    throw err;
  }
  return d;
}

export function listDrivers() {
  return Object.keys(DRIVERS);
}
