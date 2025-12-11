-- Phase 2: Classify Featured Questions Individually
-- This script analyzes each Featured question individually and assigns classification attributes
-- based on the unique content of each question, not blanket category rules.
-- 
-- All 2 Featured questions classified individually based on their unique content.
-- Featured questions are weekly additions that groups can add to their queue.

-- Featured Question 1: "Have you ever "borrowed" a habit or a style from someone else's lifestyle?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['influence', 'habits', 'self-reflection'],
  mood_tags = ARRAY['reflective', 'curious'],
  is_conversation_starter = true
WHERE id = '72307ad4-73e3-42ed-a6d0-5d7c7a7a7fc3' AND category = 'Featured';

-- Featured Question 2: "Have you ever "borrowed" a habit or a style from someone else's lifestyle?" (duplicate)
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['influence', 'habits', 'self-reflection'],
  mood_tags = ARRAY['reflective', 'curious'],
  is_conversation_starter = true
WHERE id = 'eca08d78-fd55-4d82-be26-6641f9753de1' AND category = 'Featured';

