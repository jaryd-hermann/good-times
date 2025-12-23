export interface User {
  id: string
  email: string
  name: string
  birthday: string
  avatar_url?: string
  theme_preference?: "dark" | "light"
  has_seen_custom_question_onboarding?: boolean
  app_tutorial_seen?: boolean
  created_at: string
}

export interface Group {
  id: string
  name: string
  type: "family" | "friends"
  created_by: string
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: "admin" | "member"
  joined_at: string
}

export interface Prompt {
  id: string
  question: string
  description: string
  category: string
  is_default: boolean
  birthday_type?: "your_birthday" | "their_birthday" | null
  dynamic_variables?: string[] // Array of variable names like ["member_name", "memorial_name"]
  is_custom?: boolean
  custom_question_id?: string | null
  deck_id?: string | null
  deck_order?: number | null
  swipeable?: boolean
  yes_swipes_count?: number
  no_swipes_count?: number
  ice_breaker?: boolean
  featured_prompt_id?: string | null
  created_at: string
}

export interface DailyPrompt {
  id: string
  group_id: string
  prompt_id: string
  date: string
  user_id?: string | null // NULL for general prompts, user_id for user-specific prompts (birthdays)
  deck_id?: string | null // NULL for category prompts, deck_id for deck prompts
  created_at: string
  prompt?: Prompt
}

export interface EmbeddedMedia {
  platform: "spotify" | "apple_music" | "soundcloud"
  url: string
  embedId: string
  embedType: string
  embedUrl: string
  position?: number // Character position in text where embed should appear
}

export interface Entry {
  id: string
  group_id: string
  user_id: string
  prompt_id: string
  date: string
  text_content?: string
  media_urls?: string[]
  media_types?: ("photo" | "video" | "audio")[]
  embedded_media?: EmbeddedMedia[]
  mentions?: string[] // Array of user IDs mentioned in the entry
  created_at: string
  user?: User
  prompt?: Prompt
}

export interface Memorial {
  id: string
  user_id: string
  group_id: string
  name: string
  photo_url?: string
  created_at: string
}

export interface Reaction {
  id: string
  entry_id: string
  user_id: string
  type: string // Emoji string (e.g., "❤️", "👍", "👏", etc.)
  created_at: string
}

export interface Comment {
  id: string
  entry_id: string
  user_id: string
  text: string
  media_url?: string
  media_type?: "photo" | "video" | "audio"
  created_at: string
  user?: User
}

export type PromptCategory = "Most Popular" | "Family" | "Friends" | "Remembering" | "Fun" | "Seasonal" | "Birthday"

export interface CustomQuestion {
  id: string
  group_id: string
  user_id: string
  question: string
  description?: string
  is_anonymous: boolean
  created_at: string
  date_assigned: string
  date_asked?: string | null
  prompt_id?: string | null
  user?: User
  group?: Group
  prompt?: Prompt
}

export interface CustomQuestionRotation {
  id: string
  group_id: string
  user_id: string
  week_start_date: string
  date_assigned: string
  status: "assigned" | "completed" | "skipped"
  created_at: string
  user?: User
  group?: Group
}

export interface GroupActivityTracking {
  id: string
  group_id: string
  first_member_joined_at?: string | null
  first_entry_date?: string | null
  is_eligible_for_custom_questions: boolean
  eligible_since?: string | null
  created_at: string
  updated_at: string
  group?: Group
}

export interface Collection {
  id: string
  name: string
  description?: string
  icon_url?: string
  display_order: number
  created_at: string
}

export interface Deck {
  id: string
  collection_id: string
  name: string
  description?: string
  icon_url?: string
  display_order: number
  created_at: string
  collection?: Collection
}

export interface GroupDeckVote {
  id: string
  group_id: string
  deck_id: string
  user_id: string
  vote: "yes" | "no"
  created_at: string
  updated_at: string
  user?: User
  deck?: Deck
}

export interface GroupActiveDeck {
  id: string
  group_id: string
  deck_id: string
  status: "voting" | "active" | "rejected" | "finished"
  requested_by: string
  activated_at?: string | null
  finished_at?: string | null
  created_at: string
  updated_at: string
  deck?: Deck
  requested_by_user?: User
  group?: Group
}

export interface BirthdayCard {
  id: string
  group_id: string
  birthday_user_id: string
  birthday_date: string
  birthday_year: number
  status: "draft" | "published" | "public"
  is_public: boolean
  created_at: string
  published_at?: string | null
  birthday_user?: User
  group?: Group
}

export interface BirthdayCardEntry {
  id: string
  card_id: string
  contributor_user_id: string
  text_content?: string
  media_urls?: string[]
  media_types?: ("photo" | "video" | "audio")[]
  embedded_media?: EmbeddedMedia[]
  created_at: string
  updated_at: string
  contributor?: User
  card?: BirthdayCard
}

export interface FeaturedPrompt {
  id: string
  question: string
  description?: string
  week_starting: string
  category: string
  display_order: number
  suggested_by?: string | null
  created_at: string
}

export interface GroupFeaturedQuestion {
  id: string
  group_id: string
  featured_prompt_id: string
  added_by: string
  date_added: string
  date_scheduled?: string | null
  prompt_id?: string | null
  created_at: string
  user?: User
  featured_prompt?: FeaturedPrompt
}

export interface GroupQuestionSwipe {
  id: string
  user_id: string
  group_id: string
  prompt_id: string
  response: "yes" | "no"
  created_at: string
  updated_at: string
}

export interface GroupQuestionMatch {
  id: string
  group_id: string
  prompt_id: string
  matched_at: string
  asked: boolean
  created_at: string
}
