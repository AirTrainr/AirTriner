-- ============================================
-- Normalize sport slugs and names in the sports table
-- Fixes:
--   1. Basketball  → trailing space removed
--   2. martial-arts → martial_arts (hyphen to underscore)
--   3. track-and-field → track_and_field (hyphen to underscore)
-- ============================================

UPDATE sports SET
    name = TRIM(name),
    slug = CASE id
        WHEN '3f9cf91f-9a09-4590-a93f-f6dc3c4405e0' THEN 'basketball'
        WHEN 'a59ae1cb-c29d-4398-bdd1-82fe1302de44' THEN 'martial_arts'
        WHEN 'b569f8d1-dc35-4d63-b649-eb0a296266b5' THEN 'track_and_field'
        ELSE slug
    END
WHERE id IN (
    '3f9cf91f-9a09-4590-a93f-f6dc3c4405e0',  -- Basketball
    'a59ae1cb-c29d-4398-bdd1-82fe1302de44',  -- Martial Arts
    'b569f8d1-dc35-4d63-b649-eb0a296266b5'   -- Track & Field
);
