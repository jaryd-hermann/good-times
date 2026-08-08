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
  /**
   * Who reacted, oldest first. A bare count told you a thing happened but not
   * who it mattered to, which is the part people actually read a reaction for.
   * Optional so a payload from an older RPC still parses.
   */
  users?: Author[]
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
  /** True once the author has edited it. Drives the "edited" label. */
  edited?: boolean
  system_payload: {
    /** "birthday" | "member_joined" — see v2_on_message_insert, which pushes only for birthday. */
    event: string
    user_id?: string
    name?: string
  } | null
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
  /** `answered` marks who actually posted an answer for this date. */
  members: (Author & { answered?: boolean })[]
  /**
   * Answer MESSAGES in this group, not people. One answer cross-posted to three
   * groups contributes 1 here in each of them — do not sum this across groups to
   * count people; use TodayHub.answered_people.
   */
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
  /**
   * DISTINCT people other than you who have answered today across your groups.
   * Computed server-side because summing per-group answer_count double-counts
   * anyone who shared one answer to several groups.
   */
  answered_people?: number
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
