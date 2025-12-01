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
      comments: {
        Row: {
          created_at: string | null
          entry_id: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry_id: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          entry_id?: string
          id?: string
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
          id: string
          is_anonymous: boolean | null
          prompt_id: string | null
          question: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_asked?: string | null
          date_assigned: string
          description?: string | null
          group_id: string
          id?: string
          is_anonymous?: boolean | null
          prompt_id?: string | null
          question: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_asked?: string | null
          date_assigned?: string
          description?: string | null
          group_id?: string
          id?: string
          is_anonymous?: boolean | null
          prompt_id?: string | null
          question?: string
          user_id?: string
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
          group_id: string
          id: string
          prompt_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          deck_id?: string | null
          group_id: string
          id?: string
          prompt_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          deck_id?: string | null
          group_id?: string
          id?: string
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
      entries: {
        Row: {
          created_at: string | null
          date: string
          embedded_media: Json | null
          group_id: string
          id: string
          media_types: string[] | null
          media_urls: string[] | null
          prompt_id: string
          text_content: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          embedded_media?: Json | null
          group_id: string
          id?: string
          media_types?: string[] | null
          media_urls?: string[] | null
          prompt_id: string
          text_content?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          embedded_media?: Json | null
          group_id?: string
          id?: string
          media_types?: string[] | null
          media_urls?: string[] | null
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
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
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
            referencedRelation: "prompts"
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
          created_at: string | null
          created_by: string
          ice_breaker_queue_completed_date: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          ice_breaker_queue_completed_date?: string | null
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          ice_breaker_queue_completed_date?: string | null
          id?: string
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
      invite_tokens: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string
          group_id: string
          id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at: string
          group_id: string
          id?: string
          token: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string
          group_id?: string
          id?: string
          token?: string
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
      notification_queue: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          processed: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          processed?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          processed?: boolean | null
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
          deck_id: string | null
          deck_order: number | null
          description: string | null
          dynamic_variables: Json | null
          ice_breaker: boolean | null
          id: string
          is_custom: boolean | null
          is_default: boolean | null
          question: string
        }
        Insert: {
          birthday_type?: string | null
          category: string
          created_at?: string | null
          custom_question_id?: string | null
          deck_id?: string | null
          deck_order?: number | null
          description?: string | null
          dynamic_variables?: Json | null
          ice_breaker?: boolean | null
          id?: string
          is_custom?: boolean | null
          is_default?: boolean | null
          question: string
        }
        Update: {
          birthday_type?: string | null
          category?: string
          created_at?: string | null
          custom_question_id?: string | null
          deck_id?: string | null
          deck_order?: number | null
          description?: string | null
          dynamic_variables?: Json | null
          ice_breaker?: boolean | null
          id?: string
          is_custom?: boolean | null
          is_default?: boolean | null
          question?: string
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
      users: {
        Row: {
          avatar_url: string | null
          birthday: string | null
          created_at: string | null
          email: string
          has_seen_custom_question_onboarding: boolean | null
          id: string
          name: string | null
          theme_preference: string | null
        }
        Insert: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string | null
          email: string
          has_seen_custom_question_onboarding?: boolean | null
          id: string
          name?: string | null
          theme_preference?: string | null
        }
        Update: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string | null
          email?: string
          has_seen_custom_question_onboarding?: boolean | null
          id?: string
          name?: string | null
          theme_preference?: string | null
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
    }
    Functions: {
      batch_update_prompt_answer_counts: { Args: never; Returns: undefined }
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
      get_prompt_answer_rate: {
        Args: { prompt_uuid: string }
        Returns: {
          answer_rate: number
          total_answers: number
          total_asks: number
        }[]
      }
      is_group_member: {
        Args: { p_group: string; p_user: string }
        Returns: boolean
      }
      needs_queue_initialization: {
        Args: { group_uuid: string }
        Returns: boolean
      }
      track_birthday_card_view: {
        Args: { card_uuid: string; user_uuid: string }
        Returns: undefined
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
