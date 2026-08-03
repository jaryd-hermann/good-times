/**
 * v2 domain types.
 *
 * These mirror the jsonb shapes returned by the v2_* RPCs, which are the ONLY
 * supported read path — screens make one call, not a fan-out. See docs/V2_PLAN.md §7.
 */

export type AnswerMode = "video" | "voice" | "text"
export type MessageKind = "answer" | "chat" | "system"
export type MediaType = "photo" | "video" | "audio"

export type Author = {
  id: string
  name: string | null
  avatar_url: string | null
}

export type Reaction = {
  emoji: string
  count: number
  mine: boolean
}

export type AnswerPayload = {
  id: string
  mode: AnswerMode
  text_content: string | null
  transcript: string | null
  media_urls: string[] | null
  media_types: MediaType[] | null
  captions: (string | null)[] | null
  /** Weekday each photo was taken ("Mon"), parallel to media_urls. Null where unknown. */
  media_days?: (string | null)[] | null
  /** How many groups this answer went to. Renders as "· 3 groups" on your own card. */
  share_count: number
  /** Present instead of the fields above when the thread is gated. */
  redacted?: boolean
}

export type ReplyStub = {
  id: string
  author: string
  /** Falls back to "Photo" / "Video" / "Voice note" when the message has no text. */
  excerpt: string
  /** First media item of the replied-to message, for the quote thumbnail. */
  reply_media?: string | null
  reply_media_type?: string | null
}

export type ThreadMessage = {
  id: string
  kind: MessageKind
  created_at: string
  thread_date: string
  author: Author | null
  text: string | null
  media_urls: string[] | null
  media_types: MediaType[] | null
  /** True when the thread is locked — content was withheld server-side, not just hidden. */
  redacted: boolean
  answer: AnswerPayload | null
  reply_to: ReplyStub | null
  reactions: Reaction[]
  system_payload: { event: string; user_id?: string; name?: string } | null
}

export type ThreadGroup = {
  id: string
  name: string
  member_count: number
  answered_count: number
  is_admin: boolean
  members: (Author & { answered?: boolean })[]
}

export type Thread = {
  group: ThreadGroup
  date: string
  question: { prompt_id: string; text: string }
  locked: boolean
  last_read_at: string | null
  messages: ThreadMessage[]
  error?: "not_a_member"
}

export type HubGroup = {
  id: string
  name: string
  member_count: number
  members: Author[]
  answer_count: number
  message_count: number
  unread_count: number
  has_birthday: boolean
  last_message: { text: string; author: string; kind: MessageKind } | null
  last_activity: string | null
}

export type MyAnswer = {
  id: string
  mode: AnswerMode
  text_content: string | null
  transcript: string | null
  media_urls: string[] | null
  media_types: MediaType[] | null
  captions: (string | null)[] | null
  /** Weekday each photo was taken ("Mon"), parallel to media_urls. Null where unknown. */
  media_days?: (string | null)[] | null
  created_at: string
  shared_group_ids: string[]
}

export type TodayHub = {
  date: string
  question: { prompt_id: string; text: string }
  locked: boolean
  my_answer: MyAnswer | null
  groups: HubGroup[]
}

export type ChatListRow = {
  id: string
  name: string
  member_count: number
  members: Author[]
  locked: boolean
  unread_count: number
  last_message: { text: string; author: string; kind: MessageKind; thread_date: string } | null
  last_activity: string | null
}

export type HistoryRow = {
  group_id: string
  group_name: string
  thread_date: string
  question: string
  answer_count: number
  message_count: number
  video_count: number
  last_activity: string
  last_message: { author: string; text: string } | null
  unread_count: number
  preview_people: PreviewPerson[]
}

export type PreviewPerson = {
  user_id: string
  name: string
  avatar_url: string | null
  urls: string[]
  total: number
}

export type RangeQuestion = { prompt_id: string; text: string; answered: boolean }
export type RangeQuestionMap = Record<string, RangeQuestion>
