-- Add media support to comments table
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('photo', 'video', 'audio'));

-- Add index for better query performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_comments_entry ON comments(entry_id);

