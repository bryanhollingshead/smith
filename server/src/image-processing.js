// Smith — Image processing
//
// Wraps Sharp to:
//   1. Validate an incoming buffer is actually an image we want
//   2. Strip EXIF (privacy + smaller files)
//   3. Produce 3 size variants in WebP
//   4. Upload each variant via storage.js
//   5. Return a { thumb, medium, full } object of storage keys
//
// Two output shapes:
//   processSquare()    — square crop (centered). Use for avatars, logos.
//   processCover()     — preserves aspect ratio with a max width. Use for
//                        cover photos, jobsite photos, post photos.
//
// Sharp defaults: WebP quality 82, lossless off. Strikes a good balance —
// WebP at 82 is visually indistinguishable from the original at ~30% the
// file size of an equivalent JPEG. WebP support is universal in 2026.
//
// Why WebP over JPEG: smaller files for the same quality. We pay R2 storage
// + bandwidth per byte, so file size matters. Browser support is universal.
// Mobile clients (future) can decode WebP natively.
//
// Originals: we discard them after producing variants. If we ever need a
// "view original" affordance, the `full` variant at 1600px is plenty for
// any realistic use case, including high-DPI displays.

import sharp from 'sharp';
import crypto from 'node:crypto';
import { uploadBuffer } from './storage.js';

const ACCEPT_FORMATS = new Set(['jpeg', 'png', 'webp', 'heic', 'heif']);

// Hard cap on the input buffer size. 25MB is a generous ceiling for camera
// photos straight off a phone (typical iPhone HEIC is 2-4MB; biggest realistic
// case is a DSLR JPEG at ~15MB).
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

const VARIANT_SQUARE = {
  thumb:  { size: 200,  quality: 80 },
  medium: { size: 600,  quality: 82 },
  full:   { size: 1200, quality: 82 },
};
const VARIANT_COVER = {
  thumb:  { size: 320,  quality: 80 },
  medium: { size: 1024, quality: 82 },
  full:   { size: 1920, quality: 82 },
};

// Validate + decode a buffer to a Sharp pipeline + report metadata.
async function inspect(buf) {
  if (!Buffer.isBuffer(buf)) throw new Error('Image buffer required.');
  if (buf.length > MAX_INPUT_BYTES) {
    throw new Error(`Image too large (max ${Math.round(MAX_INPUT_BYTES / 1024 / 1024)} MB).`);
  }
  const img = sharp(buf, { failOn: 'truncated' });
  const meta = await img.metadata();
  if (!ACCEPT_FORMATS.has(meta.format)) {
    throw new Error(`Unsupported image format: ${meta.format || 'unknown'}`);
  }
  return { img: img.rotate(), meta }; // rotate() honors EXIF orientation then strips it
}

// Build a storage key for a variant. We use a nonce so two re-uploads of
// "avatar" for the same user don't overwrite each other mid-flight (storage
// is eventually consistent; the DB is the source of truth for "current url").
//
// Path scheme:  <namespace>/<owner-id>/<label>-<size>-<nonce>.webp
// e.g.          users/42/avatar-thumb-3f2a1b9c.webp
function keyFor({ namespace, ownerId, label, size, nonce }) {
  return `${namespace}/${ownerId}/${label}-${size}-${nonce}.webp`;
}

// ── processSquare ───────────────────────────────────────────────────────
// Center-cropped to a square, 3 variants. For avatars + logos.
export async function processSquare(buf, { namespace, ownerId, label }) {
  const { img } = await inspect(buf);
  const nonce = crypto.randomBytes(4).toString('hex');
  const out = {};

  for (const [name, { size, quality }] of Object.entries(VARIANT_SQUARE)) {
    const variantBuf = await img
      .clone()
      .resize(size, size, { fit: 'cover', position: 'attention' })
      .webp({ quality })
      .toBuffer();
    const key = keyFor({ namespace, ownerId, label, size: name, nonce });
    await uploadBuffer(key, variantBuf, 'image/webp');
    out[name] = key;
  }

  return out; // { thumb, medium, full } of storage keys
}

// ── processCover ────────────────────────────────────────────────────────
// Preserves aspect ratio. Max width per variant; height is computed.
// For cover photos, jobsite photos, post photos.
export async function processCover(buf, { namespace, ownerId, label }) {
  const { img } = await inspect(buf);
  const nonce = crypto.randomBytes(4).toString('hex');
  const out = {};

  for (const [name, { size, quality }] of Object.entries(VARIANT_COVER)) {
    const variantBuf = await img
      .clone()
      .resize(size, null, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    const key = keyFor({ namespace, ownerId, label, size: name, nonce });
    await uploadBuffer(key, variantBuf, 'image/webp');
    out[name] = key;
  }

  return out;
}
