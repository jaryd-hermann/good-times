-- Phase 2: Classify Friends Questions Individually - SAMPLE (First 10)
-- This script analyzes each Friends question individually and assigns classification attributes
-- based on the unique content of each question, not blanket category rules.
-- 
-- Sample of 10 questions showing the approach:
-- - Depth ranges from 1 (light/fun) to 4 (deep/meaningful)
-- - Vulnerability scores from 1 (low risk) to 3 (requires opening up)
-- - Emotional weight: light, moderate, heavy
-- - Time orientation: past, present, future, timeless
-- - Focus: self, others, both
-- - Media affinity: none, low, medium, high
-- - Topics and mood tags are specific to each question's content

-- Friends Question 1: "What kind of work do you actually enjoy doing?"
-- Analysis: Moderate depth, requires reflection on career satisfaction, present-focused
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['career', 'work', 'satisfaction'],
  mood_tags = ARRAY['reflective', 'positive'],
  is_conversation_starter = true
WHERE id = '01470965-2b6e-4644-ae84-69471848593c' AND category = 'Friends';

-- Friends Question 2: "What's a time someone in this group called you out in a good way?"
-- Analysis: Deeper question about growth and friendship, requires vulnerability, past-focused
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['friendship', 'growth', 'feedback'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '01c0aa5d-379b-4386-9e02-ea74f5212f2b' AND category = 'Friends';

-- Friends Question 3: "What's something about {member_name} you'll never forget"
-- Analysis: Deep appreciation question, others-focused, nostalgic, medium media potential
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['friendship', 'memories', 'appreciation'],
  mood_tags = ARRAY['warm', 'nostalgic'],
  is_conversation_starter = true
WHERE id = '047044c6-45fb-41aa-aeeb-fa5cf982b3ed' AND category = 'Friends';

-- Friends Question 4: "What's a story you think none of us actually know?"
-- Analysis: Light, playful question about sharing secrets/stories, past-focused
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['stories', 'secrets', 'surprise'],
  mood_tags = ARRAY['playful', 'curious'],
  is_conversation_starter = true
WHERE id = '0a506b10-094b-4817-913a-21b02c8856c5' AND category = 'Friends';

-- Friends Question 5: "What's something you tried and will never go back from? Why?"
-- Analysis: Light preference question, requires explanation, past-focused
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['habits', 'preferences', 'change'],
  mood_tags = ARRAY['decisive', 'confident'],
  is_conversation_starter = true
WHERE id = '0ab7820f-e068-447a-a60c-1a82f13baa61' AND category = 'Friends';

-- Friends Question 6: "What is your most unhinged purchase?"
-- Analysis: Very light, humorous question, short answer, medium media potential
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['shopping', 'humor', 'spending'],
  mood_tags = ARRAY['humorous', 'playful'],
  is_conversation_starter = true
WHERE id = '0d232b99-e734-4db4-88f4-c64a1b299ca7' AND category = 'Friends';

-- Friends Question 7: "What's something only you in this group would spend more money on?"
-- Analysis: Light, self-aware question about uniqueness, present-focused
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['spending', 'preferences', 'uniqueness'],
  mood_tags = ARRAY['playful', 'self-aware'],
  is_conversation_starter = true
WHERE id = '0d76b6b4-8971-4311-adc1-adccfe1a8c0b' AND category = 'Friends';

-- Friends Question 8: "What's a micro-opinion you hold (something that doesn't matter but you care about anyway)?"
-- Analysis: Very light, quirky question about pet peeves, present-focused
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['opinions', 'pet-peeves', 'humor'],
  mood_tags = ARRAY['humorous', 'quirky'],
  is_conversation_starter = true
WHERE id = '0d8a173d-c8f6-4518-aa22-0592be08bf62' AND category = 'Friends';

-- Friends Question 9: "What item have you owned and held onto for the longest?"
-- Analysis: Moderate depth, sentimental question, high media potential (photo of item)
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['memories', 'objects', 'sentimentality'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = '0e3af077-db2e-4d2f-ad7d-5c05c9fcf5de' AND category = 'Friends';

-- Friends Question 10: "What is a ridiculous goal you secretly have just for fun?"
-- Analysis: Light, aspirational question, future-focused, requires slight vulnerability
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['goals', 'dreams', 'humor'],
  mood_tags = ARRAY['playful', 'aspirational'],
  is_conversation_starter = true
WHERE id = '0f3daf24-fc4e-4352-8800-815df54a066c' AND category = 'Friends';

