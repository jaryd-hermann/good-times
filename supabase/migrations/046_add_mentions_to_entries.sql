-- Add mentions column to entries table
-- Stores array of user IDs that were mentioned in the entry
ALTER TABLE entries ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';

-- Create index for faster queries on mentions
CREATE INDEX IF NOT EXISTS idx_entries_mentions ON entries USING GIN(mentions);

