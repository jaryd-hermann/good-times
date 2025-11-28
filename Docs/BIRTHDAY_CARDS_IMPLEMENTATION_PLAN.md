# Birthday Cards Feature - Implementation Plan

## Overview
Birthday Cards is an additive feature that allows group members to write private messages for someone's birthday. Cards are revealed on the birthday person's special day and can be made public to appear in group history.

## Database Schema

### 1. `birthday_cards` Table
Tracks card metadata and status.

```sql
CREATE TABLE birthday_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  birthday_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  birthday_date DATE NOT NULL,
  birthday_year INTEGER NOT NULL, -- Year of this birthday (for age calculation)
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'public')) DEFAULT 'draft',
  is_public BOOLEAN DEFAULT false, -- Whether card is visible in group history
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ, -- When card was published (12 hours before birthday)
  UNIQUE(group_id, birthday_user_id, birthday_date) -- One card per user per birthday
);

CREATE INDEX idx_birthday_cards_group ON birthday_cards(group_id);
CREATE INDEX idx_birthday_cards_birthday_user ON birthday_cards(birthday_user_id);
CREATE INDEX idx_birthday_cards_birthday_date ON birthday_cards(birthday_date);
CREATE INDEX idx_birthday_cards_status ON birthday_cards(status);
```

### 2. `birthday_card_entries` Table
Stores individual contributions to cards.

```sql
CREATE TABLE birthday_card_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES birthday_cards(id) ON DELETE CASCADE,
  contributor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_content TEXT,
  media_urls TEXT[],
  media_types TEXT[],
  embedded_media JSONB, -- Same structure as entries.embedded_media
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, contributor_user_id) -- One entry per contributor per card
);

CREATE INDEX idx_birthday_card_entries_card ON birthday_card_entries(card_id);
CREATE INDEX idx_birthday_card_entries_contributor ON birthday_card_entries(contributor_user_id);
```

### 3. `birthday_card_notifications` Table
Tracks notification status for contributors.

```sql
CREATE TABLE birthday_card_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES birthday_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('initial', 'reminder')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, user_id, notification_type)
);

CREATE INDEX idx_birthday_card_notifications_card ON birthday_card_notifications(card_id);
CREATE INDEX idx_birthday_card_notifications_user ON birthday_card_notifications(user_id);
```

### 4. RLS Policies
```sql
-- birthday_cards: Group members can view cards for their groups
CREATE POLICY "Group members can view birthday cards"
  ON birthday_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = birthday_cards.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- birthday_card_entries: Contributors can view/edit their own entries, birthday person can view all entries for their card
CREATE POLICY "Contributors can view their entries"
  ON birthday_card_entries FOR SELECT
  USING (
    contributor_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM birthday_cards
      WHERE birthday_cards.id = birthday_card_entries.card_id
      AND birthday_cards.birthday_user_id = auth.uid()
    )
  );

CREATE POLICY "Contributors can insert entries"
  ON birthday_card_entries FOR INSERT
  WITH CHECK (
    contributor_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM birthday_cards
      WHERE birthday_cards.id = birthday_card_entries.card_id
      AND birthday_cards.status = 'draft'
    )
  );

CREATE POLICY "Contributors can update their entries"
  ON birthday_card_entries FOR UPDATE
  USING (contributor_user_id = auth.uid())
  WITH CHECK (contributor_user_id = auth.uid());

-- birthday_card_notifications: Group members can view their notifications
CREATE POLICY "Users can view their notifications"
  ON birthday_card_notifications FOR SELECT
  USING (user_id = auth.uid());
```

## Edge Functions

### 1. `create-birthday-cards` (Cron: Daily at 1 AM UTC)
Creates card records 7 days before birthdays.

**Logic:**
- Find all groups with members who have birthdays in 7 days
- For each upcoming birthday:
  - Check if card already exists for this birthday_date
  - Create `birthday_cards` record with status='draft'
  - Exclude the birthday person from being notified

**Output:** Creates card records ready for notification

### 2. `send-birthday-card-notifications` (Cron: Daily at 8 AM UTC)
Sends notifications to contributors 7 days before birthdays.

**Logic:**
- Find all cards with status='draft' where birthday_date is exactly 7 days away
- For each card:
  - Get all group members EXCEPT birthday_user_id
  - Check if they've already been notified (birthday_card_notifications)
  - Send push notification: "It's [Name]'s birthday in 7 days! Write them a card."
  - Record notification in `birthday_card_notifications`
  - Create notification records in `notifications` table

**Notification Type:** `birthday_card_contribute`

### 3. `send-birthday-card-reminders` (Cron: Daily at 8 AM UTC)
Sends reminder notifications 2 days before birthdays.

**Logic:**
- Find all cards with status='draft' where birthday_date is exactly 2 days away
- For each card:
  - Get all group members EXCEPT birthday_user_id
  - Check if they've contributed (birthday_card_entries)
  - Check if they've received reminder (birthday_card_notifications with type='reminder')
  - If no contribution and no reminder: send reminder notification
  - Record reminder notification

**Notification Type:** `birthday_card_reminder`

### 4. `publish-birthday-cards` (Cron: Hourly)
Publishes cards 12 hours before birthday.

**Logic:**
- Find all cards with status='draft' where:
  - birthday_date is today AND current time is >= 12:00 PM (noon) of previous day
  - OR birthday_date is tomorrow AND current time is >= 12:00 PM (noon) today
- Update card status to 'published'
- Set published_at timestamp
- Send notification to birthday person: "You have a birthday card! 🎉"
- Create notification record

**Notification Type:** `birthday_card_ready`

### 5. `send-birthday-card-ready-notification` (Cron: Daily at 8 AM UTC)
Sends notification on birthday day if card exists.

**Logic:**
- Find all cards with status='published' where birthday_date is today
- For each card:
  - Check if birthday person has already been notified today
  - Send notification: "Your birthday card is ready! 🎂"
  - Record notification

**Note:** This runs at 8 AM to ensure birthday person sees notification when they wake up.

## UI Components

### 1. `BirthdayCardUpcomingBanner` Component
Shows alert to contributors who need to write a card.

**Props:**
- `groupId: string`
- `birthdayUserId: string`
- `birthdayUserName: string`
- `birthdayUserAvatar: string | undefined`
- `birthdayDate: string`
- `onPress: () => void`

**Display Logic:**
- Show if: current date is within 7 days before birthday_date AND user hasn't contributed yet
- Hide if: user has contributed OR less than 12 hours before birthday OR card is published
- Stack multiple banners vertically if multiple birthdays upcoming

**Design:** Based on UpcomingAlert.png - shows square avatar, name, and "Write [Name] a birthday card" text

### 2. `BirthdayCardEditBanner` Component
Shows alert to contributors who have written a card (on the day they wrote it).

**Props:**
- `groupId: string`
- `cardId: string`
- `birthdayUserId: string`
- `birthdayUserName: string`
- `birthdayDate: string`
- `onPress: () => void`

**Display Logic:**
- Show only on the date the entry was created (entry.created_at date)
- Hide on other dates
- Allows editing the entry

**Design:** Based on EditAlert.png

### 3. `BirthdayCardYourCardBanner` Component
Shows alert to birthday person that their card is ready.

**Props:**
- `groupId: string`
- `cardId: string`
- `birthdayDate: string`
- `contributorAvatars: Array<{ user_id: string; avatar_url?: string }>`
- `onPress: () => void`

**Display Logic:**
- Show if: card status is 'published' AND birthday_date matches selectedDate
- Persist on that specific date (if user navigates back to birthday date, banner shows)
- Show circle avatars of contributors who wrote entries

**Design:** Based on YourCardAlert.png

### 4. `BirthdayCardComposer` Page
Similar to `entry-composer.tsx` but for card entries.

**Route:** `/(main)/modals/birthday-card-composer`

**Props (via params):**
- `cardId: string`
- `groupId: string`
- `birthdayUserId: string`
- `birthdayUserName: string`
- `returnTo?: string`
- `entryId?: string` (for editing)

**Features:**
- Same toolbar as entry-composer (photos, videos, audio, songs)
- Same text input and media handling
- Header text: "Write [Name] a birthday card" (from AddComposer.png)
- No question prompt displayed
- Stores to `birthday_card_entries` table
- On save: creates/updates entry, hides upcoming banner, shows edit banner

**Key Differences from entry-composer:**
- No prompt question
- Saves to `birthday_card_entries` instead of `entries`
- No daily prompt association
- Entry is private (not shown in feed/history unless card is public)

### 5. `BirthdayCardDetails` Page
Shows the full birthday card to the birthday person.

**Route:** `/(main)/birthday-card-details`

**Props (via params):**
- `cardId: string`
- `groupId: string`
- `returnTo?: string`

**Features:**
- Header: "Happy [Age] Birthday!" (age = current year - birth year)
- Scrollable list of entries (EntryCard components)
- Entries shown in order written (by created_at)
- No question text shown on entries
- No reactions or comments on entries
- Click entry → opens `BirthdayCardEntryDetail` page
- "Make Public" button (if card is not public)
- Fade-in animation when opening card

**Design:** Based on CardDetails.png - header section with birthday text, then EntryCard list

### 6. `BirthdayCardEntryDetail` Page
Shows individual card entry in detail.

**Route:** `/(main)/modals/birthday-card-entry-detail`

**Props (via params):**
- `entryId: string`
- `cardId: string`
- `entryIds: string` (JSON array for navigation)
- `index: number`
- `returnTo?: string`

**Features:**
- Similar to `entry-detail.tsx` but:
  - No question text
  - No reactions section
  - No comments section
  - "Next" button navigates to next card entry
- Full media display (photos, videos, audio, embedded media)
- Shows contributor name and avatar

## Integration Points

### 1. Home Screen (`app/(main)/home.tsx`)

**Add queries:**
```typescript
// Get upcoming birthdays (next 7 days) for current group
const { data: upcomingBirthdayCards = [] } = useQuery({
  queryKey: ["upcomingBirthdayCards", currentGroupId, userId, selectedDate],
  queryFn: () => getUpcomingBirthdayCards(currentGroupId, userId, selectedDate),
  enabled: !!currentGroupId && !!userId,
})

// Get card entries user has written (for edit banner)
const { data: myCardEntries = [] } = useQuery({
  queryKey: ["myCardEntries", currentGroupId, userId, selectedDate],
  queryFn: () => getMyCardEntriesForDate(currentGroupId, userId, selectedDate),
  enabled: !!currentGroupId && !!userId,
})

// Get user's own birthday card (if it's their birthday)
const { data: myBirthdayCard } = useQuery({
  queryKey: ["myBirthdayCard", currentGroupId, userId, selectedDate],
  queryFn: () => getMyBirthdayCard(currentGroupId, userId, selectedDate),
  enabled: !!currentGroupId && !!userId,
})
```

**Add banners in render:**
- Before custom question banner: Show `BirthdayCardUpcomingBanner` for each upcoming birthday
- Show `BirthdayCardEditBanner` for entries written on selectedDate
- Show `BirthdayCardYourCardBanner` if it's user's birthday and card exists

**Banner Priority:**
1. BirthdayCardYourCardBanner (if user's birthday)
2. BirthdayCardUpcomingBanner (stacked vertically)
3. BirthdayCardEditBanner (for entries written today)
4. CustomQuestionBanner (existing)

### 2. History Screen (`app/(main)/history.tsx`)

**Add filter option:**
- Add "Birthday Cards" to filter modal
- **IMPORTANT:** Only show this filter option if the current user has received at least one birthday card (where `birthday_user_id = currentUserId`)
- When selected, filter shows only the user's birthday dates (where they received cards)
- Each birthday date shows the birthday card entry that can be clicked to view card details
- Other users do NOT see this filter option (only for their own birthday cards)

**Add query:**
```typescript
// Check if user has received any birthday cards
const { data: hasReceivedCards } = useQuery({
  queryKey: ["hasReceivedBirthdayCards", currentGroupId, userId],
  queryFn: () => hasReceivedBirthdayCards(currentGroupId, userId),
  enabled: !!currentGroupId && !!userId,
})

// Get user's birthday cards (only their own)
const { data: myBirthdayCards = [] } = useQuery({
  queryKey: ["myBirthdayCards", currentGroupId, userId],
  queryFn: () => getMyBirthdayCards(currentGroupId, userId),
  enabled: !!currentGroupId && !!userId && selectedFilters.includes("Birthday Cards"),
})
```

**Display:**
- Filter option only appears if `hasReceivedCards === true`
- When filter is active, show only dates where user received a birthday card
- Each date shows the birthday card entry (clickable)
- Clicking opens `BirthdayCardDetails` page
- Shows both private and public cards (user can see their own cards regardless of public status)

### 3. Database Functions (`lib/db.ts`)

**New functions needed:**
```typescript
// Get upcoming birthday cards user needs to contribute to
export async function getUpcomingBirthdayCards(
  groupId: string,
  userId: string,
  todayDate: string
): Promise<BirthdayCard[]>

// Get card entries user has written for a specific date
export async function getMyCardEntriesForDate(
  groupId: string,
  userId: string,
  date: string
): Promise<BirthdayCardEntry[]>

// Get user's own birthday card (if it's their birthday)
export async function getMyBirthdayCard(
  groupId: string,
  userId: string,
  date: string
): Promise<BirthdayCard | null>

// Check if user has received any birthday cards
export async function hasReceivedBirthdayCards(
  groupId: string,
  userId: string
): Promise<boolean>

// Get user's own birthday cards (only cards where they are the birthday person)
export async function getMyBirthdayCards(
  groupId: string,
  userId: string
): Promise<BirthdayCard[]>

// Get card entries for a card
export async function getBirthdayCardEntries(
  cardId: string
): Promise<BirthdayCardEntry[]>

// Create birthday card entry
export async function createBirthdayCardEntry(data: {
  cardId: string
  contributorUserId: string
  textContent?: string
  mediaUrls?: string[]
  mediaTypes?: ("photo" | "video" | "audio")[]
  embeddedMedia?: any[]
}): Promise<BirthdayCardEntry>

// Update birthday card entry
export async function updateBirthdayCardEntry(
  entryId: string,
  userId: string,
  updates: {
    textContent?: string
    mediaUrls?: string[]
    mediaTypes?: ("photo" | "video" | "audio")[]
    embeddedMedia?: any[]
  }
): Promise<BirthdayCardEntry>

// Make card public
export async function makeBirthdayCardPublic(
  cardId: string,
  userId: string
): Promise<BirthdayCard>

// Get birthday card by ID
export async function getBirthdayCard(cardId: string): Promise<BirthdayCard | null>

// Get birthday card entry by ID
export async function getBirthdayCardEntry(entryId: string): Promise<BirthdayCardEntry | null>
```

### 4. Types (`lib/types.ts`)

**Add new types:**
```typescript
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
```

## Implementation Steps

### Phase 1: Database & Backend
1. Create migration file: `021_add_birthday_cards.sql`
   - Create tables
   - Add indexes
   - Add RLS policies
   - Add triggers for updated_at

2. Create Edge Functions:
   - `create-birthday-cards/index.ts`
   - `send-birthday-card-notifications/index.ts`
   - `send-birthday-card-reminders/index.ts`
   - `publish-birthday-cards/index.ts`
   - `send-birthday-card-ready-notification/index.ts`

3. Update cron jobs in `002_add_cron_jobs.sql`:
   - Add cron for create-birthday-cards (1 AM UTC)
   - Add cron for send-birthday-card-notifications (8 AM UTC)
   - Add cron for send-birthday-card-reminders (8 AM UTC)
   - Add cron for publish-birthday-cards (hourly)
   - Add cron for send-birthday-card-ready-notification (8 AM UTC)

4. Add database functions to `lib/db.ts`

5. Add types to `lib/types.ts`

### Phase 2: UI Components
1. Create `components/BirthdayCardUpcomingBanner.tsx`
2. Create `components/BirthdayCardEditBanner.tsx`
3. Create `components/BirthdayCardYourCardBanner.tsx`
4. Create `app/(main)/modals/birthday-card-composer.tsx` (based on entry-composer)
5. Create `app/(main)/birthday-card-details.tsx`
6. Create `app/(main)/modals/birthday-card-entry-detail.tsx` (based on entry-detail)

### Phase 3: Integration
1. Integrate banners into `app/(main)/home.tsx`
2. Add birthday cards filter to `app/(main)/history.tsx`
3. Add navigation handlers
4. Add PostHog tracking events

### Phase 4: Testing & Polish
1. Test card creation flow
2. Test notification timing
3. Test editing flow
4. Test card reveal on birthday
5. Test "Make Public" functionality
6. Test multiple birthdays same day
7. Test edge cases (leaving group, joining after card created, etc.)

## Key Logic Details

### Banner Display Logic

**Upcoming Banner:**
- Show if: `todayDate <= birthdayDate - 7 days` AND `todayDate >= birthdayDate - 7 days` AND `user hasn't contributed` AND `card.status = 'draft'`
- Hide if: `user has contributed` OR `current time >= birthdayDate - 12 hours` OR `card.status = 'published'`

**Edit Banner:**
- Show if: `entry.created_at date === selectedDate` AND `card.status = 'draft'`
- Hide on all other dates

**Your Card Banner:**
- Show if: `card.status = 'published'` AND `birthdayDate === selectedDate` AND `birthdayUserId === currentUserId`
- Persist on that date (always shows when viewing that date)

### Age Calculation
```typescript
function calculateAge(birthdayYear: number, birthdayDate: string): number {
  const currentYear = new Date(birthdayDate).getFullYear()
  return currentYear - birthdayYear
}
```

### Card Publishing Logic
- Card is published 12 hours before birthday (noon of previous day)
- Once published, contributors can no longer add/edit entries
- Birthday person can view card once published

### Public Card Display
- When card is made public, it appears in group history on the birthday_date
- Shows as a special entry type (different styling to indicate it's a birthday card)
- All group members can see public cards in history

## Notification Types

Add to notification system:
- `birthday_card_contribute`: "It's [Name]'s birthday in 7 days! Write them a card."
- `birthday_card_reminder`: "Don't forget! [Name]'s birthday is in 2 days. Write them a card."
- `birthday_card_ready`: "You have a birthday card! 🎉" (sent on birthday day)

## PostHog Events

Track these events:
- `viewed_birthday_card_upcoming_banner`
- `clicked_birthday_card_upcoming_banner`
- `viewed_birthday_card_edit_banner`
- `clicked_birthday_card_edit_banner`
- `viewed_birthday_card_your_card_banner`
- `clicked_birthday_card_your_card_banner`
- `opened_birthday_card_composer`
- `created_birthday_card_entry`
- `updated_birthday_card_entry`
- `opened_birthday_card_details`
- `made_birthday_card_public`
- `viewed_birthday_card_entry`

## Edge Cases Handled

1. **Multiple birthdays same day**: Each gets their own card, all non-birthday members see alerts for all
2. **Member leaves before birthday**: Their entry remains, they just don't see the card
3. **Member joins after card created**: They can contribute if card is still draft
4. **Member joins after card published**: They were never part of that card
5. **Contributor leaves**: Their entry still shows in the card
6. **Birthday date changes**: Old card remains, new card created for new date
7. **Card expires before contribution**: Banner disappears 12 hours before birthday

## Questions Resolved

✅ 7 days before exactly
✅ 12 hours before midnight
✅ Published at 12 hours before
✅ Notifications at 8 AM
✅ New table for clarity
✅ One entry per contributor
✅ All media types supported
✅ Order written
✅ No limit on entries
✅ Contributors visible
✅ Edits update both views
✅ No deletion
✅ All non-birthday members see all alerts
✅ No limits on active cards
✅ Cards always stored
✅ Public/private toggle
✅ Age shown every year
✅ Fade animation on open
✅ No preview for contributors
✅ Only name/avatar shown
✅ Show all upcoming (next 7 days)
✅ Stacked vertically
✅ Edit banner only on written date
✅ Your card banner persists on date
✅ Reminder 2 days before
✅ One notification for birthday person
✅ No contributor count in notifications
✅ Track all metadata
✅ Simple age calculation

