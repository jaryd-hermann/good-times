-- =============================================================================
-- BASELINE 04 — Row Level Security and policies
-- =============================================================================
-- Generated from the live catalog of project ytnnsykbgohiscfgomfe on 2026-08-01.
-- Migrations 001-059 were never committed; this reconstructs what they built.
-- 35 of 51 tables have RLS enabled; 95 policies.
-- NOTE: 16 tables deliberately have RLS DISABLED in production (users, groups,
-- group_members, entries, comments, reactions, notification_queue, app_settings and
-- others). That is a known accepted risk, not an omission from this file.
-- See docs/V2_PLAN.md section 12.
-- =============================================================================

ALTER TABLE public.birthday_card_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_card_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_card_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_question_rotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_active_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_activity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_deck_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_engagement_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_featured_question_count ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_featured_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_prompt_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_question_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_question_swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inactivity_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_name_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contributors can insert entries" ON public.birthday_card_entries;
CREATE POLICY "Contributors can insert entries" ON public.birthday_card_entries AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((contributor_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM birthday_cards
  WHERE ((birthday_cards.id = birthday_card_entries.card_id) AND (birthday_cards.status = 'draft'::text))))));

DROP POLICY IF EXISTS "Contributors can update their entries" ON public.birthday_card_entries;
CREATE POLICY "Contributors can update their entries" ON public.birthday_card_entries AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((contributor_user_id = auth.uid())) WITH CHECK ((contributor_user_id = auth.uid()));

DROP POLICY IF EXISTS "Contributors can view their entries" ON public.birthday_card_entries;
CREATE POLICY "Contributors can view their entries" ON public.birthday_card_entries AS PERMISSIVE FOR SELECT TO PUBLIC USING (((contributor_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM birthday_cards
  WHERE ((birthday_cards.id = birthday_card_entries.card_id) AND (birthday_cards.birthday_user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.birthday_card_notifications;
CREATE POLICY "Service role can insert notifications" ON public.birthday_card_notifications AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their notifications" ON public.birthday_card_notifications;
CREATE POLICY "Users can view their notifications" ON public.birthday_card_notifications AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can track card views" ON public.birthday_card_views;
CREATE POLICY "Service role can track card views" ON public.birthday_card_views AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);

DROP POLICY IF EXISTS "Users can track their card views" ON public.birthday_card_views;
CREATE POLICY "Users can track their card views" ON public.birthday_card_views AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM birthday_cards
  WHERE ((birthday_cards.id = birthday_card_views.card_id) AND (birthday_cards.birthday_user_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can view their card views" ON public.birthday_card_views;
CREATE POLICY "Users can view their card views" ON public.birthday_card_views AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Birthday person can make card public" ON public.birthday_cards;
CREATE POLICY "Birthday person can make card public" ON public.birthday_cards AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((birthday_user_id = auth.uid())) WITH CHECK ((birthday_user_id = auth.uid()));

DROP POLICY IF EXISTS "Group members can view birthday cards" ON public.birthday_cards;
CREATE POLICY "Group members can view birthday cards" ON public.birthday_cards AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = birthday_cards.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Service role can update birthday cards" ON public.birthday_cards;
CREATE POLICY "Service role can update birthday cards" ON public.birthday_cards AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view collections" ON public.collections;
CREATE POLICY "Anyone can view collections" ON public.collections AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Users can delete their own comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can delete their own comment reactions" ON public.comment_reactions AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert their own comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can insert their own comment reactions" ON public.comment_reactions AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can update their own comment reactions" ON public.comment_reactions AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can view comment reactions" ON public.comment_reactions AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Users can view rotation for their groups" ON public.custom_question_rotation;
CREATE POLICY "Users can view rotation for their groups" ON public.custom_question_rotation AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can create custom questions" ON public.custom_questions;
CREATE POLICY "Users can create custom questions" ON public.custom_questions AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = user_id) AND (group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can update their custom questions" ON public.custom_questions;
CREATE POLICY "Users can update their custom questions" ON public.custom_questions AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((auth.uid() = user_id) AND (date_asked IS NULL))) WITH CHECK (((auth.uid() = user_id) AND (group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view custom questions for their groups" ON public.custom_questions;
CREATE POLICY "Users can view custom questions for their groups" ON public.custom_questions AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Service can delete daily_prompts" ON public.daily_prompts;
CREATE POLICY "Service can delete daily_prompts" ON public.daily_prompts AS PERMISSIVE FOR DELETE TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Service can insert daily_prompts" ON public.daily_prompts;
CREATE POLICY "Service can insert daily_prompts" ON public.daily_prompts AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update daily_prompts" ON public.daily_prompts;
CREATE POLICY "Service can update daily_prompts" ON public.daily_prompts AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view daily_prompts in their groups" ON public.daily_prompts;
CREATE POLICY "Users can view daily_prompts in their groups" ON public.daily_prompts AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Group members can view deck activations" ON public.deck_activations;
CREATE POLICY "Group members can view deck activations" ON public.deck_activations AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = deck_activations.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Service role can track deck activations" ON public.deck_activations;
CREATE POLICY "Service role can track deck activations" ON public.deck_activations AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view decks" ON public.decks;
CREATE POLICY "Anyone can view decks" ON public.decks AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Users can create entries in their groups" ON public.entries;
CREATE POLICY "Users can create entries in their groups" ON public.entries AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))) AND (user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can view entries in their groups" ON public.entries;
CREATE POLICY "Users can view entries in their groups" ON public.entries AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can view featured prompts" ON public.featured_prompts;
CREATE POLICY "Users can view featured prompts" ON public.featured_prompts AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Group members can request deck votes" ON public.group_active_decks;
CREATE POLICY "Group members can request deck votes" ON public.group_active_decks AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = group_active_decks.group_id) AND (group_members.user_id = auth.uid())))) AND (requested_by = auth.uid()) AND (status = 'voting'::text)));

DROP POLICY IF EXISTS "Group members can view active decks for their groups" ON public.group_active_decks;
CREATE POLICY "Group members can view active decks for their groups" ON public.group_active_decks AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = group_active_decks.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Service role can update active decks" ON public.group_active_decks;
CREATE POLICY "Service role can update active decks" ON public.group_active_decks AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view activity tracking for their groups" ON public.group_activity_tracking;
CREATE POLICY "Users can view activity tracking for their groups" ON public.group_activity_tracking AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Group members can cast votes" ON public.group_deck_votes;
CREATE POLICY "Group members can cast votes" ON public.group_deck_votes AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = group_deck_votes.group_id) AND (group_members.user_id = auth.uid())))) AND (user_id = auth.uid())));

DROP POLICY IF EXISTS "Group members can view votes for their groups" ON public.group_deck_votes;
CREATE POLICY "Group members can view votes for their groups" ON public.group_deck_votes AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = group_deck_votes.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can update their own votes" ON public.group_deck_votes;
CREATE POLICY "Users can update their own votes" ON public.group_deck_votes AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view group engagement data for their groups" ON public.group_engagement_data;
CREATE POLICY "Users can view group engagement data for their groups" ON public.group_engagement_data AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can view featured question counts" ON public.group_featured_question_count;
CREATE POLICY "Users can view featured question counts" ON public.group_featured_question_count AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can add featured questions" ON public.group_featured_questions;
CREATE POLICY "Users can add featured questions" ON public.group_featured_questions AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = added_by) AND (group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view group featured questions" ON public.group_featured_questions;
CREATE POLICY "Users can view group featured questions" ON public.group_featured_questions AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can manage interests for their groups" ON public.group_interests;
CREATE POLICY "Users can manage interests for their groups" ON public.group_interests AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = group_interests.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can view group interests for their groups" ON public.group_interests;
CREATE POLICY "Users can view group interests for their groups" ON public.group_interests AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = group_interests.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Admins can remove members" ON public.group_members;
CREATE POLICY "Admins can remove members" ON public.group_members AS PERMISSIVE FOR DELETE TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = group_members.group_id) AND (gm.user_id = auth.uid()) AND (gm.role = 'admin'::text)))) AND (user_id <> auth.uid())));

DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;
CREATE POLICY "Users can view members of their groups" ON public.group_members AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members_1.group_id
   FROM group_members group_members_1
  WHERE (group_members_1.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can insert into group_prompt_queue" ON public.group_prompt_queue;
CREATE POLICY "Users can insert into group_prompt_queue" ON public.group_prompt_queue AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))) AND (added_by = auth.uid())));

DROP POLICY IF EXISTS "Users can update group_prompt_queue" ON public.group_prompt_queue;
CREATE POLICY "Users can update group_prompt_queue" ON public.group_prompt_queue AS PERMISSIVE FOR UPDATE TO authenticated USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can view group_prompt_queue" ON public.group_prompt_queue;
CREATE POLICY "Users can view group_prompt_queue" ON public.group_prompt_queue AS PERMISSIVE FOR SELECT TO authenticated USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Service role can insert matches" ON public.group_question_matches;
CREATE POLICY "Service role can insert matches" ON public.group_question_matches AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update matches" ON public.group_question_matches;
CREATE POLICY "Service role can update matches" ON public.group_question_matches AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view matches in their groups" ON public.group_question_matches;
CREATE POLICY "Users can view matches in their groups" ON public.group_question_matches AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can create their own swipes" ON public.group_question_swipes;
CREATE POLICY "Users can create their own swipes" ON public.group_question_swipes AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own swipes" ON public.group_question_swipes;
CREATE POLICY "Users can update their own swipes" ON public.group_question_swipes AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view swipes in their groups" ON public.group_question_swipes;
CREATE POLICY "Users can view swipes in their groups" ON public.group_question_swipes AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Group members can view settings" ON public.group_settings;
CREATE POLICY "Group members can view settings" ON public.group_settings AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = group_settings.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Only admins can insert settings" ON public.group_settings;
CREATE POLICY "Only admins can insert settings" ON public.group_settings AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = group_settings.group_id) AND (group_members.user_id = auth.uid()) AND (group_members.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Only admins can update settings" ON public.group_settings;
CREATE POLICY "Only admins can update settings" ON public.group_settings AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = group_settings.group_id) AND (group_members.user_id = auth.uid()) AND (group_members.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Users can insert songs in their groups" ON public.group_songs;
CREATE POLICY "Users can insert songs in their groups" ON public.group_songs AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))) AND (user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can view songs in their groups" ON public.group_songs;
CREATE POLICY "Users can view songs in their groups" ON public.group_songs AS PERMISSIVE FOR SELECT TO PUBLIC USING ((group_id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Only admins can update group name" ON public.groups;
CREATE POLICY "Only admins can update group name" ON public.groups AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid()) AND (group_members.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Users can view groups they're in" ON public.groups;
CREATE POLICY "Users can view groups they're in" ON public.groups AS PERMISSIVE FOR SELECT TO PUBLIC USING ((id IN ( SELECT group_members.group_id
   FROM group_members
  WHERE (group_members.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Service role can manage inactivity logs" ON public.inactivity_notification_log;
CREATE POLICY "Service role can manage inactivity logs" ON public.inactivity_notification_log AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own inactivity logs" ON public.inactivity_notification_log;
CREATE POLICY "Users can view own inactivity logs" ON public.inactivity_notification_log AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Interests are viewable by authenticated users" ON public.interests;
CREATE POLICY "Interests are viewable by authenticated users" ON public.interests AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read marketing stories" ON public.marketing_stories;
CREATE POLICY "Anyone can read marketing stories" ON public.marketing_stories AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Group members can insert name usage" ON public.prompt_name_usage;
CREATE POLICY "Group members can insert name usage" ON public.prompt_name_usage AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = prompt_name_usage.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Group members can view name usage" ON public.prompt_name_usage;
CREATE POLICY "Group members can view name usage" ON public.prompt_name_usage AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = prompt_name_usage.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Group members can view prompt stats" ON public.prompt_usage_stats;
CREATE POLICY "Group members can view prompt stats" ON public.prompt_usage_stats AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = prompt_usage_stats.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Service role can manage prompt stats" ON public.prompt_usage_stats;
CREATE POLICY "Service role can manage prompt stats" ON public.prompt_usage_stats AS PERMISSIVE FOR ALL TO PUBLIC USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view prompts" ON public.prompts;
CREATE POLICY "Anyone can view prompts" ON public.prompts AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert prompts" ON public.prompts;
CREATE POLICY "Users can insert prompts" ON public.prompts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens;
CREATE POLICY "Users can delete own push tokens" ON public.push_tokens AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens;
CREATE POLICY "Users can insert own push tokens" ON public.push_tokens AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens;
CREATE POLICY "Users can update own push tokens" ON public.push_tokens AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view own push tokens" ON public.push_tokens;
CREATE POLICY "Users can view own push tokens" ON public.push_tokens AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS push_tokens_delete_own ON public.push_tokens;
CREATE POLICY push_tokens_delete_own ON public.push_tokens AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS push_tokens_insert_own ON public.push_tokens;
CREATE POLICY push_tokens_insert_own ON public.push_tokens AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS push_tokens_select_own ON public.push_tokens;
CREATE POLICY push_tokens_select_own ON public.push_tokens AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS push_tokens_update_own ON public.push_tokens;
CREATE POLICY push_tokens_update_own ON public.push_tokens AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Group members can view preferences" ON public.question_category_preferences;
CREATE POLICY "Group members can view preferences" ON public.question_category_preferences AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = question_category_preferences.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Only admins can manage preferences" ON public.question_category_preferences;
CREATE POLICY "Only admins can manage preferences" ON public.question_category_preferences AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = question_category_preferences.group_id) AND (group_members.user_id = auth.uid()) AND (group_members.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = question_category_preferences.group_id) AND (group_members.user_id = auth.uid()) AND (group_members.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Users can manage their own interests" ON public.user_interests;
CREATE POLICY "Users can manage their own interests" ON public.user_interests AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view interests of group members" ON public.user_interests;
CREATE POLICY "Users can view interests of group members" ON public.user_interests AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (group_members gm1
     JOIN group_members gm2 ON ((gm1.group_id = gm2.group_id)))
  WHERE ((gm1.user_id = auth.uid()) AND (gm2.user_id = user_interests.user_id)))));

DROP POLICY IF EXISTS "Users can view their own interests" ON public.user_interests;
CREATE POLICY "Users can view their own interests" ON public.user_interests AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own songs" ON public.user_songs;
CREATE POLICY "Users can insert their own songs" ON public.user_songs AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can view their own songs" ON public.user_songs;
CREATE POLICY "Users can view their own songs" ON public.user_songs AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own statuses" ON public.user_statuses;
CREATE POLICY "Users can delete their own statuses" ON public.user_statuses AS PERMISSIVE FOR DELETE TO PUBLIC USING (((auth.uid() = user_id) AND (date = CURRENT_DATE)));

DROP POLICY IF EXISTS "Users can insert their own statuses" ON public.user_statuses;
CREATE POLICY "Users can insert their own statuses" ON public.user_statuses AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can read statuses in their groups" ON public.user_statuses;
CREATE POLICY "Users can read statuses in their groups" ON public.user_statuses AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM group_members
  WHERE ((group_members.group_id = user_statuses.group_id) AND (group_members.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Users can update their own statuses" ON public.user_statuses;
CREATE POLICY "Users can update their own statuses" ON public.user_statuses AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((auth.uid() = user_id) AND (date = CURRENT_DATE))) WITH CHECK (((auth.uid() = user_id) AND (date = CURRENT_DATE)));

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = id));

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = id));
