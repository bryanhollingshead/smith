// Smith — Migration runner
// Applies every .sql file in ./migrations in lexical order, idempotently
// (tracks applied files in a `_migrations` table). Pass --drop to wipe first.

import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsDir = join(__dirname, '..', 'migrations');

const drop = process.argv.includes('--drop');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function dropEverything(client) {
  console.log('[migrate] --drop: dropping public schema');
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

async function main() {
  const client = await pool.connect();
  try {
    if (drop) await dropEverything(client);
    await ensureMigrationsTable(client);

    const applied = new Set(
      (await client.query('SELECT filename FROM _migrations')).rows.map(r => r.filename)
    );

    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      console.log(`[migrate] applying ${file}`);
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      ran++;
    }
    console.log(ran === 0 ? '[migrate] nothing to do' : `[migrate] applied ${ran} file(s)`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
