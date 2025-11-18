-- Fix storage RLS policy for memorial photos
-- Memorial photos are uploaded to avatars bucket with path: {groupId}/{memorialId}/{fileName}
-- But the current policy only allows {userId}/... paths

-- Allow group admins to upload memorial photos to their group folders
CREATE POLICY "Group admins can upload memorial photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IN (
    SELECT group_id::text 
    FROM group_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow group admins to update/delete memorial photos in their group folders
CREATE POLICY "Group admins can update memorial photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IN (
    SELECT group_id::text 
    FROM group_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Group admins can delete memorial photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IN (
    SELECT group_id::text 
    FROM group_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

