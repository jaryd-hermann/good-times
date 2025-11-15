# Storage Bucket Setup Guide

## Problem
If you're seeing 404 "Bucket not found" errors when trying to access media URLs, it means the `entries-media` storage bucket doesn't exist in your Supabase project.

## Solution

### Step 1: Create the Bucket

**Via Supabase Dashboard (Recommended):**

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **"New bucket"** button
5. Fill in the form:
   - **Name**: `entries-media` (must match exactly)
   - **Public bucket**: ✅ **Check this box** (required for `getPublicUrl()` to work)
   - **File size limit**: 50 MB (or your preferred limit)
   - **Allowed MIME types**: Leave empty or add `image/*,video/*,audio/*`
6. Click **"Create bucket"**

### Step 2: Set Up Storage Policies

After creating the bucket, run the migration to set up Row Level Security (RLS) policies:

1. Go to **SQL Editor** in your Supabase dashboard
2. Open the file `supabase/migrations/003_create_storage_bucket.sql`
3. Copy and paste the SQL into the editor
4. Click **"Run"**

This will create policies that:
- Allow authenticated users to upload files to their group folders
- Allow authenticated users to read files from their group folders
- Allow authenticated users to delete files from their group folders
- Allow public read access (so `getPublicUrl()` works)

### Step 3: Verify

After creating the bucket and running the migration:

1. Try uploading a new entry with media in the app
2. Check that the media URL works by clicking it in the browser
3. Verify the file appears in Storage > entries-media in your Supabase dashboard

## Alternative: Create Bucket via Script

If you prefer to create the bucket programmatically:

1. Add your service role key to `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
   (Find this in: Project Settings > API > service_role key)

2. Install tsx if needed:
   ```bash
   npm install -g tsx
   ```

3. Run the script:
   ```bash
   npx tsx scripts/create-storage-bucket.ts
   ```

4. Then run the migration `003_create_storage_bucket.sql` as described above.

## Troubleshooting

### Bucket exists but URLs still return 404
- Verify the bucket is set to **Public** (not private)
- Check that the migration `003_create_storage_bucket.sql` has been run
- Verify the file path structure matches: `groupId/entryId/filename.ext`

### Upload fails with permission error
- Ensure you've run the migration `003_create_storage_bucket.sql`
- Check that the user is authenticated and is a member of the group
- Verify RLS policies are enabled on the storage.objects table

### Old entries have broken media URLs
If you have existing entries with media URLs that don't work:
- The media files may have been uploaded before the bucket existed
- You'll need to re-upload the media for those entries, OR
- If the files exist elsewhere, you can manually upload them to the bucket with the correct path structure

