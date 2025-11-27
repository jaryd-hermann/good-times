# Question Decks Feature - Testing & Deployment Guide

## Overview
This guide walks through deploying the question decks feature, including database migrations, edge functions, and seeding data.

---

## Step 1: Database Migration

### Apply the migration
Run the migration to create all required tables and update existing ones:

```bash
# If using Supabase CLI (recommended)
supabase db push

# OR if applying directly via SQL editor in Supabase Dashboard:
# Copy contents of supabase/migrations/020_add_question_decks.sql
# and run in SQL Editor
```

**What this does:**
- Creates `collections`, `decks`, `group_deck_votes`, `group_active_decks` tables
- Adds `deck_id` and `deck_order` columns to `prompts` table
- Adds `deck_id` column to `daily_prompts` table
- Migrates existing "Fun" and "A Bit Deeper" prompts to "Family"/"Friends"
- Deletes "Fun" and "A Bit Deeper" categories
- Sets up RLS policies and indexes

**Verify migration:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('collections', 'decks', 'group_deck_votes', 'group_active_decks');

-- Check columns added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'prompts' AND column_name IN ('deck_id', 'deck_order');
```

---

## Step 2: Deploy Edge Functions

Deploy all modified and new edge functions:

```bash
# Deploy all functions (if using Supabase CLI)
supabase functions deploy initialize-group-queue
supabase functions deploy schedule-daily-prompts
supabase functions deploy update-group-queue
supabase functions deploy regenerate-queue-with-packs
supabase functions deploy activate-deck
supabase functions deploy check-deck-completion

# OR deploy individually via Supabase Dashboard:
# Go to Edge Functions > Deploy > Select function folder
```

**Functions to deploy:**
1. ✅ `initialize-group-queue` - Modified (removed Fun/A Bit Deeper, added deck logic)
2. ✅ `schedule-daily-prompts` - Modified (removed Fun/A Bit Deeper, added deck scheduling)
3. ✅ `update-group-queue` - Modified (removed Fun/A Bit Deeper references)
4. ✅ `regenerate-queue-with-packs` - **NEW** (regenerates queue when deck activated)
5. ✅ `activate-deck` - **NEW** (handles voting and activation)
6. ✅ `check-deck-completion` - **NEW** (marks decks as finished)

**Verify deployment:**
- Check Supabase Dashboard > Edge Functions
- All functions should show as "Active"
- Test each function with a simple payload if needed

---

## Step 3: Set Up Cron Job (Optional)

The `check-deck-completion` function should run daily to mark finished decks. Add a cron job:

```sql
-- In Supabase SQL Editor
SELECT cron.schedule(
  'check-deck-completion',
  '0 2 * * *', -- Run daily at 2 AM UTC
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-deck-completion',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    ) AS request_id;
  $$
);
```

**Replace:**
- `YOUR_PROJECT_REF` with your Supabase project reference
- `YOUR_SERVICE_ROLE_KEY` with your service role key (from Supabase Dashboard > Settings > API)

---

## Step 4: Seed Collections, Decks, and Questions

### CSV Format Required

You'll need **3 CSV files** with the following structure:

#### 1. Collections CSV (`collections.csv`)
```csv
name,description,display_order
"Deep Connections","Questions designed to foster deeper understanding and connection",1
"Light & Fun","Playful questions for lighter moments",2
"Reflection","Thought-provoking questions for self-reflection",3
```

**Columns:**
- `name` (required) - Collection name
- `description` (optional) - Collection description
- `display_order` (required) - Order for display (1, 2, 3, etc.)
- `icon_url` (optional) - Will be added later via migration

#### 2. Decks CSV (`decks.csv`)
```csv
collection_name,name,description,display_order
"Deep Connections","Vulnerability Deck","Questions that encourage sharing deeper feelings",1
"Deep Connections","Values & Beliefs","Explore what matters most to each other",2
"Light & Fun","Would You Rather","Fun hypothetical scenarios",1
"Light & Fun","Childhood Memories","Nostalgic questions about growing up",2
```

**Columns:**
- `collection_name` (required) - Must match a name from collections.csv
- `name` (required) - Deck name
- `description` (optional) - Deck description
- `display_order` (required) - Order within collection (1, 2, 3, etc.)
- `icon_url` (optional) - Will be added later via migration

#### 3. Questions CSV (`deck_questions.csv`)
```csv
deck_name,question,description,deck_order
"Vulnerability Deck","What's something you're afraid to tell people?","A question about vulnerability",1
"Vulnerability Deck","When was the last time you cried?","Exploring emotions",2
"Vulnerability Deck","What's your biggest regret?","Deep reflection",3
"Values & Beliefs","What's a principle you'd never compromise on?","Core values",1
"Values & Beliefs","What do you think happens after we die?","Philosophical",2
```

**Columns:**
- `deck_name` (required) - Must match a name from decks.csv
- `question` (required) - The question text
- `description` (optional) - Question description
- `deck_order` (required) - Order within deck (1, 2, 3, etc.) - **Important for deterministic ordering**

**Important Notes:**
- Each deck should have **maximum 6 questions** (as per requirements)
- `deck_order` determines the order questions are asked (1, 2, 3...)
- Questions will NOT have a `category` (they're deck-specific)
- Questions will NOT have `is_default` set (they're optional decks)

---

## Step 5: After CSV Files Are Ready

Once you have the 3 CSV files ready, provide them to me and I'll:

1. **Create a seed script** that:
   - Reads the CSV files
   - Inserts collections first
   - Inserts decks (linking to collections)
   - Inserts questions (linking to decks, setting `deck_order`)
   - Handles errors gracefully

2. **The script will:**
   - Use Supabase client with service role key
   - Insert in correct order (collections → decks → questions)
   - Skip duplicates if re-run
   - Output progress and any errors

3. **After seeding:**
   - You can upload icon images
   - I'll create a migration to update `icon_url` fields
   - Or we can update them manually via SQL

**What I need from you:**
- The 3 CSV files (collections.csv, decks.csv, deck_questions.csv)
- Any specific requirements for the seed script
- Confirmation of file format matches above

---

## Step 6: Testing Checklist

After deployment and seeding, test the following:

### ✅ Basic Flow
- [ ] Navigate to "Ask" tab (compass icon)
- [ ] See collections grid
- [ ] Click collection → see decks
- [ ] Click deck → see questions carousel
- [ ] Click "Add this deck" → see vote request modal
- [ ] Submit vote request → see it in "Your decks" carousel

### ✅ Voting Flow
- [ ] See pending vote banner on home screen (if voting)
- [ ] Click banner → navigate to vote screen
- [ ] Vote Yes/No → see vote count update
- [ ] When majority reached → deck activates automatically
- [ ] See notification (if notifications working)

### ✅ Active Deck Flow
- [ ] After activation → deck shows as "Active" in carousel
- [ ] Questions from deck appear in daily prompts (1 per week)
- [ ] Deck tag appears on daily prompt
- [ ] Click deck tag → navigate to deck detail

### ✅ Queue Regeneration
- [ ] When deck activates → future prompts regenerate
- [ ] Today/tomorrow prompts preserved
- [ ] Custom questions preserved
- [ ] Birthday prompts preserved

### ✅ History Filters
- [ ] Go to History tab
- [ ] Open filters modal
- [ ] See "Question Decks" section (if group has active decks)
- [ ] Select deck filter → see only entries from that deck

### ✅ Deck Completion
- [ ] After all questions asked → deck marked as "finished"
- [ ] Finished deck moves to right side of carousel
- [ ] Finished deck no longer counts toward 3-deck limit

### ✅ Edge Cases
- [ ] Group with < 4 members → cannot request vote
- [ ] Maximum 3 active decks → cannot activate 4th
- [ ] Rejected deck → can be re-requested
- [ ] Finished deck → can be re-activated (if requirements allow)

---

## Step 7: Post-Deployment

### Monitor Logs
Check Supabase Dashboard > Edge Functions > Logs for:
- `regenerate-queue-with-packs` - Should run when decks activate
- `activate-deck` - Should run when votes are cast
- `check-deck-completion` - Should run daily (if cron set up)

### Verify Data
```sql
-- Check collections seeded
SELECT COUNT(*) FROM collections;

-- Check decks seeded
SELECT COUNT(*) FROM decks;

-- Check questions seeded
SELECT COUNT(*) FROM prompts WHERE deck_id IS NOT NULL;

-- Check active decks
SELECT * FROM group_active_decks WHERE status = 'active';
```

---

## Troubleshooting

### Migration fails
- Check if tables already exist
- Verify RLS policies aren't blocking
- Check for foreign key constraints

### Functions fail to deploy
- Verify Deno runtime compatibility
- Check function logs for errors
- Ensure environment variables are set

### Seeding fails
- Verify CSV format matches exactly
- Check foreign key relationships (collection → deck → question)
- Ensure no duplicate names

### Voting not working
- Check RLS policies on `group_deck_votes`
- Verify group has 4+ members
- Check `activate-deck` function logs

---

## Next Steps After Testing

1. **Add icon images** - Upload to storage, update `icon_url` fields
2. **Set up notifications** - Configure `pack_vote_requested` notification type
3. **Monitor performance** - Check query performance with indexes
4. **User feedback** - Gather feedback on deck selection and voting UX

---

## Questions?

If you encounter any issues or need clarification, let me know!

