-- =============================================================================
-- The welcome push must only greet genuinely new people
-- =============================================================================
-- v2_on_first_push_token fires on any push_tokens insert, and its only guard was
-- "has this user ever been sent a v2_welcome". Existing users already hold a v1
-- Expo token, and upgrading to v2 writes a SECOND row for the OneSignal
-- subscription id — so all 30 of them would have been told "You're in — welcome
-- to Good Times. Answer your first question, and join your group." on upgrade,
-- despite having answered for months and already being in groups.
--
-- Note the discriminator is NOT "has no answers": v2 onboarding has people answer
-- the question BEFORE the notifications screen, so a brand new user already has an
-- answer by the time this fires. Predating the v2 cutover, or having any v1
-- entries, is what actually separates the two populations.
--
-- Verified in a rolled-back transaction: inserting a token for an established v1
-- user queues 0 welcome rows; doing the same for a new v2 signup queues 1.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.v2_on_first_push_token()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notification_queue nq
    WHERE nq.user_id = NEW.user_id AND nq.type = 'v2_welcome'
  ) THEN
    RETURN NEW;
  END IF;

  -- Anyone who predates v2, or who ever posted through v1, is an upgrading user
  -- rather than a new one.
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.user_id AND u.created_at < DATE '2026-08-01'
  ) OR EXISTS (
    SELECT 1 FROM public.entries e WHERE e.user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM public.v2_notify_now(
    NEW.user_id,
    'v2_welcome',
    'You''re in — welcome to Good Times',
    'Answer your first question, and join your group.',
    jsonb_build_object('type','v2_welcome'));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a welcome message block a token from being saved.
  RAISE WARNING 'v2_on_first_push_token failed for %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END $function$;
