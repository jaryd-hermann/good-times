export interface User {
  id: string
  email: string
  name: string
  birthday: string
  avatar_url?: string
  theme_preference?: "dark" | "light"
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
  created_at: string
}

export interface DailyPrompt {
  id: string
  group_id: string
  prompt_id: string
  date: string
  user_id?: string | null // NULL for general prompts, user_id for user-specific prompts (birthdays)
  created_at: string
  prompt?: Prompt
}

export interface EmbeddedMedia {
  platform: "spotify" | "apple_music"
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
  type: "heart"
  created_at: string
}

export interface Comment {
  id: string
  entry_id: string
  user_id: string
  text: string
  created_at: string
  user?: User
}

export type PromptCategory = "Most Popular" | "Family" | "Friends" | "Remembering" | "Fun" | "Seasonal" | "Birthday"
