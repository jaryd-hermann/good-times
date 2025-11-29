-- Migration: Clear invalid avatar URLs (file:// paths)
-- These are local device file paths that cannot be accessed by other users
-- Users will need to re-upload their avatars, which will now be stored in Supabase Storage

-- Clear all avatar_urls that start with "file://" (local device paths)
UPDATE users
SET avatar_url = NULL
WHERE avatar_url IS NOT NULL 
  AND avatar_url LIKE 'file://%';

-- Log how many avatars were cleared
DO $$
DECLARE
  cleared_count INTEGER;
BEGIN
  GET DIAGNOSTICS cleared_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % invalid avatar URLs (file:// paths)', cleared_count;
END $$;

