# Avatars Bucket Setup

## Issue
User profile pictures are not loading and showing "bucket not found" error when trying to upload.

## Solution

The `avatars` storage bucket needs to be created in Supabase.

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Storage**
3. Click **"New bucket"**
4. Name: `avatars`
5. **Check "Public bucket"** (required for `getPublicUrl()` to work)
6. Click **"Create bucket"**

### Option 2: Via Script

Run the script to create the bucket programmatically:

```bash
npx tsx scripts/create-avatars-bucket.ts
```

**Note:** Requires `SUPABASE_SERVICE_ROLE_KEY` in your `.env` file.

### After Creating the Bucket

Run the migration to set up RLS policies:

```sql
-- Run in Supabase SQL Editor:
-- supabase/migrations/006_create_avatars_bucket.sql
```

This migration sets up:
- Users can upload their own avatars
- Users can read any avatar (public bucket)
- Users can update/delete their own avatars
- Public read access for `getPublicUrl()` to work

## Verification

After setup, try uploading a profile picture in Settings. It should work without errors.

