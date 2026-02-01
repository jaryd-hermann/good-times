-- Create marketing_stories table for educational content
-- Stores story slides that users can view in a carousel

CREATE TABLE IF NOT EXISTS marketing_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id TEXT NOT NULL, -- e.g., 'tips-asking', 'tips-answering', 'tips-getting-most'
  slide_number INTEGER NOT NULL CHECK (slide_number >= 1 AND slide_number <= 8),
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, slide_number) -- Ensure one slide per number per story
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_marketing_stories_story_id ON marketing_stories(story_id);
CREATE INDEX IF NOT EXISTS idx_marketing_stories_slide_number ON marketing_stories(slide_number);

-- Enable RLS
ALTER TABLE marketing_stories ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read marketing stories
CREATE POLICY "Anyone can read marketing stories"
  ON marketing_stories
  FOR SELECT
  USING (true);

-- Insert placeholder content for 3 stories
-- Story 1: Tips on asking questions
INSERT INTO marketing_stories (story_id, slide_number, headline, body) VALUES
('tips-asking', 1, 'You can ask questions too', 'Twice a week, someone in your group gets a chance to ask a question. This opportunity only lasts the day—if you skip it, it passes to someone else.'),
('tips-asking', 2, 'Show your name or stay anonymous', 'When it''s your turn, you can choose to show your name or keep it anonymous. Either way, everyone will answer your question!'),
('tips-asking', 3, 'Ask about what matters', 'The best questions are ones that get people thinking. Ask about things your group cares about—their interests, experiences, or opinions.'),
('tips-asking', 4, 'Keep it simple', 'A good question doesn''t need to be complicated. Sometimes the simplest questions spark the best conversations.'),
('tips-asking', 5, 'Make it personal', 'Questions that invite people to share personal stories or experiences often lead to deeper connections.'),
('tips-asking', 6, 'Be curious', 'Ask questions you genuinely want to know the answer to. Your curiosity will make others want to share.'),
('tips-asking', 7, 'Timing matters', 'If you see your chance to ask, take it! The opportunity moves to someone else if you wait.'),
('tips-asking', 8, 'Have fun with it', 'Good Times is all about bringing people closer. Don''t overthink it—just ask what you''re curious about!'),

-- Story 2: Tips on answering questions
('tips-answering', 1, 'Answer however you like', 'There''s no right or wrong way to answer. Use text, photos, videos, or voice—whatever feels natural to you.'),
('tips-answering', 2, 'Add photos and videos', 'A picture is worth a thousand words. Add photos or videos to bring your answer to life and show your personality.'),
('tips-answering', 3, 'Try video answers', 'Video answers let you tell a story naturally. Don''t worry about polish—just be yourself. Your group will love seeing the real you.'),
('tips-answering', 4, 'Use voice messages', 'Sometimes speaking feels easier than typing. Voice messages add personality and make people feel closer.'),
('tips-answering', 5, 'Be authentic', 'This isn''t social media—there''s no performance needed. Just share what you really think and feel.'),
('tips-answering', 6, 'Reply to others', 'The conversation doesn''t stop at your answer. Reply to what others said and keep the discussion going.'),
('tips-answering', 7, 'Take your time', 'There''s no rush. Answer when you have something meaningful to say, not just to check it off.'),
('tips-answering', 8, 'Enjoy the process', 'Answering questions is a chance to reflect and connect. Have fun with it and see where the conversation takes you!'),

-- Story 3: How to get the most out of Good Times
('tips-getting-most', 1, 'Set your interests', 'Tell Good Times what you''re into, and we''ll make sure the daily question is about something you care about.'),
('tips-getting-most', 2, 'Answer regularly', 'The more you answer, the more you''ll see what others said. Regular participation keeps the conversation flowing.'),
('tips-getting-most', 3, 'Create multiple groups', 'You can be in multiple groups—family, friends, different friend circles. Each group has its own space and vibe.'),
('tips-getting-most', 4, 'Use the weekly journal', 'Every Sunday, share a photo from your week. It''s a simple way to stay connected and see what everyone''s up to.'),
('tips-getting-most', 5, 'Add memorials', 'If your group has lost someone special, add them as a memorial. We''ll ask occasional questions about them to keep their memory alive.'),
('tips-getting-most', 6, 'Check your history', 'Scroll through your timeline to revisit past conversations. Use filters to find specific entries or topics.'),
('tips-getting-most', 7, 'Celebrate birthdays', 'When someone in your group has a birthday, add to their birthday card. It''s a meaningful way to show you care.'),
('tips-getting-most', 8, 'Make it a habit', 'Good Times works best when it becomes part of your daily routine. Just one question a day can bring you closer to the people you care about.');

-- Grant permissions
GRANT SELECT ON marketing_stories TO authenticated;
GRANT SELECT ON marketing_stories TO anon;

COMMENT ON TABLE marketing_stories IS 'Educational story slides shown in marketing carousel on home screen';
