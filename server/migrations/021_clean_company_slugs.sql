-- Clean up company public_slugs.
--
-- Migration 020 always appended a 4-digit suffix derived from the row's id
-- (e.g. "thunderbird-0017"). For most companies the name is already unique
-- and the bare stem is what people and AI agents expect ("thunderbird").
-- This re-slug pass gives the clean stem to companies whose name is unique,
-- and falls back to "stem-NNNN" only when there's a real collision.

WITH stems AS (
  SELECT id, name,
         COALESCE(
           NULLIF(
             regexp_replace(
               regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'),
               '(^-+|-+$)', '', 'g'
             ),
             ''
           ),
           'company'
         ) AS stem
    FROM companies
),
ranked AS (
  -- Lowest id wins the bare stem; later ids fall back to stem-NNNN.
  SELECT id, stem,
         ROW_NUMBER() OVER (PARTITION BY stem ORDER BY id ASC) AS rn
    FROM stems
)
UPDATE companies c
   SET public_slug = CASE
         WHEN r.rn = 1 THEN r.stem
         ELSE r.stem || '-' || LPAD((c.id % 10000)::text, 4, '0')
       END
  FROM ranked r
 WHERE r.id = c.id;
