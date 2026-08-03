-- =============================================================================
-- BASELINE 01 — Extensions, tables, constraints, indexes, views
-- =============================================================================
-- Migrations 001-059 were never committed to this repo; the schema they built
-- existed only in the live database (project ytnnsykbgohiscfgomfe). This file
-- and its siblings (000_baseline_02..04) were generated from the live catalog
-- on 2026-08-01 so the migration chain can be reproduced from source.
--
-- Generated from pg_catalog, not pg_dump. Ordering within this file is:
--   extensions -> tables -> PK/UNIQUE/CHECK -> FOREIGN KEY -> indexes -> views
-- Foreign keys are applied after all tables exist, so table order is irrelevant.
--
-- This file is idempotent and safe to run against the existing database: every
-- statement is IF NOT EXISTS or guarded. It is intended to reproduce the schema
-- on a fresh environment, NOT to modify the live one.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";
-- supabase_vault@0.3.1 is managed by the platform; not recreated here.

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.birthday_card_entries (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  card_id uuid NOT NULL,
  contributor_user_id uuid NOT NULL,
  text_content text,
  media_urls text[],
  media_types text[],
  embedded_media jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.birthday_card_notifications (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  card_id uuid NOT NULL,
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  sent_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.birthday_card_views (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  card_id uuid NOT NULL,
  user_id uuid NOT NULL,
  viewed_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.birthday_cards (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  birthday_user_id uuid NOT NULL,
  birthday_date date NOT NULL,
  birthday_year integer NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  published_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.collections (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  description text,
  icon_url text,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text DEFAULT 'heart'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  entry_id uuid NOT NULL,
  user_id uuid NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  media_url text,
  media_type text
);

CREATE TABLE IF NOT EXISTS public.custom_question_rotation (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  date_assigned date NOT NULL,
  status text DEFAULT 'assigned'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_questions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  question text NOT NULL,
  is_anonymous boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  date_assigned date NOT NULL,
  date_asked date,
  prompt_id uuid,
  user_name text,
  group_name text,
  description text
);

CREATE TABLE IF NOT EXISTS public.daily_prompts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  deck_id uuid,
  is_discovery boolean DEFAULT false,
  discovery_interest text,
  engagement_score numeric
);

CREATE TABLE IF NOT EXISTS public.deck_activations (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  deck_id uuid NOT NULL,
  group_id uuid NOT NULL,
  activated_at timestamp with time zone DEFAULT now(),
  group_active_deck_id uuid
);

CREATE TABLE IF NOT EXISTS public.deck_classifications (
  deck_id uuid NOT NULL,
  depth_level integer,
  vulnerability_score integer,
  emotional_weight text,
  time_orientation text,
  focus_type text,
  media_affinity text[],
  deck_vibe_tags text[],
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.decks (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  collection_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  icon_url text,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discovery_attempts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  interest_name text NOT NULL,
  question_count integer DEFAULT 0,
  total_engagement_score numeric DEFAULT 0,
  last_tested_date date,
  status text DEFAULT 'testing'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  resend_id text,
  template_data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entries (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  date date NOT NULL,
  text_content text,
  media_urls text[],
  media_types text[],
  created_at timestamp with time zone DEFAULT now(),
  embedded_media jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  mentions uuid[] DEFAULT '{}'::uuid[],
  captions text[]
);

CREATE TABLE IF NOT EXISTS public.featured_prompts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  question text NOT NULL,
  description text,
  week_starting date NOT NULL,
  category text DEFAULT 'Featured'::text NOT NULL,
  display_order integer NOT NULL,
  suggested_by text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_active_decks (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  deck_id uuid NOT NULL,
  status text NOT NULL,
  requested_by uuid NOT NULL,
  activated_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_activity_tracking (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  first_member_joined_at timestamp with time zone,
  first_entry_date date,
  is_eligible_for_custom_questions boolean DEFAULT false,
  eligible_since timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_deck_votes (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  deck_id uuid NOT NULL,
  user_id uuid NOT NULL,
  vote text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_engagement_data (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  group_name text,
  group_members text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  total_prompts_asked integer DEFAULT 0,
  total_entries integer DEFAULT 0,
  member_count integer DEFAULT 0,
  avg_completion_rate double precision DEFAULT 0,
  avg_answer_length double precision DEFAULT 0,
  median_answer_length double precision DEFAULT 0,
  media_attachment_rate double precision DEFAULT 0,
  avg_hours_to_first_response double precision DEFAULT 0,
  avg_comments_per_entry double precision DEFAULT 0,
  entry_comment_rate double precision DEFAULT 0,
  last_engagement_date timestamp with time zone,
  last_prompt_date date
);

CREATE TABLE IF NOT EXISTS public.group_featured_question_count (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  week_starting date NOT NULL,
  count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_featured_questions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  featured_prompt_id uuid NOT NULL,
  added_by uuid NOT NULL,
  date_added timestamp with time zone DEFAULT now(),
  date_scheduled date,
  prompt_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_interests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  interest_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member'::text NOT NULL,
  joined_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_prompt_queue (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  added_by uuid NOT NULL,
  "position" integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_question_matches (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  matched_at timestamp with time zone DEFAULT now(),
  asked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_question_swipes (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  response text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_settings (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_songs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  url text NOT NULL,
  embed_id text NOT NULL,
  embed_type text,
  title text,
  artist text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  ice_breaker_queue_completed_date date,
  active_interests text[] DEFAULT '{}'::text[],
  interest_cycle_position integer DEFAULT 0,
  interest_cycle_interests text[] DEFAULT ARRAY[]::text[],
  inferred_interests text[] DEFAULT '{}'::text[],
  last_interest_used text
);

CREATE TABLE IF NOT EXISTS public.inactivity_notification_log (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  last_sent_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interest_similarities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  interest_name text NOT NULL,
  similar_interest text NOT NULL,
  co_occurrence_score numeric NOT NULL,
  calculated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  display_order integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invite_tokens (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  token text NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_stories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  story_id text NOT NULL,
  slide_number integer NOT NULL,
  headline text NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memorials (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  name text NOT NULL,
  photo_url text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  scheduled_time timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_email_schedule (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  sent boolean DEFAULT false,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prompt_name_usage (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  prompt_id uuid NOT NULL,
  variable_type text NOT NULL,
  name_used text NOT NULL,
  date_used date NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prompt_usage_stats (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  prompt_id uuid NOT NULL,
  group_id uuid NOT NULL,
  date date NOT NULL,
  group_size_at_time integer NOT NULL,
  answers_count integer DEFAULT 0,
  daily_prompt_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prompts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  question text NOT NULL,
  category text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  birthday_type text,
  dynamic_variables jsonb DEFAULT '[]'::jsonb,
  is_custom boolean DEFAULT false,
  custom_question_id uuid,
  ice_breaker boolean DEFAULT false,
  deck_id uuid,
  deck_order integer,
  featured_prompt_id uuid,
  total_asked_count integer DEFAULT 0,
  total_answered_count integer DEFAULT 0,
  global_completion_rate double precision,
  last_asked_date date,
  popularity_score double precision,
  ice_breaker_order integer,
  question_type text,
  description text,
  is_default boolean,
  deck text,
  interests text[] DEFAULT '{}'::text[]
);

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  token text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.question_category_preferences (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  group_id uuid NOT NULL,
  category text NOT NULL,
  preference text NOT NULL,
  weight numeric(3,2) DEFAULT 1.0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  entry_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text DEFAULT 'heart'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_interests (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  interest_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_songs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  url text NOT NULL,
  embed_id text NOT NULL,
  embed_type text,
  title text,
  artist text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_statuses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  status_text text NOT NULL,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  name text,
  birthday date,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  theme_preference text DEFAULT 'dark'::text,
  has_seen_custom_question_onboarding boolean DEFAULT false,
  app_tutorial_seen boolean DEFAULT false,
  active_interests text[] DEFAULT '{}'::text[],
  timezone text DEFAULT 'America/New_York'::text,
  notifications_enabled boolean DEFAULT true NOT NULL,
  daily_question_notifications_enabled boolean DEFAULT true NOT NULL
);

-- =============================================================================
-- PRIMARY KEYS
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
  ALTER TABLE public.birthday_card_entries ADD CONSTRAINT birthday_card_entries_pkey PRIMARY KEY (id);
  ALTER TABLE public.birthday_card_notifications ADD CONSTRAINT birthday_card_notifications_pkey PRIMARY KEY (id);
  ALTER TABLE public.birthday_card_views ADD CONSTRAINT birthday_card_views_pkey PRIMARY KEY (id);
  ALTER TABLE public.birthday_cards ADD CONSTRAINT birthday_cards_pkey PRIMARY KEY (id);
  ALTER TABLE public.collections ADD CONSTRAINT collections_pkey PRIMARY KEY (id);
  ALTER TABLE public.comment_reactions ADD CONSTRAINT comment_reactions_pkey PRIMARY KEY (id);
  ALTER TABLE public.comments ADD CONSTRAINT comments_pkey PRIMARY KEY (id);
  ALTER TABLE public.custom_question_rotation ADD CONSTRAINT custom_question_rotation_pkey PRIMARY KEY (id);
  ALTER TABLE public.custom_questions ADD CONSTRAINT custom_questions_pkey PRIMARY KEY (id);
  ALTER TABLE public.daily_prompts ADD CONSTRAINT daily_prompts_pkey PRIMARY KEY (id);
  ALTER TABLE public.deck_activations ADD CONSTRAINT deck_activations_pkey PRIMARY KEY (id);
  ALTER TABLE public.deck_classifications ADD CONSTRAINT deck_classifications_pkey PRIMARY KEY (deck_id);
  ALTER TABLE public.decks ADD CONSTRAINT decks_pkey PRIMARY KEY (id);
  ALTER TABLE public.discovery_attempts ADD CONSTRAINT discovery_attempts_pkey PRIMARY KEY (id);
  ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);
  ALTER TABLE public.entries ADD CONSTRAINT entries_pkey PRIMARY KEY (id);
  ALTER TABLE public.featured_prompts ADD CONSTRAINT featured_prompts_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_active_decks ADD CONSTRAINT group_active_decks_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_activity_tracking ADD CONSTRAINT group_activity_tracking_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_deck_votes ADD CONSTRAINT group_deck_votes_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_engagement_data ADD CONSTRAINT group_engagement_data_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_featured_question_count ADD CONSTRAINT group_featured_question_count_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_featured_questions ADD CONSTRAINT group_featured_questions_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_interests ADD CONSTRAINT group_interests_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_members ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_prompt_queue ADD CONSTRAINT group_prompt_queue_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_question_matches ADD CONSTRAINT group_question_matches_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_question_swipes ADD CONSTRAINT group_question_swipes_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_settings ADD CONSTRAINT group_settings_pkey PRIMARY KEY (id);
  ALTER TABLE public.group_songs ADD CONSTRAINT group_songs_pkey PRIMARY KEY (id);
  ALTER TABLE public.groups ADD CONSTRAINT groups_pkey PRIMARY KEY (id);
  ALTER TABLE public.inactivity_notification_log ADD CONSTRAINT inactivity_notification_log_pkey PRIMARY KEY (id);
  ALTER TABLE public.interest_similarities ADD CONSTRAINT interest_similarities_pkey PRIMARY KEY (id);
  ALTER TABLE public.interests ADD CONSTRAINT interests_pkey PRIMARY KEY (id);
  ALTER TABLE public.invite_tokens ADD CONSTRAINT invite_tokens_pkey PRIMARY KEY (id);
  ALTER TABLE public.marketing_stories ADD CONSTRAINT marketing_stories_pkey PRIMARY KEY (id);
  ALTER TABLE public.memorials ADD CONSTRAINT memorials_pkey PRIMARY KEY (id);
  ALTER TABLE public.notification_queue ADD CONSTRAINT notification_queue_pkey PRIMARY KEY (id);
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
  ALTER TABLE public.onboarding_email_schedule ADD CONSTRAINT onboarding_email_schedule_pkey PRIMARY KEY (id);
  ALTER TABLE public.prompt_name_usage ADD CONSTRAINT prompt_name_usage_pkey PRIMARY KEY (id);
  ALTER TABLE public.prompt_usage_stats ADD CONSTRAINT prompt_usage_stats_pkey PRIMARY KEY (id);
  ALTER TABLE public.prompts ADD CONSTRAINT prompts_pkey PRIMARY KEY (id);
  ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);
  ALTER TABLE public.question_category_preferences ADD CONSTRAINT question_category_preferences_pkey PRIMARY KEY (id);
  ALTER TABLE public.reactions ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);
  ALTER TABLE public.user_interests ADD CONSTRAINT user_interests_pkey PRIMARY KEY (id);
  ALTER TABLE public.user_songs ADD CONSTRAINT user_songs_pkey PRIMARY KEY (id);
  ALTER TABLE public.user_statuses ADD CONSTRAINT user_statuses_pkey PRIMARY KEY (id);
  ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL;
END $$;

-- =============================================================================
-- UNIQUE CONSTRAINTS
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE public.birthday_card_entries ADD CONSTRAINT birthday_card_entries_card_id_contributor_user_id_key UNIQUE (card_id, contributor_user_id);
  ALTER TABLE public.birthday_card_notifications ADD CONSTRAINT birthday_card_notifications_card_id_user_id_notification_ty_key UNIQUE (card_id, user_id, notification_type);
  ALTER TABLE public.birthday_card_views ADD CONSTRAINT birthday_card_views_card_id_user_id_key UNIQUE (card_id, user_id);
  ALTER TABLE public.birthday_cards ADD CONSTRAINT birthday_cards_group_id_birthday_user_id_birthday_date_key UNIQUE (group_id, birthday_user_id, birthday_date);
  ALTER TABLE public.comment_reactions ADD CONSTRAINT comment_reactions_comment_id_user_id_key UNIQUE (comment_id, user_id);
  ALTER TABLE public.custom_question_rotation ADD CONSTRAINT custom_question_rotation_group_id_user_id_week_start_date_key UNIQUE (group_id, user_id, week_start_date);
  ALTER TABLE public.custom_questions ADD CONSTRAINT custom_questions_group_id_date_assigned_key UNIQUE (group_id, date_assigned);
  ALTER TABLE public.deck_activations ADD CONSTRAINT deck_activations_deck_id_group_id_key UNIQUE (deck_id, group_id);
  ALTER TABLE public.discovery_attempts ADD CONSTRAINT discovery_attempts_group_id_interest_name_key UNIQUE (group_id, interest_name);
  ALTER TABLE public.group_active_decks ADD CONSTRAINT group_active_decks_group_id_deck_id_key UNIQUE (group_id, deck_id);
  ALTER TABLE public.group_activity_tracking ADD CONSTRAINT group_activity_tracking_group_id_key UNIQUE (group_id);
  ALTER TABLE public.group_deck_votes ADD CONSTRAINT group_deck_votes_group_id_deck_id_user_id_key UNIQUE (group_id, deck_id, user_id);
  ALTER TABLE public.group_engagement_data ADD CONSTRAINT group_engagement_data_group_id_key UNIQUE (group_id);
  ALTER TABLE public.group_featured_question_count ADD CONSTRAINT group_featured_question_count_group_id_week_starting_key UNIQUE (group_id, week_starting);
  ALTER TABLE public.group_featured_questions ADD CONSTRAINT group_featured_questions_group_id_featured_prompt_id_key UNIQUE (group_id, featured_prompt_id);
  ALTER TABLE public.group_interests ADD CONSTRAINT group_interests_group_id_interest_id_key UNIQUE (group_id, interest_id);
  ALTER TABLE public.group_members ADD CONSTRAINT group_members_group_id_user_id_key UNIQUE (group_id, user_id);
  ALTER TABLE public.group_question_matches ADD CONSTRAINT group_question_matches_group_id_prompt_id_key UNIQUE (group_id, prompt_id);
  ALTER TABLE public.group_question_swipes ADD CONSTRAINT group_question_swipes_user_id_group_id_prompt_id_key UNIQUE (user_id, group_id, prompt_id);
  ALTER TABLE public.group_settings ADD CONSTRAINT group_settings_group_id_key UNIQUE (group_id);
  ALTER TABLE public.group_songs ADD CONSTRAINT group_songs_group_id_platform_embed_id_key UNIQUE (group_id, platform, embed_id);
  ALTER TABLE public.inactivity_notification_log ADD CONSTRAINT inactivity_notification_log_user_id_group_id_key UNIQUE (user_id, group_id);
  ALTER TABLE public.interest_similarities ADD CONSTRAINT interest_similarities_interest_name_similar_interest_key UNIQUE (interest_name, similar_interest);
  ALTER TABLE public.interests ADD CONSTRAINT interests_name_key UNIQUE (name);
  ALTER TABLE public.invite_tokens ADD CONSTRAINT invite_tokens_token_key UNIQUE (token);
  ALTER TABLE public.marketing_stories ADD CONSTRAINT marketing_stories_story_id_slide_number_key UNIQUE (story_id, slide_number);
  ALTER TABLE public.onboarding_email_schedule ADD CONSTRAINT onboarding_email_schedule_user_id_email_type_key UNIQUE (user_id, email_type);
  ALTER TABLE public.prompt_name_usage ADD CONSTRAINT prompt_name_usage_unique_per_date UNIQUE (group_id, prompt_id, variable_type, date_used);
  ALTER TABLE public.prompt_usage_stats ADD CONSTRAINT prompt_usage_stats_daily_prompt_id_key UNIQUE (daily_prompt_id);
  ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_token_key UNIQUE (token);
  ALTER TABLE public.question_category_preferences ADD CONSTRAINT question_category_preferences_group_id_category_key UNIQUE (group_id, category);
  ALTER TABLE public.reactions ADD CONSTRAINT reactions_entry_id_user_id_key UNIQUE (entry_id, user_id);
  ALTER TABLE public.user_interests ADD CONSTRAINT user_interests_user_id_interest_id_key UNIQUE (user_id, interest_id);
  ALTER TABLE public.user_songs ADD CONSTRAINT user_songs_user_id_platform_embed_id_key UNIQUE (user_id, platform, embed_id);
  ALTER TABLE public.user_statuses ADD CONSTRAINT user_statuses_user_id_group_id_date_key UNIQUE (user_id, group_id, date);
  ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- CHECK CONSTRAINTS
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE public.birthday_card_notifications ADD CONSTRAINT birthday_card_notifications_notification_type_check CHECK ((notification_type = ANY (ARRAY['initial'::text, 'reminder'::text])));
  ALTER TABLE public.birthday_cards ADD CONSTRAINT birthday_cards_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'public'::text])));
  ALTER TABLE public.comments ADD CONSTRAINT comments_media_type_check CHECK ((media_type = ANY (ARRAY['photo'::text, 'video'::text, 'audio'::text])));
  ALTER TABLE public.custom_question_rotation ADD CONSTRAINT custom_question_rotation_status_check CHECK ((status = ANY (ARRAY['assigned'::text, 'completed'::text, 'skipped'::text])));
  ALTER TABLE public.custom_questions ADD CONSTRAINT custom_questions_question_check CHECK ((char_length(question) <= 200));
  ALTER TABLE public.deck_classifications ADD CONSTRAINT deck_classifications_depth_level_check CHECK (((depth_level >= 1) AND (depth_level <= 5)));
  ALTER TABLE public.deck_classifications ADD CONSTRAINT deck_classifications_emotional_weight_check CHECK ((emotional_weight = ANY (ARRAY['light'::text, 'moderate'::text, 'heavy'::text])));
  ALTER TABLE public.deck_classifications ADD CONSTRAINT deck_classifications_focus_type_check CHECK ((focus_type = ANY (ARRAY['self'::text, 'others'::text, 'group'::text, 'external'::text])));
  ALTER TABLE public.deck_classifications ADD CONSTRAINT deck_classifications_time_orientation_check CHECK ((time_orientation = ANY (ARRAY['past'::text, 'present'::text, 'future'::text, 'timeless'::text])));
  ALTER TABLE public.deck_classifications ADD CONSTRAINT deck_classifications_vulnerability_score_check CHECK (((vulnerability_score >= 1) AND (vulnerability_score <= 5)));
  ALTER TABLE public.discovery_attempts ADD CONSTRAINT discovery_attempts_status_check CHECK ((status = ANY (ARRAY['testing'::text, 'inferred'::text, 'rejected'::text])));
  ALTER TABLE public.group_active_decks ADD CONSTRAINT group_active_decks_status_check CHECK ((status = ANY (ARRAY['voting'::text, 'active'::text, 'rejected'::text, 'finished'::text])));
  ALTER TABLE public.group_deck_votes ADD CONSTRAINT group_deck_votes_vote_check CHECK ((vote = ANY (ARRAY['yes'::text, 'no'::text])));
  ALTER TABLE public.group_featured_question_count ADD CONSTRAINT group_featured_question_count_count_check CHECK (((count >= 0) AND (count <= 2)));
  ALTER TABLE public.group_members ADD CONSTRAINT group_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])));
  ALTER TABLE public.group_question_swipes ADD CONSTRAINT group_question_swipes_response_check CHECK ((response = ANY (ARRAY['yes'::text, 'no'::text])));
  ALTER TABLE public.group_songs ADD CONSTRAINT group_songs_platform_check CHECK ((platform = ANY (ARRAY['spotify'::text, 'soundcloud'::text])));
  ALTER TABLE public.groups ADD CONSTRAINT groups_type_check CHECK ((type = ANY (ARRAY['family'::text, 'friends'::text])));
  ALTER TABLE public.marketing_stories ADD CONSTRAINT marketing_stories_slide_number_check CHECK (((slide_number >= 1) AND (slide_number <= 8)));
  ALTER TABLE public.prompt_name_usage ADD CONSTRAINT prompt_name_usage_variable_type_check CHECK ((variable_type = ANY (ARRAY['memorial_name'::text, 'member_name'::text])));
  ALTER TABLE public.prompts ADD CONSTRAINT prompts_birthday_type_check CHECK ((birthday_type = ANY (ARRAY['your_birthday'::text, 'their_birthday'::text])));
  ALTER TABLE public.question_category_preferences ADD CONSTRAINT question_category_preferences_preference_check CHECK ((preference = ANY (ARRAY['more'::text, 'less'::text, 'none'::text])));
  ALTER TABLE public.user_songs ADD CONSTRAINT user_songs_platform_check CHECK ((platform = ANY (ARRAY['spotify'::text, 'soundcloud'::text])));
  ALTER TABLE public.user_statuses ADD CONSTRAINT user_statuses_status_text_check CHECK ((char_length(status_text) <= 200));
  ALTER TABLE public.users ADD CONSTRAINT users_theme_preference_check CHECK ((theme_preference = ANY (ARRAY['dark'::text, 'light'::text])));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- FOREIGN KEYS
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE public.birthday_card_entries ADD CONSTRAINT birthday_card_entries_card_id_fkey FOREIGN KEY (card_id) REFERENCES birthday_cards(id) ON DELETE CASCADE;
  ALTER TABLE public.birthday_card_entries ADD CONSTRAINT birthday_card_entries_contributor_user_id_fkey FOREIGN KEY (contributor_user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.birthday_card_notifications ADD CONSTRAINT birthday_card_notifications_card_id_fkey FOREIGN KEY (card_id) REFERENCES birthday_cards(id) ON DELETE CASCADE;
  ALTER TABLE public.birthday_card_notifications ADD CONSTRAINT birthday_card_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.birthday_card_views ADD CONSTRAINT birthday_card_views_card_id_fkey FOREIGN KEY (card_id) REFERENCES birthday_cards(id) ON DELETE CASCADE;
  ALTER TABLE public.birthday_card_views ADD CONSTRAINT birthday_card_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.birthday_cards ADD CONSTRAINT birthday_cards_birthday_user_id_fkey FOREIGN KEY (birthday_user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.birthday_cards ADD CONSTRAINT birthday_cards_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.comment_reactions ADD CONSTRAINT comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
  ALTER TABLE public.comment_reactions ADD CONSTRAINT comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.comments ADD CONSTRAINT comments_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;
  ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.custom_question_rotation ADD CONSTRAINT custom_question_rotation_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.custom_question_rotation ADD CONSTRAINT custom_question_rotation_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.custom_questions ADD CONSTRAINT custom_questions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.custom_questions ADD CONSTRAINT custom_questions_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE SET NULL;
  ALTER TABLE public.custom_questions ADD CONSTRAINT custom_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.daily_prompts ADD CONSTRAINT daily_prompts_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE SET NULL;
  ALTER TABLE public.daily_prompts ADD CONSTRAINT daily_prompts_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.daily_prompts ADD CONSTRAINT daily_prompts_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE;
  ALTER TABLE public.daily_prompts ADD CONSTRAINT daily_prompts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.deck_activations ADD CONSTRAINT deck_activations_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE;
  ALTER TABLE public.deck_activations ADD CONSTRAINT deck_activations_group_active_deck_id_fkey FOREIGN KEY (group_active_deck_id) REFERENCES group_active_decks(id) ON DELETE SET NULL;
  ALTER TABLE public.deck_activations ADD CONSTRAINT deck_activations_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.deck_classifications ADD CONSTRAINT deck_classifications_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE;
  ALTER TABLE public.decks ADD CONSTRAINT decks_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
  ALTER TABLE public.discovery_attempts ADD CONSTRAINT discovery_attempts_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.entries ADD CONSTRAINT entries_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.entries ADD CONSTRAINT entries_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE;
  ALTER TABLE public.entries ADD CONSTRAINT entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.group_active_decks ADD CONSTRAINT group_active_decks_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE;
  ALTER TABLE public.group_active_decks ADD CONSTRAINT group_active_decks_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_active_decks ADD CONSTRAINT group_active_decks_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.group_activity_tracking ADD CONSTRAINT group_activity_tracking_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_deck_votes ADD CONSTRAINT group_deck_votes_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE;
  ALTER TABLE public.group_deck_votes ADD CONSTRAINT group_deck_votes_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_deck_votes ADD CONSTRAINT group_deck_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.group_engagement_data ADD CONSTRAINT group_engagement_data_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_featured_question_count ADD CONSTRAINT group_featured_question_count_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_featured_questions ADD CONSTRAINT group_featured_questions_added_by_fkey FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.group_featured_questions ADD CONSTRAINT group_featured_questions_featured_prompt_id_fkey FOREIGN KEY (featured_prompt_id) REFERENCES featured_prompts(id) ON DELETE CASCADE;
  ALTER TABLE public.group_featured_questions ADD CONSTRAINT group_featured_questions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_featured_questions ADD CONSTRAINT group_featured_questions_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE SET NULL;
  ALTER TABLE public.group_interests ADD CONSTRAINT group_interests_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_interests ADD CONSTRAINT group_interests_interest_id_fkey FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE;
  ALTER TABLE public.group_members ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_members ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.group_prompt_queue ADD CONSTRAINT group_prompt_queue_added_by_fkey FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.group_prompt_queue ADD CONSTRAINT group_prompt_queue_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_prompt_queue ADD CONSTRAINT group_prompt_queue_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE;
  ALTER TABLE public.group_question_matches ADD CONSTRAINT group_question_matches_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_question_matches ADD CONSTRAINT group_question_matches_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE;
  ALTER TABLE public.group_question_swipes ADD CONSTRAINT group_question_swipes_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_question_swipes ADD CONSTRAINT group_question_swipes_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE;
  ALTER TABLE public.group_question_swipes ADD CONSTRAINT group_question_swipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.group_settings ADD CONSTRAINT group_settings_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_songs ADD CONSTRAINT group_songs_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.group_songs ADD CONSTRAINT group_songs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.groups ADD CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.inactivity_notification_log ADD CONSTRAINT inactivity_notification_log_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.inactivity_notification_log ADD CONSTRAINT inactivity_notification_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.invite_tokens ADD CONSTRAINT invite_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.invite_tokens ADD CONSTRAINT invite_tokens_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.memorials ADD CONSTRAINT memorials_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.memorials ADD CONSTRAINT memorials_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.notification_queue ADD CONSTRAINT notification_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.onboarding_email_schedule ADD CONSTRAINT onboarding_email_schedule_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.prompt_name_usage ADD CONSTRAINT prompt_name_usage_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.prompt_name_usage ADD CONSTRAINT prompt_name_usage_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE;
  ALTER TABLE public.prompt_usage_stats ADD CONSTRAINT prompt_usage_stats_daily_prompt_id_fkey FOREIGN KEY (daily_prompt_id) REFERENCES daily_prompts(id) ON DELETE CASCADE;
  ALTER TABLE public.prompt_usage_stats ADD CONSTRAINT prompt_usage_stats_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.prompt_usage_stats ADD CONSTRAINT prompt_usage_stats_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE;
  ALTER TABLE public.prompts ADD CONSTRAINT prompts_custom_question_id_fkey FOREIGN KEY (custom_question_id) REFERENCES custom_questions(id) ON DELETE SET NULL;
  ALTER TABLE public.prompts ADD CONSTRAINT prompts_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE SET NULL;
  ALTER TABLE public.prompts ADD CONSTRAINT prompts_featured_prompt_id_fkey FOREIGN KEY (featured_prompt_id) REFERENCES featured_prompts(id) ON DELETE SET NULL;
  ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.question_category_preferences ADD CONSTRAINT question_category_preferences_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.reactions ADD CONSTRAINT reactions_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE;
  ALTER TABLE public.reactions ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.user_interests ADD CONSTRAINT user_interests_interest_id_fkey FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE;
  ALTER TABLE public.user_interests ADD CONSTRAINT user_interests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.user_songs ADD CONSTRAINT user_songs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.user_statuses ADD CONSTRAINT user_statuses_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  ALTER TABLE public.user_statuses ADD CONSTRAINT user_statuses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- INDEXES (constraint-backing indexes are created by the constraints above)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_birthday_card_entries_card ON public.birthday_card_entries USING btree (card_id);
CREATE INDEX IF NOT EXISTS idx_birthday_card_entries_contributor ON public.birthday_card_entries USING btree (contributor_user_id);
CREATE INDEX IF NOT EXISTS idx_birthday_card_entries_created ON public.birthday_card_entries USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_birthday_card_notifications_card ON public.birthday_card_notifications USING btree (card_id);
CREATE INDEX IF NOT EXISTS idx_birthday_card_notifications_type ON public.birthday_card_notifications USING btree (notification_type);
CREATE INDEX IF NOT EXISTS idx_birthday_card_notifications_user ON public.birthday_card_notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_birthday_card_views_card ON public.birthday_card_views USING btree (card_id);
CREATE INDEX IF NOT EXISTS idx_birthday_card_views_user ON public.birthday_card_views USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_birthday_card_views_viewed_at ON public.birthday_card_views USING btree (viewed_at);
CREATE INDEX IF NOT EXISTS idx_birthday_cards_birthday_date ON public.birthday_cards USING btree (birthday_date);
CREATE INDEX IF NOT EXISTS idx_birthday_cards_birthday_user ON public.birthday_cards USING btree (birthday_user_id);
CREATE INDEX IF NOT EXISTS idx_birthday_cards_birthday_user_date ON public.birthday_cards USING btree (birthday_user_id, birthday_date);
CREATE INDEX IF NOT EXISTS idx_birthday_cards_group ON public.birthday_cards USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_birthday_cards_status ON public.birthday_cards USING btree (status);
CREATE INDEX IF NOT EXISTS idx_collections_order ON public.collections USING btree (display_order);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON public.comment_reactions USING btree (comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_entry ON public.comments USING btree (entry_id);
CREATE INDEX IF NOT EXISTS idx_rotation_group_week ON public.custom_question_rotation USING btree (group_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_rotation_status ON public.custom_question_rotation USING btree (status);
CREATE INDEX IF NOT EXISTS idx_rotation_user ON public.custom_question_rotation USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_custom_questions_date_asked ON public.custom_questions USING btree (date_asked);
CREATE INDEX IF NOT EXISTS idx_custom_questions_date_assigned ON public.custom_questions USING btree (date_assigned);
CREATE INDEX IF NOT EXISTS idx_custom_questions_group ON public.custom_questions USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_custom_questions_prompt ON public.custom_questions USING btree (prompt_id);
CREATE INDEX IF NOT EXISTS idx_custom_questions_user ON public.custom_questions USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS daily_prompts_group_date_user_unique ON public.daily_prompts USING btree (group_id, date, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_daily_prompts_deck ON public.daily_prompts USING btree (deck_id);
CREATE INDEX IF NOT EXISTS idx_daily_prompts_group_date ON public.daily_prompts USING btree (group_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_prompts_user ON public.daily_prompts USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_deck_activations_activated_at ON public.deck_activations USING btree (activated_at);
CREATE INDEX IF NOT EXISTS idx_deck_activations_deck ON public.deck_activations USING btree (deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_activations_group ON public.deck_activations USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_decks_collection_order ON public.decks USING btree (collection_id, display_order);
CREATE INDEX IF NOT EXISTS idx_discovery_attempts_group_interest ON public.discovery_attempts USING btree (group_id, interest_name);
CREATE INDEX IF NOT EXISTS idx_discovery_attempts_group_status ON public.discovery_attempts USING btree (group_id, status);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON public.email_logs USING btree (email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs USING btree (sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON public.email_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_email_type ON public.email_logs USING btree (user_id, email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_entries_group_date ON public.entries USING btree (group_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_mentions ON public.entries USING gin (mentions);
CREATE INDEX IF NOT EXISTS idx_entries_user ON public.entries USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_group_date ON public.entries USING btree (user_id, group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_featured_prompts_order ON public.featured_prompts USING btree (week_starting, display_order);
CREATE INDEX IF NOT EXISTS idx_featured_prompts_week ON public.featured_prompts USING btree (week_starting);
CREATE INDEX IF NOT EXISTS idx_group_active_decks_group_status ON public.group_active_decks USING btree (group_id, status);
CREATE INDEX IF NOT EXISTS idx_group_active_decks_status ON public.group_active_decks USING btree (status) WHERE (status = ANY (ARRAY['voting'::text, 'active'::text]));
CREATE INDEX IF NOT EXISTS idx_activity_eligible ON public.group_activity_tracking USING btree (is_eligible_for_custom_questions);
CREATE INDEX IF NOT EXISTS idx_activity_group ON public.group_activity_tracking USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_deck_votes_group_deck ON public.group_deck_votes USING btree (group_id, deck_id);
CREATE INDEX IF NOT EXISTS idx_group_engagement_data_group_id ON public.group_engagement_data USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_featured_count_group_week ON public.group_featured_question_count USING btree (group_id, week_starting);
CREATE INDEX IF NOT EXISTS idx_group_featured_added_by ON public.group_featured_questions USING btree (added_by);
CREATE INDEX IF NOT EXISTS idx_group_featured_group ON public.group_featured_questions USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_featured_prompt ON public.group_featured_questions USING btree (featured_prompt_id);
CREATE INDEX IF NOT EXISTS idx_group_featured_scheduled ON public.group_featured_questions USING btree (date_scheduled);
CREATE INDEX IF NOT EXISTS idx_group_interests_group_id ON public.group_interests USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_interests_interest_id ON public.group_interests USING btree (interest_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_group_matches_asked ON public.group_question_matches USING btree (group_id, asked) WHERE (asked = false);
CREATE INDEX IF NOT EXISTS idx_group_matches_group ON public.group_question_matches USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_matches_prompt ON public.group_question_matches USING btree (prompt_id);
CREATE INDEX IF NOT EXISTS idx_group_swipes_group_prompt ON public.group_question_swipes USING btree (group_id, prompt_id);
CREATE INDEX IF NOT EXISTS idx_group_swipes_prompt_response ON public.group_question_swipes USING btree (prompt_id, response);
CREATE INDEX IF NOT EXISTS idx_group_swipes_user_group ON public.group_question_swipes USING btree (user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_group_settings_group ON public.group_settings USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_songs_group ON public.group_songs USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_group_songs_platform ON public.group_songs USING btree (platform);
CREATE INDEX IF NOT EXISTS idx_group_songs_user ON public.group_songs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_groups_ice_breaker_completed ON public.groups USING btree (ice_breaker_queue_completed_date);
CREATE INDEX IF NOT EXISTS idx_inactivity_log_last_sent ON public.inactivity_notification_log USING btree (last_sent_at);
CREATE INDEX IF NOT EXISTS idx_inactivity_log_user_group ON public.inactivity_notification_log USING btree (user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_interest_similarities_interest ON public.interest_similarities USING btree (interest_name);
CREATE INDEX IF NOT EXISTS idx_interest_similarities_score ON public.interest_similarities USING btree (interest_name, co_occurrence_score DESC);
CREATE INDEX IF NOT EXISTS idx_interests_name ON public.interests USING btree (name);
CREATE INDEX IF NOT EXISTS idx_marketing_stories_slide_number ON public.marketing_stories USING btree (slide_number);
CREATE INDEX IF NOT EXISTS idx_marketing_stories_story_id ON public.marketing_stories USING btree (story_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_time ON public.notification_queue USING btree (scheduled_time) WHERE ((processed = false) AND (scheduled_time IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications USING btree (user_id, read);
CREATE INDEX IF NOT EXISTS idx_onboarding_email_schedule_scheduled ON public.onboarding_email_schedule USING btree (scheduled_for) WHERE (sent = false);
CREATE INDEX IF NOT EXISTS idx_onboarding_email_schedule_sent ON public.onboarding_email_schedule USING btree (sent, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_onboarding_email_schedule_user ON public.onboarding_email_schedule USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_schedule_pending ON public.onboarding_email_schedule USING btree (scheduled_for, sent) WHERE (sent = false);
CREATE INDEX IF NOT EXISTS idx_onboarding_schedule_scheduled_for ON public.onboarding_email_schedule USING btree (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_onboarding_schedule_user_id ON public.onboarding_email_schedule USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_name_usage_group_date ON public.prompt_name_usage USING btree (group_id, date_used);
CREATE INDEX IF NOT EXISTS idx_prompt_name_usage_prompt_variable ON public.prompt_name_usage USING btree (prompt_id, variable_type);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_stats_date ON public.prompt_usage_stats USING btree (date);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_stats_group ON public.prompt_usage_stats USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_stats_prompt ON public.prompt_usage_stats USING btree (prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_stats_prompt_date ON public.prompt_usage_stats USING btree (prompt_id, date);
CREATE INDEX IF NOT EXISTS idx_prompts_birthday_type ON public.prompts USING btree (birthday_type) WHERE (birthday_type IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prompts_category_birthday ON public.prompts USING btree (category, birthday_type);
CREATE INDEX IF NOT EXISTS idx_prompts_deck ON public.prompts USING btree (deck_id);
CREATE INDEX IF NOT EXISTS idx_prompts_deck_order ON public.prompts USING btree (deck_id, deck_order) WHERE (deck_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prompts_featured ON public.prompts USING btree (featured_prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompts_ice_breaker ON public.prompts USING btree (ice_breaker) WHERE (ice_breaker = true);
CREATE INDEX IF NOT EXISTS idx_prompts_ice_breaker_category ON public.prompts USING btree (ice_breaker, category) WHERE (ice_breaker = true);
CREATE INDEX IF NOT EXISTS idx_prompts_ice_breaker_order ON public.prompts USING btree (ice_breaker_order) WHERE (ice_breaker_order IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prompts_ice_breaker_ordered ON public.prompts USING btree (ice_breaker_order) WHERE ((ice_breaker = true) AND (ice_breaker_order IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_prompts_popularity_score ON public.prompts USING btree (popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_standard_category ON public.prompts USING btree (category) WHERE (category = 'Standard'::text);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_question_preferences_category ON public.question_category_preferences USING btree (category);
CREATE INDEX IF NOT EXISTS idx_question_preferences_group ON public.question_category_preferences USING btree (group_id);
CREATE INDEX IF NOT EXISTS idx_reactions_entry ON public.reactions USING btree (entry_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_interest_id ON public.user_interests USING btree (interest_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON public.user_interests USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_songs_platform ON public.user_songs USING btree (platform);
CREATE INDEX IF NOT EXISTS idx_user_songs_user ON public.user_songs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_statuses_date ON public.user_statuses USING btree (date);
CREATE INDEX IF NOT EXISTS idx_user_statuses_group_date ON public.user_statuses USING btree (group_id, date);
CREATE INDEX IF NOT EXISTS idx_user_statuses_user_group_date ON public.user_statuses USING btree (user_id, group_id, date);

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW public.groups_needing_queue_init AS
  SELECT g.id,
    g.name,
    g.type,
    g.created_at,
    count(dp.id) AS prompt_count_last_7_days
   FROM (groups g
     LEFT JOIN daily_prompts dp ON (((dp.group_id = g.id) AND (dp.date >= (CURRENT_DATE - '7 days'::interval)) AND (dp.user_id IS NULL))))
  GROUP BY g.id, g.name, g.type, g.created_at
 HAVING (count(dp.id) = 0);

-- =============================================================================
-- TABLE COMMENTS
-- =============================================================================

COMMENT ON TABLE public.app_settings IS 'Application settings for cron jobs and other server-side operations';
COMMENT ON TABLE public.birthday_card_entries IS 'Individual contributions to birthday cards. One entry per contributor per card.';
COMMENT ON TABLE public.birthday_card_notifications IS 'Tracks notification status for birthday card contributors.';
COMMENT ON TABLE public.birthday_card_views IS 'Tracks when users view/open their birthday cards';
COMMENT ON TABLE public.birthday_cards IS 'Tracks birthday card metadata and status. One card per user per birthday per group.';
COMMENT ON TABLE public.collections IS 'Question collections that contain multiple decks';
COMMENT ON TABLE public.deck_activations IS 'Tracks deck activations by groups for counting unique group activations per deck';
COMMENT ON TABLE public.decks IS 'Question decks/packs that groups can vote on and activate';
COMMENT ON TABLE public.email_logs IS 'Logs of all emails sent through the system';
COMMENT ON TABLE public.group_active_decks IS 'Tracks which decks are active, voting, rejected, or finished for each group';
COMMENT ON TABLE public.group_deck_votes IS 'Individual votes cast by group members on decks';
COMMENT ON TABLE public.group_question_matches IS 'Tracks matched questions (2+ yes swipes) per group';
COMMENT ON TABLE public.group_question_swipes IS 'Tracks individual user swipes on questions per group';
COMMENT ON TABLE public.marketing_stories IS 'Educational story slides shown in marketing carousel on home screen';
COMMENT ON TABLE public.onboarding_email_schedule IS 'Tracks scheduled onboarding emails for new users';
COMMENT ON TABLE public.prompt_name_usage IS 'Tracks which names have been used for dynamic variables in prompts to ensure fair rotation';
COMMENT ON TABLE public.prompt_usage_stats IS 'Tracks prompt usage: how many times prompts are asked (group size) and answered';
