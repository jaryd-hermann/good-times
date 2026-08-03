import { captureEvent } from "../posthog"

/**
 * The v2 funnel, in one place.
 *
 * Before this the whole app had five capture calls — logged_out, the two
 * notification-permission ones, and created_group, which lives in v1's lib/db.ts
 * and is not on any v2 path. Nothing in (v2) or (onboarding-v2) was instrumented,
 * so there was no way to see where people fell out of onboarding.
 *
 * Names are centralised here rather than passed as strings at each call site,
 * because a typo in an event name is invisible: nothing errors, the event just
 * quietly lands under a new name and the funnel undercounts forever.
 *
 * Conventions:
 *  - snake_case, past tense, object first: `group_created`, not `createGroup`.
 *  - screen views that matter to the funnel are explicit `*_viewed` events, not
 *    left to autocapture, so renaming a route cannot silently break a funnel.
 *  - no message bodies, names, emails or invite tokens as properties. Group and
 *    prompt ids are fine; they are not personal data and they make cohorts useful.
 */

export type SignInMethod = "email" | "apple" | "google"
export type AnswerMethod = "text" | "video" | "voice"

export const v2Analytics = {
  // ---- acquisition -------------------------------------------------------
  splashViewed: () => captureEvent("splash_viewed"),

  authViewed: () => captureEvent("auth_viewed"),

  /** New account. `method` separates the email form from the two SSO buttons. */
  signedUp: (method: SignInMethod) => captureEvent("signed_up", { method }),

  /** Returning user. Kept distinct from signed_up so activation is measurable. */
  signedIn: (method: SignInMethod) => captureEvent("signed_in", { method }),

  // ---- onboarding --------------------------------------------------------
  profileViewed: () => captureEvent("profile_viewed"),

  /** Both optional fields are flagged so we can see what people actually fill in. */
  profileCreated: (opts: { hasPhoto: boolean; hasBirthday: boolean }) =>
    captureEvent("profile_created", {
      has_photo: opts.hasPhoto,
      has_birthday: opts.hasBirthday,
    }),

  notificationsViewed: (stage: "pre" | "post") =>
    captureEvent("notifications_viewed", { stage }),

  /** The outcome of the CTA, not of the OS dialog — see notification_permission_*. */
  notificationsChoice: (enabled: boolean) =>
    captureEvent("notifications_choice", { enabled }),

  // ---- core loop ---------------------------------------------------------
  questionAnswered: (opts: {
    method: AnswerMethod
    hasMedia: boolean
    isEdit: boolean
    /** 0 for today, 1 for yesterday, … — catches back-filling of missed days. */
    dayOffset: number
    groupCount: number
  }) =>
    captureEvent("question_answered", {
      method: opts.method,
      has_media: opts.hasMedia,
      is_edit: opts.isEdit,
      day_offset: opts.dayOffset,
      group_count: opts.groupCount,
    }),

  // ---- groups ------------------------------------------------------------
  /** `from` distinguishes the onboarding step from the in-app menu. */
  groupCreated: (opts: { groupId: string; from: "onboarding" | "app" }) =>
    captureEvent("group_created", { group_id: opts.groupId, from: opts.from }),

  /** `via` separates a tapped invite link from a hand-pasted code. */
  groupJoined: (opts: { groupId: string; via: "link" | "code" }) =>
    captureEvent("group_joined", { group_id: opts.groupId, via: opts.via }),

  /** Sharing the invite out — the growth loop's one measurable step. */
  groupMemberInvited: (opts: { groupId: string; channel: "share" | "copy" }) =>
    captureEvent("group_member_invited", {
      group_id: opts.groupId,
      channel: opts.channel,
    }),

  // ---- engagement --------------------------------------------------------
  historyViewed: () => captureEvent("history_viewed"),

  threadOpened: (opts: { groupId: string; hadUnseen: boolean }) =>
    captureEvent("thread_opened", { group_id: opts.groupId, had_unseen: opts.hadUnseen }),

  /** `kind` is the thing worth knowing: replies mean conversation, not broadcast. */
  messageSent: (opts: { groupId: string; kind: "open" | "reply"; hasMedia: boolean }) =>
    captureEvent("message_sent", {
      group_id: opts.groupId,
      kind: opts.kind,
      has_media: opts.hasMedia,
    }),
}
