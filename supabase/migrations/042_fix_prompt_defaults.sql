-- Migration: Fix is_default values for existing prompts
-- Set is_default = true for prompts that should be available for suggestions
-- (exclude custom prompts and training prompts)

-- Set is_default = true for all prompts that:
-- 1. Are not custom prompts (category != 'Custom')
-- 2. Are not training prompts (is_training != true)
-- 3. Are not explicitly set to false
UPDATE prompts
SET is_default = true
WHERE (is_default IS NULL OR is_default = false)
  AND category != 'Custom'
  AND (is_training IS NULL OR is_training = false);

-- Verify the update
SELECT 
  category,
  COUNT(*) as total,
  COUNT(CASE WHEN is_default = true THEN 1 END) as is_default_true,
  COUNT(CASE WHEN is_default = false THEN 1 END) as is_default_false,
  COUNT(CASE WHEN is_default IS NULL THEN 1 END) as is_default_null
FROM prompts
GROUP BY category
ORDER BY category;

