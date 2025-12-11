-- Phase 2: Classify Remembering Questions Individually
-- This script analyzes each Remembering question individually and assigns classification attributes
-- based on the unique content of each question, not blanket category rules.
-- 
-- All 37 Remembering questions classified individually based on their unique content.
-- Remembering questions are all about memorial_name and tend to be very emotionally heavy.

-- Remembering Question 1: "What's something that was just so iconically {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'character', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = '04aa80ea-e086-498c-b79d-7476be4ec4f3' AND category = 'Remembering';

-- Remembering Question 2: "What is something you shared with {memorial_name} that felt like your thing?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'bond', 'intimacy'],
  mood_tags = ARRAY['sentimental', 'emotional'],
  is_conversation_starter = true
WHERE id = '12b6c23c-baaa-4620-8d27-4ecc128ef378' AND category = 'Remembering';

-- Remembering Question 3: "What is a smell that reminds you {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'senses', 'memories'],
  mood_tags = ARRAY['nostalgic', 'emotional'],
  is_conversation_starter = true
WHERE id = '1735f614-2500-4b28-bdc1-90b0beefbab9' AND category = 'Remembering';

-- Remembering Question 4: "How did {memorial_name} show up for others in a way you admire?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'admiration', 'character'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '2149e39b-feb6-4584-a7c4-4045b8f2c796' AND category = 'Remembering';

-- Remembering Question 5: "Share a photo of you and {memorial_name}"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'photos', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = '276ec1f9-d327-42d0-8d02-d2655314dd83' AND category = 'Remembering';

-- Remembering Question 6: "Share some photos you'd like {memorial_name} to see right now"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'loss', 'wish'],
  mood_tags = ARRAY['wistful', 'emotional'],
  is_conversation_starter = true
WHERE id = '288a7c45-3415-4144-92a8-342e3fe182f4' AND category = 'Remembering';

-- Remembering Question 7: "What's a moment you'll always remember with {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'memories', 'moments'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = '2cafb51c-3fc5-42bf-a633-88112f835e15' AND category = 'Remembering';

-- Remembering Question 8: "What do you think {memorial_name} would say about what you're doing today?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'imagination', 'connection'],
  mood_tags = ARRAY['wistful', 'reflective'],
  is_conversation_starter = true
WHERE id = '2e61981a-a3b8-4eb3-92b4-be1ed395ff36' AND category = 'Remembering';

-- Remembering Question 9: "What's a story with you and {memorial_name} others might not know?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'stories', 'secrets'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = '2ee600e9-9556-45ff-8630-89ad170e7296' AND category = 'Remembering';

-- Remembering Question 10: "What is something you wish you had asked {memorial_name} while you could?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 5,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'regret', 'loss'],
  mood_tags = ARRAY['wistful', 'regretful'],
  is_conversation_starter = true
WHERE id = '3e8f6529-b37d-41eb-83ca-c0b8d5ec1179' AND category = 'Remembering';

-- Remembering Question 11: "What makes you feel most connected with {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'connection', 'spirituality'],
  mood_tags = ARRAY['spiritual', 'emotional'],
  is_conversation_starter = true
WHERE id = '4e7dd0c7-3bd8-4fa5-828c-6e407296fc31' AND category = 'Remembering';

-- Remembering Question 12: "What three words do you think {memorial_name} would use to describe you?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'self-reflection', 'love'],
  mood_tags = ARRAY['reflective', 'emotional'],
  is_conversation_starter = true
WHERE id = '51c0587e-60c8-4a9f-ab04-28c4496152a6' AND category = 'Remembering';

-- Remembering Question 13: "What is something about yourself that you would thank {memorial_name} for?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'gratitude', 'influence'],
  mood_tags = ARRAY['grateful', 'emotional'],
  is_conversation_starter = true
WHERE id = '545228cc-e9b5-4c35-9c39-442661379dc9' AND category = 'Remembering';

-- Remembering Question 14: "What's something big {memorial_name} taught you?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'wisdom', 'lessons'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '57f30a38-c82e-4b56-a46a-e29108d0f34b' AND category = 'Remembering';

-- Remembering Question 15: "What phrase will always belong to {memorial_name} in your mind?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'sayings', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = '67a728e5-b512-4e16-9052-0c0763b019c6' AND category = 'Remembering';

-- Remembering Question 16: "What is a quiet moment with {memorial_name} that you remember more than the big events?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'intimacy', 'moments'],
  mood_tags = ARRAY['sentimental', 'emotional'],
  is_conversation_starter = true
WHERE id = '6eb1b057-9405-4052-bac7-011c17a46855' AND category = 'Remembering';

-- Remembering Question 17: "What day do you wish you could relive with {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 5,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'wish', 'loss'],
  mood_tags = ARRAY['wistful', 'emotional'],
  is_conversation_starter = true
WHERE id = '7320e5d3-bbbd-45a3-bc14-008b543ccd77' AND category = 'Remembering';

-- Remembering Question 18: "When did you feel proud of {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'pride', 'admiration'],
  mood_tags = ARRAY['proud', 'warm'],
  is_conversation_starter = true
WHERE id = '8817ad14-34a9-489d-af35-6cd8e4fe63de' AND category = 'Remembering';

-- Remembering Question 19: "What's something small {memorial_name} taught you?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'lessons', 'wisdom'],
  mood_tags = ARRAY['grateful', 'warm'],
  is_conversation_starter = true
WHERE id = '892b3e1c-8fe6-40f3-a7f7-f4aa9bcde8ca' AND category = 'Remembering';

-- Remembering Question 20: "If you could tell {memorial_name} one thing about your life now what would it be?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 5,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'communication', 'loss'],
  mood_tags = ARRAY['wistful', 'emotional'],
  is_conversation_starter = true
WHERE id = '8cbb9f22-0672-4789-bc9a-d27ff46a4557' AND category = 'Remembering';

-- Remembering Question 21: "What is a small habit or quirk of {memorial_name} that you miss?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'loss', 'details'],
  mood_tags = ARRAY['wistful', 'sentimental'],
  is_conversation_starter = true
WHERE id = '8fe7ec55-d1fa-4827-a320-9089c703c857' AND category = 'Remembering';

-- Remembering Question 22: "What everyday object or place makes you think of {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'triggers', 'memories'],
  mood_tags = ARRAY['nostalgic', 'emotional'],
  is_conversation_starter = true
WHERE id = '91135a63-c5d5-440e-8b0a-245deb3cdfee' AND category = 'Remembering';

-- Remembering Question 23: "Share a song you and {memorial_name} loved together?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'music', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = 'a12f0eb5-5ba2-44a7-9666-b3006b8105f4' AND category = 'Remembering';

-- Remembering Question 24: "If you could give someone one story to understand {memorial_name} which would you choose?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'stories', 'legacy'],
  mood_tags = ARRAY['meaningful', 'reflective'],
  is_conversation_starter = true
WHERE id = 'a3a3c40b-f996-45df-803c-bde5c6528801' AND category = 'Remembering';

-- Remembering Question 25: "What is something {memorial_name} did that you try honor is some way?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'legacy', 'honor'],
  mood_tags = ARRAY['respectful', 'meaningful'],
  is_conversation_starter = true
WHERE id = 'c4cc276b-a083-48cc-853b-e68d7904a581' AND category = 'Remembering';

-- Remembering Question 26: "If you could thank {memorial_name} for one specific thing what would it be?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 5,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'gratitude', 'appreciation'],
  mood_tags = ARRAY['grateful', 'emotional'],
  is_conversation_starter = true
WHERE id = 'c8d30b28-2002-4806-891f-35d1ce15b0af' AND category = 'Remembering';

-- Remembering Question 27: "What did {memorial_name} believe in strongly that rubbed off on you?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'values', 'influence'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = 'cba2e61b-cdf6-47f1-b495-914ab2c8f201' AND category = 'Remembering';

-- Remembering Question 28: "What is a story about {memorial_name} that you never get tired of telling?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'stories', 'legacy'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = 'd330dbe1-3d9a-4f7a-adc1-06ccfb933138' AND category = 'Remembering';

-- Remembering Question 29: "What is a value you try to live by because of {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'values', 'influence'],
  mood_tags = ARRAY['grateful', 'meaningful'],
  is_conversation_starter = true
WHERE id = 'de4c02fc-fcc4-4ec6-a298-6a8df7c47d3b' AND category = 'Remembering';

-- Remembering Question 30: "What is a photo of {memorial_name} that you love and why?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'photos', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = 'de9a522e-518e-49df-bbf8-14344b37558b' AND category = 'Remembering';

-- Remembering Question 31: "If {memorial_name} could give you advice today what would you hope they would say?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 5,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'wish', 'guidance'],
  mood_tags = ARRAY['wistful', 'emotional'],
  is_conversation_starter = true
WHERE id = 'e2378456-7f28-450c-b3d0-ecbb08d1c80d' AND category = 'Remembering';

-- Remembering Question 32: "What little things make you think of {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'triggers', 'memories'],
  mood_tags = ARRAY['nostalgic', 'emotional'],
  is_conversation_starter = true
WHERE id = 'ea7db9f0-86e4-4df2-94d3-29cae5a78383' AND category = 'Remembering';

-- Remembering Question 33: "What is a place you associate most strongly with {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'places', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = 'f3742a6a-f069-488e-a0dd-a7d269b01dbd' AND category = 'Remembering';

-- Remembering Question 34: "What is a song you wish you could sit and play for {memorial_name} today?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 5,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'wish', 'music'],
  mood_tags = ARRAY['wistful', 'emotional'],
  is_conversation_starter = true
WHERE id = 'f69a7390-1552-4ec6-8c09-84067c3f5272' AND category = 'Remembering';

-- Remembering Question 35: "What is a conversation with {memorial_name} you'll always remember?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'conversations', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = 'f7659c51-3028-4639-a67b-98e81230be78' AND category = 'Remembering';

-- Remembering Question 36: "What are three words you'd use to describe {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'character', 'description'],
  mood_tags = ARRAY['reflective', 'emotional'],
  is_conversation_starter = true
WHERE id = 'f899e8ce-7633-45ca-a312-ccf939abc8ed' AND category = 'Remembering';

-- Remembering Question 37: "If you could spend one more ordinary afternoon with {memorial_name} what would you do together?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 5,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'wish', 'loss'],
  mood_tags = ARRAY['wistful', 'emotional'],
  is_conversation_starter = true
WHERE id = 'f8a1f63e-6001-45c9-8d97-2c441e292ad9' AND category = 'Remembering';

