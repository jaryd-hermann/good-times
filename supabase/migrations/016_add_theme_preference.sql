-- Add theme_preference column to users table
ALTER TABLE users ADD COLUMN theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('dark', 'light'));

