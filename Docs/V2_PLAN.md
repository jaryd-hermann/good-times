# Good Times v2 — Implementation Plan

**"One question for everyone"** — one hand-curated global question per day. You answer
once; the answer fans out to every group you're in; each group holds its own
conversation about it.

Status: plan, no code written. Supersedes the architecture outline and
`ONBOARDING_REVIEW.md`, both of which are folded in here. Corrections to those documents
are marked ⚠️.

---

## 0. Decisions locked

| # | Decision |
|---|---|
| 1 | **All pushes move to OneSignal.** `notification_queue` survives as an outbox (needed for digests); only the transport changes. |
| 2 | **Full migration.** `entries` → `answers` + `answer_shares`, `comments` → `messages`, `reactions` → `message_reactions`. History renders natively. |
| 3 | **Gating stays client-side blur.** RLS also stays off for now — accepted risk, see §12. |
| 4 | **`messages.thread_date` is NOT NULL.** Inside a day's thread, free chat and system messages are both encouraged. There is no messaging *outside* a question day. |
| 5 | **Digest/rollup for high-volume pushes.** Personal and directed events stay instant. |
| 6 | **Birthdays return as system messages** inside the day's thread, repliable like any message. Zero scheduling machinery. |
| 7 | **No answer detail pages.** Long answers expand/collapse inline; all context and replies live in the chat. |
| 8 | **Composer is mode-first**: Answer → pick Video / Voice / Text → mode flow → Review & share → Post. |
| 9 | **Songs removed from answers.** Mentions kept. |
| 10 | **`user_statuses` survives** (dormant — 0 rows in 30 days; minimal budget). |
| 11 | **Sunday photo dump uses the identical mechanic** — one answer, fanned out. No special case. |
| 12 | **Curation admin UI required**, plus an automatic fallback so a date can never be empty. |
| 13 | **The uncommitted OneSignal branch folds into this rewrite**, not shipped separately. |
| 14 | **Onboarding is answer-first**: 5 screens, first answer at #4, before any group exists. |
| 15 | **Unshared answers retro-share, always** — at their own date, never polluting newer threads, never pushing. |
| 16 | **First answer is skippable but strongly framed.** |
| 17 | **Birthday stays in onboarding, asked explicitly** — no silent default, skippable. |
| 18 | **Invites move to `invite_tokens`**; legacy UUID links keep resolving forever. |
| 19 | **Deferred install recovery = invite codes + paste suggestion.** No Branch, no silent clipboard read. |
| 20 | **Curation admin is a standalone local web portal** (`admin/`, Next.js + service role), not an in-app screen. Seeds the queue from measured engagement. |
| 22 | **Live transcription cut.** Transcription is post-hoc Whisper on the finished recording; no on-device speech recogniser, no new native dependency. |
| 21 | **Sharing is rebuilt, not migrated.** No v1 `/share/<entryId>` back-compat. Two share types — a single answer, or a whole thread — both routing into the chat. Same edge-function + OG + deep-link infra. |

### ⚠️ Corrections to the source documents

1. **Engagement pushes already exist.** Three live triggers — `on_new_entry`,
   `on_new_comment` (sending both `new_comment` and `comment_reply`), and
   `on_member_joined` — feed `notification_queue`, and the worker has delivered ~4,800
   `new_entry`, ~990 `new_comment`, ~580 `comment_reply`. §5 is a **refactor**, not a
   net-new build.
2. **The inactivity cron is scheduled** (jobid 33, `30 21 * * *`, ~3,110 sent).
3. **The daily push has a live DST bug** — `get8AMEstUTC` hardcodes 13:00 UTC with an
   explicit "no DST handling" comment, so it has fired at 9am EDT all summer.
4. **`group_prompt_queue` is not orphaned** — `getDailyPrompt` reads it (`lib/db.ts:1351`).
5. **`entries` has no unique constraint at all.** `UNIQUE(user_id, date)` is new behaviour
   even within one group.
6. **Multi-group is rare today**: 38/48 users are in exactly one group. Design 2C is the
   *primary* path, not the edge case.
7. **The AASA file is fine.** `ONBOARDING_REVIEW.md` §9 suspects it's unserved;
   `public/.well-known/apple-app-site-association` exists, is valid, declares
   `38NFF5BY78.com.jarydhermann.goodtimes` for `/join/*` and `/share/*`, and neither
   `vercel.json` rewrite shadows it. Worth one `curl` to confirm, but not a bug. The
   **Android `intentFilters` gap is real**.
8. **Birthdays are no longer dead.** `ONBOARDING_REVIEW.md` refinement #3 assumed birthday
   features die in v2. Decision 6 revived them, which makes `users.birthday` load-bearing
   and turns the silent-default problem into a launch blocker — see §4.3.

---

## 1. Data model

### 1.1 Curation

```sql
create table question_schedule (
  date        date primary key,
  prompt_id   uuid not null references prompts(id),
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  notes       text
);
```

**Fallback (critical).** With a global question, one unfilled date breaks the app for
every user. Resolution goes through `resolve_question_for_date(d date) returns uuid`,
preferring `question_schedule`, then an evergreen pool, then a hard-coded emergency prompt.

```sql
create materialized view prompt_engagement as
select p.id, p.question,
       sum(s.answers_count)::numeric / nullif(sum(s.group_size_at_time), 0) as answer_rate,
       count(*) as times_asked,
       max(s.date) as last_asked
from prompts p join prompt_usage_stats s on s.prompt_id = p.id
where p.category = 'Standard'
group by p.id, p.question
having count(*) >= 3;
```

⚠️ Do **not** use `prompts.global_completion_rate` — it returns values above 1.0 and is
not a rate. The pool excludes anything used in the last 180 days. 711 Standard prompts
have been asked at least once, so the pool is healthy.

`prompts` is pruned: drop `ice_breaker*`, `interests`, `birthday_type`,
`deck_id`/`deck_order`, `is_custom`/`custom_question_id`, `dynamic_variables`,
`featured_prompt_id`. Clean the dirty `category` values first (`'Custom'` vs `'Custom '`,
one empty string).

### 1.2 Answers

```sql
create table answers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  prompt_id    uuid not null references prompts(id),
  date         date not null,
  mode         text not null check (mode in ('video','voice','text')),
  text_content text,                    -- typed body, or transcript when included
  transcript   text,                    -- always stored for video/voice
  media_urls   text[],
  media_types  text[],
  captions     text[],
  mentions     uuid[],
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index answers_user_date_unique
  on answers (user_id, date) where date >= :cutover_date;

create table answer_shares (
  answer_id uuid not null references answers(id) on delete cascade,
  group_id  uuid not null references groups(id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (answer_id, group_id)
);
create index idx_answer_shares_group on answer_shares (group_id);
```

Changes from the outline: `embedded_media` is gone (decision 9); `mode` and `transcript`
are new (decision 8).

### Retro-share rule (decision 15)

An answer written before the user had any group has **zero** `answer_shares`. When they
later join or create a group, every unshared answer is shared into it — unbounded in time,
no cutoff.

Two constraints make this safe:

1. **It lands at its own date.** The generated message uses
   `thread_date = answers.date` and `created_at = answers.created_at`, so a three-day-old
   answer appears in that day's historical thread in correct chronological position. It
   never touches today's thread.
2. **It never notifies.** Retro-shares are written with a flag that suppresses the digest
   trigger — otherwise joining a group would fire "Sam answered today's question" for
   content days or weeks old.

```sql
-- called on group join / create
insert into answer_shares (answer_id, group_id)
select a.id, :group_id from answers a
where a.user_id = :user_id
  and not exists (select 1 from answer_shares s where s.answer_id = a.id);
```

Answers that were *deliberately* unshared — every group toggled off in 3E — are
indistinguishable from onboarding answers under this rule and will also surface on the
next join. Called out in §11 as a thing to watch rather than special-cased, since 3E
already lets the user pick per group.

### 1.3 Threads

Thread identity is `(group_id, thread_date)`. No threads table.

```sql
create table messages (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null references groups(id) on delete cascade,
  thread_date         date not null,
  kind                text not null check (kind in ('answer','chat','system')),
  user_id             uuid references users(id),   -- NULL for kind='system'
  text                text,
  media_urls          text[],
  media_types         text[],
  mentions            uuid[],
  answer_id           uuid references answers(id) on delete cascade,
  reply_to_message_id uuid references messages(id) on delete set null,
  system_payload      jsonb,
  suppress_notify     boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz
);

create index idx_messages_thread on messages (group_id, thread_date, created_at);
create unique index idx_messages_answer_group
  on messages (answer_id, group_id) where answer_id is not null;
```

Three kinds, one table: **`answer`** (the answer card, chronologically placed),
**`chat`** (plain inline message, decision 4), **`system`** (generated, authorless —
birthdays; repliable via `reply_to_message_id`, decision 6).

```sql
create table message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create table thread_reads (
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  thread_date date not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, group_id, thread_date)
);
```

⚠️ `message_reactions` is a behaviour change: `reactions` today is
`UNIQUE(entry_id, user_id)` — one reaction per person per entry.

`thread_reads` is per-thread, not per-group — design 2F shows unread badges on individual
historical rows.

### 1.4 Birthdays

A small daily cron inserts one `kind='system'` message per group per birthday:

```sql
insert into messages (group_id, thread_date, kind, system_payload)
select gm.group_id, current_date, 'system',
       jsonb_build_object('event','birthday','user_id', u.id)
from group_members gm join users u on u.id = gm.user_id
where u.birthday is not null
  and to_char(u.birthday,'MM-DD') = to_char(current_date,'MM-DD')
on conflict do nothing;
```

Volume is trivial (26 groups). Renders as a banner, repliable, one instant push per group.
Designs 2B and 2E already show the 🎂 affordances. **Requires the birthday cleanup in
§4.3** — without it this fires ~11 fake birthdays across 14 groups on March 14–15.

### 1.5 Invites and onboarding state

`invite_tokens` already exists with exactly the right columns
(`id, group_id, token, created_by, expires_at, created_at`), **0 rows and 0 code
references**. Implementing it needs no migration.

```sql
alter table users add column onboarded_at timestamptz;
alter table users add column is_admin boolean not null default false;
```

`onboarded_at` replaces the AsyncStorage `has_completed_post_auth_onboarding_<userId>` key
and the 10-minute account-age heuristic (`welcome-post-auth.tsx:69-74`,
`notifications-onboarding.tsx:75-80`), so reinstalls stop replaying onboarding.

### 1.6 Migration

Small data: 1,410 entries, 1,138 comments, 369 reactions, 48 users, 26 groups.

```
entries           → answers (mode='text', id preserved)
                  + answer_shares (one row, the entry's group_id)
                  + messages (kind='answer', thread_date = entries.date)
comments          → messages (kind='chat', reply_to_message_id → the answer message;
                     media_url/media_type wrapped into single-element arrays)
reactions         → message_reactions on the answer message
comment_reactions → message_reactions on the comment message
entries.embedded_media → dropped (decision 9); archived with the source table
users.birthday    → null out the 11 default rows (§4.3)
users.onboarded_at→ backfill = created_at for all existing users
```

Keep `entries`/`comments`/`reactions` renamed `*_v1_archive` until v2 has run clean for a
full release cycle.

### 1.7 Storage

⚠️ Not covered by the `000_baseline_*` files, which capture the `public` schema only.

| Bucket | Public | Purpose |
|---|---|---|
| `entries-media` | **true** | answer photos/video/audio |
| `avatars` | **true** | profile images |
| `onboarding-videos` | **true** | onboarding assets |

1,645 objects, 16 policies in the `storage` schema.

**All three buckets are public.** Combined with RLS being off on `entries` (decision 3),
every photo, video and voice note in the app is readable by anyone who has or can guess
the URL — and the URLs are readable from the database with the shipped anon key. This is
the same accepted-risk envelope as §12.3, but it is a distinct surface and is not fixed by
adding RLS to `public` alone. Logged as §12.8.

v2 needs no new buckets — `answers.media_urls` and `messages.media_urls` keep pointing at
`entries-media`. Migration moves no files. Should storage ever be locked down, the buckets
become private and reads move to signed URLs, which changes every media render path; that
is a separate project, not part of this one.

Auth configuration (providers `apple`, `email`, `google`; redirect URLs; email templates)
is likewise **not** captured in any repo file and is not reproducible from source. Worth
exporting before the rewrite touches the auth flow in phase 6.

---

## 2. Composer

Four steps, per designs 3A–3E.

**3A — Pick how you answer.** Question card, then Talking head (60s, auto-captioned),
Voice note (transcribed), Write it (text, photos, mentions). Photos attach inside any
mode. Last-used mode floats to the top — track usage counts in AsyncStorage; local
preference, no round trip.

**3B — Talking head.** Question pinned over the viewfinder; 60s ring; retake before
review; live caption strip.

**3C — Voice note.** Waveform, live transcript, `Include` toggle to post the transcript
alongside audio, scrub and trim.

**3D — Write it.** Question collapses to a strip on typing. Attachment row: Photos,
@Mention. ⚠️ The mockup still shows a **Song** chip — removed per decision 9.

**3E — Review & share.** Preview with `Captions on / Add photos / Trim`, per-group toggles
("Sharing to 2 of 3"), Post. Writes one `answers` row, one `answer_shares` row per enabled
group, and one `kind='answer'` message per group thread.

⚠️ At zero groups (the onboarding answer, §4.1) the share list is empty and the
"Unlocks all your groups for today" microcopy needs a variant.

### What's reusable

| Need | Existing | Verdict |
|---|---|---|
| Video capture | `VideoMessageModal.tsx` (929 lines), `expo-camera` v17 `recordAsync({maxDuration})`, front camera default | Strong reuse. expo-camera has **no pause/resume** — 3B's retake-only model is already compatible. |
| Audio capture | `CommentVoiceMemo.tsx`, `TranscriptionModal.tsx` (uncommitted), `expo-av` | Strong reuse |
| Transcription | `lib/openai-transcribe.ts` (uncommitted) — Whisper | *Final* transcript only — see risk below |
| Photos + captions | `MediaCaptions.tsx` (560 lines), `captions[]` already on entries | Direct reuse |
| Mentions | `MentionAutocomplete.tsx`, `MentionableText.tsx`, `mentions[]` | Direct reuse |
| Text body, upload, retry | `entry-composer.tsx` (4,220 lines) | Harvest, don't port — carries journal/birthday/custom-question branches that all die |

### ~~Live transcription~~ — CUT

**Decision (2026-08-01): live transcription is dropped.** No live caption strip on the
talking-head viewfinder (3B), no live transcript under the waveform (3C).

Transcription still happens, just **after** recording finishes: the existing
`transcribeAudioFromUri` posts the completed file to Whisper and the result is stored on
`answers.transcript`, so readers can still read instead of listen. 3C's `Include` toggle
still decides whether the transcript is posted alongside the audio.

What this buys: no `expo-speech-recognition` dependency, no
`NSSpeechRecognitionUsageDescription`, no native rebuild, and **the largest technical
unknown in the plan disappears** — video and voice capture become ordinary work on
`expo-camera` and `expo-av`, both already in the project.

UI consequence: 3B shows a recording timer rather than a rolling caption; 3C shows the
waveform with a "Transcribing…" state after you stop, rather than text appearing as you
speak.

Also: **`expo-av` is deprecated in SDK 54** in favour of `expo-audio` + `expo-video`.
Migrate during the composer rebuild, not after.

---

## 3. Thread rendering

Per decision 7 and design 4A there are **no answer detail pages**. This deletes
`entry-detail.tsx` (2,783 lines) and `birthday-card-entry-detail.tsx` (705 lines), moving
their comment composer into the thread's bottom message bar.

An answer card carries: author, `ANSWER` badge, timestamp, `· 3 groups` on your own card;
media carousel with dot indicators, `1 of 4` counter and per-photo caption overlay from
the existing `captions[]`; body text clamped to ~6 lines with `Show more ▼` / `Show less ▲`;
reaction row; and a `Reply ↩` affordance producing a quoted reply.

Chat messages render as plain bubbles; replies carry a quote stub. System messages render
as a centred banner and accept replies like anything else. A
`NEW — YOU HAVEN'T SEEN THIS` divider is positioned from `thread_reads.last_read_at`.

---

## 4. Onboarding, invites and sharing

### 4.0 What exists today

13 screens before home (15 with the memorial branch), verified against the route files:
welcome-1 → welcome-2 → welcome-3 → how-it-works → create-group/name-type → memorial
(+2) → about → auth → create-group/invite → welcome-post-auth → notifications-onboarding
→ set-theme → group-interests → home.

Verified sharp edges:

| # | Issue | Evidence |
|---|---|---|
| 1 | Tapping "Login" on welcome-1 silently deletes a pending invite | `welcome-1.tsx:94` `removeItem("pending_group_join")` |
| 2 | Boot router signs out any user missing name **or** birthday | `index.tsx:940` |
| 3 | Birthday picker silently defaults to 1969-03-15 | `about.tsx:49` |
| 4 | Invite links are raw group UUIDs; `invite_tokens` has **0 code references** | verified |
| 5 | Cold-start race: `_layout` pushes `/join/<id>` while the boot effect independently replaces the route | `app/index.tsx` / `app/_layout.tsx` |
| 6 | "Join Group" on welcome-1 is an explainer modal with no code-entry path | verified |
| 7 | Group creation forked | `auth.tsx:532 persistOnboarding` vs `lib/onboarding-actions.ts` |
| 8 | `swipe-onboarding.tsx` is 976 dead lines | every route in is commented out |
| 9 | Sign-in vs sign-up inferred from AsyncStorage; Apple/Google via web OAuth | `usesAppleSignIn: true` but config comment says web-based |
| 10 | No Android `intentFilters` | `app.config.ts` has `scheme` + iOS `associatedDomains` only |
| 11 | `pending_group_created` set in 1 file, read/cleared across 5 | verified — deleting `swipe-onboarding` removes one for free |
| 12 | Invited + not installed loses the invite entirely | no deferred linking of any kind |

### 4.1 The v2 flow

**Organic — 5 screens, answer at #4:**

1. **Splash** — brand, one line, Continue; "see how it works" as a quiet link.
2. **Auth drawer** — Apple / Google / email.
3. **Profile** — name + photo + birthday (explicit, skippable, §4.3).
4. **Answer today's question** — the real composer, no group yet. **Skippable but strongly
   framed** (decision 16): a quiet "skip for now" that lands them at step 5 with
   everything still locked.
5. **"You're alone here" → Create or Join** — Create = group name only → share sheet /
   copy link / contacts.

Notification prompt fires after the first answer or first invite sent, with a reason
("We'll tell you when your people answer") — not as a standalone screen.

**Invited — same spine:** splash shows inviter and group ("Sam invited you to The Rose
Period") → auth → profile → answer → **land directly in the group thread**, their answer
already posted and everyone else's unlocked. No "alone here" step.

**Existing user, invited, installed + signed in:** auto-join with undo toast — no confirm
screen. Depends on token expiry (§4.2) so a leaked link can't silently add strangers.

**Returning user, fresh install:** splash → auth (or FaceID straight through) → home.
Never replays onboarding, enforced by `users.onboarded_at`.

The groupless first answer is what makes this possible at all: with per-group
`daily_prompts` a user without a group had no question. `question_schedule` gives them one
on day one, and decision 15 makes sure it isn't orphaned.

### 4.2 Invites

**Tokens.** Joining redeems an `invite_tokens` row — expiry and revocation for free, a
prerequisite for silent auto-join. Legacy `/join/<uuid>` links keep resolving
**indefinitely** (decision 18); they're already in people's message threads. New shares
emit tokens.

**Deferred install recovery** (decision 19) — the App Store round-trip strips all context:

- **Human invite code** (`GT-7F3K`) shown on the join page and copied to the clipboard.
  The app's first-run screen gets a "Have an invite code?" entry — which also fixes sharp
  edge #6.
- **Paste suggestion, not clipboard read.** Make the code field a plain text input so iOS
  QuickType and Android Gboard offer the copied string as a suggestion. This is the
  "available to paste" affordance: one tap, **no permission prompt and no paste banner**,
  because the user taps the suggestion and the app never reads the clipboard.
  ⚠️ `textContentType="oneTimeCode"` does **not** help — that mechanism is SMS-driven.
- **Explicit "Paste invite code" button** as the guaranteed fallback, calling
  `Clipboard.getStringAsync()` on tap. This *does* trigger iOS's paste banner, but
  user-initiated and in context. **No silent read on launch.**
- **No Branch/AppsFlyer.** True zero-input deferred linking needs them; codes + paste
  suggestion get one tap, not zero. Revisit only if the funnel proves it necessary.

**Android App Links.** Add `intentFilters` to `app.config.ts` for
`thegoodtimes.app/join/*` and `/share/*` with `autoVerify`. Today Android https taps land
in the browser and rely on the JS `goodtimes://` hop.

**Invite context survives auth server-side** — attached to the pending token, not an
AsyncStorage key a stray "Login" tap can delete. Structurally fixes sharp edge #1.

### 4.3 Birthday

Decision 17: keep the ask in onboarding, but **explicitly** — remove the
`new Date(1969, 2, 15)` default from `about.tsx:49`; empty field, fill or actively skip.

**Cleanup migration.** Current data:

| | |
|---|---|
| Users with a birthday | 45 of 48 |
| On the silent `1969-03-15` default | 9 |
| Plus `1969-03-14` | 2 |
| **Junk share** | **24.4%** |
| **Groups that would fire a fake birthday Mar 14–15** | **14 of 26** |
| Genuine birthdays in the next 90 days | 9 |

Null out the 11 default rows. The §1.4 cron already guards on `birthday is not null`, so
cleaned users simply get no birthday message until they supply a real one.

**⚠️ Lockstep dependency.** Because birthday is now skippable, `index.tsx:940` must drop
birthday from its sign-out condition **in the same release** — otherwise every new v2 user
who skips is signed out on their second boot. Three users already trip the `name` half of
that check today. The gate becomes: signed in + `name` present + `onboarded_at` set.

### 4.4 Sharing

Decision 21. v1 sharing is **dropped, not migrated** — `/share/<entryId>` stops resolving.
v2 sharing is new but reuses the same infrastructure: a redirect edge function serving Open
Graph tags, an OG image renderer, the AASA/App Links paths, and a `goodtimes://` deep link.

**What is shareable.** An answer exists once (`answers`) but appears as a `kind='answer'`
message in each group it was shared to, and there are no answer detail pages (decision 7).
So the shareable object is the **message**, not the answer — `messages.id` identifies both
the content and which group's thread it lives in.

| Type | Target | Lands on |
|---|---|---|
| **Answer** — "here's my answer" | `messages.id` where `kind='answer'` | that group's thread, anchored to the message |
| **Thread** — "here's our group's discussion" | `(group_id, thread_date)` | that group's thread, at the question header |

Both route into the chat. Same screen, different anchor.

**Tokens, not raw IDs.** v1 keys the OG renderer on a raw `entryId` with a service-role
client and no auth, so anyone holding or guessing an entry UUID can render private group
content — including the entry's first photo, which the renderer uses as the image
background. v2 keys on an opaque token instead:

```sql
create table share_links (
  token       text primary key,           -- short, opaque, non-enumerable
  kind        text not null check (kind in ('answer','thread')),
  message_id  uuid references messages(id) on delete cascade,  -- kind='answer'
  group_id    uuid references groups(id) on delete cascade,    -- kind='thread'
  thread_date date,                                            -- kind='thread'
  created_by  uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  check ((kind = 'answer' and message_id is not null)
      or (kind = 'thread' and group_id is not null and thread_date is not null))
);
```

Gives revocation and non-enumerable URLs, and lets the OG renderer resolve a token instead
of trusting a caller-supplied UUID. URLs are `https://thegoodtimes.app/s/<token>`; the
deep link is `goodtimes://s/<token>`. Add `/s/*` to the AASA `paths` and the Android
`intentFilters` alongside `/join/*`.

**What the link preview may reveal.** These links are meant to leave the app — that's the
growth loop — so the preview is effectively public and gets cached by WhatsApp, iMessage
and every crawler that touches it. The two cases are not symmetrical:

- **Answer share** is the author exposing *their own* content, and only the author may
  create one. Preview shows the question, a short excerpt of their answer, and their first
  photo — same as v1.
- **Thread share** exposes *other people's* answers, and any member can create one.
  Preview shows the question, the group name and participant/answer counts — **no answer
  text and no member photos**. Conservative default; it is the one part of this design I'd
  flag for override, because loosening it later is easy and tightening it after links are
  cached is not.

**Recipient who isn't a member** lands on a join CTA carrying the group, not on the thread.
Since a thread share already identifies a group, it can optionally mint an `invite_tokens`
row so "here's our discussion" doubles as an invite — recommended, and it makes sharing a
genuine acquisition path rather than a dead end.

**Reused from v1:** `share-og-image` (re-keyed from `entryId` to token, and taught to render
the thread variant), the `join-redirect` OG/deep-link/store-fallback HTML pattern, and
`ShareModal.tsx` (rewritten for two share types; its existing WhatsApp/SMS/copy actions and
"Nudge your group" framing carry over).

### 4.5 Also cleaned up here

Explicit Sign in / Sign up states rather than inference from AsyncStorage; native Sign in
with Apple rather than the web OAuth round-trip; a single group-creation path replacing
the `persistOnboarding` / `createGroupFromOnboarding` fork; and the cold-start race
(sharp edge #5) resolved by having one owner of boot navigation.

⚠️ The uncommitted branch's `PUSH_CHANNELS_REGISTERED_KEY` / `needsPushRegistrationAttempt`
logic assumes registration happens at today's `notifications-onboarding` screen. Moving
the prompt to post-first-answer means that logic is **rewritten, not ported**.

---

## 5. Notifications

### 5.1 Transport

Everything on OneSignal, targeted by **external ID** (`OneSignal.login(supabaseUserId)` —
already in the uncommitted branch as `linkSupabaseUserId`).

`push_tokens` is retired, and with it all ten `.like('token', 'ExponentPushToken%')`
filters currently in the working tree — they ship and die in the same rewrite. The
`provider` column is moot. Multi-device works for free. Expo receipt checking is moot.

### 5.2 The daily question needs no queue at all

OneSignal delivers scheduled campaigns per-recipient-timezone natively. One campaign per
date with `delayed_option: "timezone"` and `delivery_time_of_day: "8:00AM"`, created by a
nightly cron once `question_schedule` resolves. Deletes `send-daily-notifications`
(334 lines), the DST bug, and ~5,700 queue rows per cycle.

### 5.3 Digest vs instant

| Event | Delivery |
|---|---|
| `daily_question` | OneSignal scheduled campaign, per-timezone 8am |
| `new_answer` | **digest** |
| `thread_message` | **digest** |
| `reaction` | **digest** |
| `reply_to_you` | instant |
| `mention` | instant |
| `birthday` | instant, one per group |
| `nudge` | cron, capped |
| `inactivity` | existing cron (unchanged) |
| *retro-shared answers* | **never** (decision 15) |

```sql
create table notification_digest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  thread_date date,
  type text not null,
  event_count int not null default 1,
  actor_ids uuid[] not null default '{}',
  first_event_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  flushed_at timestamptz
);

create unique index idx_digest_open
  on notification_digest (user_id, group_id, thread_date, type)
  where flushed_at is null;
```

Triggers **upsert** here instead of inserting a push per event. The worker flushes after
10 minutes of quiet **or** `event_count >= 5`: 1 actor → "Sam answered today's question";
2 → "Sam and Alex answered in The Fam"; 3+ → "Sam and 3 others answered in The Fam".

This quiet-window flush is why `notification_queue` survives decision 1 — OneSignal can't
coalesce events it hasn't been told about yet.

### 5.4 Preferences

⚠️ Migration 078 (uncommitted) adds two boolean columns. Since it folds into the rewrite,
replace it — nine event types shouldn't be nine columns:

```sql
alter table users add column notification_prefs jsonb not null default '{}'::jsonb;
```

with `notification_pref_enabled(user_id, type)` defaulting true on absent keys. **Every**
sender checks it — today only the daily push does.

### 5.5 Worker and nudge

Rewrite `process-notification-queue`: batch per OneSignal request, add
`attempts`/`last_error`/`next_attempt_at` with exponential backoff, and stop head-of-line
blocking (today a permanently failing row retries forever every 5 minutes while holding
its slot in a `limit(50)` ordered scan).

Nudge: late-morning cron per timezone — for each group where nobody has answered today and
at least one member has, push the non-answerers. Cap one per user per day across all
groups. Design 2B also exposes it manually.

---

## 6. Curation admin — local web portal

⚠️ Supersedes the earlier in-app-screen recommendation. This is a **standalone web app**,
run locally against Supabase for now, deployable to Vercel later without rework.

**Stack:** Next.js (App Router) in `admin/` with its own `package.json`, `@supabase/supabase-js`,
and the **service role key server-side only** — never in a client bundle, so all DB access
goes through server components and route handlers. This sidesteps RLS entirely (which is
off anyway, decision 3) and keeps the operator tool independent of app auth.

Not in the Expo project: there is no `web` target configured (`app/page.tsx` is a v0 build
stub, no `web` block in `app.config.ts`), and a phone is the wrong surface for scheduling
60 questions.

### Screens

1. **Dashboard** — live counts: users, groups, average group size, answers today, answer
   rate for today's question, groups with zero answers today.
2. **Queue** — the core. Calendar/list of upcoming dates showing date, question, source
   (scheduled vs fallback). Assign, swap, reorder, clear. Sundays pinned to the Journal
   prompt. Empty dates inside the next 30 days flagged loudly.
3. **Question bank** — searchable `prompts` table with engagement columns, filterable to
   "never used" / "used > 180 days ago". Assign straight to a date.
4. **Past performance** — per past date: question, unique answerers, % of active users,
   messages, reactions, groups with ≥1 answer. Sortable, so the best questions are
   discoverable for reuse.

### Seeding

The queue seeds from the most engaging questions already in the bank, ranked by the
`prompt_engagement` metric in §1.1 — `sum(answers_count) / sum(group_size_at_time)` over
`prompt_usage_stats`, minimum 3 asks. 711 Standard prompts qualify, so there is ample pool.

⚠️ Do **not** rank on `prompts.popularity_score` or `prompts.global_completion_rate`. The
latter returns values above 1.0 and is not a rate; both are legacy fields from the
personalization system being deleted.

Seeding is idempotent and never overwrites a hand-assigned date:

```sql
insert into question_schedule (date, prompt_id)
select d::date, p.id from generate_series(:from, :to, '1 day') d
cross join lateral (
  select e.id from prompt_engagement e
  where e.id not in (select prompt_id from question_schedule)
  order by e.answer_rate desc limit 1 offset (d::date - :from)
) p
on conflict (date) do nothing;
```

Sundays are assigned the Journal prompt before the ranked fill runs.

Plus a monitoring cron: if any date inside the next 7 days is unscheduled, push Jaryd.

---

## 7. Performance

| Cause | Fix |
|---|---|
| **Zero `FlatList` in the codebase** — `home.tsx` (7,111 lines) and `history.tsx` (6,391) render everything in a `ScrollView` | `FlashList` for thread, chat list, history. Also removes the scroll-restore hack. |
| **`staleTime: 0` + `refetchOnMount` + `refetchOnWindowFocus` globally** (`_layout.tsx:561`) across 166 `useQuery` sites, plus 53 explicit overrides | Per-family `staleTime`; Realtime for invalidation. |
| **N+1 per-date fetching** — three `Promise.all` loops, one round trip per date each (~90 requests for 30 days) | One RPC per screen. |
| **`select("*, user:users(*), prompt:prompts(*)")`** on every entry query | Explicit column lists. |

```
get_today_hub(user_id)              -- 2A/2B
get_thread(group_id, date, user_id) -- 2C/2D/4A
get_chat_list(user_id)              -- group rows, last message, unread, locked
get_history(user_id, filters)       -- 2F, paginated
```

Supabase Realtime on `messages` filtered to the open thread — the app's first realtime
feature (zero `.channel()` usage today).

The in-app bell moves off client polling (`lib/notifications-in-app.ts` recomputes from
AsyncStorage keys + per-group queries) onto the server-side `notifications` table, which
already has a `read` column and ~16,700 rows and is unused for this.

---

## 8. Screens

Two tabs — **Today** and **History**.

| Screen | Design | Notes |
|---|---|---|
| Splash (+ invited variant) | new | Inviter + group context when arriving from a link |
| Auth drawer | new | Apple / Google / email; explicit sign-in vs sign-up |
| Profile | new | Name + photo + explicit birthday (skippable) |
| First answer (groupless) | 3A–3E | Real composer; "skip for now" |
| "You're alone here" | new | Create / Join; invite code entry |
| Invite code + paste sheet | new | Also fixes welcome-1's dead Join button |
| Today — before answering | 2A | Question card, "Answer to unlock", audience pill |
| Today — after answering | 2B | Chat list with unread badges and inline Nudge |
| Composer modes | 3A–3E | Picker, talking head, voice, write, review & share |
| Thread | 2C / 2D / 4A | Answers + inline chat + quoted replies; expand/collapse; **no detail page**. 2C is the **primary** path — 38/48 users |
| Locked thread | screenshot 1 | Blurred previews + CTA |
| Group settings | 2E | Members, invite, per-group mute, rename, leave |
| Share sheet | — | Two modes (this answer / this discussion), rewritten from `ShareModal.tsx` |
| Shared-link landing | — | Non-member view: question, group, join CTA |
| History | 2F | Group-first rows; group/period/unseen filters |

---

## 9. Kill list

**Safe deletes — zero external references:** `app/(auth)/*`, `components/MediaViewer.tsx`,
`components/FilmFrame.tsx`, `app/(main)/group-settings/question-types.tsx`.

**Deleted by decision 7:** `entry-detail.tsx` (2,783), `birthday-card-entry-detail.tsx` (705).

**Deleted by decision 9:** `EmbeddedPlayer.tsx`, `lib/embed-parser.ts`, `user_songs`,
`group_songs`, `embedded_media` handling across 11 files. These tables fed interest/deck
personalization, which is also dying — full removal.

**Deleted by §4 (onboarding):** `welcome-2`, `welcome-3`, `how-it-works`,
`welcome-post-auth`, `set-theme`, `group-interests`, `memorial` ×3, `swipe-onboarding`
(976 dead lines), `start-new-group`. `about.tsx` becomes the profile step.

**Needs unwinding first:** `explore-decks` (12 refs).

**Features:** birthday *cards* (4 tables, 6 functions + crons, 3 screens, 3 banners,
composer — birthdays themselves survive as system messages, §1.4), memorials, custom
questions (4 tables, 4 functions, Mon/Thu cron, 3 screens), interests + discovery, decks/
featured (~700 lines of `lib/db.ts`), per-group queues (`daily_prompts`,
`group_prompt_queue`, `schedule-daily-prompts` at 2,426 lines, `initialize-group-queue`
at 1,082, `question_category_preferences`).

⚠️ `getDailyPrompt` reads `group_prompt_queue`, so remove it with the function
(`lib/db.ts:310–1857`), not before.

Historical birthday-card, custom-question and memorial *answers* stay readable.

---

## 10. Build sequence

1. **Foundations** — `question_schedule`, `resolve_question_for_date`, `prompt_engagement`,
   `prompts` cleanup, curation admin + monitoring cron.
2. ~~Composer spike~~ — **removed.** Live transcription was cut, so there is no unknown to
   de-risk. Migrate `expo-av` → `expo-audio`/`expo-video` during the composer build.
3. **Answers** — `answers` + `answer_shares` + retro-share, migration script, full
   composer 3A–3E.
4. **Threads** — `messages` (three kinds), `message_reactions`, `thread_reads`,
   comments/reactions migration, birthday cron + data cleanup, Realtime, the four RPCs.
5. **UX** — two-tab nav, Today hub, chat list, thread with expand/collapse, locked state,
   History rework, all on FlashList.
6. **Onboarding + invites + sharing** — 5-screen flow, `onboarded_at`, `invite_tokens`,
   codes + paste, `share_links` + rebuilt share sheet + re-keyed OG renderer (§4.4),
   `/s/*` added to AASA and Android intentFilters, boot-gate change (must land with the
   birthday change), auth cleanup, group-creation de-fork.
7. **Notifications** — OneSignal cutover (folding in the uncommitted branch), digest table
   + trigger rewrite, per-type prefs, nudge cron, worker retry/backoff.
8. **Cutover** — kill list, dead-code purge, archive rename, analytics taxonomy swap
   (§12.1), `/share` decision (§12.2), version bump to 2.0.0, phased App Store release.

Cross-cutting, not a phase: the analytics events in §12.1 must ship **before** cutover, or
the multi-group premise (§13.7) can't be measured. The `.gitignore` cleanup and
`send-notification` deletion (§12.3) can happen any time.

Phases 3 and 4 carry data-migration risk. Phase 6 has the one hard ordering constraint
(birthday ↔ boot gate). Phases 1 and 7 are independently shippable.

---

## 11. Verification

- **Fan-out** — user in 3 groups answers once: visible in all 3 threads with independent
  replies and reactions; toggling a group off in 3E hides it there; a second account that
  hasn't answered sees the blurred thread.
- **Single group** — the 2C path: no audience pill, post lands straight in the thread.
- **Retro-share** — answer with no group, join a group 3 days later: the answer appears in
  that group's history **at its original date**, not in today's thread, and **fires no
  push**. Also confirm a deliberately-unshared answer surfacing on a later join reads
  acceptably (§1.2).
- **Unlock asymmetry** — toggling a group off in 3E still unlocks it for reading. Gating
  keys off the `answers` row, not `answer_shares`.
- **Onboarding** — organic: 5 screens, skip path works and lands locked. Invited: lands in
  the group thread with the answer already posted. Reinstall: never replays. Skipping
  birthday does **not** cause a sign-out on next boot.
- **Invites** — legacy `/join/<uuid>` still resolves; token link expires; auto-join undo
  works; code entry works; paste suggestion appears on a fresh install (iOS and Android);
  Android https tap opens the app, not the browser.
- **Sharing** — an answer share opens that group's thread anchored to the message; a thread
  share opens at the question header; a member lands in the thread, a non-member lands on
  the join CTA. Revoking a token kills both the page and the OG image. The thread-share
  preview shows **no** other member's answer text or photos. A stale `/share/<entryId>`
  link shows the expired-link page, not a 404 or a crash.
- **Composer modes** — video/voice/text each reach 3E and post; photos attach in all three;
  transcript Include toggle behaves.
- **Timezone** — ET/PT/CET get the same date's question and 8am *local* pushes. Re-test
  across a DST boundary.
- **Digest** — five answers in one group within ten minutes produce one push, not five; a
  direct reply still arrives instantly.
- **Birthday** — system message appears for the right group, is repliable, pushes once;
  cleaned users produce nothing on Mar 14–15.
- **Migration** — pre-cutover history renders identically; comments appear as chat
  messages; reactions preserved.
- **Fallback** — delete tomorrow's `question_schedule` row; confirm an evergreen question
  is served and Jaryd is alerted.
- **Perf** — cold start to interactive; 200-message thread scroll; History with 12 months.

---

## 12. Operational scope

Work that is part of the rewrite but sits outside the feature sections above.

### 12.1 Analytics

52 `captureEvent()` call sites and an 802-line taxonomy in `docs/POSTHOG_EVENTS.md`. v2
invalidates most of it: the onboarding funnel is replaced wholesale, `entries` become
`answers`, `comments` become `messages`, and birthday-card/custom-question/deck events
describe features that no longer exist.

This needs its own pass, not incidental edits, because §12.9 depends on it — "measure the
multi-group premise" is impossible without events defined *before* cutover. Minimum new set:

- `question_answered` with `mode` (video/voice/text), `groups_shared_count`, `time_to_answer`
- `answer_skipped` (decision 16 — how many people take the skip)
- `thread_opened`, `message_sent`, `reaction_added`
- `group_created`, `group_joined` with `source` (link / code / paste)
- `onboarding_step_completed` for the 5-screen flow, to compare against today's 13-screen funnel
- `push_received` / `push_opened` by type, to prove the digest is working

Retire every birthday-card, custom-question, deck, interest and swipe event.

### 12.2 Retiring v1 share links

Sharing is designed in §4.4. The cleanup: `/share/<entryId>` stops resolving (decision 21),
so links already sent in people's message threads will break. At current scale that is
acceptable; the alternative is keeping a resolver alive against `entries_v1_archive`
indefinitely. Serve a friendly "this link has expired — open Good Times" page from the same
edge function rather than a 404, and drop `/share/*` from the AASA `paths` once `/s/*` ships.

Note `share-og-image` is deployed with `verify_jwt: false`, as are `send-daily-notifications`
and `send-custom-question-notifications`. Public invocability is correct for the OG renderer;
for the notification senders it means anyone who knows the URL can trigger a push blast.
Fix during the phase 7 notification work.

### 12.3 Repo/deployment drift

`send-notification` exists in the repo, is **not deployed**, and has zero callers — delete
it with the kill list. 23 functions are deployed against 24 in the repo; every other one
matches.

Also still tracked and dirtying every diff: `.DS_Store` and `supabase/.temp/cli-latest`.
`git rm --cached` both and add to `.gitignore`.

### 12.4 The uncommitted branch

~40 modified files plus 8 new ones are in the working tree. Decision 13 folds them into the
rewrite rather than shipping them first, so they need an explicit keep/discard pass:

- **Keep and build on:** `lib/onesignal.ts`, `lib/openai-transcribe.ts`,
  `lib/prepare-audio-playback.ts`, `TranscriptionModal.tsx`, the `join-redirect` OG rewrite,
  migration 077 (push_tokens RLS).
- **Rewrite:** `NotificationPermissionResumeHandler.tsx` and the
  `PUSH_CHANNELS_REGISTERED_KEY` logic (registration point moves to post-first-answer),
  migration 078 (becomes `notification_prefs` jsonb, §5.4).
- **Discard on arrival:** all ten `.like('token', 'ExponentPushToken%')` filters, and
  `push_tokens` handling generally, once external-ID targeting lands.
- **Unrelated, resolve separately:** the ~50 lines of scroll-restore logic deleted from
  `home.tsx`. Confirm that was intentional; it becomes moot when FlashList lands (§7).

### 12.5 Release and rollback

- **Rollback.** Phases 3–4 rewrite live data. `entries`/`comments`/`reactions` survive as
  `*_v1_archive`, so the DB is recoverable — but a shipped binary is not. Any release
  containing the cutover needs the previous build ready to re-promote, and the archive
  tables must not be dropped until a full release cycle has passed.
- **Staged rollout.** This changes every screen. Use a phased App Store release rather than
  100% day one.
- **Version.** `app.config.ts` is at 1.2.5 / build 6 with `runtimeVersion` pinned to the
  app version. v2 is a major: bump to 2.0.0 and bump `runtimeVersion` in lockstep, or OTA
  updates will target the wrong binaries.
- **The birthday ↔ boot-gate constraint (§4.3) is the one change that cannot be split
  across releases.**

---

## 13. Open risks

1. ~~**Live transcription**~~ — **CUT 2026-08-01.** Transcription is post-hoc Whisper on
   the finished file. No new native dependency; video/voice capture is now ordinary work.
2. **Paste suggestion is OS behaviour, not an API.** QuickType/Gboard usually surface a
   copied code but we can't force it. The explicit "Paste invite code" button is the
   guarantee; without Branch, deferred install is one tap, never zero.
3. **RLS stays off — accepted (decision 3).** 16 tables including `users`, `entries`,
   `comments`, `group_members`; anyone with the shipped anon key can read every answer,
   message and email. Fine while invite-only. Revisit before public growth — and write
   policies *before* enabling, since bare `ENABLE ROW LEVEL SECURITY` breaks the app.
4. ~~**Migrations 001–059 are absent from the repo.**~~ **RESOLVED 2026-08-01.**
   Reconstructed from the live catalog into `000_baseline_01..04` (+ `_05` cron
   reference). Verified object-for-object against the live database. Two secrets were
   found and redacted in the process: a JWT in every pre-job-54 cron definition, and the
   **anon key hardcoded in the body of `public.send_welcome_email`** — that function
   should be rewritten to read `get_app_setting('supabase_anon_key')` at runtime.
5. **`expo-av` is deprecated in SDK 54.** Migrate during the composer rebuild.
6. **Birthday coverage will drop.** Explicit-and-skippable yields fewer birthdays than
   today's 45/48 — but today's are 24% fiction. Watch the real fill rate after cutover.
7. **The multi-group premise.** Fan-out serves 7 of 48 users today. Measure deliberately —
   which requires the events in §12.1 to exist *before* cutover, not after.
8. **All three storage buckets are public** (§1.7). Every photo, video and voice note is
   readable by URL, and those URLs are readable with the shipped anon key. Same accepted-risk
   envelope as #3, but a separate surface that fixing `public`-schema RLS does not address.
9. **Auth config is not in source** — providers, redirect URLs and email templates exist
   only in the Supabase dashboard. Export before phase 6 touches the auth flow.
10. **Three edge functions deploy with `verify_jwt: false`**, including
    `send-daily-notifications` — anyone with the URL can trigger a push blast. Fix in phase 7.

---

## 14. Known-unplanned

Deliberately out of scope, recorded so they are not mistaken for oversights:

- **Locking down storage** (private buckets + signed URLs). Touches every media render path.
- **Enabling RLS on the `public` schema.** Decision 3 defers it; revisit before public growth.
- **Web/desktop clients.** The admin portal (§6) is the only web surface.
- **An automated test suite.** §11 is a manual checklist; there is no test infrastructure in
  the repo today and this plan does not add any.
- **Deferred deep linking via Branch/AppsFlyer** (decision 19) — codes + paste gets one tap,
  not zero.
