-- Phase 2: Classify Custom Questions Individually
-- This script analyzes each Custom question individually and assigns classification attributes
-- based on the unique content of each question, not blanket category rules.
-- 
-- All 81 Custom questions classified individually based on their unique content.
-- Custom questions are highly varied - some are light/fun, some are memorial-related, some are reflective.

-- Custom Question 1: "What's the most crazy thing you've done on purpose?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['adventure', 'risk', 'stories'],
  mood_tags = ARRAY['playful', 'bold'],
  is_conversation_starter = true
WHERE id = '00b98bad-d82f-464c-82be-201db1864f0f' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 2: "What tiny win are you proud of this week?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['wins', 'achievement', 'positivity'],
  mood_tags = ARRAY['positive', 'proud'],
  is_conversation_starter = true
WHERE id = '0393b564-fef7-4e13-97f2-7eab6b3e43a4' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 3: "What's the funniest overheard comment you've ever caught?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['humor', 'stories', 'observation'],
  mood_tags = ARRAY['humorous', 'playful'],
  is_conversation_starter = true
WHERE id = '067883c9-ee72-42c0-88af-b6bba88a2b7a' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 4: "Share a randomly chosen old photo & tell the story."
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['photos', 'memories', 'stories'],
  mood_tags = ARRAY['nostalgic', 'playful'],
  is_conversation_starter = true
WHERE id = '132164c8-ef41-44b9-8028-b9941b787b38' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 5: "What's one tiny thing you're looking forward to?"
UPDATE prompts SET
  depth_level = 1,
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
WHERE id = '1603929c-bb4e-4a2f-ae3d-3cd297ae0dc5' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 6: "What's your signature move on a night out?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['personality', 'nightlife', 'humor'],
  mood_tags = ARRAY['playful', 'confident'],
  is_conversation_starter = true
WHERE id = '175fa745-71f6-4fdd-9665-8294d6f7baaf' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 7: "Share a childhood photo if you have one."
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['childhood', 'memories', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = '184016f4-b47a-4310-bb8f-5eb4095ea9e4' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 8: "What snack defined your childhood?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['childhood', 'food', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'playful'],
  is_conversation_starter = true
WHERE id = '1bcf65ab-1fb8-41b0-b1bb-3cfe596109cf' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 9: "What's a value or lesson of {memorial_name}'s that you carry forward?"
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
WHERE id = '1f3fa5e7-85cb-4c2b-a209-3d653e60a6ce' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 10: "What's your current comfort show/food/song?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['medium'],
  clarity_level = 4,
  topics = ARRAY['comfort', 'media', 'current'],
  mood_tags = ARRAY['cozy', 'casual'],
  is_conversation_starter = true
WHERE id = '20740076-c1e6-47b9-baf8-940f9a5e156c' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 11: "What's something in your life today that exists because of {memorial_name}?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'influence', 'legacy'],
  mood_tags = ARRAY['grateful', 'emotional'],
  is_conversation_starter = true
WHERE id = '242b5d1b-1719-4f8d-8fad-5fe906fbf44c' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 12: "What's a photo you took that means more than it looks?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['photos', 'meaning', 'stories'],
  mood_tags = ARRAY['reflective', 'meaningful'],
  is_conversation_starter = true
WHERE id = '26607ea9-ca8b-4ea7-abc0-7d3f0f6b8514' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 13: "What's something small you fixed/improved recently?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['improvement', 'wins', 'practical'],
  mood_tags = ARRAY['positive', 'satisfied'],
  is_conversation_starter = true
WHERE id = '2bd57d3a-5a26-486a-811a-0b2e76a03821' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 14: "What was a scene of chaos? Share a photo or short video of it."
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['chaos', 'humor', 'memories'],
  mood_tags = ARRAY['humorous', 'nostalgic'],
  is_conversation_starter = true
WHERE id = '2d1b90a3-6415-453b-9162-9d844c4d8e82' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 15: "What was something {memorial_name} always said or did that you still hear in your head?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'sayings', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = '305d01a8-df37-4057-a6d2-0f33302f4a16' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 16: "What's something you value most in your friendships?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['friendship', 'values', 'relationships'],
  mood_tags = ARRAY['reflective', 'thoughtful'],
  is_conversation_starter = true
WHERE id = '35084137-855c-4b1d-aad5-2c07cfcdcf4c' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 17: "What's a moment {memorial_name} you're grateful you had?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'gratitude', 'memories'],
  mood_tags = ARRAY['grateful', 'emotional'],
  is_conversation_starter = true
WHERE id = '3515f7f0-6ce5-4752-bb23-8068b7bb63e2' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 18: "What's a trait you love in one of the people in this group?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['appreciation', 'group', 'traits'],
  mood_tags = ARRAY['warm', 'appreciative'],
  is_conversation_starter = true
WHERE id = '3655f448-c423-48fc-a879-e5e6444a5625' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 19: "What's something you appreciate more now than you did growing up?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['wisdom', 'aging', 'appreciation'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '36beb3d6-0d8d-4907-9603-232a2536df50' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 20: "What's a moment you wish you could relive once?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memories', 'wish', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'wistful'],
  is_conversation_starter = true
WHERE id = '36c66974-fbd7-4f72-a87f-8c54fba3012e' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 21: "What's something {memorial_name} loved that you now appreciate because of them?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'influence', 'appreciation'],
  mood_tags = ARRAY['grateful', 'emotional'],
  is_conversation_starter = true
WHERE id = '3735a135-f3b2-411e-a776-ed11a14f76a9' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 22: "What's a small decision that improved your life?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['decisions', 'improvement', 'life-lessons'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '378f9e2f-9ac6-43b6-a6e8-2d8d73083a32' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 23: "What's a small win from this week?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['wins', 'achievement', 'positivity'],
  mood_tags = ARRAY['positive', 'proud'],
  is_conversation_starter = true
WHERE id = '39213b05-ea7c-4cc0-8a1f-0af136cfda6e' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 24: "Share a photo of something that brings you joy for no reason"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['joy', 'appreciation', 'sharing'],
  mood_tags = ARRAY['happy', 'positive'],
  is_conversation_starter = true
WHERE id = '39bf142d-bb39-4135-be34-9de1f24b2b25' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 25: "Take a short video of a random corner in your place."
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['home', 'sharing', 'casual'],
  mood_tags = ARRAY['casual', 'present'],
  is_conversation_starter = true
WHERE id = '3e30fc69-c390-448b-a821-573a9818e792' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 26: "What's the best thing you ate this week?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['medium'],
  clarity_level = 4,
  topics = ARRAY['food', 'pleasure', 'sharing'],
  mood_tags = ARRAY['happy', 'casual'],
  is_conversation_starter = true
WHERE id = '4e097e63-0c4a-402f-a1e6-a39b2df4af67' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 27: "Share an old night-out pic you love."
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['memories', 'nightlife', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'playful'],
  is_conversation_starter = true
WHERE id = '520694fc-8e35-4cf7-8ab9-02af560e52c5' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 28: "Show your current weather or window view."
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['moment', 'location', 'sharing'],
  mood_tags = ARRAY['casual', 'present'],
  is_conversation_starter = true
WHERE id = '53d31ca0-717a-40de-8225-815359c61bda' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 29: "What's your most harmlessly controversial opinion?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['opinions', 'humor', 'discussion'],
  mood_tags = ARRAY['playful', 'bold'],
  is_conversation_starter = true
WHERE id = '53e7bcce-64be-4bb6-8afa-d7d4fc5eed5b' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 30: "What's a childhood comfort you still love?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['childhood', 'comfort', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'cozy'],
  is_conversation_starter = true
WHERE id = '575b0b3d-3b81-493d-8149-60832124203e' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 31: "What's one thing you'd change about your home instantly?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['home', 'preferences', 'wishes'],
  mood_tags = ARRAY['casual', 'thoughtful'],
  is_conversation_starter = true
WHERE id = '5a217453-4642-4b25-939e-8a1003add700' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 32: "Share an outfit/purchase others might judge but you stand by."
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['fashion', 'confidence', 'humor'],
  mood_tags = ARRAY['confident', 'playful'],
  is_conversation_starter = true
WHERE id = '5bb10cc2-fb73-43d1-80a1-5c94b8315173' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 33: "Share a photo that makes you feel nostalgic."
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['nostalgia', 'memories', 'photos'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = '5be6ca3a-76bb-49c3-9966-05cbfd086401' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 34: "What's a habit you want to build (and why)?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['habits', 'growth', 'aspiration'],
  mood_tags = ARRAY['aspirational', 'reflective'],
  is_conversation_starter = true
WHERE id = '639f50be-bb94-4c5a-8077-43872f97ef12' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 35: "What's your go-to drink order & what does it say about you?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['personality', 'preferences', 'humor'],
  mood_tags = ARRAY['playful', 'self-aware'],
  is_conversation_starter = true
WHERE id = '67eb755d-bc08-4d13-b2e2-7566fc6160b2' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 36: "What's the last moment you felt genuinely proud?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['pride', 'achievement', 'self-reflection'],
  mood_tags = ARRAY['proud', 'reflective'],
  is_conversation_starter = true
WHERE id = '6ce8fc3a-3473-47ad-b96a-848bac77b400' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 37: "Take a photo of whatever's in front of you right now."
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['moment', 'sharing', 'casual'],
  mood_tags = ARRAY['casual', 'present'],
  is_conversation_starter = true
WHERE id = '707fe58e-0548-41ed-b805-6a12e03d4e37' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 38: "What's a sound or smell that takes you back?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['senses', 'memories', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'emotional'],
  is_conversation_starter = true
WHERE id = '71811082-dc66-4187-90c0-53b820f1b78d' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 39: "Share a photo of your real workspace—no cleaning allowed."
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['workspace', 'humor', 'sharing'],
  mood_tags = ARRAY['playful', 'vulnerable'],
  is_conversation_starter = true
WHERE id = '72cb5c10-8ded-4f92-9071-2b615fcfd404' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 40: "What's a memory of {memorial_name} that still makes you smile?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 3,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'memories', 'joy'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = '7307c593-0ba7-42c4-a734-c315b2df384c' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 41: "What was your first job & what did it teach you?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['work', 'lessons', 'growth'],
  mood_tags = ARRAY['reflective', 'nostalgic'],
  is_conversation_starter = true
WHERE id = '74b274f9-6f5d-4f2b-8277-bee50a34d1f8' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 42: "Share a photo that represents your current season of life."
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['life-stage', 'reflection', 'photos'],
  mood_tags = ARRAY['reflective', 'thoughtful'],
  is_conversation_starter = true
WHERE id = '74e27951-8940-4743-95f7-203e7cfe2b70' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 43: "What's a photo that captures a turning point for you?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['turning-points', 'growth', 'photos'],
  mood_tags = ARRAY['reflective', 'meaningful'],
  is_conversation_starter = true
WHERE id = '7578278c-083e-4141-8b95-7e0c34fad84a' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 44: "What object do you own that has a story?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['objects', 'memories', 'stories'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = '794d2e9b-bfba-4d62-89c7-d35f256095e0' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 45: "What's a moment you suddenly felt like an adult?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['growth', 'maturity', 'self-awareness'],
  mood_tags = ARRAY['reflective', 'nostalgic'],
  is_conversation_starter = true
WHERE id = '7d7efadb-ff56-434c-a629-2b1bde4e9c5f' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 46: "What's something you didn't expect to matter to you as an adult?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['surprise', 'values', 'aging'],
  mood_tags = ARRAY['reflective', 'surprised'],
  is_conversation_starter = true
WHERE id = '8484738c-a284-4720-84fc-a049fafb02df' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 47: "What's a big life moment you didn't expect to matter?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['low'],
  clarity_level = 5,
  topics = ARRAY['life-moments', 'surprise', 'reflection'],
  mood_tags = ARRAY['reflective', 'thoughtful'],
  is_conversation_starter = true
WHERE id = '88657234-1b48-4627-9983-997b5a402582' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 48: "What's a goal you had in the past that makes you smile now?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['goals', 'nostalgia', 'humor'],
  mood_tags = ARRAY['nostalgic', 'amused'],
  is_conversation_starter = true
WHERE id = '8c2f2e9f-3ca7-4337-8102-5020db54ec43' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 49: "What's the coziest thing you've bought recently?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['medium'],
  clarity_level = 4,
  topics = ARRAY['comfort', 'purchases', 'coziness'],
  mood_tags = ARRAY['cozy', 'happy'],
  is_conversation_starter = true
WHERE id = '8edf6e35-8220-484f-999c-a2ad22db7048' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 50: "What trend needs to disappear forever?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['opinions', 'trends', 'humor'],
  mood_tags = ARRAY['playful', 'opinionated'],
  is_conversation_starter = true
WHERE id = '9d41bf8f-5675-4364-88e7-bc96a140d9d8' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 51: "What do you think {memorial_name} would be proud of in your life right now?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'pride', 'connection'],
  mood_tags = ARRAY['wistful', 'emotional'],
  is_conversation_starter = true
WHERE id = 'a6fe932b-bc62-43a0-8109-4407197a1653' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 52: "What's a silly memory that still makes you laugh?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['humor', 'memories', 'joy'],
  mood_tags = ARRAY['humorous', 'nostalgic'],
  is_conversation_starter = true
WHERE id = 'a8323a5a-f805-49dc-924e-3562f70af0bd' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 53: "What's the dumbest hill you'd die on?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['opinions', 'humor', 'stubbornness'],
  mood_tags = ARRAY['humorous', 'playful'],
  is_conversation_starter = true
WHERE id = 'abadd2d3-532e-46b9-9ecb-6e3901e9a58b' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 54: "What was your vibe 10 years ago vs now?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['growth', 'change', 'self-reflection'],
  mood_tags = ARRAY['reflective', 'nostalgic'],
  is_conversation_starter = true
WHERE id = 'abec65c0-0ccf-4caf-977a-f77781637ad3' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 55: "Share something that made today better."
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['gratitude', 'positivity', 'sharing'],
  mood_tags = ARRAY['grateful', 'positive'],
  is_conversation_starter = true
WHERE id = 'b5adcb8a-d284-42ef-929e-67702e958e1d' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 56: "Record a voice note telling a quick story about someone you admire."
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['admiration', 'stories', 'voice'],
  mood_tags = ARRAY['warm', 'appreciative'],
  is_conversation_starter = true
WHERE id = 'b7caa534-7f42-4c37-ac5b-88d6f46ad5a8' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 57: "Share a photo of a place tied to a big memory."
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['places', 'memories', 'meaning'],
  mood_tags = ARRAY['nostalgic', 'meaningful'],
  is_conversation_starter = true
WHERE id = 'ba42996e-d87e-4a55-8edf-2e43314dc2a4' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 58: "What's your most unserious personality trait?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['personality', 'humor', 'self-awareness'],
  mood_tags = ARRAY['humorous', 'self-aware'],
  is_conversation_starter = true
WHERE id = 'ba6fd862-7f47-4ebc-a1b4-0c97b3c92c12' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 59: "What's something that always calms you?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['self-care', 'calm', 'wellness'],
  mood_tags = ARRAY['peaceful', 'thoughtful'],
  is_conversation_starter = true
WHERE id = 'bf66d237-6207-4d72-a600-ad9db8d6c49e' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 60: "Who becomes the philosopher friend at 1 a.m.?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['group-dynamics', 'humor', 'personality'],
  mood_tags = ARRAY['humorous', 'playful'],
  is_conversation_starter = true
WHERE id = 'c27df0e3-5977-4943-8824-df29f9528554' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 61: "Who shaped you more than you realized at the time?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['influence', 'reflection', 'relationships'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = 'c42a5726-3fec-4266-9fc4-83e3c621acdd' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 62: "What's a popular thing you secretly think is overrated?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['opinions', 'criticism', 'humor'],
  mood_tags = ARRAY['playful', 'contrarian'],
  is_conversation_starter = true
WHERE id = 'c5b51930-1dff-4d3e-ad6f-7dad21a3ef9d' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 63: "What's a moment you recently felt cared for?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['care', 'relationships', 'gratitude'],
  mood_tags = ARRAY['grateful', 'warm'],
  is_conversation_starter = true
WHERE id = 'c78306a1-1aa7-498f-b3bd-7ed944213cb9' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 64: "What's something you do that feels illegal but isn't?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['humor', 'quirks', 'playfulness'],
  mood_tags = ARRAY['humorous', 'playful'],
  is_conversation_starter = true
WHERE id = 'ca82e04d-c3d6-4680-be12-d91cc6dd5cfc' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 65: "Record a voice note explaining a random memory triggered by a picture."
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['memories', 'storytelling', 'voice'],
  mood_tags = ARRAY['nostalgic', 'reflective'],
  is_conversation_starter = true
WHERE id = 'cafe3412-6cb5-4b95-9ab1-35e6eec50202' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 66: "What small thing made you smile recently?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['joy', 'positivity', 'gratitude'],
  mood_tags = ARRAY['happy', 'positive'],
  is_conversation_starter = true
WHERE id = 'cda11feb-4c05-4f97-aeb5-08b7be872763' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 67: "What's a small rule you always break?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['rules', 'humor', 'rebellion'],
  mood_tags = ARRAY['playful', 'rebellious'],
  is_conversation_starter = true
WHERE id = 'cee1874c-0d80-41ed-af90-9bce4f900ef1' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 68: "Share a photo or object that reminds you of {memorial_name}."
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'objects', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = 'd2ee6e33-c91d-4de8-862b-db0e08a0a04b' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 69: "Send a 5-second video doing a dramatic rant about something tiny."
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['humor', 'rant', 'video'],
  mood_tags = ARRAY['humorous', 'dramatic'],
  is_conversation_starter = true
WHERE id = 'dea36fd4-5635-45c6-a8b5-17d5bb8af6a5' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 70: "What's something you wish more people knew about you?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 4,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['vulnerability', 'self-expression', 'identity'],
  mood_tags = ARRAY['vulnerable', 'thoughtful'],
  is_conversation_starter = true
WHERE id = 'e12b611d-24be-4c89-8007-ccfe8985d181' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 71: "What's a game/toy you loved growing up?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['childhood', 'nostalgia', 'toys'],
  mood_tags = ARRAY['nostalgic', 'playful'],
  is_conversation_starter = true
WHERE id = 'e861a26f-3d4d-4b26-b106-f9521e69fd3b' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 72: "Share a photo that captures {memorial_name} perfectly in your eyes."
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'photos', 'memories'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = 'ed34552e-0545-4df4-9a2f-7668cb116286' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 73: "What's something someone said that stuck with you?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['wisdom', 'impact', 'words'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = 'eff8dc50-68dc-4da8-a0dc-3c1b30db56bb' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 74: "Show your favorite spot in your home."
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['home', 'comfort', 'sharing'],
  mood_tags = ARRAY['cozy', 'warm'],
  is_conversation_starter = true
WHERE id = 'f05c1370-3d91-43f0-bf1f-e7899dbaf1ec' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 75: "What's a feeling you're chasing more of lately?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['desires', 'emotions', 'aspiration'],
  mood_tags = ARRAY['reflective', 'aspirational'],
  is_conversation_starter = true
WHERE id = 'f5eae114-962a-4186-be71-047d1fb03aad' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 76: "Share a random photo from your camera roll with no context."
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['photos', 'humor', 'sharing'],
  mood_tags = ARRAY['playful', 'mysterious'],
  is_conversation_starter = true
WHERE id = 'f751dfa5-97e8-490d-874e-2ba9dbd6d612' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 77: "What's a little joy you think others underrate?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['joy', 'appreciation', 'wisdom'],
  mood_tags = ARRAY['thoughtful', 'positive'],
  is_conversation_starter = true
WHERE id = 'f87162e6-a390-42ae-ae10-24d4bab681f0' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 78: "What's one thing you learned about yourself recently?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['self-discovery', 'growth', 'reflection'],
  mood_tags = ARRAY['reflective', 'introspective'],
  is_conversation_starter = true
WHERE id = 'f891fe5f-8f85-4fd8-b62b-177ec3e3b3d8' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 79: "What's something you're currently working through?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 4,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['struggle', 'growth', 'vulnerability'],
  mood_tags = ARRAY['vulnerable', 'reflective'],
  is_conversation_starter = true
WHERE id = 'fa780710-9424-4677-b385-4602fed37e4c' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 80: "Send a vibe check video of your ideal night."
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['aspirations', 'fun', 'video'],
  mood_tags = ARRAY['aspirational', 'excited'],
  is_conversation_starter = true
WHERE id = 'fbd2d762-ba98-43c3-a6a6-0165e714fbbd' AND (category = 'Custom' OR category = 'Custom ');

-- Custom Question 81: "What's something {memorial_name} taught you that stuck?"
UPDATE prompts SET
  depth_level = 5,
  vulnerability_score = 4,
  emotional_weight = 'heavy',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['memorial', 'wisdom', 'influence'],
  mood_tags = ARRAY['grateful', 'meaningful'],
  is_conversation_starter = true
WHERE id = 'fe04a660-c7ac-48a0-a7e7-d1f1445a22b5' AND (category = 'Custom' OR category = 'Custom ');

