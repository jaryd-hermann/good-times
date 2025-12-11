-- Migration: Classify existing prompts (Phase 2)
-- Populates classification attributes for all existing questions
-- IMPORTANT: Only updates new classification columns, does not modify existing data

-- ============================================================================
-- Helper function to classify questions based on patterns
-- ============================================================================

-- This migration will use UPDATE statements with WHERE clauses to classify questions
-- based on their question text, category, and other existing attributes

-- ============================================================================
-- 1. Classify by Category (initial pass)
-- ============================================================================

-- Remembering category: Deep, vulnerable, past-oriented
UPDATE prompts 
SET 
  depth_level = 5,
  vulnerability_score = 5,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  clarity_level = 3
WHERE category = 'Remembering' 
  AND depth_level IS NULL;

-- Birthday category: Moderate depth, present/future oriented
UPDATE prompts 
SET 
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = CASE 
    WHEN question ILIKE '%year%' OR question ILIKE '%next%' OR question ILIKE '%future%' THEN 'future'
    WHEN question ILIKE '%learn%' OR question ILIKE '%realization%' THEN 'present'
    ELSE 'present'
  END,
  focus_type = CASE 
    WHEN dynamic_variables::text LIKE '%member_name%' THEN 'others'
    ELSE 'self'
  END,
  answer_length_expectation = 'medium',
  clarity_level = 2
WHERE category = 'Birthday' 
  AND depth_level IS NULL;

-- Edgy/NSFW category: Moderate depth, moderate vulnerability (edgy but can be revealing)
UPDATE prompts 
SET 
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  clarity_level = 2,
  topics = ARRAY['relationships', 'personal'],
  mood_tags = ARRAY['humorous', 'playful']
WHERE category = 'Edgy/NSWF' 
  AND depth_level IS NULL;

-- Seasonal category: Light to moderate, timeless
UPDATE prompts 
SET 
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'timeless',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  clarity_level = 2
WHERE category = 'Seasonal' 
  AND depth_level IS NULL;

-- Featured category: Moderate depth (will be refined by question content below)
-- Leave as default, will be classified by content patterns

-- Family category: Moderate to deep, others/group focused
UPDATE prompts 
SET 
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = CASE 
    WHEN question ILIKE '%member_name%' THEN 'others'
    WHEN question ILIKE '%group%' OR (question ILIKE '%family%' AND question ILIKE '%together%') THEN 'group'
    ELSE 'self'
  END,
  answer_length_expectation = 'medium',
  clarity_level = 2,
  topics = ARRAY['family'],
  mood_tags = ARRAY['warm', 'sentimental']
WHERE category = 'Family' 
  AND depth_level IS NULL;

-- Friends category: Moderate depth, group/others focused
UPDATE prompts 
SET 
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = CASE 
    WHEN question ILIKE '%member_name%' THEN 'others'
    WHEN question ILIKE '%this group%' OR question ILIKE '%us%' THEN 'group'
    ELSE 'self'
  END,
  answer_length_expectation = 'medium',
  clarity_level = 2,
  topics = ARRAY['friendship', 'relationships'],
  mood_tags = ARRAY['playful', 'warm']
WHERE category = 'Friends' 
  AND depth_level IS NULL;

-- Custom category: Will be classified by content (no default category-based classification)
-- Leave for content-based classification below

-- ============================================================================
-- 2. Classify by Question Content Patterns
-- ============================================================================

-- Deep/Introspective questions (depth_level 4-5)
UPDATE prompts 
SET 
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  answer_length_expectation = 'long'
WHERE (
  question ILIKE '%learn%' AND (question ILIKE '%yourself%' OR question ILIKE '%life%')
  OR question ILIKE '%realization%'
  OR question ILIKE '%changed your mind%'
  OR question ILIKE '%perspective%'
  OR question ILIKE '%hard truth%'
  OR question ILIKE '%value%' AND question ILIKE '%live%'
  OR question ILIKE '%philosophy%'
  OR question ILIKE '%lesson%' AND question ILIKE '%longest%'
  OR question ILIKE '%grateful%' AND question ILIKE '%today%'
  OR question ILIKE '%appreciate%' AND question ILIKE '%more%'
  OR question ILIKE '%working through%'
  OR question ILIKE '%decision%' AND question ILIKE '%trying to make%'
)
AND depth_level IS NULL;

-- Memorial questions (deep, vulnerable, past)
UPDATE prompts 
SET 
  depth_level = 5,
  vulnerability_score = 5,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  topics = ARRAY['memorial', 'loss', 'memory', 'grief'],
  mood_tags = ARRAY['nostalgic', 'sentimental', 'reflective']
WHERE (
  question ILIKE '%memorial_name%'
  OR question ILIKE '%memorial%'
)
AND depth_level IS NULL;

-- Member name questions (moderate depth, others-focused)
UPDATE prompts 
SET 
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  topics = ARRAY['relationships', 'friendship', 'family'],
  mood_tags = ARRAY['appreciative', 'warm']
WHERE (
  question ILIKE '%member_name%'
  AND question NOT ILIKE '%memorial%'
)
AND depth_level IS NULL;

-- Group-focused questions
UPDATE prompts 
SET 
  depth_level = 3,
  focus_type = 'group',
  answer_length_expectation = 'medium',
  is_conversation_starter = true,
  topics = ARRAY['group', 'together', 'shared']
WHERE (
  question ILIKE '%this group%'
  OR question ILIKE '%us all%'
  OR question ILIKE '%we all%'
  OR question ILIKE '%our family%'
  OR question ILIKE '%our group%'
  OR question ILIKE '%together%' AND (question ILIKE '%family%' OR question ILIKE '%group%')
)
AND focus_type IS NULL;

-- Light/Fun questions (depth_level 1-2)
UPDATE prompts 
SET 
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  answer_length_expectation = 'quick',
  mood_tags = ARRAY['funny', 'lighthearted', 'playful']
WHERE (
  question ILIKE '%funniest%'
  OR question ILIKE '%crazy%'
  OR question ILIKE '%wildest%'
  OR question ILIKE '%unhinged%'
  OR question ILIKE '%chaos%'
  OR question ILIKE '%dumbest%'
  OR question ILIKE '%ridiculous%'
  OR question ILIKE '%petty%'
  OR question ILIKE '%cringe%'
  OR question ILIKE '%embarrassing%'
  OR question ILIKE '%shocking%'
  OR question ILIKE '%taboo%'
  OR question ILIKE '%walk of shame%'
  OR question ILIKE '%Roman Empire%'
  OR question ILIKE '%superpower%'
  OR question ILIKE '%vibe check%'
)
AND depth_level IS NULL;

-- Past/Memory questions
UPDATE prompts 
SET 
  time_orientation = 'past',
  topics = COALESCE(topics, ARRAY[]::TEXT[]) || ARRAY['memory', 'nostalgia', 'childhood'],
  mood_tags = COALESCE(mood_tags, ARRAY[]::TEXT[]) || ARRAY['nostalgic']
WHERE (
  question ILIKE '%memory%'
  OR question ILIKE '%remember%'
  OR question ILIKE '%childhood%'
  OR question ILIKE '%growing up%'
  OR question ILIKE '%used to%'
  OR question ILIKE '%first%' AND (question ILIKE '%job%' OR question ILIKE '%meet%')
  OR question ILIKE '%10 years ago%'
  OR question ILIKE '%relive%'
  OR question ILIKE '%wish you could%' AND question ILIKE '%back%'
)
AND time_orientation IS NULL;

-- Present/Moment questions
UPDATE prompts 
SET 
  time_orientation = 'present',
  topics = COALESCE(topics, ARRAY[]::TEXT[]) || ARRAY['current', 'now', 'recent']
WHERE (
  question ILIKE '%right now%'
  OR question ILIKE '%currently%'
  OR question ILIKE '%at the moment%'
  OR question ILIKE '%this week%'
  OR question ILIKE '%recently%'
  OR question ILIKE '%lately%'
  OR question ILIKE '%today%'
  OR question ILIKE '%working on%'
  OR question ILIKE '%excited about%'
)
AND time_orientation IS NULL;

-- Future/Aspirational questions
UPDATE prompts 
SET 
  time_orientation = 'future',
  topics = COALESCE(topics, ARRAY[]::TEXT[]) || ARRAY['future', 'goals', 'aspirations'],
  mood_tags = COALESCE(mood_tags, ARRAY[]::TEXT[]) || ARRAY['hopeful', 'aspirational']
WHERE (
  question ILIKE '%next year%'
  OR question ILIKE '%next week%'
  OR question ILIKE '%hope%'
  OR question ILIKE '%goal%'
  OR question ILIKE '%looking forward%'
  OR question ILIKE '%want to%' AND question ILIKE '%try%'
  OR question ILIKE '%would love%'
  OR question ILIKE '%wish%' AND question ILIKE '%could%'
)
AND time_orientation IS NULL;

-- Photo/Media questions
UPDATE prompts 
SET 
  media_affinity = ARRAY['photo'],
  answer_length_expectation = 'medium'
WHERE (
  question ILIKE '%photo%'
  OR question ILIKE '%picture%'
  OR question ILIKE '%image%'
  OR question ILIKE '%camera roll%'
  OR question ILIKE '%screenshot%'
)
AND media_affinity IS NULL;

-- Video questions
UPDATE prompts 
SET 
  media_affinity = ARRAY['video'],
  answer_length_expectation = 'quick'
WHERE (
  question ILIKE '%video%'
  OR question ILIKE '%5-second%'
  OR question ILIKE '%short video%'
)
AND media_affinity IS NULL;

-- Voice note questions
UPDATE prompts 
SET 
  media_affinity = ARRAY['audio'],
  answer_length_expectation = 'medium'
WHERE (
  question ILIKE '%voice note%'
  OR question ILIKE '%voice message%'
  OR question ILIKE '%record%' AND question ILIKE '%voice%'
)
AND media_affinity IS NULL;

-- Questions that combine media types
UPDATE prompts 
SET 
  media_affinity = ARRAY['photo', 'video']
WHERE (
  question ILIKE '%photo%' AND question ILIKE '%video%'
  OR question ILIKE '%share%' AND (question ILIKE '%photo%' OR question ILIKE '%video%')
)
AND media_affinity IS NULL;

-- ============================================================================
-- 3. Refine classifications based on specific question patterns
-- ============================================================================

-- Self-reflection questions
UPDATE prompts 
SET 
  focus_type = 'self',
  depth_level = COALESCE(depth_level, 3),
  vulnerability_score = COALESCE(vulnerability_score, 3)
WHERE (
  question ILIKE '%yourself%'
  OR question ILIKE '%you%' AND (question ILIKE '%learn%' OR question ILIKE '%realize%' OR question ILIKE '%proud%')
  OR question ILIKE '%your%' AND (question ILIKE '%strength%' OR question ILIKE '%talent%' OR question ILIKE '%expertise%')
)
AND focus_type IS NULL;

-- Conversation starters (questions that invite discussion)
UPDATE prompts 
SET 
  is_conversation_starter = true
WHERE (
  question ILIKE '%agree%'
  OR question ILIKE '%all think%'
  OR question ILIKE '%we all%'
  OR question ILIKE '%everyone%'
  OR question ILIKE '%group%' AND (question ILIKE '%think%' OR question ILIKE '%believe%')
  OR question ILIKE '%recommend%'
  OR question ILIKE '%advice%'
  OR question ILIKE '%opinion%'
  OR question ILIKE '%hot take%'
)
AND is_conversation_starter IS NULL;

-- Long answer questions (require detailed responses)
UPDATE prompts 
SET 
  answer_length_expectation = 'long'
WHERE (
  question ILIKE '%story%'
  OR question ILIKE '%describe%'
  OR question ILIKE '%tell us%'
  OR question ILIKE '%share%' AND (question ILIKE '%moment%' OR question ILIKE '%memory%' OR question ILIKE '%time%')
  OR question ILIKE '%explain%'
)
AND answer_length_expectation IS NULL;

-- Quick answer questions
UPDATE prompts 
SET 
  answer_length_expectation = 'quick'
WHERE (
  question ILIKE '%three words%'
  OR question ILIKE '%one thing%'
  OR question ILIKE '%name%' AND NOT question ILIKE '%story%'
  OR question ILIKE '%pick%'
  OR question ILIKE '%choose%'
)
AND answer_length_expectation = 'medium';

-- ============================================================================
-- 4. Add topic tags based on content
-- ============================================================================

-- Family topics
UPDATE prompts 
SET 
  topics = COALESCE(topics, ARRAY[]::TEXT[]) || ARRAY['family']
WHERE (
  question ILIKE '%family%'
  OR category = 'Family'
)
AND (topics IS NULL OR NOT ('family' = ANY(topics)));

-- Friendship topics
UPDATE prompts 
SET 
  topics = COALESCE(topics, ARRAY[]::TEXT[]) || ARRAY['friendship', 'relationships']
WHERE (
  question ILIKE '%friend%'
  OR category = 'Friends'
)
AND (topics IS NULL OR NOT ('friendship' = ANY(topics)));

-- Work/Career topics
UPDATE prompts 
SET 
  topics = COALESCE(topics, ARRAY[]::TEXT[]) || ARRAY['work', 'career']
WHERE (
  question ILIKE '%work%'
  OR question ILIKE '%job%'
  OR question ILIKE '%career%'
)
AND (topics IS NULL OR NOT ('work' = ANY(topics)));

-- Childhood topics
UPDATE prompts 
SET 
  topics = COALESCE(topics, ARRAY[]::TEXT[]) || ARRAY['childhood', 'nostalgia']
WHERE (
  question ILIKE '%childhood%'
  OR question ILIKE '%growing up%'
  OR question ILIKE '%kid%'
)
AND (topics IS NULL OR NOT ('childhood' = ANY(topics)));

-- Food topics
UPDATE prompts 
SET 
  topics = COALESCE(topics, ARRAY[]::TEXT[]) || ARRAY['food']
WHERE (
  question ILIKE '%food%'
  OR question ILIKE '%snack%'
  OR question ILIKE '%meal%'
  OR question ILIKE '%ate%'
)
AND (topics IS NULL OR NOT ('food' = ANY(topics)));

-- Music topics
UPDATE prompts 
SET 
  topics = COALESCE(topics, ARRAY[]::TEXT[]) || ARRAY['music', 'songs']
WHERE (
  question ILIKE '%song%'
  OR question ILIKE '%music%'
  OR question ILIKE '%spotify%'
  OR question ILIKE '%playlist%'
)
AND (topics IS NULL OR NOT ('music' = ANY(topics)));

-- ============================================================================
-- 5. Add mood tags
-- ============================================================================

-- Nostalgic mood
UPDATE prompts 
SET 
  mood_tags = COALESCE(mood_tags, ARRAY[]::TEXT[]) || ARRAY['nostalgic']
WHERE (
  question ILIKE '%nostalgic%'
  OR question ILIKE '%remember%'
  OR question ILIKE '%miss%'
  OR question ILIKE '%used to%'
)
AND (mood_tags IS NULL OR NOT ('nostalgic' = ANY(mood_tags)));

-- Funny/Humorous mood
UPDATE prompts 
SET 
  mood_tags = COALESCE(mood_tags, ARRAY[]::TEXT[]) || ARRAY['funny', 'humorous']
WHERE (
  question ILIKE '%funny%'
  OR question ILIKE '%funniest%'
  OR question ILIKE '%laugh%'
  OR question ILIKE '%hilarious%'
  OR question ILIKE '%crack%' AND question ILIKE '%up%'
)
AND (mood_tags IS NULL OR NOT ('funny' = ANY(mood_tags)));

-- Reflective mood
UPDATE prompts 
SET 
  mood_tags = COALESCE(mood_tags, ARRAY[]::TEXT[]) || ARRAY['reflective', 'thoughtful']
WHERE (
  question ILIKE '%reflect%'
  OR question ILIKE '%think about%'
  OR question ILIKE '%consider%'
  OR question ILIKE '%realize%'
  OR question ILIKE '%learn%'
)
AND (mood_tags IS NULL OR NOT ('reflective' = ANY(mood_tags)));

-- Sentimental mood
UPDATE prompts 
SET 
  mood_tags = COALESCE(mood_tags, ARRAY[]::TEXT[]) || ARRAY['sentimental', 'warm']
WHERE (
  question ILIKE '%proud%'
  OR question ILIKE '%admire%'
  OR question ILIKE '%appreciate%'
  OR question ILIKE '%grateful%'
  OR question ILIKE '%love%'
  OR question ILIKE '%care%'
)
AND (mood_tags IS NULL OR NOT ('sentimental' = ANY(mood_tags)));

-- ============================================================================
-- 6. Set defaults for any remaining NULL values
-- ============================================================================

-- Default depth_level (if still NULL)
UPDATE prompts 
SET depth_level = 3
WHERE depth_level IS NULL;

-- Default vulnerability_score (if still NULL)
UPDATE prompts 
SET vulnerability_score = 3
WHERE vulnerability_score IS NULL;

-- Default emotional_weight (if still NULL)
UPDATE prompts 
SET emotional_weight = 'moderate'
WHERE emotional_weight IS NULL;

-- Default time_orientation (if still NULL)
UPDATE prompts 
SET time_orientation = 'present'
WHERE time_orientation IS NULL;

-- Default focus_type (if still NULL)
UPDATE prompts 
SET focus_type = 'self'
WHERE focus_type IS NULL;

-- Default answer_length_expectation (if still NULL)
UPDATE prompts 
SET answer_length_expectation = 'medium'
WHERE answer_length_expectation IS NULL;

-- Default clarity_level (if still NULL)
UPDATE prompts 
SET clarity_level = 2
WHERE clarity_level IS NULL;

-- ============================================================================
-- 7. Clean up empty arrays (set to NULL instead of empty array)
-- ============================================================================

UPDATE prompts 
SET topics = NULL
WHERE topics = ARRAY[]::TEXT[];

UPDATE prompts 
SET mood_tags = NULL
WHERE mood_tags = ARRAY[]::TEXT[];

UPDATE prompts 
SET media_affinity = NULL
WHERE media_affinity = ARRAY[]::TEXT[];

