-- Phase 2: Classify Family Questions Individually
-- This script analyzes each Family question individually and assigns classification attributes
-- based on the unique content of each question, not blanket category rules.
-- 
-- All 39 Family questions classified individually based on their unique content.
-- Family questions tend to be more emotionally weighted and deeper than Friends questions.

-- Family Question 1: "What's something you're proud of about {member_name}?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['pride', 'family', 'appreciation'],
  mood_tags = ARRAY['proud', 'warm'],
  is_conversation_starter = true
WHERE id = '00c7bb27-9b6b-41c5-8fcb-fd4f907f3d9f' AND category = 'Family';

-- Family Question 2: "What's a story you think none of us actually know?"
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
WHERE id = '05f397fd-1ab6-432d-a559-b293d9bc5984' AND category = 'Family';

-- Family Question 3: "What's your favorite simple way to show someone in the family you care?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['love', 'care', 'family-bonds'],
  mood_tags = ARRAY['warm', 'thoughtful'],
  is_conversation_starter = true
WHERE id = '12a9ea3a-9ec0-49d3-98e7-fb1589d405c4' AND category = 'Family';

-- Family Question 4: "What is something you appreciate more about family as you get older?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['wisdom', 'aging', 'family-values'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '17b1908c-a2e1-43c5-903b-9ddd8ed5f203' AND category = 'Family';

-- Family Question 5: "What's a hobby you've started recently?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 4,
  topics = ARRAY['hobbies', 'new-things', 'interests'],
  mood_tags = ARRAY['excited', 'enthusiastic'],
  is_conversation_starter = true
WHERE id = '2821f642-b28c-48be-b3c5-b8a27a712a81' AND category = 'Family';

-- Family Question 6: "How would you describe {member_name} to a stranger?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['character', 'family', 'appreciation'],
  mood_tags = ARRAY['warm', 'thoughtful'],
  is_conversation_starter = true
WHERE id = '2fba026f-f53f-4763-b317-b00d0c44c518' AND category = 'Family';

-- Family Question 7: "What's your favorite memory of us all together?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memories', 'family-bonding', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = '3246161d-5ed9-4733-b8d0-b897c6235ab9' AND category = 'Family';

-- Family Question 8: "When did {member_name} say something that stuck with you for a long time?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['wisdom', 'family', 'impact'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '34f7fe18-a6d7-4305-bfce-713170025e0c' AND category = 'Family';

-- Family Question 9: "What's a childhood photo you love?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['childhood', 'memories', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = '3ada0d0b-c74b-41fd-a7ce-7add243cf4c4' AND category = 'Family';

-- Family Question 10: "What's your favorite way to spend a lazy morning?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['comfort', 'routines', 'relaxation'],
  mood_tags = ARRAY['cozy', 'peaceful'],
  is_conversation_starter = true
WHERE id = '3d34df3c-48c2-4f7e-ab01-d9069df859f2' AND category = 'Family';

-- Family Question 11: "What is something you want to say to the family that you rarely say?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['vulnerability', 'communication', 'feelings'],
  mood_tags = ARRAY['vulnerable', 'emotional'],
  is_conversation_starter = true
WHERE id = '4794b520-d085-4833-83c6-28b9fdb3a982' AND category = 'Family';

-- Family Question 12: "What is something you are proud of that nobody sees on social media?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['pride', 'achievement', 'private'],
  mood_tags = ARRAY['proud', 'vulnerable'],
  is_conversation_starter = true
WHERE id = '4c7491e6-7030-4e75-b89e-b36f8c48596d' AND category = 'Family';

-- Family Question 13: "What's something you've been getting better at lately?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['growth', 'improvement', 'skills'],
  mood_tags = ARRAY['positive', 'proud'],
  is_conversation_starter = true
WHERE id = '624aafde-ee22-41b0-b1df-af98db9e513c' AND category = 'Family';

-- Family Question 14: "What is one of your earliest family memories?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['childhood', 'memories', 'family-history'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = '67183047-39e5-4fae-bbd9-7c7264f6f171' AND category = 'Family';

-- Family Question 15: "Which family story have you heard a million times but still love?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['stories', 'family-traditions', 'nostalgia'],
  mood_tags = ARRAY['warm', 'nostalgic'],
  is_conversation_starter = true
WHERE id = '6dd61b41-f76f-4d66-bddc-4b971768e392' AND category = 'Family';

-- Family Question 16: "What's something risky you did that didn't pan out how you expected?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['risk', 'failure', 'lessons'],
  mood_tags = ARRAY['reflective', 'resilient'],
  is_conversation_starter = true
WHERE id = '703a125e-d514-4b30-b2b8-b7c6a67a193d' AND category = 'Family';

-- Family Question 17: "What is your favorite photo of our family and why?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memories', 'family-bonding', 'photos'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = '714f05f2-9f54-4fbb-a175-6ad6ea8847eb' AND category = 'Family';

-- Family Question 18: "What's something you are sure we all agree on?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['unity', 'common-ground', 'family-values'],
  mood_tags = ARRAY['unifying', 'positive'],
  is_conversation_starter = true
WHERE id = '74217e13-8103-4973-b077-4a3e9651151a' AND category = 'Family';

-- Family Question 19: "What do you think {member_name}'s biggest strengh is?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['strengths', 'family', 'appreciation'],
  mood_tags = ARRAY['appreciative', 'warm'],
  is_conversation_starter = false
WHERE id = '7fe59321-c52d-4c8b-a63e-c825b67b1eb6' AND category = 'Family';

-- Family Question 20: "What decision are you trying to make at the moment?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['decisions', 'uncertainty', 'life'],
  mood_tags = ARRAY['thoughtful', 'vulnerable'],
  is_conversation_starter = true
WHERE id = '90e82fac-79d8-4f4f-b0f2-3d59ca991a84' AND category = 'Family';

-- Family Question 21: "What's a talent you think everyone in this group would agree you have...and one that you certainly don't?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['self-awareness', 'humor', 'talents'],
  mood_tags = ARRAY['self-aware', 'humorous'],
  is_conversation_starter = true
WHERE id = '94474a82-bd72-463d-a3e5-a0f77ddd8d1d' AND category = 'Family';

-- Family Question 22: "What was the best gift you ever got from us?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['gifts', 'appreciation', 'memories'],
  mood_tags = ARRAY['grateful', 'warm'],
  is_conversation_starter = true
WHERE id = 'a1cb2e9c-5396-4aa5-a7e5-d62c99024ac3' AND category = 'Family';

-- Family Question 23: "What made you feel loved in our family growing up?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['love', 'childhood', 'family-bonding'],
  mood_tags = ARRAY['emotional', 'grateful'],
  is_conversation_starter = true
WHERE id = 'a4668af4-018a-483c-b852-7932b80eab88' AND category = 'Family';

-- Family Question 24: "What's something about {member_name} you truly admire?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['admiration', 'family', 'appreciation'],
  mood_tags = ARRAY['appreciative', 'warm'],
  is_conversation_starter = true
WHERE id = 'a4dd66bc-e038-4910-b788-fc258c99e999' AND category = 'Family';

-- Family Question 25: "What's the last photo on your camera roll you actually love?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['photos', 'appreciation', 'sharing'],
  mood_tags = ARRAY['positive', 'sharing'],
  is_conversation_starter = true
WHERE id = 'a599aa89-a668-4a40-aa71-92f264fd4ae5' AND category = 'Family';

-- Family Question 26: "What's a habit you've picked up this year?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['habits', 'growth', 'change'],
  mood_tags = ARRAY['positive', 'reflective'],
  is_conversation_starter = true
WHERE id = 'ae3af757-cfdf-4f39-824a-fcb78c5613b1' AND category = 'Family';

-- Family Question 27: "What is a hard truth you learned from family?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['wisdom', 'lessons', 'family-values'],
  mood_tags = ARRAY['serious', 'reflective'],
  is_conversation_starter = true
WHERE id = 'ba408c1e-8f92-4944-bae0-b2e36bab5f43' AND category = 'Family';

-- Family Question 28: "What's something you've seen that changed your perspective on something in life?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['growth', 'perspective', 'life-lessons'],
  mood_tags = ARRAY['reflective', 'transformative'],
  is_conversation_starter = true
WHERE id = 'bdf57d77-3a4d-4c68-affe-f23208e74215' AND category = 'Family';

-- Family Question 29: "What do you think you'd see if you scrolled through {member_name}'s feed?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['observation', 'social-media', 'humor'],
  mood_tags = ARRAY['playful', 'observant'],
  is_conversation_starter = false
WHERE id = 'db031f3f-c450-4fcd-ad68-2ecc1ff17b4c' AND category = 'Family';

-- Family Question 30: "What's one thing you're looking forward to in the next week?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['future', 'excitement', 'anticipation'],
  mood_tags = ARRAY['excited', 'hopeful'],
  is_conversation_starter = true
WHERE id = 'dc9c1fdd-f024-401a-a209-9e6bf533003d' AND category = 'Family';

-- Family Question 31: "What's something we used to do that you miss?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['nostalgia', 'family-traditions', 'loss'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = 'dfe75c7c-8393-4fab-9cba-f40ba9308893' AND category = 'Family';

-- Family Question 32: "When did you feel proud of yourself in front of us?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['pride', 'achievement', 'family-validation'],
  mood_tags = ARRAY['proud', 'grateful'],
  is_conversation_starter = true
WHERE id = 'e2402d74-b468-41e6-9463-08fea06611fc' AND category = 'Family';

-- Family Question 33: "What's something seemingly small that happened in our family that actually had a big impact?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['memories', 'family-history', 'impact'],
  mood_tags = ARRAY['reflective', 'meaningful'],
  is_conversation_starter = true
WHERE id = 'ee439031-53da-4145-be86-4d57c60f2711' AND category = 'Family';

-- Family Question 34: "What's something super normal to us that others would find very odd?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['family-culture', 'uniqueness', 'humor'],
  mood_tags = ARRAY['playful', 'affectionate'],
  is_conversation_starter = true
WHERE id = 'ef70ffd7-c1dc-465c-84c7-613c18113f27' AND category = 'Family';

-- Family Question 35: "What's something that happened recently that surprised you?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['surprise', 'recent-events', 'life'],
  mood_tags = ARRAY['curious', 'reflective'],
  is_conversation_starter = true
WHERE id = 'f3b279cf-cc96-46a8-909f-0f88b6633ab1' AND category = 'Family';

-- Family Question 36: "What do you think is the hardest thing you've done?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['challenges', 'struggle', 'resilience'],
  mood_tags = ARRAY['serious', 'reflective'],
  is_conversation_starter = true
WHERE id = 'f4197614-0b3b-4394-8097-458956abed46' AND category = 'Family';

-- Family Question 37: "Share a story of you and {member_name}."
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memories', 'family-bonding', 'stories'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = 'f4f37290-f842-4d58-95ff-25bf3c2b07b4' AND category = 'Family';

-- Family Question 38: "What is one thing you hope never changes about our family?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['family-values', 'hope', 'permanence'],
  mood_tags = ARRAY['sentimental', 'hopeful'],
  is_conversation_starter = true
WHERE id = 'fd7425af-59c7-448b-b861-4f5c8b9e4ef6' AND category = 'Family';

-- Family Question 39: "What's something these past few months that's given you lots of pleasure and happiness?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 4,
  topics = ARRAY['happiness', 'joy', 'recent-events'],
  mood_tags = ARRAY['happy', 'grateful'],
  is_conversation_starter = true
WHERE id = 'ff8f923b-9f7b-418b-8462-f03ad5a83b57' AND category = 'Family';

