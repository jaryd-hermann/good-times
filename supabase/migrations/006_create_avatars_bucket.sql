-- Storage bucket creation and policies for avatars
-- 
-- IMPORTANT: You must create the bucket FIRST before running this migration!
-- 
-- Option 1: Via Supabase Dashboard (Recommended)
--   1. Go to your Supabase project dashboard
--   2. Navigate to Storage
--   3. Click "New bucket"
--   4. Name: "avatars"
--   5. Check "Public bucket" (required for getPublicUrl to work)
--   6. Click "Create bucket"
--
-- Option 2: Via Script
--   Run: npx tsx scripts/create-avatars-bucket.ts
--   (Requires SUPABASE_SERVICE_ROLE_KEY in .env)
--
-- After creating the bucket, run this migration to set up RLS policies.

-- Storage policies for avatars bucket
-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read any avatar (public bucket)
CREATE POLICY "Users can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Allow authenticated users to update/delete their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access (for getPublicUrl to work)
CREATE POLICY "Public can read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

