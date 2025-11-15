-- Storage bucket creation and policies for entries-media
-- 
-- IMPORTANT: You must create the bucket FIRST before running this migration!
-- 
-- Option 1: Via Supabase Dashboard (Recommended)
--   1. Go to your Supabase project dashboard
--   2. Navigate to Storage
--   3. Click "New bucket"
--   4. Name: "entries-media"
--   5. Check "Public bucket" (required for getPublicUrl to work)
--   6. Click "Create bucket"
--
-- Option 2: Via Script
--   Run: npx tsx scripts/create-storage-bucket.ts
--   (Requires SUPABASE_SERVICE_ROLE_KEY in .env)
--
-- After creating the bucket, run this migration to set up RLS policies.

-- Storage policies for entries-media bucket
-- Allow authenticated users to upload files to their group's folder
CREATE POLICY "Users can upload to their group folders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'entries-media' AND
  (storage.foldername(name))[1] IN (
    SELECT group_id::text FROM group_members WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to read files from their group's folders
CREATE POLICY "Users can read files from their group folders"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'entries-media' AND
  (storage.foldername(name))[1] IN (
    SELECT group_id::text FROM group_members WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete files from their group's folders
CREATE POLICY "Users can delete files from their group folders"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'entries-media' AND
  (storage.foldername(name))[1] IN (
    SELECT group_id::text FROM group_members WHERE user_id = auth.uid()
  )
);

-- Allow public read access (for getPublicUrl to work)
   npx expo start --clear
