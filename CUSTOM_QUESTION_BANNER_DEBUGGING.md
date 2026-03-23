# Custom Question Banner Debugging Guide

## Problem Summary

Custom question banners stopped showing on Monday and Thursday. Investigation shows:
1. Last custom question asked: 2026-01-06
2. No banners shown recently
3. Assignment function may not be running

## Root Cause Analysis

The custom question system has two critical dependencies:

### 1. Group Eligibility (`group_activity_tracking` table)
- Groups must be marked as `is_eligible_for_custom_questions = true`
- Only groups with 3+ members are eligible
- The `check-custom-question-eligibility` function updates this table

### 2. Assignment Function (`assign-custom-question-opportunity`)
- Must run on **Monday and Thursday at 12:01 AM UTC**
- Creates opportunities in `custom_questions` table with `date_assigned` set to that day
- Only processes groups where `is_eligible_for_custom_questions = true`

### 3. Banner Display Logic
- Banner shows when `date_assigned = CURRENT_DATE` AND `date_asked IS NULL`
- User sees banner on the day they're assigned (Monday or Thursday)

## Diagnostic Queries

Run `debug_custom_question_banners.sql` to diagnose:

1. **Check cron job configuration** - Verify function is scheduled
2. **Check group eligibility** - Verify groups are marked eligible
3. **Check assignment history** - See if function has been running
4. **Check pending opportunities** - See what should show banners
5. **Identify missing assignments** - Find dates where assignments should have happened

## Fix Steps

Run `fix_custom_question_banners.sql` in order:

### Step 1: Update Group Eligibility
Ensure all groups with 3+ members are marked as eligible:
```sql
-- See fix_custom_question_banners.sql STEP 1
-- Or call the check-custom-question-eligibility function
```

### Step 2: Set Up Cron Scheduling

**Critical**: The `assign-custom-question-opportunity` function MUST be scheduled.

#### Option A: Supabase Dashboard (Recommended)
1. Go to Supabase Dashboard > Edge Functions
2. Click on `assign-custom-question-opportunity`
3. Click "Schedule" tab
4. Add schedule:
   - **Cron Expression**: `0 1 * * 1,4` (Monday and Thursday at 12:01 AM UTC)
   - **OR** use: `cron(1 0 ? * MON,THU *)` for AWS EventBridge format

#### Option B: External Cron Service
Set up GitHub Actions, Vercel Cron, or similar:
- **URL**: `POST https://your-project.supabase.co/functions/v1/assign-custom-question-opportunity`
- **Headers**: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
- **Schedule**: Monday and Thursday at 12:01 AM UTC

### Step 3: Schedule Eligibility Check (Optional but Recommended)
Schedule `check-custom-question-eligibility` to run daily or weekly:
- **Daily**: `0 2 * * *` (12:02 AM UTC daily)
- **Weekly**: `0 2 * * 0` (12:02 AM UTC on Sundays)

### Step 4: Verify Function Execution
1. Check Supabase Dashboard > Edge Functions > Logs
2. Look for `assign-custom-question-opportunity` executions on Mondays/Thursdays
3. Verify logs show successful execution with assignments created

## Verification

After fixes, run the verification queries in `fix_custom_question_banners.sql`:

```sql
-- Should show:
-- ✅ Eligible Groups: > 0
-- ✅ Opportunities Today: > 0 (if today is Monday/Thursday)
-- ✅ Pending Opportunities: > 0 (if today is Monday/Thursday)
-- ✅ Last Assignment Date: Recent (within last week)
```

## Common Issues

### Issue: No eligible groups
**Symptom**: Function runs but creates 0 opportunities
**Fix**: Run `check-custom-question-eligibility` function or use STEP 1 fix script

### Issue: Function not running
**Symptom**: No opportunities created on expected dates
**Fix**: Set up cron scheduling (Step 2 above)

### Issue: Groups not marked eligible
**Symptom**: Groups have 3+ members but `is_eligible_for_custom_questions = false/null`
**Fix**: Run eligibility check function or manually update via SQL

### Issue: Opportunities exist but banners don't show
**Symptom**: Opportunities in database but users don't see banners
**Fix**: 
- Verify `date_assigned = CURRENT_DATE`
- Verify `date_asked IS NULL`
- Check frontend banner display logic
- Verify user is viewing the correct group

## Files Created

1. **investigate_custom_questions.sql** - Original investigation queries
2. **debug_custom_question_banners.sql** - Comprehensive diagnostic queries
3. **fix_custom_question_banners.sql** - Step-by-step fix script
4. **CUSTOM_QUESTION_BANNER_DEBUGGING.md** - This guide

## Next Steps

1. ✅ Run diagnostic queries to identify the issue
2. ✅ Fix group eligibility if needed
3. ✅ **CRITICAL: Set up/verify cron scheduling** (scheduler stopped after Jan 5)
4. ✅ Manually trigger function for today if it's Monday/Thursday
5. ✅ Monitor function logs for next Monday/Thursday
6. ✅ Verify banners appear for users

## Immediate Action Required

Based on your diagnostic output:
- **Last assignment**: 2026-01-05
- **Missing assignments**: All Monday/Thursday dates since Jan 5
- **Scheduler status**: NOT RUNNING

**Do this NOW:**

1. **Check scheduler status**: Run `check_scheduler_status.sql` to see exactly which dates are missing
2. **If today is Monday/Thursday**: Manually trigger the function via Supabase Dashboard
3. **Fix the scheduler**: Set up cron job (see Step 2 in fix script)
4. **Verify**: Check function logs to confirm it runs on next Monday/Thursday

## Monitoring

Going forward, monitor:
- Function execution logs on Mondays/Thursdays
- Number of opportunities created each week
- Group eligibility status
- Banner display in the app

If issues persist, check:
- Function logs for errors
- Database for constraint violations
- Network/API issues
- Frontend banner display logic
