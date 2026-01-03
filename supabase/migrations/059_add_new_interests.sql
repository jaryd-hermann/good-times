-- Add 3 new interests: History, Science & Engineering, Philosophy & Psychology

INSERT INTO interests (name, display_order) VALUES
  ('History', 19),
  ('Science & Engineering', 20),
  ('Philosophy & Psychology', 21)
ON CONFLICT (name) DO NOTHING;

