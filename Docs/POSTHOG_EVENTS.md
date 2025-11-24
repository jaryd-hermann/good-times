# PostHog Events Documentation

## Overview

This document outlines all PostHog events tracked in the Good Times app. These events enable comprehensive analytics for user behavior, funnel conversion, retention, and engagement metrics.

## Event Categories

- **Onboarding Flow** - Events tracking user journey from first app open through account creation
- **Core App Usage** - Events tracking daily app usage and engagement
- **Settings & Configuration** - Events tracking user preferences and settings changes
- **Social Features** - Events tracking interactions between users (comments, reactions, shares)
- **Notifications** - Events tracking push notification permissions

---

## Onboarding Flow Events

### 1. `onboarding_started`

**Description:** Fired when user first lands on the welcome screen (welcome-1).

**Properties:**
- `source` (string): How user arrived at onboarding
  - `"default_landing"` - User opened app normally
  - `"invite_page"` - User arrived via deep link to join a group

**Trigger:** Screen load of `app/(onboarding)/welcome-1.tsx`

**Questions Answered:**
- How many users start onboarding?
- What percentage come from invites vs. organic discovery?
- Conversion rate from onboarding start to account creation

---

### 2. `loaded_jaryd_intro_1`

**Description:** User viewed the first intro screen (welcome-2).

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/welcome-2.tsx`

**Questions Answered:**
- Drop-off rate after first intro screen
- Time spent on intro screens

---

### 3. `loaded_jaryd_intro_2`

**Description:** User viewed the second intro screen (welcome-3).

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/welcome-3.tsx`

**Questions Answered:**
- Drop-off rate through intro sequence
- Completion rate of intro screens

---

### 4. `loaded_how_it_works`

**Description:** User viewed the "How It Works" screen.

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/how-it-works.tsx`

**Questions Answered:**
- How many users view the explanation before proceeding?
- Impact of "How It Works" on conversion

---

### 5. `loaded_create_group`

**Description:** User reached the group creation screen (name-type selection).

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/create-group/name-type.tsx`

**Questions Answered:**
- Conversion rate to group creation screen
- Drop-off at group creation step

---

### 6. `loaded_memorial`

**Description:** User viewed the memorial introduction screen.

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/memorial.tsx`

**Questions Answered:**
- How many users proceed to memorial setup?
- Memorial feature adoption rate

---

### 7. `added_memorial`

**Description:** User successfully added a memorial to their group.

**Properties:**
- `has_photo` (boolean): Whether user uploaded a photo for the memorial

**Trigger:** Successful memorial creation in `app/(onboarding)/memorial-input.tsx`

**Questions Answered:**
- Memorial creation completion rate
- Photo upload rate for memorials
- Impact of memorials on engagement

---

### 8. `loaded_memorial_preview`

**Description:** User viewed the memorial preview screen.

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/memorial-preview.tsx`

**Questions Answered:**
- Memorial preview engagement
- Drop-off after memorial creation

---

### 9. `loaded_about`

**Description:** User viewed the "About" screen.

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/about.tsx`

**Questions Answered:**
- About screen engagement
- Impact on conversion

---

### 10. `loaded_registration`

**Description:** User reached the registration/auth screen.

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/auth.tsx`

**Questions Answered:**
- Conversion rate to registration screen
- Drop-off at registration step

---

### 11. `created_account`

**Description:** User successfully created an account (registered).

**Properties:** None

**Trigger:** Successful account creation in `app/(onboarding)/auth.tsx` or `app/(auth)/sign-up.tsx`

**Special Notes:** 
- Immediately triggers PostHog `identify(userId)` to link anonymous events
- Critical for funnel analysis

**Questions Answered:**
- Account creation conversion rate
- Overall onboarding funnel completion
- Time to account creation

---

### 12. `created_group`

**Description:** User successfully created a new group.

**Properties:**
- `group_id` (string): UUID of the created group
- `group_type` (string): Type of group - `"family"` or `"friends"`
- `has_memorial` (boolean): Whether group includes a memorial
- `nsfw_enabled` (boolean): Whether NSFW content is enabled

**Trigger:** Successful group creation in `lib/db.ts` → `createGroup()`

**Questions Answered:**
- Group creation success rate
- Group type distribution (family vs. friends)
- Memorial adoption rate
- NSFW preference rate

---

### 13. `joined_group`

**Description:** User successfully joined an existing group.

**Properties:**
- `group_id` (string): UUID of the joined group
- `join_method` (string): How user joined - `"invite_link"` | `"direct"` | etc.

**Trigger:** Successful group join in `app/join/[groupId].tsx` or group join logic

**Questions Answered:**
- Group join success rate
- Invite link effectiveness
- Viral growth metrics

---

### 14. `loaded_invite_group_screen`

**Description:** User viewed the invite/join screen (from deep link).

**Properties:** None

**Trigger:** Screen load of `app/join/[groupId].tsx` when accessed via deep link

**Questions Answered:**
- Deep link click-through rate
- Invite link engagement

---

### 15. `took_invite_action`

**Description:** User took an explicit action to share/invite (not just viewing the screen).

**Properties:**
- `action_type` (string): Type of action taken
  - `"copy_clipboard"` - User copied invite link to clipboard
  - `"open_phonebook"` - User opened contacts/phonebook
  - `"share_cta"` - User clicked share CTA button
  - Note: `"finish"` button is NOT an action

**Trigger:** User clicks copy, phonebook, or share CTA in invite screen

**Questions Answered:**
- Invite sharing engagement rate
- Most popular sharing methods
- Viral coefficient

---

### 16. `loaded_feedback_screen`

**Description:** User viewed the feedback screen (welcome-post-auth).

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/welcome-post-auth.tsx`

**Questions Answered:**
- Post-auth onboarding completion rate
- Feedback screen engagement

---

### 17. `loaded_notification_screen`

**Description:** User viewed the notification onboarding screen.

**Properties:** None

**Trigger:** Screen load of `app/(onboarding)/notifications-onboarding.tsx`

**Questions Answered:**
- Notification onboarding engagement
- Permission request screen views

---

### 18. `loaded_home_screen`

**Description:** User viewed the home screen (fires once per session).

**Properties:** None

**Trigger:** First screen load of `app/(main)/home.tsx` per session

**Special Notes:**
- Fires once per app session (not on every focus)
- Indicates onboarding completion for new users
- Marks session start for existing users

**Questions Answered:**
- Onboarding completion rate
- Daily active users (DAU)
- Session start frequency
- Time to first home screen view

---

## Core App Usage Events

### 19. `signed_in`

**Description:** User successfully signed into the app.

**Properties:** None

**Trigger:** Successful sign-in in `app/(onboarding)/auth.tsx` or `app/(auth)/sign-in.tsx`

**Special Notes:**
- Triggers PostHog `identify(userId)` if not already identified

**Questions Answered:**
- Sign-in success rate
- Return user engagement
- Authentication method usage

---

### 20. `switched_group`

**Description:** User switched from one group to another.

**Properties:**
- `from_group_id` (string): UUID of the previous group
- `to_group_id` (string): UUID of the new group

**Trigger:** Group selection change in `app/(main)/home.tsx` → `handleSelectGroup()`

**Questions Answered:**
- Multi-group usage patterns
- Group switching frequency
- User engagement across groups

---

### 21. `changed_dates`

**Description:** User navigated to a different date (past/future).

**Properties:**
- `from_date` (string): Previous date (YYYY-MM-DD)
- `to_date` (string): New date (YYYY-MM-DD)
- `group_id` (string): UUID of the current group

**Trigger:** Date selection change in `app/(main)/home.tsx` → `setSelectedDate()`

**Questions Answered:**
- Date browsing behavior
- Engagement depth (how far back users look)
- Historical content engagement

---

### 22. `opened_daily_question`

**Description:** User opened the entry composer to answer the daily question.

**Properties:** None

**Trigger:** User clicks "Tell the Group" button or opens entry composer in `app/(main)/home.tsx` → `handleAnswerPrompt()`

**Questions Answered:**
- Entry composer open rate
- Prompt engagement rate
- Conversion from prompt view to entry creation

---

### 23. `answered_daily_question`

**Description:** User successfully submitted an entry answering the daily question.

**Properties:**
- `prompt_id` (string): UUID of the prompt answered
- `group_id` (string): UUID of the group
- `date` (string): Date of entry (YYYY-MM-DD)
- `has_media` (boolean): Whether entry includes media (photo/video)
- `media_types_added` (array): Array of media types - `["photo"]`, `["video"]`, `["photo", "video"]`, etc.
- `text_length` (number): Character count of text content

**Trigger:** Successful entry submission in `app/(main)/modals/entry-composer.tsx`

**Questions Answered:**
- Entry creation completion rate
- Media usage rate
- Average entry length
- Prompt effectiveness
- Daily engagement rate

---

### 24. `viewed_entry`

**Description:** User viewed an entry (their own or another member's).

**Properties:**
- `entry_id` (string): UUID of the viewed entry
- `prompt_id` (string): UUID of the prompt
- `group_id` (string): UUID of the group
- `date` (string): Date of entry (YYYY-MM-DD)
- `is_own_entry` (boolean): Whether user is viewing their own entry

**Trigger:** Entry detail view in `app/(main)/modals/entry-detail.tsx` or `components/EntryCard.tsx`

**Questions Answered:**
- Entry view rate
- Self vs. others' entry viewing patterns
- Content consumption behavior
- Engagement with group members' content

---

### 25. `edited_entry`

**Description:** User edited and reposted an existing entry.

**Properties:**
- `entry_id` (string): UUID of the edited entry
- `prompt_id` (string): UUID of the prompt
- `group_id` (string): UUID of the group
- `date` (string): Date of entry (YYYY-MM-DD)
- `has_media` (boolean): Whether edited entry includes media
- `text_length` (number): Character count of edited text

**Trigger:** Successful entry edit submission

**Questions Answered:**
- Entry edit rate
- Content refinement behavior
- User satisfaction with initial entries

---

### 26. `changed_app_theme`

**Description:** User changed the app theme (light/dark mode).

**Properties:**
- `from_theme` (string): Previous theme - `"light"` | `"dark"`
- `to_theme` (string): New theme - `"light"` | `"dark"`

**Trigger:** Theme toggle in settings or theme context

**Questions Answered:**
- Theme preference distribution
- Theme switching behavior
- User customization engagement

---

### 27. `loaded_history_screen`

**Description:** User viewed the history screen.

**Properties:** None

**Trigger:** Screen load of `app/(main)/history.tsx`

**Questions Answered:**
- History screen usage
- Historical content engagement
- Feature discovery

---

### 28. `custom_question_banner_shown`

**Description:** Custom question opportunity banner was displayed to user.

**Properties:**
- `group_id` (string): UUID of the group
- `date` (string): Date for the custom question (YYYY-MM-DD)

**Trigger:** Banner display in `app/(main)/home.tsx` when custom question opportunity exists

**Questions Answered:**
- Custom question opportunity visibility
- Banner impression rate
- Conversion from banner to question creation

---

### 29. `clicked_custom_question_alert`

**Description:** User clicked the custom question banner.

**Properties:** None

**Trigger:** Banner click in `app/(main)/home.tsx` → `handleCustomQuestionPress()`

**Questions Answered:**
- Banner click-through rate
- Custom question feature discovery
- Interest in custom questions

---

### 30. `loaded_custom_question_screen`

**Description:** User viewed the custom question creation screen.

**Properties:** None

**Trigger:** Screen load of `app/(main)/add-custom-question.tsx` or `app/(main)/custom-question-onboarding.tsx`

**Questions Answered:**
- Custom question screen engagement
- Drop-off at question creation

---

### 31. `created_custom_question`

**Description:** User successfully created a custom question.

**Properties:**
- `group_id` (string): UUID of the group
- `date` (string): Date for the custom question (YYYY-MM-DD)
- `text_length` (number): Character count of question text
- `has_description` (boolean): Whether question includes a description
- `visibility` (string): Question visibility - `"anonymous"` | `"public"`

**Trigger:** Successful custom question creation

**Questions Answered:**
- Custom question creation rate
- Question complexity (text length)
- Anonymous vs. public preference
- Feature adoption rate

---

### 32. `added_comment`

**Description:** User added a comment to an entry.

**Properties:**
- `entry_id` (string): UUID of the entry
- `prompt_id` (string): UUID of the prompt
- `group_id` (string): UUID of the group
- `comment_length` (number): Character count of comment

**Trigger:** Successful comment submission

**Questions Answered:**
- Comment engagement rate
- Social interaction frequency
- Average comment length
- Community engagement metrics

---

### 33. `added_reaction`

**Description:** User added a reaction to an entry.

**Properties:**
- `entry_id` (string): UUID of the entry
- `prompt_id` (string): UUID of the prompt
- `group_id` (string): UUID of the group
- `reaction_type` (string): Type of reaction (if multiple types exist)

**Trigger:** Reaction addition in entry detail or entry card

**Questions Answered:**
- Reaction engagement rate
- Social interaction patterns
- Content appreciation metrics

---

### 34. `logged_out`

**Description:** User logged out of the app.

**Properties:** None

**Trigger:** Sign out action in `components/AuthProvider.tsx`

**Special Notes:**
- Triggers PostHog `reset()` to clear user identification

**Questions Answered:**
- Logout frequency
- Session duration
- User retention patterns

---

## Settings Events

### 35. `loaded_settings_screen`

**Description:** User viewed the main settings screen.

**Properties:** None

**Trigger:** Screen load of `app/(main)/settings.tsx`

**Questions Answered:**
- Settings screen usage
- Feature discovery

---

### 36. `loaded_profile_settings`

**Description:** User viewed the profile settings screen.

**Properties:** None

**Trigger:** Screen load of `app/(main)/settings/profile.tsx`

**Questions Answered:**
- Profile editing engagement
- User customization behavior

---

### 37. `loaded_group_settings`

**Description:** User viewed the group settings screen.

**Properties:**
- `group_id` (string): UUID of the group

**Trigger:** Screen load of `app/(main)/group-settings/` screens

**Questions Answered:**
- Group management engagement
- Settings usage by group

---

## Invite/Share Events

### 38. `generated_invite_link`

**Description:** User generated an invite link for a group.

**Properties:**
- `group_id` (string): UUID of the group

**Trigger:** Invite link generation in group settings or invite flow

**Questions Answered:**
- Invite link generation rate
- Viral growth potential

---

### 39. `shared_invite_link`

**Description:** User shared an invite link via native sharing.

**Properties:**
- `group_id` (string): UUID of the group
- `share_method` (string): Method used - `"native"` | `"share_sheet"` | `"clipboard"`

**Trigger:** Successful share action via native share sheet

**Questions Answered:**
- Share engagement rate
- Preferred sharing methods
- Viral coefficient

---

### 40. `copied_invite_link`

**Description:** User copied invite link to clipboard.

**Properties:**
- `group_id` (string): UUID of the group

**Trigger:** Copy to clipboard action

**Questions Answered:**
- Clipboard copy usage
- Alternative sharing methods

---

## Notification Events

### 41. `notification_permission_granted`

**Description:** User granted push notification permissions.

**Properties:** None

**Trigger:** Permission granted in `lib/notifications.ts` → `registerForPushNotifications()`

**Questions Answered:**
- Notification opt-in rate
- Permission grant success rate
- Impact on retention

---

### 42. `notification_permission_denied`

**Description:** User denied push notification permissions.

**Properties:** None

**Trigger:** Permission denied in `lib/notifications.ts` → `registerForPushNotifications()`

**Questions Answered:**
- Notification opt-out rate
- Permission denial reasons
- Impact on engagement

---

## Key Metrics & Questions These Events Enable

### Funnel Analysis
- **Onboarding Funnel:** Track conversion from `onboarding_started` → `created_account` → `created_group` → `loaded_home_screen`
- **Entry Creation Funnel:** Track `opened_daily_question` → `answered_daily_question`
- **Custom Question Funnel:** Track `custom_question_banner_shown` → `clicked_custom_question_alert` → `created_custom_question`

### Retention Metrics
- **Daily Active Users (DAU):** `loaded_home_screen` (once per session)
- **Weekly Active Users (WAU):** Aggregate `loaded_home_screen` events
- **Monthly Active Users (MAU):** Aggregate `loaded_home_screen` events
- **Retention Rate:** Users who return after `created_account`

### Engagement Metrics
- **Entry Creation Rate:** `answered_daily_question` / `loaded_home_screen`
- **Social Engagement Rate:** `added_comment` + `added_reaction` / `viewed_entry`
- **Group Switching Frequency:** `switched_group` frequency
- **Date Browsing Depth:** `changed_dates` patterns

### Feature Adoption
- **Memorial Adoption:** `added_memorial` / `created_group`
- **Custom Question Adoption:** `created_custom_question` / `custom_question_banner_shown`
- **Notification Opt-in:** `notification_permission_granted` / users who saw prompt
- **Theme Customization:** `changed_app_theme` frequency

### Growth Metrics
- **Viral Coefficient:** `shared_invite_link` → `joined_group` conversion
- **Invite Effectiveness:** `took_invite_action` → `joined_group` conversion
- **Organic vs. Invited Users:** Compare `onboarding_started` source property

---

## Implementation Notes

### User Identification
- **Pre-Auth Events:** Use PostHog's automatic anonymous ID
- **After `created_account`:** Immediately call `posthog.identify(userId)` to link anonymous events
- **After `signed_in`:** Call `posthog.identify(userId)` if not already identified
- **On `logged_out`:** Call `posthog.reset()` to clear user identification

### Event Timing
- **Screen Load Events:** Fire in `useEffect` or `useFocusEffect` hooks
- **Action Events:** Fire immediately after successful action completion
- **Session Events:** `loaded_home_screen` fires once per session (use session flag)

### Error Handling
- All PostHog events must be wrapped in try-catch
- Events should never block or interfere with core app behavior
- Use `isPostHogReady()` check before capturing, but don't wait/block
- Events are fire-and-forget; failures shouldn't affect UI/UX

### Privacy
- No PII (Personally Identifiable Information) in event properties
- User IDs are UUIDs, not emails or names
- Text content lengths only, never actual text content
- All events respect user privacy settings

---

## Event Naming Convention

Events follow this pattern:
- `loaded_*` - Screen/view loaded
- `created_*` - Entity created (account, group, entry, etc.)
- `added_*` - Item added (memorial, comment, reaction)
- `opened_*` - Action initiated (composer opened)
- `viewed_*` - Content viewed
- `clicked_*` - UI element clicked
- `changed_*` - Setting/preference changed
- `switched_*` - Context switched (group, date)
- `took_*` - Explicit action taken
- `logged_*` - Authentication action

---

## Future Considerations

- **A/B Testing:** Events can be used to measure feature experiment results
- **Cohort Analysis:** Track user behavior by signup date, group type, etc.
- **Feature Flags:** PostHog feature flags can be integrated for gradual rollouts
- **Session Replay:** Can be enabled later for debugging (currently disabled for privacy)

