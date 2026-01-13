-- Setup script to initialize the interest graph system
-- Run this AFTER migrations 060, 061, and 062

-- Step 1: Calculate initial interest similarities
-- This populates the interest_similarities table with co-occurrence data
SELECT calculate_interest_similarities();

-- Note: You should run calculate_interest_similarities() periodically (e.g., weekly)
-- to keep similarity data up-to-date as groups add/remove interests
