-- Update reactions table to support emoji types instead of just 'heart'
-- Remove the CHECK constraint that limits type to 'heart'
-- Allow type to be any text (emoji string)

-- First, drop the existing constraint
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_type_check;

-- Update the type column to allow any text (for emoji)
-- The column is already TEXT, so we just need to remove the constraint
-- For existing 'heart' reactions, we can optionally convert them to ❤️ emoji
-- But we'll leave them as-is for backward compatibility

-- Add a comment to document the change
COMMENT ON COLUMN reactions.type IS 'Emoji string representing the reaction type (e.g., ❤️, 👍, 👏, etc.)';

