-- Smith — Migration 007: photo URLs for companies, jobsites, posts
--
-- Each new column holds a JSON string of the form
--   {"thumb": "<key>", "medium": "<key>", "full": "<key>"}
-- pointing to storage keys (same shape as users.avatar_url/cover_url
-- introduced in migration 006).
--
-- Existing placeholder columns (companies.logo_tone, jobsites.photo_kind,
-- post_photos.photo_kind) are kept for backward compatibility and for
-- demo data. When a real photo is uploaded, the URL wins; otherwise the
-- placeholder kind drives a procedurally generated swatch.

-- companies: optional uploaded logo
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- jobsites: optional uploaded primary photo (one per jobsite for now;
-- multi-photo galleries can come later in a separate jobsite_photos table)
ALTER TABLE jobsites
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- post_photos: optional uploaded photo alongside the existing photo_kind.
-- post_photos already has a position column; we don't change that.
ALTER TABLE post_photos
  ADD COLUMN IF NOT EXISTS photo_url TEXT;
