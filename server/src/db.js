// Smith — Postgres pool
import 'dotenv/config';
import pg from 'pg';

const { Pool, types } = pg;

// pg returns BIGINT as a string by default to avoid precision loss. Our IDs
// will never approach 2^53, so cast to Number — keeps the API JSON cleaner
// and means JSON.parse'd id === Number id everywhere downstream.
types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Copy .env.example → .env and set it.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Reasonable defaults for dev
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[pg] idle client error:', err);
});

/**
 * Run a parameterized query.
 * Always prefer this over pool.query so we have a single chokepoint.
 */
export const q = (text, params) => pool.query(text, params);

/**
 * Run a function inside a transaction. Rolls back on throw.
 *   await tx(async (client) => { await client.query(...); });
 */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
