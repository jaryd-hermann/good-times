-- Add Journal category prompt for weekly photo journal
-- This prompt will be asked every Sunday
INSERT INTO prompts (
  id,
  question,
  description,
  category,
  is_default,
  ice_breaker,
  ice_breaker_order,
  created_at
) VALUES (
  gen_random_uuid(),
  'Share your weekly photo journal',
  'What happend this week, and what are you looking forward to?',
  'Journal',
  true,
  false,
  NULL,
  NOW()
) ON CONFLICT DO NOTHING;
