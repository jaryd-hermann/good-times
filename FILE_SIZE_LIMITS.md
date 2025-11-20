# File Size Limits

## Current Limits

### Storage Buckets

#### `entries-media` Bucket
- **File Size Limit**: 50 MB (52,428,800 bytes)
- **Allowed Mime Types**: `image/*`, `video/*`, `audio/*`
- **Purpose**: Stores photos, videos, and voice memos for entries
- **Configuration**: Set in `scripts/create-storage-bucket.ts`

#### `avatars` Bucket
- **File Size Limit**: 5 MB (5,242,880 bytes)
- **Allowed Mime Types**: `image/jpeg`, `image/png`, `image/webp`
- **Purpose**: Stores user profile photos
- **Configuration**: Set in `scripts/create-avatars-bucket.ts`

## How to Increase Limits

### Option 1: Update via Supabase Dashboard
1. Go to Storage in your Supabase project
2. Select the bucket you want to modify
3. Click "Settings"
4. Update the "File size limit" field
5. Click "Save"

### Option 2: Update via Script
1. Edit the relevant script file:
   - `scripts/create-storage-bucket.ts` for entries-media
   - `scripts/create-avatars-bucket.ts` for avatars
2. Update the `fileSizeLimit` value (in bytes)
3. Note: This only affects new buckets. Existing buckets need to be updated via Dashboard or API

### Option 3: Update via Supabase API
```typescript
const { data, error } = await supabase.storage.updateBucket("entries-media", {
  fileSizeLimit: 104857600, // 100 MB in bytes
})
```

## Recommended Limits

### For Production
- **entries-media**: 50-100 MB (sufficient for high-quality photos and short videos)
- **avatars**: 5-10 MB (sufficient for profile photos)

### Considerations
- Larger limits = more storage costs
- Larger limits = longer upload times
- Consider implementing client-side compression before upload
- Video files can be very large - consider transcoding/compression

## Current Implementation

The file size limits are enforced by Supabase Storage. If a file exceeds the limit, the upload will fail with an error that should be caught and displayed to the user.

To check current limits programmatically:
```typescript
const { data } = await supabase.storage.getBucket("entries-media")
console.log("File size limit:", data.fileSizeLimit)
```

