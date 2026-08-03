# Onboarding Review & v2 Redesign Proposal

Deep dive on the current onboarding flow (new users, existing users, invited users), what's broken, and the proposed v2 flow. Companion to `Docs/V2_PLAN.md` (the "One Question for Everyone" pivot) — the answer-first onboarding below **depends on** the v2 global question schedule.

**TL;DR:** A new user today sees **13 screens before home** (15 with the memorial branch), and an invited user who doesn't have the app installed **loses the invite entirely** (no deferred deep linking). The proposed flow cuts to ~5 screens with the first answer as the activation moment.

---

## Part 1 — What exists today

### New user (organic)

welcome-1 → welcome-2 (founder intro) → welcome-3 (positioning) → how-it-works → group name/type → memorial Yes/No (+2 screens if Yes) → about (name, birthday, photo) → auth → invite share → welcome-post-auth → notifications → set-theme → group-interests → home.

**13–15 screens, ~14 taps** before any value. The user builds a group and a profile before they've answered a single question.

### Returning user (fresh install)

welcome-1 → tap Login → auth → home. Two screens — fine — but:

- FaceID auto-login only works if stored credentials survived.
- The "onboarding complete" flag lives **only in AsyncStorage** (`has_completed_post_auth_onboarding_<userId>`), so a reinstall can replay onboarding screens for existing users — mitigated only by a "account older than 10 minutes" heuristic (`welcome-post-auth.tsx:71`, `notifications-onboarding.tsx:77`).

### Invited user — three variants

| Variant | What happens |
|---|---|
| Installed + signed in | Link opens a confirm screen (`app/join/[groupId].tsx`: "Sam invited you to join…") → tap Join → membership insert → home. Not auto-join, but close. |
| Installed, not signed in | Group ID stashed in AsyncStorage (`pending_group_join`) and resumed after auth — but the user still walks **10 screens** (welcome-2, welcome-3, how-it-works, about, auth, welcome-post-auth, notifications, set-theme, group-interests) before seeing the group they were invited to. |
| Not installed | `join-redirect` edge function serves an OG page that bounces to the App Store — and that's it. **No Branch, no clipboard handoff, nothing.** The app opens cold with zero knowledge of the invite; the user must go find the link and tap it again. This is almost certainly the biggest invite-funnel leak. |

### Sharp edges found in the trace

1. **Tapping "Login" on welcome-1 deletes a pending invite** (`welcome-1.tsx:94` removes `pending_group_join`) — an invited user who taps Login instead of Join silently loses the group join.
2. **Birthday is a session-killer**: the boot router (`app/index.tsx:940`) signs out any authed user whose profile lacks name or birthday. The date picker in `about.tsx` silently defaults to 1969-03-15, so most users ship a fake DOB.
3. **Invite links are raw group UUIDs** (`thegoodtimes.app/join/<groupId>`) — no expiry, no revocation. The `invite_tokens` table exists in the schema and is referenced by **zero** lines of code.
4. **Cold-start race**: opening a join link when the app isn't running can get clobbered by the boot router (`app/index.tsx`) navigating to home/welcome over the join screen — `_layout.tsx` pushes `/join/<id>` while the boot effect independently replaces the route.
5. **The "Join Group" button on welcome-1 is a dead end** — an explainer modal ("follow the invite link…"), no code-entry path anywhere in the app.
6. **Group creation logic is forked**: onboarding creates the group inside `auth.tsx` (`persistOnboarding`), while "Create another group" uses `lib/onboarding-actions.ts:createGroupFromOnboarding` — near-duplicate implementations.
7. **`swipe-onboarding.tsx` is ~1,000 dead lines** — every route into it is commented out.
8. **Auth sign-in vs sign-up is inferred, not chosen** — from AsyncStorage state, with implicit signup-on-failed-login and a "No Account Found" modal fallback. Apple/Google go through web OAuth (no native Sign in with Apple).
9. **Android App Links are not declared** in `app.config.ts` (no `intentFilters`) — Android https taps land in the browser and rely on the JS `goodtimes://` hop. Also, the AASA file route is missing from the `vercel.json` rewrite list, so iOS Universal Link verification is worth checking.
10. **`pending_group_created` cleanup is inconsistent** — set in one place, cleared in five; if any route is skipped it lingers and hijacks the next boot's routing.

---

## Part 2 — Proposed v2 flow

### Why the proposal works (and what it depends on)

- **Answer before group** only became possible with the v2 pivot — today a user with no group has no question (questions are per-group `daily_prompts` rows). With the global `question_schedule`, a groupless user has a question on day one. **Activation = first answer, not group creation.**
- **"You're alone here — let's get your people in"** is the right emotional beat: group creation becomes *motivated* (you've answered, you want someone to see it) instead of homework.
- **Splash → Continue → auth drawer** kills welcome-2/3/how-it-works. Keep the "show me more" gallery as an optional link — don't force three screens of pitch on someone who tapped an invite from a friend (the friend *is* the pitch).

### The flows

**New user, organic — 5 screens, answer at #4:**

1. **Splash** — brand + one line + Continue ("see how it works" as a quiet link)
2. **Auth drawer** — Apple / Google / email
3. **Profile** — name + photo only (no DOB — see below)
4. **Answer today's question** — the real app composer, no group yet
5. **"You're alone here" → Create or Join** — Create = group name only → share sheet / copy link / contacts
6. *(Notification prompt — after first answer or first invite sent, with a reason)*

**New user, invited — same spine, one swap:**

Join link → app (or store → code/clipboard recovery) → splash shows group context ("Sam invited you to The Rose Period") → auth → profile → **answer today's question** → land directly in the group thread, where their answer is already posted and everyone else's answers unlock. No "alone here" step. This is the best first session in the app: they arrive to a live conversation they've already earned entry into.

**Existing user, invited, installed + signed in:**

**Auto-join + undo** — no confirm screen. Join immediately, land in the group, toast: "You joined The Rose Period — Undo." (Requires token expiry first — see below — so a leaked link can't silently add strangers.)

**Returning user, fresh install:**

Splash → auth (or FaceID straight through) → home. Never replays onboarding.

### Key refinements

**1. Deferred deep linking — the one real gap in the sketch.** App Store installs strip all context; "the link has that path" doesn't happen for free. In order of preference:

- **Short invite codes as the universal fallback.** Implement the dormant `invite_tokens` table with a human code (e.g. `GT-7F3K`). The join web page says "Get the app, then enter code GT-7F3K" and copies it to the clipboard; the app's first-run screen gets a "Have an invite code?" entry (also fixes the welcome-1 dead-end button). Works 100% of the time, no SDK, no privacy prompts.
- **Clipboard handoff on top**: on first launch, check the clipboard for a `thegoodtimes.app/join/...` URL or code pattern and *offer* "Join Sam's group?" — one tap when it works. (iOS shows a paste notification; make it an offer, not a silent read.)
- **Skip Branch/AppsFlyer** until codes + clipboard prove insufficient — SDK weight, cost, and ATT-adjacent privacy surface for a private-by-design app.

**2. Tokens, not UUIDs.** Joining should redeem an `invite_tokens` row, not a raw group UUID — expiry and revocation for free, which is a prerequisite for silent auto-join.

**3. Cut the DOB from onboarding.** Birthday features die in v2; if the lightweight "🎂 it's Sam's birthday" thread idea survives, ask for birthday later, in-context ("add your birthday so your groups can celebrate you") — not as a gate. Today's silent-1969-default proves people won't give it honestly, and it's currently a sign-out bug waiting to fire.

**4. Notification prompt with a reason, at peak intent.** "We'll tell you when your people answer" — after the first answer or first invite sent. In v2 the engagement pushes are the whole growth loop, so opt-in rate here matters more than anything else in onboarding.

**5. Kill from onboarding entirely:** memorial branch, set-theme (default to system; it's in Settings), group-interests (dead in v2), welcome-post-auth (fold the "I'm Jaryd, find me in settings" note into a first-session card or the alone-here screen), group type family/friends (dies with the features that used it, or moves to group settings).

**6. Server-side onboarding state.** Add `users.onboarded_at` (or infer from "has profile") instead of AsyncStorage keys — reinstalls stop replaying onboarding, the 10-minute heuristic dies.

**7. Invite context persists server-side through auth** — attach the pending token to the auth session or re-read it post-auth, not an AsyncStorage key that a stray "Login" tap deletes (structurally fixes sharp edge #1).

**8. Auth cleanup when this is built:** explicit Sign in / Sign up states rather than inferred-from-AsyncStorage; native Sign in with Apple rather than the web OAuth round-trip.

---

## Part 3 — Flow comparison

| Persona | Today | Proposed |
|---|---|---|
| New user, organic | 13–15 screens, answer comes after everything | 5 screens, answer at #4 |
| New user, invited | 10 screens, group last | 5 screens, lands in group thread |
| Invited, app not installed | Invite lost at App Store | Code/clipboard recovery → same as invited |
| Invited, installed + signed in | Confirm screen → home | Auto-join + undo → group thread |
| Returning, fresh install | 2 screens, may replay onboarding | Splash → auth → home, never replays |

---

## Screens to mock in Claude Design

1. Splash (with invited-context variant showing inviter + group)
2. Auth drawer (Apple / Google / email)
3. Profile (name + photo)
4. First-answer composer (groupless state)
5. "You're alone here" → Create / Join
6. Create group (name → invite: share link / copy / contacts)
7. "Have an invite code?" entry + clipboard-offer sheet
8. Auto-join undo toast + landing-in-thread moment
9. Contextual notification prompt
