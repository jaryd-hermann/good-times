-- Add function to increment swipe counts on prompts
-- This uses SECURITY DEFINER to bypass RLS, allowing updates to swipe count columns
CREATE OR REPLACE FUNCTION increment_prompt_swipe_count(
  p_prompt_id UUID,
  p_response TEXT
)
RETURNS VOID AS $$
DECLARE
  count_column TEXT;
BEGIN
  -- Determine which column to update
  IF p_response = 'yes' THEN
    count_column := 'yes_swipes_count';
  ELSIF p_response = 'no' THEN
    count_column := 'no_swipes_count';
  ELSE
    RAISE EXCEPTION 'Invalid response: %', p_response;
  END IF;

  -- Update the count using dynamic SQL
  EXECUTE format(
    'UPDATE prompts SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
    count_column,
    count_column
  ) USING p_prompt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_prompt_swipe_count(UUID, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION increment_prompt_swipe_count IS 'Increments yes_swipes_count or no_swipes_count for a prompt. Uses SECURITY DEFINER to bypass RLS.';

