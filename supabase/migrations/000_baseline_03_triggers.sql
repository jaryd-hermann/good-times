-- =============================================================================
-- BASELINE 03 — Triggers
-- =============================================================================
-- Generated from the live catalog of project ytnnsykbgohiscfgomfe on 2026-08-01.
-- Migrations 001-059 were never committed; this reconstructs what they built.
-- 21 triggers. Each is preceded by DROP TRIGGER IF EXISTS for idempotency.
-- =============================================================================

DROP TRIGGER IF EXISTS update_birthday_card_entries_updated_at ON public.birthday_card_entries;
CREATE TRIGGER update_birthday_card_entries_updated_at BEFORE UPDATE ON public.birthday_card_entries FOR EACH ROW EXECUTE FUNCTION update_birthday_card_entries_updated_at();

DROP TRIGGER IF EXISTS on_new_comment ON public.comments;
CREATE TRIGGER on_new_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION queue_new_comment_notification();

DROP TRIGGER IF EXISTS create_prompt_usage_stat_on_daily_prompt ON public.daily_prompts;
CREATE TRIGGER create_prompt_usage_stat_on_daily_prompt AFTER INSERT ON public.daily_prompts FOR EACH ROW EXECUTE FUNCTION create_prompt_usage_stat();

DROP TRIGGER IF EXISTS update_discovery_attempts_timestamp ON public.discovery_attempts;
CREATE TRIGGER update_discovery_attempts_timestamp BEFORE UPDATE ON public.discovery_attempts FOR EACH ROW EXECUTE FUNCTION update_discovery_attempts_updated_at();

DROP TRIGGER IF EXISTS entry_created_update_metrics ON public.entries;
CREATE TRIGGER entry_created_update_metrics AFTER INSERT ON public.entries FOR EACH ROW EXECUTE FUNCTION update_question_answered();

DROP TRIGGER IF EXISTS entry_discovery_engagement_trigger ON public.entries;
CREATE TRIGGER entry_discovery_engagement_trigger AFTER INSERT OR UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION trigger_update_discovery_engagement_on_entry();

DROP TRIGGER IF EXISTS on_new_entry ON public.entries;
CREATE TRIGGER on_new_entry AFTER INSERT ON public.entries FOR EACH ROW EXECUTE FUNCTION queue_new_entry_notification();

DROP TRIGGER IF EXISTS update_entries_updated_at ON public.entries;
CREATE TRIGGER update_entries_updated_at BEFORE UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS track_deck_activation_on_status_change ON public.group_active_decks;
CREATE TRIGGER track_deck_activation_on_status_change AFTER INSERT OR UPDATE ON public.group_active_decks FOR EACH ROW EXECUTE FUNCTION track_deck_activation();

DROP TRIGGER IF EXISTS update_group_active_decks_updated_at ON public.group_active_decks;
CREATE TRIGGER update_group_active_decks_updated_at BEFORE UPDATE ON public.group_active_decks FOR EACH ROW EXECUTE FUNCTION update_group_active_decks_updated_at();

DROP TRIGGER IF EXISTS update_group_activity_updated_at ON public.group_activity_tracking;
CREATE TRIGGER update_group_activity_updated_at BEFORE UPDATE ON public.group_activity_tracking FOR EACH ROW EXECUTE FUNCTION update_group_activity_updated_at();

DROP TRIGGER IF EXISTS update_group_deck_votes_updated_at ON public.group_deck_votes;
CREATE TRIGGER update_group_deck_votes_updated_at BEFORE UPDATE ON public.group_deck_votes FOR EACH ROW EXECUTE FUNCTION update_group_deck_votes_updated_at();

DROP TRIGGER IF EXISTS update_group_engagement_data_updated_at ON public.group_engagement_data;
CREATE TRIGGER update_group_engagement_data_updated_at BEFORE UPDATE ON public.group_engagement_data FOR EACH ROW EXECUTE FUNCTION update_group_engagement_data_updated_at();

DROP TRIGGER IF EXISTS update_featured_count_updated_at ON public.group_featured_question_count;
CREATE TRIGGER update_featured_count_updated_at BEFORE UPDATE ON public.group_featured_question_count FOR EACH ROW EXECUTE FUNCTION update_featured_count_updated_at();

DROP TRIGGER IF EXISTS trigger_update_group_active_interests ON public.group_interests;
CREATE TRIGGER trigger_update_group_active_interests AFTER INSERT OR DELETE OR UPDATE ON public.group_interests FOR EACH ROW EXECUTE FUNCTION update_group_active_interests();

DROP TRIGGER IF EXISTS on_member_joined ON public.group_members;
CREATE TRIGGER on_member_joined AFTER INSERT ON public.group_members FOR EACH ROW EXECUTE FUNCTION queue_member_joined_notification();

DROP TRIGGER IF EXISTS trigger_welcome_email_on_registration ON public.group_members;
CREATE TRIGGER trigger_welcome_email_on_registration AFTER INSERT ON public.group_members FOR EACH ROW EXECUTE FUNCTION trigger_welcome_email_on_registration();

DROP TRIGGER IF EXISTS update_group_swipes_updated_at ON public.group_question_swipes;
CREATE TRIGGER update_group_swipes_updated_at BEFORE UPDATE ON public.group_question_swipes FOR EACH ROW EXECUTE FUNCTION update_group_swipes_updated_at();

DROP TRIGGER IF EXISTS reaction_discovery_engagement_trigger ON public.reactions;
CREATE TRIGGER reaction_discovery_engagement_trigger AFTER INSERT OR DELETE ON public.reactions FOR EACH ROW EXECUTE FUNCTION trigger_update_discovery_engagement_on_reaction();

DROP TRIGGER IF EXISTS trigger_update_user_active_interests ON public.user_interests;
CREATE TRIGGER trigger_update_user_active_interests AFTER INSERT OR DELETE OR UPDATE ON public.user_interests FOR EACH ROW EXECUTE FUNCTION update_user_active_interests();

DROP TRIGGER IF EXISTS update_user_statuses_updated_at_trigger ON public.user_statuses;
CREATE TRIGGER update_user_statuses_updated_at_trigger BEFORE UPDATE ON public.user_statuses FOR EACH ROW EXECUTE FUNCTION update_user_statuses_updated_at();
