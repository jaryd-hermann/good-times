-- Allow media on an answer that has no group yet.
--
-- v2 lets a new user answer before they create or join anything (the answer
-- retro-shares into the first group they join). The composer had no group id to
-- build a storage path from, so it passed the literal string "onboarding" —
-- and gt_upload_media_by_group casts that first path segment to uuid:
--
--   is_group_member(auth.uid(), (NULLIF(split_part(name,'/',1),''))::uuid)
--
-- which raised `invalid input syntax for type uuid: "onboarding"` rather than
-- simply denying the insert.
--
-- The composer now uses the user's own id as the folder in that case. This policy
-- is what makes that writable: is_group_member(uid, uid) is false, so without it
-- the upload would still be refused — just with a permission error instead of a
-- cast error.
--
-- Reads need nothing new: "Public can read entries-media files" already permits
-- SELECT bucket-wide and the bucket is public, so the media resolves for group
-- members once the answer retro-shares.

CREATE POLICY "gt_upload_own_answer_media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'entries-media'
    -- Own folder only: the segment must equal the caller's uid. Compared as TEXT
    -- deliberately — a cast here would reintroduce exactly the failure above for
    -- any non-uuid folder name.
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "gt_delete_own_answer_media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'entries-media'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
