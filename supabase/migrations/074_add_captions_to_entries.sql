-- Add captions field to entries table
-- Captions is an array of text, parallel to media_urls and media_types
-- Each caption corresponds to the media at the same index
-- NULL values indicate no caption for that media item
ALTER TABLE entries
ADD COLUMN captions text[] DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN entries.captions IS 'Array of captions for media items, parallel to media_urls and media_types. NULL values indicate no caption for that media item. Only used for Journal category entries.';
