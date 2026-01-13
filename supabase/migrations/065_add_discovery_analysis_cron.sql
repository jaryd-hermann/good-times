-- Set up cron jobs for discovery system automation
-- Note: Requires pg_cron extension to be enabled
-- Enable with: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily analysis at 2 AM UTC
-- This promotes interests to inferred_interests when threshold is met
SELECT cron.schedule(
  'analyze-discovery-engagement',
  '0 2 * * *', -- Run at 2 AM UTC daily
  $$
  SELECT analyze_discovery_engagement();
  $$
);

-- Schedule weekly similarity recalculation at 3 AM UTC on Sundays
-- This keeps interest similarity data up-to-date as groups add/remove interests
SELECT cron.schedule(
  'recalculate-interest-similarities',
  '0 3 * * 0', -- Run at 3 AM UTC every Sunday
  $$
  SELECT calculate_interest_similarities();
  $$
);

-- To manually run:
-- SELECT analyze_discovery_engagement();
-- SELECT calculate_interest_similarities();

-- To unschedule:
-- SELECT cron.unschedule('analyze-discovery-engagement');
-- SELECT cron.unschedule('recalculate-interest-similarities');
