-- =============================================================================
-- Move everyone still on 'dark' to 'light'
-- (applied via MCP as v2_backfill_theme_preference_to_light)
-- =============================================================================
-- The column defaulted to 'dark' for v1's dark-first design. Migration 117 changed
-- the default so new accounts start light but deliberately left existing rows
-- alone, because a chosen 'dark' is indistinguishable from an inherited one.
--
-- Done now on an explicit decision: v2 is light-first, 39 of the 41 predate the v2
-- cutover and were never asked, and anyone who wants dark can set it in Settings.
--
-- Reversible: the previous value is preserved in theme_preference_before_backfill
-- rather than being overwritten silently.
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS theme_preference_before_backfill text;

UPDATE public.users
SET theme_preference_before_backfill = theme_preference
WHERE theme_preference IS DISTINCT FROM 'light'
  AND theme_preference_before_backfill IS NULL;

UPDATE public.users
SET theme_preference = 'light'
WHERE theme_preference IS DISTINCT FROM 'light';
