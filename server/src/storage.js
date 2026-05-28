// Smith — Storage layer
//
// Driver-pattern abstraction over file storage. Two drivers ship:
//
//   local — writes to ./uploads/ on the server's disk. Suitable for dev.
//   r2    — writes to Cloudflare R2 (or any S3-compatible bucket).
//
// The driver is selected by STORAGE_DRIVER env var (defaults to 'local').
//
// Everywhere else in the codebase, we use these four functions:
//
//   uploadBuffer(key, buf, contentType)   → stores bytes under `key`
//   downloadStream(key)                   → returns a Readable + {contentType, contentLength}
//   deleteObject(key)                     → best-effort delete
//   publicUrl(key)                        → returns a string the client can GET
//
// Keys are app-namespaced — e.g. "users/42/avatar-thumb.webp" — and never
// contain leading slashes. The driver handles the rest.
//
// publicUrl behavior differs by driver:
//   local → /api/files/<key> (served by routes/files.js)
//   r2    → either a public R2 dev URL OR a signed URL, depending on the
//           bucket's access policy. We default to public if R2_PUBLIC_BASE
//           is set (set this to your R2 public dev URL or custom domain),
//           else we sign URLs on each read (slower but private).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Driver selection ────────────────────────────────────────────────────
const DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

// ── Local driver ────────────────────────────────────────────────────────
// Writes to ./uploads/<key>. Reads stream from disk. publicUrl returns
// "/api/files/<key>" — see routes/files.js for the serving endpoint.

const LOCAL_ROOT = path.resolve(__dirname, '..', 'uploads');

function localKeyPath(key) {
  // Defense in depth — refuse to traverse out of LOCAL_ROOT.
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep) && resolved !== LOCAL_ROOT) {
    throw new Error(`Path traversal attempted: ${key}`);
  }
  return resolved;
}

const localDriver = {
  async uploadBuffer(key, buf, contentType) {
    const filepath = localKeyPath(key);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, buf);
    // Sidecar metadata file so downloadStream can recover content-type.
    fs.writeFileSync(filepath + '.meta', JSON.stringify({ contentType, contentLength: buf.length }));
    return { key };
  },

  async downloadStream(key) {
    const filepath = localKeyPath(key);
    if (!fs.existsSync(filepath)) throw new Error('Not found');
    let meta = { contentType: 'application/octet-stream', contentLength: undefined };
    try {
      meta = JSON.parse(fs.readFileSync(filepath + '.meta', 'utf8'));
    } catch { /* missing sidecar; use defaults */ }
    return { stream: fs.createReadStream(filepath), ...meta };
  },

  async deleteObject(key) {
    const filepath = localKeyPath(key);
    try { fs.unlinkSync(filepath); } catch { /* best effort */ }
    try { fs.unlinkSync(filepath + '.meta'); } catch { /* best effort */ }
  },

  publicUrl(key) {
    // Encode each path segment so spaces/special chars don't break the URL,
    // but keep the slashes structural.
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    return `/api/files/${encoded}`;
  },
};

// ── R2 driver ───────────────────────────────────────────────────────────
// Uses the AWS SDK v3 with S3-compatible config. R2 speaks S3, so we just
// point the SDK at the R2 endpoint.

let r2Client = null;
let r2Bucket = null;
let r2PublicBase = null;

async function initR2() {
  if (r2Client) return;
  const { S3Client } = await import('@aws-sdk/client-s3');
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`R2 driver selected but env vars missing: ${missing.join(', ')}`);
  }
  r2Client = new S3Client({
    region: 'auto', // R2 doesn't care; pass anything
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  r2Bucket = process.env.R2_BUCKET;
  r2PublicBase = process.env.R2_PUBLIC_BASE || null; // optional public-read URL
}

const r2Driver = {
  async uploadBuffer(key, buf, contentType) {
    await initR2();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await r2Client.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }));
    return { key };
  },

  async downloadStream(key) {
    await initR2();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const res = await r2Client.send(new GetObjectCommand({
      Bucket: r2Bucket,
      Key: key,
    }));
    return {
      stream: res.Body, // a Readable
      contentType: res.ContentType || 'application/octet-stream',
      contentLength: res.ContentLength,
    };
  },

  async deleteObject(key) {
    await initR2();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    try {
      await r2Client.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: key }));
    } catch { /* best effort — don't crash if the object is already gone */ }
  },

  publicUrl(key) {
    // Prefer a public-base URL if configured (R2 dev bucket or custom domain).
    // Otherwise route reads through our server, which will sign or stream from R2.
    if (r2PublicBase || process.env.R2_PUBLIC_BASE) {
      const base = (r2PublicBase || process.env.R2_PUBLIC_BASE).replace(/\/$/, '');
      const encoded = key.split('/').map(encodeURIComponent).join('/');
      return `${base}/${encoded}`;
    }
    // Fallback: route reads through our own server. routes/files.js handles
    // proxying R2 → response in this mode.
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    return `/api/files/${encoded}`;
  },
};

// ── Public API ──────────────────────────────────────────────────────────
const driver = DRIVER === 'r2' ? r2Driver : localDriver;

export async function uploadBuffer(key, buf, contentType) {
  if (!key || typeof key !== 'string') throw new Error('key required');
  if (!buf || !Buffer.isBuffer(buf)) throw new Error('Buffer required');
  return driver.uploadBuffer(key, buf, contentType || 'application/octet-stream');
}

export async function downloadStream(key) {
  return driver.downloadStream(key);
}

export async function deleteObject(key) {
  return driver.deleteObject(key);
}

export function publicUrl(key) {
  return driver.publicUrl(key);
}

// Canonical converter for the stored avatar_url / cover_url / photo_url shape:
// a JSON map of storage KEYS like { thumb, medium, full } (possibly a JSON
// string, possibly NULL). Returns the same shape with each key resolved to a
// client-usable URL via publicUrl, or null. Use this everywhere instead of
// hand-rolling a parser per route (a stale per-file copy is exactly what made
// connection-card avatars 404 once).
export function keysToUrls(stored) {
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

// Helper used by callers that store JSON shape like { thumb, medium, full }.
// Iterates and deletes every variant. Tolerates missing keys.
export async function deleteVariants(json) {
  if (!json) return;
  let parsed = json;
  if (typeof json === 'string') {
    try { parsed = JSON.parse(json); } catch { return; }
  }
  if (typeof parsed !== 'object') return;
  await Promise.allSettled(
    Object.values(parsed).filter(v => typeof v === 'string').map(deleteObject)
  );
}

// Exported so tests / debugging can confirm which driver is active.
export const activeDriver = DRIVER;
