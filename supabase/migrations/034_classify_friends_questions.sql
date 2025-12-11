-- Phase 2: Classify Friends Questions Individually
-- This script analyzes each Friends question individually and assigns classification attributes
-- based on the unique content of each question, not blanket category rules.
-- 
-- All 97 Friends questions classified individually based on their unique content.

-- Friends Question 1: "What kind of work do you actually enjoy doing?"
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

-- Friends Question 11: "What's a habit or interest you picked up from someone in this group?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['friendship', 'influence', 'habits'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '1224297b-00cd-45de-83f1-0a874c7dad0a' AND category = 'Friends';

-- Friends Question 12: "What's a habit you've picked up this year?"
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
WHERE id = '12bb3fb8-6b69-4bbc-bf6c-e4fc87b633d3' AND category = 'Friends';

-- Friends Question 13: "If you walked into a party and saw {member_name} talking to someone, what are they talking about?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['friendship', 'observation', 'humor'],
  mood_tags = ARRAY['playful', 'observant'],
  is_conversation_starter = false
WHERE id = '157b6730-2335-4e2c-9dd5-c1ac4c95fda2' AND category = 'Friends';

-- Friends Question 14: "How would you describe {member_name} to a stranger?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['friendship', 'character', 'appreciation'],
  mood_tags = ARRAY['warm', 'thoughtful'],
  is_conversation_starter = true
WHERE id = '16bb2c1c-3213-422d-a64c-92c3f2083606' AND category = 'Friends';

-- Friends Question 15: "Share a picture of something in your home that has a story?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['memories', 'home', 'stories'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = '1879cdcc-1a5c-4c83-82f5-14ff4d0867a8' AND category = 'Friends';

-- Friends Question 16: "What's something that happened recently that surprised you?"
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
WHERE id = '1ad6088c-c99e-4654-aba7-6da268ae9d6f' AND category = 'Friends';

-- Friends Question 17: "What song instantly takes you back?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['music', 'memories', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'emotional'],
  is_conversation_starter = true
WHERE id = '1ca8bb48-f2d7-45ea-ae7a-334aa26a0a64' AND category = 'Friends';

-- Friends Question 18: "What's your top recommendation to the group at the moment?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['recommendations', 'sharing', 'interests'],
  mood_tags = ARRAY['helpful', 'enthusiastic'],
  is_conversation_starter = true
WHERE id = '1ee419c7-abad-4e66-ae61-1262775493db' AND category = 'Friends';

-- Friends Question 19: "Take a 5-second video of the view from where you're sitting right now?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['moment', 'location', 'sharing'],
  mood_tags = ARRAY['casual', 'present'],
  is_conversation_starter = true
WHERE id = '2484119c-9f50-4002-9fd9-eb1f70fc1f5a' AND category = 'Friends';

-- Friends Question 20: "What is something you hope this group still does in ten years?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'future',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['friendship', 'future', 'values'],
  mood_tags = ARRAY['hopeful', 'sentimental'],
  is_conversation_starter = true
WHERE id = '256d8704-f614-4a6a-b1d0-4f897813941e' AND category = 'Friends';

-- Friends Question 21: "What's something you're working towards people might be surprised to hear?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['goals', 'secrets', 'aspiration'],
  mood_tags = ARRAY['vulnerable', 'aspirational'],
  is_conversation_starter = true
WHERE id = '27d71256-6fcf-4b6e-a965-897644e68637' AND category = 'Friends';

-- Friends Question 22: "What's something you've seen that changed your perspective on something in life?"
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
WHERE id = '2b482e98-5437-4c85-be48-02ebe1a82d36' AND category = 'Friends';

-- Friends Question 23: "What's something you got brought that ended up being way more useful than you expected?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['medium'],
  clarity_level = 4,
  topics = ARRAY['purchases', 'surprise', 'utility'],
  mood_tags = ARRAY['grateful', 'surprised'],
  is_conversation_starter = true
WHERE id = '33903e7e-517b-4687-96fa-b3d76a4221e7' AND category = 'Friends';

-- Friends Question 24: "If you had to give a five minute TED talk with no prep what topic would you choose?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['expertise', 'passion', 'knowledge'],
  mood_tags = ARRAY['confident', 'enthusiastic'],
  is_conversation_starter = true
WHERE id = '3593f5d3-5313-4c54-bc1e-f770daeab204' AND category = 'Friends';

-- Friends Question 25: "What have you changed your mind about recently?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['growth', 'change', 'beliefs'],
  mood_tags = ARRAY['reflective', 'open-minded'],
  is_conversation_starter = true
WHERE id = '375ae68c-2c3e-40a7-b88a-b9ec866ca032' AND category = 'Friends';

-- Friends Question 26: "What lesson took you the longest to learn?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['wisdom', 'lessons', 'growth'],
  mood_tags = ARRAY['reflective', 'humble'],
  is_conversation_starter = true
WHERE id = '384126cf-fad2-4f7b-94c5-8c070b1aa573' AND category = 'Friends';

-- Friends Question 27: "What is something you want to say to this group that you rarely say?"
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
WHERE id = '38c05fe8-0602-4540-a34f-397aaf6741e7' AND category = 'Friends';

-- Friends Question 28: "What's something you pretend to know more about than you actually do?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['humor', 'self-awareness', 'pretending'],
  mood_tags = ARRAY['humorous', 'self-deprecating'],
  is_conversation_starter = true
WHERE id = '39377292-7c35-4670-87b8-64688d204f6f' AND category = 'Friends';

-- Friends Question 29: "What's your first memory of {member_name}?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['memories', 'friendship', 'first-impressions'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = '3a93175d-6e5b-456f-b1ff-6573167edfe2' AND category = 'Friends';

-- Friends Question 30: "What is something you admire about how {member_name} is living their life?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['admiration', 'friendship', 'values'],
  mood_tags = ARRAY['appreciative', 'warm'],
  is_conversation_starter = true
WHERE id = '3d7301c6-8624-4194-b0e8-d2f847b2fe89' AND category = 'Friends';

-- Friends Question 31: "What do you think is the hardest thing you've done?"
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
WHERE id = '4066397b-b653-462d-8a14-ff7622f841a0' AND category = 'Friends';

-- Friends Question 32: "What is {member_name} most qualified to give advice about?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['expertise', 'friendship', 'advice'],
  mood_tags = ARRAY['appreciative', 'playful'],
  is_conversation_starter = false
WHERE id = '480b11b6-912a-4d05-9547-178c8850993c' AND category = 'Friends';

-- Friends Question 33: "What's your 'I will die on this' hill opinion at the moment?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['opinions', 'stubbornness', 'humor'],
  mood_tags = ARRAY['passionate', 'humorous'],
  is_conversation_starter = true
WHERE id = '4b51d517-33d3-40b1-893e-ee06fb48b866' AND category = 'Friends';

-- Friends Question 34: "What's something you've started recently we don't know about?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['secrets', 'new-things', 'growth'],
  mood_tags = ARRAY['curious', 'excited'],
  is_conversation_starter = true
WHERE id = '4da7386c-8b1f-4a22-a1ad-c346da309c4b' AND category = 'Friends';

-- Friends Question 35: "What's a small win from this week you feel good about?"
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
WHERE id = '53391950-95b2-460b-8d9e-8fd83243fd09' AND category = 'Friends';

-- Friends Question 36: "When last did you make a fool of yourself?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['humor', 'embarrassment', 'stories'],
  mood_tags = ARRAY['humorous', 'self-deprecating'],
  is_conversation_starter = true
WHERE id = '56d8289e-99f9-4fe1-97d3-d245c6a49248' AND category = 'Friends';

-- Friends Question 37: "What is a time you and one of us got into trouble?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['memories', 'trouble', 'friendship'],
  mood_tags = ARRAY['nostalgic', 'playful'],
  is_conversation_starter = true
WHERE id = '5b7d8d26-1837-4262-b733-8265b1f7b75d' AND category = 'Friends';

-- Friends Question 38: "How did you first meet this group or your first friend here?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['origin-story', 'friendship', 'memories'],
  mood_tags = ARRAY['nostalgic', 'warm'],
  is_conversation_starter = true
WHERE id = '63ab1469-b99e-4851-be56-2e42a6998ee2' AND category = 'Friends';

-- Friends Question 39: "When did {member_name} say something that stuck with you for a long time?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['wisdom', 'friendship', 'impact'],
  mood_tags = ARRAY['grateful', 'reflective'],
  is_conversation_starter = true
WHERE id = '69b3ca81-fcf7-48a3-8604-462297baa058' AND category = 'Friends';

-- Friends Question 40: "What's the most played song on your Spotify right now?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['music', 'current', 'sharing'],
  mood_tags = ARRAY['casual', 'current'],
  is_conversation_starter = true
WHERE id = '7446b03d-93c2-4894-8641-0d721286b04f' AND category = 'Friends';

-- Friends Question 41: "Share the last photo you have on your phone of you and {member_name}?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 5,
  topics = ARRAY['memories', 'friendship', 'photos'],
  mood_tags = ARRAY['warm', 'nostalgic'],
  is_conversation_starter = true
WHERE id = '74655993-c2b3-4eb5-bb1c-7aae1b25a117' AND category = 'Friends';

-- Friends Question 42: "I've always wondered if it's normal to ..."
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['curiosity', 'normalcy', 'questions'],
  mood_tags = ARRAY['curious', 'vulnerable'],
  is_conversation_starter = true
WHERE id = '7852fc2c-1200-4d72-8a2d-ce39b4bc626f' AND category = 'Friends';

-- Friends Question 43: "What's something {member_name} does makes you laugh?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['humor', 'friendship', 'appreciation'],
  mood_tags = ARRAY['playful', 'warm'],
  is_conversation_starter = false
WHERE id = '7a612dbc-f4af-48e4-9825-25ecb267114a' AND category = 'Friends';

-- Friends Question 44: "What is a memory you wish you had on video?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 4,
  topics = ARRAY['memories', 'regret', 'nostalgia'],
  mood_tags = ARRAY['nostalgic', 'wistful'],
  is_conversation_starter = true
WHERE id = '7d03c5a6-44e2-4fea-8340-6c9e43248091' AND category = 'Friends';

-- Friends Question 45: "What's a life hack you've learned?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['tips', 'learning', 'practical'],
  mood_tags = ARRAY['helpful', 'practical'],
  is_conversation_starter = true
WHERE id = '7dc9408a-3f73-4acc-8ca7-70a7f9992ac0' AND category = 'Friends';

-- Friends Question 46: "What's a phone number you're glad you deleted?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['humor', 'relationships', 'relief'],
  mood_tags = ARRAY['humorous', 'relieved'],
  is_conversation_starter = true
WHERE id = '7ffdcd08-02a7-48dd-8cd8-b7f9adeaf0f2' AND category = 'Friends';

-- Friends Question 47: "What is a tradition you'd like to propose we start?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'future',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['traditions', 'future', 'group-bonding'],
  mood_tags = ARRAY['hopeful', 'thoughtful'],
  is_conversation_starter = true
WHERE id = '7ffeef7d-1c2d-4f0b-a334-ef8ca487b603' AND category = 'Friends';

-- Friends Question 48: "What's the last photo on your camera roll you actually love?"
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
WHERE id = '819cde05-c2ce-4af6-9c06-ec4d4b3ff6ff' AND category = 'Friends';

-- Friends Question 49: "Share some photos from your phone you like that people haven't seen"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['photos', 'sharing', 'secrets'],
  mood_tags = ARRAY['playful', 'sharing'],
  is_conversation_starter = true
WHERE id = '83598bce-1e42-4159-8f38-600d6e2fb0fb' AND category = 'Friends';

-- Friends Question 50: "When was the last time you suprised yourself?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['self-discovery', 'surprise', 'growth'],
  mood_tags = ARRAY['reflective', 'positive'],
  is_conversation_starter = true
WHERE id = '856dba41-3f52-4e23-b6fa-de52d6f957ca' AND category = 'Friends';

-- Friends Question 51: "When did {member_name} surprise you?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['surprise', 'friendship', 'memories'],
  mood_tags = ARRAY['grateful', 'warm'],
  is_conversation_starter = true
WHERE id = '876ee772-e5fe-4e49-b059-e2619fdd0edf' AND category = 'Friends';

-- Friends Question 52: "What's something this group does that makes you proud to be part of it?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['pride', 'group-values', 'appreciation'],
  mood_tags = ARRAY['proud', 'grateful'],
  is_conversation_starter = true
WHERE id = '8aad1a3e-5c25-4090-8c99-45355b4f3303' AND category = 'Friends';

-- Friends Question 53: "What's your Roman Empire?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['obsessions', 'humor', 'random-thoughts'],
  mood_tags = ARRAY['humorous', 'quirky'],
  is_conversation_starter = true
WHERE id = '8c0e45c7-ead2-4a0d-af16-9f2dabbbaedb' AND category = 'Friends';

-- Friends Question 54: "Share a video or voice note explaining something you're working on or excited about"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['projects', 'excitement', 'sharing'],
  mood_tags = ARRAY['enthusiastic', 'excited'],
  is_conversation_starter = true
WHERE id = '9156aec1-9a05-4227-8b2f-aeee44f58f84' AND category = 'Friends';

-- Friends Question 55: "What's something about {member_name} you truly admire?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['admiration', 'friendship', 'appreciation'],
  mood_tags = ARRAY['warm', 'appreciative'],
  is_conversation_starter = true
WHERE id = '9470373b-b2ef-43b0-88a3-9fd1b88ea3e2' AND category = 'Friends';

-- Friends Question 56: "What is a weirdly specific compliment someone once gave you?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['compliments', 'memories', 'humor'],
  mood_tags = ARRAY['warm', 'humorous'],
  is_conversation_starter = true
WHERE id = '976c2ddd-286c-4369-98e0-3b636bc54098' AND category = 'Friends';

-- Friends Question 57: "What's been the most fun you've had recently?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 4,
  topics = ARRAY['fun', 'recent-events', 'joy'],
  mood_tags = ARRAY['happy', 'positive'],
  is_conversation_starter = true
WHERE id = '9886e202-adba-48cd-a285-ab7473dfd066' AND category = 'Friends';

-- Friends Question 58: "What's something you did out of character you're glad for?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['growth', 'change', 'self-discovery'],
  mood_tags = ARRAY['proud', 'reflective'],
  is_conversation_starter = true
WHERE id = '9967ab95-9245-4307-aaa0-8df7b3e5c2ea' AND category = 'Friends';

-- Friends Question 59: "What's something silly you believed as a kid?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['childhood', 'humor', 'innocence'],
  mood_tags = ARRAY['humorous', 'nostalgic'],
  is_conversation_starter = true
WHERE id = '9b894385-b660-49b1-a3da-10a473e0dcd7' AND category = 'Friends';

-- Friends Question 60: "What is something you are proud of that nobody sees on social media?"
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
WHERE id = 'a8042a73-69d0-4d80-b42b-f4cd32675393' AND category = 'Friends';

-- Friends Question 61: "What's something you're irrational about?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['quirks', 'humor', 'self-awareness'],
  mood_tags = ARRAY['humorous', 'self-aware'],
  is_conversation_starter = true
WHERE id = 'a8cdd11d-b6f7-49ba-b882-cbee7e54b160' AND category = 'Friends';

-- Friends Question 62: "What's something you really should have said no to?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['regret', 'boundaries', 'lessons'],
  mood_tags = ARRAY['reflective', 'regretful'],
  is_conversation_starter = true
WHERE id = 'aacfd464-6b6d-4623-aa63-4c656ebf9e69' AND category = 'Friends';

-- Friends Question 63: "What the thing you're most competitive in?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['competition', 'personality', 'humor'],
  mood_tags = ARRAY['playful', 'competitive'],
  is_conversation_starter = true
WHERE id = 'ac0fd144-2bb6-40ed-b414-9d1837830fd2' AND category = 'Friends';

-- Friends Question 64: "What's the worst advice you've ever received?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['advice', 'humor', 'lessons'],
  mood_tags = ARRAY['humorous', 'reflective'],
  is_conversation_starter = true
WHERE id = 'afb51444-1f13-457f-987e-d49e67f8aa2f' AND category = 'Friends';

-- Friends Question 65: "What's your favorite way to spend a lazy morning?"
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
WHERE id = 'b32f1226-f2bc-4140-b015-0817a2af76d1' AND category = 'Friends';

-- Friends Question 66: "If you could instantly master one random skill what would it be?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['aspirations', 'skills', 'dreams'],
  mood_tags = ARRAY['aspirational', 'playful'],
  is_conversation_starter = true
WHERE id = 'b36b183c-0c2f-41d2-974c-1e7900764a36' AND category = 'Friends';

-- Friends Question 67: "What is something about you that only close friends know?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 4,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['secrets', 'vulnerability', 'intimacy'],
  mood_tags = ARRAY['vulnerable', 'trusting'],
  is_conversation_starter = true
WHERE id = 'b3bd5221-f44a-4df6-9f9f-c53af14f11b9' AND category = 'Friends';

-- Friends Question 68: "What's something these past few months that's given you lots of pleasure and happiness?"
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
WHERE id = 'b4b78361-3522-4b8c-8f55-09a0f3d8d634' AND category = 'Friends';

-- Friends Question 69: "What's something you've been interested in recently most here don't know?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['interests', 'secrets', 'curiosity'],
  mood_tags = ARRAY['curious', 'excited'],
  is_conversation_starter = true
WHERE id = 'b61844fd-1497-40e0-bd50-425d0855f98a' AND category = 'Friends';

-- Friends Question 70: "What completely ordinary thing are you weirdly competitive about?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['competition', 'humor', 'quirks'],
  mood_tags = ARRAY['humorous', 'playful'],
  is_conversation_starter = true
WHERE id = 'b6cf4ca6-e620-4fa2-ae56-92f585fc211a' AND category = 'Friends';

-- Friends Question 71: "What's something you've been getting better at lately?"
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
WHERE id = 'b8ca5b5e-26e8-49f1-8278-9465794a68af' AND category = 'Friends';

-- Friends Question 72: "What's something small that made your week better?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['gratitude', 'small-joys', 'positivity'],
  mood_tags = ARRAY['grateful', 'positive'],
  is_conversation_starter = true
WHERE id = 'b993f216-2549-4a6d-900d-091a167dc414' AND category = 'Friends';

-- Friends Question 73: "What's something you're sure we all agree on?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['unity', 'common-ground', 'group-bonding'],
  mood_tags = ARRAY['unifying', 'positive'],
  is_conversation_starter = true
WHERE id = 'c22eac19-6aea-4d52-adc3-3090ae005327' AND category = 'Friends';

-- Friends Question 74: "What's a hobby you've started recently?"
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
WHERE id = 'c4202bc4-5e68-426d-bbea-013ef8aca814' AND category = 'Friends';

-- Friends Question 75: "What's something you want to understand really well?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['learning', 'curiosity', 'aspiration'],
  mood_tags = ARRAY['curious', 'aspirational'],
  is_conversation_starter = true
WHERE id = 'c4faa22b-727a-43ec-82b0-4918aebc0302' AND category = 'Friends';

-- Friends Question 76: "Show us a photo of your cozy corner at home?"
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
WHERE id = 'c7a599e1-3110-42da-bb06-20e7d2d82372' AND category = 'Friends';

-- Friends Question 77: "What's one thing you're looking forward to in the next week?"
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
WHERE id = 'c8fbf5c8-d38a-4679-8f16-33cd74d5f96f' AND category = 'Friends';

-- Friends Question 78: "What's something so classically {member_name}"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['character', 'friendship', 'observation'],
  mood_tags = ARRAY['playful', 'affectionate'],
  is_conversation_starter = false
WHERE id = 'cb6d1da7-6067-4772-b682-92977358cdea' AND category = 'Friends';

-- Friends Question 79: "What is your go to small joy on a bad day?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['self-care', 'comfort', 'coping'],
  mood_tags = ARRAY['caring', 'thoughtful'],
  is_conversation_starter = true
WHERE id = 'cbf3e7f1-7218-4441-8ff6-7f35ec43da66' AND category = 'Friends';

-- Friends Question 80: "What's a recent 'small win' you had that most here don't know about?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['achievement', 'secrets', 'wins'],
  mood_tags = ARRAY['proud', 'modest'],
  is_conversation_starter = true
WHERE id = 'cd958167-0e72-4298-8881-fc65b305961d' AND category = 'Friends';

-- Friends Question 81: "Show the first photo in your camera roll. Explain"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['high'],
  clarity_level = 4,
  topics = ARRAY['photos', 'stories', 'memories'],
  mood_tags = ARRAY['nostalgic', 'playful'],
  is_conversation_starter = true
WHERE id = 'cdd77ac2-b7c7-435d-afef-b1a10a3c2f0c' AND category = 'Friends';

-- Friends Question 82: "What's a simple upgrade you made to your life recently?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['improvement', 'life-hacks', 'change'],
  mood_tags = ARRAY['positive', 'practical'],
  is_conversation_starter = true
WHERE id = 'cf8886ef-9f53-40fc-9f3a-f20bb0120c67' AND category = 'Friends';

-- Friends Question 83: "What do you think is your armchair expertise?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['expertise', 'opinions', 'humor'],
  mood_tags = ARRAY['humorous', 'self-aware'],
  is_conversation_starter = true
WHERE id = 'd2e8adc8-5d4e-403f-96a6-192d11c6a692' AND category = 'Friends';

-- Friends Question 84: "What are you currently obsessed with?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['medium'],
  clarity_level = 4,
  topics = ARRAY['obsessions', 'interests', 'current'],
  mood_tags = ARRAY['enthusiastic', 'excited'],
  is_conversation_starter = true
WHERE id = 'd44d9d7d-5700-4931-bb88-374c9c7256af' AND category = 'Friends';

-- Friends Question 85: "What decision are you trying to make at the moment?"
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
WHERE id = 'd79254d8-4758-46a5-8c33-6c665d1614cc' AND category = 'Friends';

-- Friends Question 86: "What's something you're proud of about {member_name}?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['pride', 'friendship', 'appreciation'],
  mood_tags = ARRAY['proud', 'warm'],
  is_conversation_starter = true
WHERE id = 'da93a4fd-14b2-4494-b72f-a2c0641beb6e' AND category = 'Friends';

-- Friends Question 87: "Who do you think is the most competitive in this group?"
UPDATE prompts SET
  depth_level = 1,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['competition', 'group-dynamics', 'humor'],
  mood_tags = ARRAY['playful', 'observant'],
  is_conversation_starter = true
WHERE id = 'dc929c7a-7ee0-4006-9811-9679e3a77490' AND category = 'Friends';

-- Friends Question 88: "What's a hot take you have right now?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['opinions', 'controversy', 'discussion'],
  mood_tags = ARRAY['bold', 'playful'],
  is_conversation_starter = true
WHERE id = 'dcf442b9-6eab-45a9-8481-3e4c383b8677' AND category = 'Friends';

-- Friends Question 89: "What's something risky you did that didn't pan out how you expected?"
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
WHERE id = 'e3446c42-f779-4349-a1dc-366c54e99406' AND category = 'Friends';

-- Friends Question 90: "What do you crave more of at the moment?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['desires', 'needs', 'self-awareness'],
  mood_tags = ARRAY['reflective', 'vulnerable'],
  is_conversation_starter = true
WHERE id = 'e77f4a67-1484-4fda-a43e-9dccb4c590d8' AND category = 'Friends';

-- Friends Question 91: "What is a quality you want to steal from each friend in this group?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'group',
  answer_length_expectation = 'long',
  media_affinity = ARRAY['none'],
  clarity_level = 5,
  topics = ARRAY['admiration', 'group-appreciation', 'values'],
  mood_tags = ARRAY['appreciative', 'warm'],
  is_conversation_starter = true
WHERE id = 'eb8f14e6-fc04-4991-9e41-d5a7a7afc00c' AND category = 'Friends';

-- Friends Question 92: "What do you think {member_name}'s biggest strengh is?"
UPDATE prompts SET
  depth_level = 3,
  vulnerability_score = 2,
  emotional_weight = 'moderate',
  time_orientation = 'present',
  focus_type = 'others',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['strengths', 'friendship', 'appreciation'],
  mood_tags = ARRAY['appreciative', 'warm'],
  is_conversation_starter = false
WHERE id = 'edfed058-d811-41aa-9366-f50114353ad8' AND category = 'Friends';

-- Friends Question 93: "What do you think you'd see if you scrolled through {member_name}'s feed?"
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
WHERE id = 'ef6cef2c-03c1-4650-9a57-83196f7a4330' AND category = 'Friends';

-- Friends Question 94: "What is something we used to do that you miss?"
UPDATE prompts SET
  depth_level = 4,
  vulnerability_score = 3,
  emotional_weight = 'moderate',
  time_orientation = 'past',
  focus_type = 'group',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['medium'],
  clarity_level = 5,
  topics = ARRAY['nostalgia', 'group-memories', 'loss'],
  mood_tags = ARRAY['nostalgic', 'sentimental'],
  is_conversation_starter = true
WHERE id = 'f47340d1-cf22-43d0-be89-9322571ed437' AND category = 'Friends';

-- Friends Question 95: "What's the dummest thing you remember doing?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'past',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['humor', 'mistakes', 'stories'],
  mood_tags = ARRAY['humorous', 'self-deprecating'],
  is_conversation_starter = true
WHERE id = 'f7452d70-d741-4e6c-911d-52fa3663023a' AND category = 'Friends';

-- Friends Question 96: "What's something you're grateful for today?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 1,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['gratitude', 'positivity', 'mindfulness'],
  mood_tags = ARRAY['grateful', 'positive'],
  is_conversation_starter = true
WHERE id = 'f95ae3a3-f58e-4a41-a9c4-dc1d8cdecf5d' AND category = 'Friends';

-- Friends Question 97: "What's a business you'd get into if nobody would judge you?"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'future',
  focus_type = 'self',
  answer_length_expectation = 'medium',
  media_affinity = ARRAY['none'],
  clarity_level = 4,
  topics = ARRAY['dreams', 'business', 'aspirations'],
  mood_tags = ARRAY['aspirational', 'playful'],
  is_conversation_starter = true
WHERE id = 'fcb1a4ea-fdc8-49d6-b0d7-fb3eda24abec' AND category = 'Friends';

-- Friends Question 98: "Tell us a quick 'update from your life' that you normally wouldn't think to share"
UPDATE prompts SET
  depth_level = 2,
  vulnerability_score = 2,
  emotional_weight = 'light',
  time_orientation = 'present',
  focus_type = 'self',
  answer_length_expectation = 'quick',
  media_affinity = ARRAY['low'],
  clarity_level = 4,
  topics = ARRAY['updates', 'sharing', 'life'],
  mood_tags = ARRAY['casual', 'open'],
  is_conversation_starter = true
WHERE id = 'ff844899-0dda-49e7-bbea-0663ebd81eec' AND category = 'Friends';
