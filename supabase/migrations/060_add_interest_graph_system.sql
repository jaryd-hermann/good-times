-- Add inferred_interests to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS inferred_interests TEXT[] DEFAULT '{}';

-- Add discovery tracking columns to daily_prompts
ALTER TABLE daily_prompts ADD COLUMN IF NOT EXISTS is_discovery BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_prompts ADD COLUMN IF NOT EXISTS discovery_interest TEXT;
ALTER TABLE daily_prompts ADD COLUMN IF NOT EXISTS engagement_score DECIMAL;

-- Create discovery_attempts table to track testing of discovery interests
CREATE TABLE IF NOT EXISTS discovery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  interest_name TEXT NOT NULL,
  question_count INTEGER DEFAULT 0,
  total_engagement_score DECIMAL DEFAULT 0,
  last_tested_date DATE,
  status TEXT DEFAULT 'testing' CHECK (status IN ('testing', 'inferred', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, interest_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_discovery_attempts_group_status ON discovery_attempts(group_id, status);
CREATE INDEX IF NOT EXISTS idx_discovery_attempts_group_interest ON discovery_attempts(group_id, interest_name);

-- Create interest_similarities table to cache co-occurrence data
CREATE TABLE IF NOT EXISTS interest_similarities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_name TEXT NOT NULL,
  similar_interest TEXT NOT NULL,
  co_occurrence_score DECIMAL NOT NULL, -- Percentage of groups with interest_name that also have similar_interest
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(interest_name, similar_interest)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_interest_similarities_interest ON interest_similarities(interest_name);
CREATE INDEX IF NOT EXISTS idx_interest_similarities_score ON interest_similarities(interest_name, co_occurrence_score DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_discovery_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_discovery_attempts_timestamp
  BEFORE UPDATE ON discovery_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_discovery_attempts_updated_at();
