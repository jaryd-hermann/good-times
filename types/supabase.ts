export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      answer_shares: {
        Row: {
          answer_id: string
          group_id: string
          shared_at: string
        }
        Insert: {
          answer_id: string
          group_id: string
          shared_at?: string
        }
        Update: {
          answer_id?: string
          group_id?: string
          shared_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_shares_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_shares_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_shares_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          captions: string[] | null
          created_at: string
          date: string
          id: string
          legacy_entry_id: string | null
          media_types: string[] | null
          media_urls: string[] | null
          mentions: string[] | null
          mode: string
          prompt_id: string
          text_content: string | null
          transcript: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          captions?: string[] | null
          created_at?: string
          date: string
          id?: string
          legacy_entry_id?: string | null
          media_types?: string[] | null
          media_urls?: string[] | null
          mentions?: string[] | null
          mode?: string
          prompt_id: string
          text_content?: string | null
          transcript?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          captions?: string[] | null
          created_at?: string
          date?: string
          id?: string
          legacy_entry_id?: string | null
          media_types?: string[] | null
          media_urls?: string[] | null
          mentions?: string[] | null
          mode?: string
          prompt_id?: string
          text_content?: string | null
          transcript?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      birthday_card_entries: {
        Row: {
          card_id: string
          contributor_user_id: string
          created_at: string | null
          embedded_media: Json | null
          id: string
          media_types: string[] | null
          media_urls: string[] | null
          text_content: string | null
          updated_at: string | null
        }
        Insert: {
          card_id: string
          contributor_user_id: string
          created_at?: string | null
          embedded_media?: Json | null
          id?: string
          media_types?: string[] | null
          media_urls?: string[] | null
          text_content?: string | null
          updated_at?: string | null
        }
        Update: {
          card_id?: string
          contributor_user_id?: string
          created_at?: string | null
          embedded_media?: Json | null
          id?: string
          media_types?: string[] | null
          media_urls?: string[] | null
          text_content?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "birthday_card_entries_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "birthday_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_card_entries_contributor_user_id_fkey"
            columns: ["contributor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_card_notifications: {
        Row: {
          card_id: string
          id: string
          notification_type: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          card_id: string
          id?: string
          notification_type: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          card_id?: string
          id?: string
          notification_type?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "birthday_card_notifications_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "birthday_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_card_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_card_views: {
        Row: {
          card_id: string
          id: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          card_id: string
          id?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          card_id?: string
          id?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "birthday_card_views_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "birthday_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_card_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_cards: {
        Row: {
          birthday_date: string
          birthday_user_id: string
          birthday_year: number
          created_at: string | null
          group_id: string
          id: string
          is_public: boolean | null
          published_at: string | null
          status: string
        }
        Insert: {
          birthday_date: string
          birthday_user_id: string
          birthday_year: number
          created_at?: string | null
          group_id: string
          id?: string
          is_public?: boolean | null
          published_at?: string | null
          status?: string
        }
        Update: {
          birthday_date?: string
          birthday_user_id?: string
          birthday_year?: number
          created_at?: string | null
          group_id?: string
          id?: string
          is_public?: boolean | null
          published_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "birthday_cards_birthday_user_id_fkey"
            columns: ["birthday_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_cards_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_cards_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon_url: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_url?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_url?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          type?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          created_at: string | null
          entry_id: string
          id: string
          media_type: string | null
          media_url: string | null
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          text: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_question_rotation: {
        Row: {
          created_at: string | null
          date_assigned: string
          group_id: string
          id: string
          status: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          date_assigned: string
          group_id: string
          id?: string
          status?: string
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          date_assigned?: string
          group_id?: string
          id?: string
          status?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_question_rotation_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_question_rotation_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_question_rotation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_questions: {
        Row: {
          created_at: string | null
          date_asked: string | null
          date_assigned: string
          description: string | null
          group_id: string
          group_name: string | null
          id: string
          is_anonymous: boolean | null
          prompt_id: string | null
          question: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          date_asked?: string | null
          date_assigned: string
          description?: string | null
          group_id: string
          group_name?: string | null
          id?: string
          is_anonymous?: boolean | null
          prompt_id?: string | null
          question: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          date_asked?: string | null
          date_assigned?: string
          description?: string | null
          group_id?: string
          group_name?: string | null
          id?: string
          is_anonymous?: boolean | null
          prompt_id?: string | null
          question?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_questions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_questions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_questions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_questions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_questions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_prompts: {
        Row: {
          created_at: string | null
          date: string
          deck_id: string | null
          discovery_interest: string | null
          engagement_score: number | null
          group_id: string
          id: string
          is_discovery: boolean | null
          prompt_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          deck_id?: string | null
          discovery_interest?: string | null
          engagement_score?: number | null
          group_id: string
          id?: string
          is_discovery?: boolean | null
          prompt_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          deck_id?: string | null
          discovery_interest?: string | null
          engagement_score?: number | null
          group_id?: string
          id?: string
          is_discovery?: boolean | null
          prompt_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_prompts_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_prompts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_prompts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_prompts_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_prompts_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_activations: {
        Row: {
          activated_at: string | null
          deck_id: string
          group_active_deck_id: string | null
          group_id: string
          id: string
        }
        Insert: {
          activated_at?: string | null
          deck_id: string
          group_active_deck_id?: string | null
          group_id: string
          id?: string
        }
        Update: {
          activated_at?: string | null
          deck_id?: string
          group_active_deck_id?: string | null
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_activations_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_activations_group_active_deck_id_fkey"
            columns: ["group_active_deck_id"]
            isOneToOne: false
            referencedRelation: "group_active_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_activations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_activations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_classifications: {
        Row: {
          deck_id: string
          deck_vibe_tags: string[] | null
          depth_level: number | null
          emotional_weight: string | null
          focus_type: string | null
          media_affinity: string[] | null
          time_orientation: string | null
          updated_at: string | null
          vulnerability_score: number | null
        }
        Insert: {
          deck_id: string
          deck_vibe_tags?: string[] | null
          depth_level?: number | null
          emotional_weight?: string | null
          focus_type?: string | null
          media_affinity?: string[] | null
          time_orientation?: string | null
          updated_at?: string | null
          vulnerability_score?: number | null
        }
        Update: {
          deck_id?: string
          deck_vibe_tags?: string[] | null
          depth_level?: number | null
          emotional_weight?: string | null
          focus_type?: string | null
          media_affinity?: string[] | null
          time_orientation?: string | null
          updated_at?: string | null
          vulnerability_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deck_classifications_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: true
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          collection_id: string
          created_at: string | null
          description: string | null
          display_order: number | null
          icon_url: string | null
          id: string
          name: string
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_url?: string | null
          id?: string
          name: string
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_url?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_attempts: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          interest_name: string
          last_tested_date: string | null
          question_count: number | null
          status: string | null
          total_engagement_score: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          interest_name: string
          last_tested_date?: string | null
          question_count?: number | null
          status?: string | null
          total_engagement_score?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          interest_name?: string
          last_tested_date?: string | null
          question_count?: number | null
          status?: string | null
          total_engagement_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_attempts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_attempts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string | null
          email_type: string
          id: string
          resend_id: string | null
          sent_at: string | null
          template_data: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_type: string
          id?: string
          resend_id?: string | null
          sent_at?: string | null
          template_data?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_type?: string
          id?: string
          resend_id?: string | null
          sent_at?: string | null
          template_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          captions: string[] | null
          created_at: string | null
          date: string
          embedded_media: Json | null
          group_id: string
          id: string
          media_types: string[] | null
          media_urls: string[] | null
          mentions: string[] | null
          prompt_id: string
          text_content: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          captions?: string[] | null
          created_at?: string | null
          date: string
          embedded_media?: Json | null
          group_id: string
          id?: string
          media_types?: string[] | null
          media_urls?: string[] | null
          mentions?: string[] | null
          prompt_id: string
          text_content?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          captions?: string[] | null
          created_at?: string | null
          date?: string
          embedded_media?: Json | null
          group_id?: string
          id?: string
          media_types?: string[] | null
          media_urls?: string[] | null
          mentions?: string[] | null
          prompt_id?: string
          text_content?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_prompts: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          question: string
          suggested_by: string | null
          week_starting: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order: number
          id?: string
          question: string
          suggested_by?: string | null
          week_starting: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          question?: string
          suggested_by?: string | null
          week_starting?: string
        }
        Relationships: []
      }
      group_active_decks: {
        Row: {
          activated_at: string | null
          created_at: string | null
          deck_id: string
          finished_at: string | null
          group_id: string
          id: string
          requested_by: string
          status: string
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          deck_id: string
          finished_at?: string | null
          group_id: string
          id?: string
          requested_by: string
          status: string
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          deck_id?: string
          finished_at?: string | null
          group_id?: string
          id?: string
          requested_by?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_active_decks_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_active_decks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_active_decks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_active_decks_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_activity_tracking: {
        Row: {
          created_at: string | null
          eligible_since: string | null
          first_entry_date: string | null
          first_member_joined_at: string | null
          group_id: string
          id: string
          is_eligible_for_custom_questions: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          eligible_since?: string | null
          first_entry_date?: string | null
          first_member_joined_at?: string | null
          group_id: string
          id?: string
          is_eligible_for_custom_questions?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          eligible_since?: string | null
          first_entry_date?: string | null
          first_member_joined_at?: string | null
          group_id?: string
          id?: string
          is_eligible_for_custom_questions?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_activity_tracking_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_activity_tracking_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      group_deck_votes: {
        Row: {
          created_at: string | null
          deck_id: string
          group_id: string
          id: string
          updated_at: string | null
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string | null
          deck_id: string
          group_id: string
          id?: string
          updated_at?: string | null
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string | null
          deck_id?: string
          group_id?: string
          id?: string
          updated_at?: string | null
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_deck_votes_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_deck_votes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_deck_votes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_deck_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_engagement_data: {
        Row: {
          avg_answer_length: number | null
          avg_comments_per_entry: number | null
          avg_completion_rate: number | null
          avg_hours_to_first_response: number | null
          created_at: string | null
          entry_comment_rate: number | null
          group_id: string
          group_members: string | null
          group_name: string | null
          id: string
          last_engagement_date: string | null
          last_prompt_date: string | null
          media_attachment_rate: number | null
          median_answer_length: number | null
          member_count: number | null
          total_entries: number | null
          total_prompts_asked: number | null
          updated_at: string | null
        }
        Insert: {
          avg_answer_length?: number | null
          avg_comments_per_entry?: number | null
          avg_completion_rate?: number | null
          avg_hours_to_first_response?: number | null
          created_at?: string | null
          entry_comment_rate?: number | null
          group_id: string
          group_members?: string | null
          group_name?: string | null
          id?: string
          last_engagement_date?: string | null
          last_prompt_date?: string | null
          media_attachment_rate?: number | null
          median_answer_length?: number | null
          member_count?: number | null
          total_entries?: number | null
          total_prompts_asked?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_answer_length?: number | null
          avg_comments_per_entry?: number | null
          avg_completion_rate?: number | null
          avg_hours_to_first_response?: number | null
          created_at?: string | null
          entry_comment_rate?: number | null
          group_id?: string
          group_members?: string | null
          group_name?: string | null
          id?: string
          last_engagement_date?: string | null
          last_prompt_date?: string | null
          media_attachment_rate?: number | null
          median_answer_length?: number | null
          member_count?: number | null
          total_entries?: number | null
          total_prompts_asked?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_engagement_data_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_engagement_data_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      group_featured_question_count: {
        Row: {
          count: number
          created_at: string | null
          group_id: string
          id: string
          updated_at: string | null
          week_starting: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          group_id: string
          id?: string
          updated_at?: string | null
          week_starting: string
        }
        Update: {
          count?: number
          created_at?: string | null
          group_id?: string
          id?: string
          updated_at?: string | null
          week_starting?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_featured_question_count_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_featured_question_count_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      group_featured_questions: {
        Row: {
          added_by: string
          created_at: string | null
          date_added: string | null
          date_scheduled: string | null
          featured_prompt_id: string
          group_id: string
          id: string
          prompt_id: string | null
        }
        Insert: {
          added_by: string
          created_at?: string | null
          date_added?: string | null
          date_scheduled?: string | null
          featured_prompt_id: string
          group_id: string
          id?: string
          prompt_id?: string | null
        }
        Update: {
          added_by?: string
          created_at?: string | null
          date_added?: string | null
          date_scheduled?: string | null
          featured_prompt_id?: string
          group_id?: string
          id?: string
          prompt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_featured_questions_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_featured_questions_featured_prompt_id_fkey"
            columns: ["featured_prompt_id"]
            isOneToOne: false
            referencedRelation: "featured_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_featured_questions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_featured_questions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_featured_questions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_featured_questions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_interests: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          interest_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          interest_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          interest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_interests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_interests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          muted: boolean
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          muted?: boolean
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          muted?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_prompt_queue: {
        Row: {
          added_by: string
          created_at: string | null
          group_id: string
          id: string
          position: number
          prompt_id: string
        }
        Insert: {
          added_by: string
          created_at?: string | null
          group_id: string
          id?: string
          position: number
          prompt_id: string
        }
        Update: {
          added_by?: string
          created_at?: string | null
          group_id?: string
          id?: string
          position?: number
          prompt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_prompt_queue_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_prompt_queue_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_prompt_queue_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_prompt_queue_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_prompt_queue_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_question_matches: {
        Row: {
          asked: boolean | null
          created_at: string | null
          group_id: string
          id: string
          matched_at: string | null
          prompt_id: string
        }
        Insert: {
          asked?: boolean | null
          created_at?: string | null
          group_id: string
          id?: string
          matched_at?: string | null
          prompt_id: string
        }
        Update: {
          asked?: boolean | null
          created_at?: string | null
          group_id?: string
          id?: string
          matched_at?: string | null
          prompt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_question_matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_question_matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_question_matches_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_question_matches_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_question_swipes: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          prompt_id: string
          response: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          prompt_id: string
          response: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          prompt_id?: string
          response?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_question_swipes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_question_swipes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_question_swipes_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_question_swipes_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_question_swipes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_settings: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      group_songs: {
        Row: {
          artist: string | null
          created_at: string | null
          embed_id: string
          embed_type: string | null
          group_id: string
          id: string
          platform: string
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          artist?: string | null
          created_at?: string | null
          embed_id: string
          embed_type?: string | null
          group_id: string
          id?: string
          platform: string
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          artist?: string | null
          created_at?: string | null
          embed_id?: string
          embed_type?: string | null
          group_id?: string
          id?: string
          platform?: string
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_songs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_songs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_songs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          active_interests: string[] | null
          created_at: string | null
          created_by: string
          ice_breaker_queue_completed_date: string | null
          id: string
          inferred_interests: string[] | null
          interest_cycle_interests: string[] | null
          interest_cycle_position: number | null
          last_interest_used: string | null
          name: string
          type: string
        }
        Insert: {
          active_interests?: string[] | null
          created_at?: string | null
          created_by: string
          ice_breaker_queue_completed_date?: string | null
          id?: string
          inferred_interests?: string[] | null
          interest_cycle_interests?: string[] | null
          interest_cycle_position?: number | null
          last_interest_used?: string | null
          name: string
          type: string
        }
        Update: {
          active_interests?: string[] | null
          created_at?: string | null
          created_by?: string
          ice_breaker_queue_completed_date?: string | null
          id?: string
          inferred_interests?: string[] | null
          interest_cycle_interests?: string[] | null
          interest_cycle_position?: number | null
          last_interest_used?: string | null
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inactivity_notification_log: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          last_sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          last_sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          last_sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inactivity_notification_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inactivity_notification_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inactivity_notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_similarities: {
        Row: {
          calculated_at: string | null
          co_occurrence_score: number
          id: string
          interest_name: string
          similar_interest: string
        }
        Insert: {
          calculated_at?: string | null
          co_occurrence_score: number
          id?: string
          interest_name: string
          similar_interest: string
        }
        Update: {
          calculated_at?: string | null
          co_occurrence_score?: number
          id?: string
          interest_name?: string
          similar_interest?: string
        }
        Relationships: []
      }
      interests: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      invite_tokens: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          revoked_at: string | null
          token: string
          uses: number
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          revoked_at?: string | null
          token: string
          uses?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          revoked_at?: string | null
          token?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_stories: {
        Row: {
          body: string
          created_at: string | null
          headline: string
          id: string
          slide_number: number
          story_id: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          headline: string
          id?: string
          slide_number: number
          story_id: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          headline?: string
          id?: string
          slide_number?: number
          story_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      memorials: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          name: string
          photo_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          name: string
          photo_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          name?: string
          photo_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memorials_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorials_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memorials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          answer_id: string | null
          created_at: string
          group_id: string
          id: string
          kind: string
          legacy_comment_id: string | null
          media_types: string[] | null
          media_urls: string[] | null
          mentions: string[] | null
          reply_to_message_id: string | null
          suppress_notify: boolean
          system_payload: Json | null
          text: string | null
          thread_date: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          answer_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          kind: string
          legacy_comment_id?: string | null
          media_types?: string[] | null
          media_urls?: string[] | null
          mentions?: string[] | null
          reply_to_message_id?: string | null
          suppress_notify?: boolean
          system_payload?: Json | null
          text?: string | null
          thread_date: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          answer_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          kind?: string
          legacy_comment_id?: string | null
          media_types?: string[] | null
          media_urls?: string[] | null
          mentions?: string[] | null
          reply_to_message_id?: string | null
          suppress_notify?: boolean
          system_payload?: Json | null
          text?: string | null
          thread_date?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_digest: {
        Row: {
          actor_ids: string[]
          event_count: number
          first_event_at: string
          flushed_at: string | null
          group_id: string | null
          id: string
          last_event_at: string
          thread_date: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_ids?: string[]
          event_count?: number
          first_event_at?: string
          flushed_at?: string | null
          group_id?: string | null
          id?: string
          last_event_at?: string
          thread_date?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_ids?: string[]
          event_count?: number
          first_event_at?: string
          flushed_at?: string | null
          group_id?: string | null
          id?: string
          last_event_at?: string
          thread_date?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_digest_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_digest_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_digest_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          attempts: number
          body: string
          created_at: string | null
          data: Json | null
          id: string
          last_error: string | null
          next_attempt_at: string | null
          processed: boolean | null
          processed_at: string | null
          scheduled_time: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          processed?: boolean | null
          processed_at?: string | null
          scheduled_time?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          processed?: boolean | null
          processed_at?: string | null
          scheduled_time?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_email_schedule: {
        Row: {
          created_at: string | null
          email_type: string
          id: string
          scheduled_for: string
          sent: boolean | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_type: string
          id?: string
          scheduled_for: string
          sent?: boolean | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_type?: string
          id?: string
          scheduled_for?: string
          sent?: boolean | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_email_schedule_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_name_usage: {
        Row: {
          created_at: string | null
          date_used: string
          group_id: string
          id: string
          name_used: string
          prompt_id: string
          variable_type: string
        }
        Insert: {
          created_at?: string | null
          date_used: string
          group_id: string
          id?: string
          name_used: string
          prompt_id: string
          variable_type: string
        }
        Update: {
          created_at?: string | null
          date_used?: string
          group_id?: string
          id?: string
          name_used?: string
          prompt_id?: string
          variable_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_name_usage_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_name_usage_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_name_usage_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_name_usage_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_usage_stats: {
        Row: {
          answers_count: number | null
          created_at: string | null
          daily_prompt_id: string | null
          date: string
          group_id: string
          group_size_at_time: number
          id: string
          prompt_id: string
          updated_at: string | null
        }
        Insert: {
          answers_count?: number | null
          created_at?: string | null
          daily_prompt_id?: string | null
          date: string
          group_id: string
          group_size_at_time: number
          id?: string
          prompt_id: string
          updated_at?: string | null
        }
        Update: {
          answers_count?: number | null
          created_at?: string | null
          daily_prompt_id?: string | null
          date?: string
          group_id?: string
          group_size_at_time?: number
          id?: string
          prompt_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_usage_stats_daily_prompt_id_fkey"
            columns: ["daily_prompt_id"]
            isOneToOne: true
            referencedRelation: "daily_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_usage_stats_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_usage_stats_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_usage_stats_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_usage_stats_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          birthday_type: string | null
          category: string
          created_at: string | null
          custom_question_id: string | null
          deck: string | null
          deck_id: string | null
          deck_order: number | null
          description: string | null
          dynamic_variables: Json | null
          featured_prompt_id: string | null
          global_completion_rate: number | null
          ice_breaker: boolean | null
          ice_breaker_order: number | null
          id: string
          interests: string[] | null
          is_custom: boolean | null
          is_default: boolean | null
          last_asked_date: string | null
          popularity_score: number | null
          question: string
          question_type: string | null
          total_answered_count: number | null
          total_asked_count: number | null
        }
        Insert: {
          birthday_type?: string | null
          category: string
          created_at?: string | null
          custom_question_id?: string | null
          deck?: string | null
          deck_id?: string | null
          deck_order?: number | null
          description?: string | null
          dynamic_variables?: Json | null
          featured_prompt_id?: string | null
          global_completion_rate?: number | null
          ice_breaker?: boolean | null
          ice_breaker_order?: number | null
          id?: string
          interests?: string[] | null
          is_custom?: boolean | null
          is_default?: boolean | null
          last_asked_date?: string | null
          popularity_score?: number | null
          question: string
          question_type?: string | null
          total_answered_count?: number | null
          total_asked_count?: number | null
        }
        Update: {
          birthday_type?: string | null
          category?: string
          created_at?: string | null
          custom_question_id?: string | null
          deck?: string | null
          deck_id?: string | null
          deck_order?: number | null
          description?: string | null
          dynamic_variables?: Json | null
          featured_prompt_id?: string | null
          global_completion_rate?: number | null
          ice_breaker?: boolean | null
          ice_breaker_order?: number | null
          id?: string
          interests?: string[] | null
          is_custom?: boolean | null
          is_default?: boolean | null
          last_asked_date?: string | null
          popularity_score?: number | null
          question?: string
          question_type?: string | null
          total_answered_count?: number | null
          total_asked_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_custom_question_id_fkey"
            columns: ["custom_question_id"]
            isOneToOne: false
            referencedRelation: "custom_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_featured_prompt_id_fkey"
            columns: ["featured_prompt_id"]
            isOneToOne: false
            referencedRelation: "featured_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      question_category_preferences: {
        Row: {
          category: string
          created_at: string | null
          group_id: string
          id: string
          preference: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          group_id: string
          id?: string
          preference: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          group_id?: string
          id?: string
          preference?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "question_category_preferences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_category_preferences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
        ]
      }
      question_schedule: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          notes: string | null
          prompt_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          notes?: string | null
          prompt_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          notes?: string | null
          prompt_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_schedule_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_schedule_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompt_engagement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_schedule_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string | null
          entry_id: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          id?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          created_by: string
          group_id: string | null
          kind: string
          message_id: string | null
          revoked_at: string | null
          thread_date: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          group_id?: string | null
          kind: string
          message_id?: string | null
          revoked_at?: string | null
          thread_date?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          group_id?: string | null
          kind?: string
          message_id?: string | null
          revoked_at?: string | null
          thread_date?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_reads: {
        Row: {
          group_id: string
          last_read_at: string
          thread_date: string
          user_id: string
        }
        Insert: {
          group_id: string
          last_read_at?: string
          thread_date: string
          user_id: string
        }
        Update: {
          group_id?: string
          last_read_at?: string
          thread_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_reads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_reads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          created_at: string | null
          id: string
          interest_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interest_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_songs: {
        Row: {
          artist: string | null
          created_at: string | null
          embed_id: string
          embed_type: string | null
          id: string
          platform: string
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          artist?: string | null
          created_at?: string | null
          embed_id: string
          embed_type?: string | null
          id?: string
          platform: string
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          artist?: string | null
          created_at?: string | null
          embed_id?: string
          embed_type?: string | null
          id?: string
          platform?: string
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_songs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_statuses: {
        Row: {
          created_at: string | null
          date: string
          group_id: string
          id: string
          status_text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          group_id: string
          id?: string
          status_text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          group_id?: string
          id?: string
          status_text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_statuses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_statuses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups_needing_queue_init"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_statuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active_interests: string[] | null
          app_tutorial_seen: boolean | null
          avatar_url: string | null
          birthday: string | null
          created_at: string | null
          daily_question_notifications_enabled: boolean
          email: string
          has_seen_custom_question_onboarding: boolean | null
          id: string
          is_admin: boolean
          name: string | null
          notification_prefs: Json
          notifications_enabled: boolean
          onboarded_at: string | null
          onesignal_id: string | null
          theme_preference: string | null
          timezone: string | null
        }
        Insert: {
          active_interests?: string[] | null
          app_tutorial_seen?: boolean | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string | null
          daily_question_notifications_enabled?: boolean
          email: string
          has_seen_custom_question_onboarding?: boolean | null
          id: string
          is_admin?: boolean
          name?: string | null
          notification_prefs?: Json
          notifications_enabled?: boolean
          onboarded_at?: string | null
          onesignal_id?: string | null
          theme_preference?: string | null
          timezone?: string | null
        }
        Update: {
          active_interests?: string[] | null
          app_tutorial_seen?: boolean | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string | null
          daily_question_notifications_enabled?: boolean
          email?: string
          has_seen_custom_question_onboarding?: boolean | null
          id?: string
          is_admin?: boolean
          name?: string | null
          notification_prefs?: Json
          notifications_enabled?: boolean
          onboarded_at?: string | null
          onesignal_id?: string | null
          theme_preference?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      groups_needing_queue_init: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          prompt_count_last_7_days: number | null
          type: string | null
        }
        Relationships: []
      }
      prompt_engagement: {
        Row: {
          answer_rate: number | null
          category: string | null
          id: string | null
          last_asked: string | null
          question: string | null
          times_asked: number | null
          total_answers: number | null
          total_asked_people: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      analyze_discovery_engagement: {
        Args: never
        Returns: {
          avg_engagement: number
          group_id: string
          interest_name: string
          status: string
        }[]
      }
      batch_update_prompt_answer_counts: { Args: never; Returns: undefined }
      calculate_engagement_score: {
        Args: { p_daily_prompt_id: string }
        Returns: number
      }
      calculate_interest_similarities: { Args: never; Returns: undefined }
      check_and_create_match: {
        Args: { p_group_id: string; p_prompt_id: string }
        Returns: boolean
      }
      get_app_setting: { Args: { setting_key: string }; Returns: string }
      get_current_week_monday: { Args: never; Returns: string }
      get_deck_activation_count: {
        Args: { deck_uuid: string }
        Returns: number
      }
      get_inactive_users: {
        Args: { check_date_end: string; check_date_start: string }
        Returns: {
          group_id: string
          group_name: string
          joined_at: string
          user_id: string
        }[]
      }
      get_interest_stats: {
        Args: { interest_id_param: string }
        Returns: {
          total_active_groups: number
          total_members: number
        }[]
      }
      get_prompt_answer_rate: {
        Args: { prompt_uuid: string }
        Returns: {
          answer_rate: number
          total_answers: number
          total_asks: number
        }[]
      }
      get_related_interests: {
        Args: { p_group_id: string; p_limit?: number }
        Returns: {
          co_occurrence_score: number
          interest_name: string
        }[]
      }
      increment_prompt_swipe_count: {
        Args: { p_prompt_id: string; p_response: string }
        Returns: undefined
      }
      increment_question_asked: {
        Args: { p_prompt_id: string }
        Returns: undefined
      }
      is_group_member: {
        Args: { p_group: string; p_user: string }
        Returns: boolean
      }
      needs_queue_initialization: {
        Args: { group_uuid: string }
        Returns: boolean
      }
      notification_pref_enabled: {
        Args: { p_type: string; p_user_id: string }
        Returns: boolean
      }
      populate_personalized_queue: {
        Args: never
        Returns: {
          result_group_id: string
          result_prompts_added: number
        }[]
      }
      resolve_question_for_date: { Args: { d: string }; Returns: string }
      run_daily_personalization_tasks: {
        Args: never
        Returns: {
          details: string
          status: string
          task: string
        }[]
      }
      run_weekly_queue_population: {
        Args: never
        Returns: {
          result_group_id: string
          result_prompts_added: number
        }[]
      }
      schedule_onboarding_emails: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      track_birthday_card_view: {
        Args: { card_uuid: string; user_uuid: string }
        Returns: undefined
      }
      update_discovery_engagement: {
        Args: { p_daily_prompt_id: string }
        Returns: undefined
      }
      update_question_global_metrics: { Args: never; Returns: undefined }
      v2_add_question: {
        Args: {
          p_actor?: string
          p_assign?: boolean
          p_category?: string
          p_question: string
        }
        Returns: Json
      }
      v2_admin_bank: {
        Args: { p_filter?: string; p_limit?: number; p_search?: string }
        Returns: Json
      }
      v2_admin_current_question: { Args: never; Returns: Json }
      v2_admin_dashboard: { Args: never; Returns: Json }
      v2_admin_groups: { Args: { p_days?: number }; Returns: Json }
      v2_admin_past: { Args: { p_limit?: number }; Returns: Json }
      v2_admin_performance: { Args: { p_days?: number }; Returns: Json }
      v2_admin_schedule: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      v2_admin_upcoming: { Args: { p_limit?: number }; Returns: Json }
      v2_create_group: {
        Args: { p_name: string; p_user_id: string }
        Returns: Json
      }
      v2_create_share_link: {
        Args: {
          p_group_id?: string
          p_kind: string
          p_message_id?: string
          p_thread_date?: string
          p_user_id: string
        }
        Returns: Json
      }
      v2_digest_add: {
        Args: {
          p_actor: string
          p_group_id: string
          p_thread_date: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      v2_emergency_prompt_id: { Args: never; Returns: string }
      v2_emit_birthday_messages: { Args: { d?: string }; Returns: number }
      v2_evergreen_pool: {
        Args: { as_of: string; recency_days?: number }
        Returns: {
          id: string
          rn: number
        }[]
      }
      v2_flush_digests: { Args: never; Returns: number }
      v2_generate_code: { Args: { len?: number }; Returns: string }
      v2_get_chat_list: {
        Args: { p_date?: string; p_user_id: string }
        Returns: Json
      }
      v2_get_history: {
        Args: {
          p_from?: string
          p_group_id?: string
          p_limit?: number
          p_offset?: number
          p_to?: string
          p_unseen_only?: boolean
          p_user_id: string
        }
        Returns: Json
      }
      v2_get_or_create_invite: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: Json
      }
      v2_get_questions_for_range: {
        Args: { p_from: string; p_to: string; p_user_id: string }
        Returns: Json
      }
      v2_get_thread: {
        Args: { p_date: string; p_group_id: string; p_user_id: string }
        Returns: Json
      }
      v2_get_today_hub: {
        Args: { p_date?: string; p_user_id: string }
        Returns: Json
      }
      v2_insert_question_at: {
        Args: { p_actor?: string; p_date: string; p_prompt_id: string }
        Returns: Json
      }
      v2_is_locked: {
        Args: { p_date: string; p_user_id: string }
        Returns: boolean
      }
      v2_is_sunday: { Args: { d: string }; Returns: boolean }
      v2_mark_all_read: {
        Args: { p_group_id?: string; p_user_id: string }
        Returns: number
      }
      v2_mark_thread_read: {
        Args: { p_group_id: string; p_thread_date: string; p_user_id: string }
        Returns: undefined
      }
      v2_move_question: {
        Args: { p_date: string; p_dir: number }
        Returns: Json
      }
      v2_notify_now: {
        Args: {
          p_body: string
          p_data: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      v2_peek_invite: { Args: { p_token: string }; Returns: Json }
      v2_question_for_thread: {
        Args: { p_date: string; p_group_id: string }
        Returns: string
      }
      v2_redeem_invite: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      v2_refresh_prompt_engagement: { Args: never; Returns: undefined }
      v2_retro_share_answers: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: number
      }
      v2_seed_question_schedule: {
        Args: { actor?: string; from_date: string; to_date: string }
        Returns: number
      }
      v2_unseen_total: {
        Args: { p_user_id: string; p_days?: number }
        Returns: number
      }
      v2_unscheduled_dates: {
        Args: { days_ahead?: number }
        Returns: {
          date: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
