-- Add embedded_media field to entries table for Spotify/Soundcloud embeds
ALTER TABLE entries ADD COLUMN IF NOT EXISTS embedded_media JSONB DEFAULT '[]'::jsonb;

-- Create user_songs table for personalization (tracks songs a user has added)
CREATE TABLE IF NOT EXISTS user_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('spotify', 'soundcloud')),
  url TEXT NOT NULL,
  embed_id TEXT NOT NULL,
  embed_type TEXT, -- 'track', 'album', 'playlist' for Spotify; 'track' for Soundcloud
  title TEXT,
  artist TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, embed_id)
);

-- Create group_songs table for group-level personalization
CREATE TABLE IF NOT EXISTS group_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('spotify', 'soundcloud')),
  url TEXT NOT NULL,
  embed_id TEXT NOT NULL,
  embed_type TEXT,
  title TEXT,
  artist TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, platform, embed_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_songs_user ON user_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_songs_platform ON user_songs(platform);
CREATE INDEX IF NOT EXISTS idx_group_songs_group ON group_songs(group_id);
CREATE INDEX IF NOT EXISTS idx_group_songs_user ON group_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_group_songs_platform ON group_songs(platform);

-- Enable RLS
ALTER TABLE user_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_songs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own songs" ON user_songs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own songs" ON user_songs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view songs in their groups" ON group_songs FOR SELECT
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert songs in their groups" ON group_songs FOR INSERT
  WITH CHECK (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()) 
    AND user_id = auth.uid()
  );

