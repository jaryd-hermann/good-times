-- Add app_tutorial_seen column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_tutorial_seen BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN users.app_tutorial_seen IS 'Tracks if user has seen the first screen of the app tutorial gallery';

