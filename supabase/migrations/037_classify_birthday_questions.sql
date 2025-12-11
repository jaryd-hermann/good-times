-- Phase 2: Classify Birthday Questions Individually
-- This script analyzes each Birthday question individually and assigns classification attributes
-- based on the unique content of each question, not blanket category rules.
-- 
-- All 22 Birthday questions classified individually based on their unique content.
-- Birthday questions are either "your_birthday" (self-focused) or "their_birthday" (others-focused with {member_name}).

-- Birthday Question 1: "What did you learn about yourself this year?" (your_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['self-reflection', 'growth', 'birthday'],
  mood_tags = ARRAY['reflective', 'introspective'],
  is_conversation_starter = true
WHERE id = '0a849789-1ebf-4697-b1f1-982ef43be68b' AND category = 'Birthday';

-- Birthday Question 2: "If you could send a message to yourself one year from now what would it say?" (your_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['future-self', 'hope', 'birthday'],
  mood_tags = ARRAY['hopeful', 'reflective'],
  is_conversation_starter = true
WHERE id = '0d239b3b-9170-4e17-9281-df8756a78bf0' AND category = 'Birthday';

-- Birthday Question 3: "What's a goal you have for this next year?" (your_birthday)
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['goals', 'aspiration', 'birthday'],
  mood_tags = ARRAY['aspirational', 'hopeful'],
  is_conversation_starter = true
WHERE id = '158af4b1-afb3-48e3-a941-4a21d0a90e87' AND category = 'Birthday';

-- Birthday Question 4: "Share some of you favorite photos you have of you and {member_name}" (their_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memories', 'friendship', 'birthday'],
  mood_tags = ARRAY['warm', 'nostalgic'],
  is_conversation_starter = true
WHERE id = '21c5b0e7-3a5c-44f6-8277-2771964fd079' AND category = 'Birthday';

-- Birthday Question 5: "What is a risk you are glad you took this past year?" (your_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['risk', 'growth', 'birthday'],
  mood_tags = ARRAY['proud', 'reflective'],
  is_conversation_starter = true
WHERE id = '22e814e5-08d1-474c-ab2b-35fad723c4e9' AND category = 'Birthday';

-- Birthday Question 6: "What's something you don't say enough to {member_name}?" (their_birthday)
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['communication', 'appreciation', 'birthday'],
  mood_tags = ARRAY['vulnerable', 'emotional'],
  is_conversation_starter = true
WHERE id = '39ff7c28-092b-4caa-ab1d-7485d1b37c9b' AND category = 'Birthday';

-- Birthday Question 7: "What makes you most proud of {member_name}?" (their_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['pride', 'appreciation', 'birthday'],
  mood_tags = ARRAY['proud', 'warm'],
  is_conversation_starter = true
WHERE id = '48c92edf-b24e-435b-89de-bafda9aabea4' AND category = 'Birthday';

-- Birthday Question 8: "Send a birthday voice note to {member_name}?" (their_birthday)
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['celebration', 'voice', 'birthday'],
  mood_tags = ARRAY['warm', 'celebratory'],
  is_conversation_starter = true
WHERE id = '528a0963-2d63-4e6a-9c71-82e194201dfc' AND category = 'Birthday';

-- Birthday Question 9: "What did you learn about yourself this year?" (your_birthday - duplicate)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['self-reflection', 'growth', 'birthday'],
  mood_tags = ARRAY['reflective', 'introspective'],
  is_conversation_starter = true
WHERE id = '68763219-5285-40b9-b53a-5f13f5ad799d' AND category = 'Birthday';

-- Birthday Question 10: "What has {member_name} taught you?" (their_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['wisdom', 'friendship', 'birthday'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '6fdd1419-4d13-43c6-be73-e2168d22eb5b' AND category = 'Birthday';

-- Birthday Question 11: "What do you hope for {member_name} for this next year?" (their_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'future',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['hope', 'wishes', 'birthday'],
  mood_tags = ARRAY['hopeful', 'warm'],
  is_conversation_starter = true
WHERE id = '8003ee63-537c-4f7b-ac17-f844836f05bf' AND category = 'Birthday';

-- Birthday Question 12: "What's the most signature {member_name} thing?" (their_birthday)
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['character', 'observation', 'birthday'],
  mood_tags = ARRAY['playful', 'affectionate'],
  is_conversation_starter = false
WHERE id = '8869efa4-b8f2-4abf-a449-43baf2146efb' AND category = 'Birthday';

-- Birthday Question 13: "What would younger you think about where you are today?" (your_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['self-reflection', 'growth', 'birthday'],
  mood_tags = ARRAY['reflective', 'nostalgic'],
  is_conversation_starter = true
WHERE id = '97ae00cf-31e2-475d-ab06-dd55f8eae5ca' AND category = 'Birthday';

-- Birthday Question 14: "What's your wish for yourself for this year?" (your_birthday)
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['wishes', 'aspiration', 'birthday'],
  mood_tags = ARRAY['hopeful', 'aspirational'],
  is_conversation_starter = true
WHERE id = '9beae48f-655b-441d-82bb-d75ba6034ede' AND category = 'Birthday';

-- Birthday Question 15: "Looking back what surprised you about this last year?" (your_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['reflection', 'surprise', 'birthday'],
  mood_tags = ARRAY['reflective', 'curious'],
  is_conversation_starter = true
WHERE id = 'b668b89e-0e2c-48e0-9728-7417f381bac6' AND category = 'Birthday';

-- Birthday Question 16: "What's something you admire about {member_name}?" (their_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['admiration', 'appreciation', 'birthday'],
  mood_tags = ARRAY['appreciative', 'warm'],
  is_conversation_starter = true
WHERE id = 'cedd9514-0b16-4081-b7f3-16ed16739360' AND category = 'Birthday';

-- Birthday Question 17: "What are you most proud of yourself for?" (your_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['pride', 'achievement', 'birthday'],
  mood_tags = ARRAY['proud', 'reflective'],
  is_conversation_starter = true
WHERE id = 'd66f0c68-c94c-431a-b691-801f19aff28d' AND category = 'Birthday';

-- Birthday Question 18: "What's your favorite story with {member_name}?" (their_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memories', 'friendship', 'birthday'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = 'e8b90151-f37c-47ad-a1b2-8c105d0a6216' AND category = 'Birthday';

-- Birthday Question 19: "What is a new thing you would love to try before your next birthday?" (your_birthday)
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['aspirations', 'new-experiences', 'birthday'],
  mood_tags = ARRAY['aspirational', 'excited'],
  is_conversation_starter = true
WHERE id = 'f1576e5a-5b59-437e-b77d-9e455b74ce99' AND category = 'Birthday';

-- Birthday Question 20: "If you could thank {member_name} for one specific thing what would it be?" (their_birthday)
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['gratitude', 'appreciation', 'birthday'],
  mood_tags = ARRAY['grateful', 'emotional'],
  is_conversation_starter = true
WHERE id = 'f75bda64-f50c-48d9-b922-94cc8c2fe414' AND category = 'Birthday';

-- Birthday Question 21: "What does or has {member_name} done that makes you proud to be their friend?" (their_birthday)
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['pride', 'friendship', 'birthday'],
  mood_tags = ARRAY['proud', 'warm'],
  is_conversation_starter = true
WHERE id = 'f786a4b9-ec31-49da-bc49-49986adde82f' AND category = 'Birthday';

-- Birthday Question 22: "What is something you hope you and {member_name} do together in the next year?" (their_birthday)
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'future',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['future', 'friendship', 'birthday'],
  mood_tags = ARRAY['hopeful', 'warm'],
  is_conversation_starter = true
WHERE id = 'f934e198-6c0a-4854-a197-d492a16b3b8b' AND category = 'Birthday';

