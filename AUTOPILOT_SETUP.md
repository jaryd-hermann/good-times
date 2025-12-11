# Personalization System - Autopilot Setup

## ✅ What We've Completed

### Phase 1: Schema & Data Foundation ✅
- ✅ Classification columns added to `prompts` table
- ✅ `deck_classifications` table created
- ✅ Global metrics tracking (`total_asked_count`, `total_answered_count`, etc.)
- ✅ Triggers for automatic metric updates

### Phase 2: Question Classification ✅
- ✅ All questions classified (Friends, Family, Remembering, Birthday, Custom, Featured)
- ✅ Each question has depth, vulnerability, topics, mood tags, etc.

### Phase 3: Group Profiling & Scoring ✅
- ✅ `group_vibe_profiles` materialized view
- ✅ `calculate_question_fit_score()` function
- ✅ `suggest_questions_for_group()` function
- ✅ `refresh_group_vibe_profiles()` function

### Phase 4: Automation Functions ✅
- ✅ `populate_personalized_queue()` function
- ✅ `run_daily_personalization_tasks()` function
- ✅ `run_weekly_queue_population()` function
- ✅ Category filtering fixed (Friends/Family matching group type)
- ✅ Queue cleanup completed

---

## 🚀 What's Needed for Autopilot

### 1. Schedule Automated Jobs (CRITICAL - Missing)

We need to set up cron jobs to run the automation functions automatically:

**Daily Tasks** (after `schedule-daily-prompts` runs):
- Refresh group profiles
- Update global question metrics

**Weekly Tasks**:
- Populate personalized queue for all groups

**Implementation**: Create a new migration file with pg_cron schedules.

### 2. Phase 5: Integrate with Daily Scheduling (CRITICAL - Missing)

Currently, `schedule-daily-prompts` only uses the queue if items exist. We need to:
- When queue is empty AND no birthday/custom/featured/remembering/deck items
- Call `suggest_questions_for_group()` on-the-fly to get personalized suggestions
- Use those suggestions instead of random selection

**Implementation**: Update `schedule-daily-prompts/index.ts` to call personalized suggestions when needed.

### 3. Monitoring & Logging (Recommended)

Add logging to track:
- When personalized questions are selected
- Fit scores and reasons
- Performance metrics
- Errors or edge cases

---

## 📋 Action Plan

### Step 1: Set Up Automated Scheduling (Do This First)

Create cron jobs to run:
1. **Daily**: `run_daily_personalization_tasks()` (after schedule-daily-prompts)
2. **Weekly**: `populate_personalized_queue()` (e.g., Sunday night)

### Step 2: Integrate Personalized Selection

Update `schedule-daily-prompts/index.ts` to:
- Check queue first (existing)
- If queue empty, call `suggest_questions_for_group()` on-the-fly
- Use personalized suggestions instead of random selection

### Step 3: Test & Monitor

- Verify cron jobs are running
- Check that personalized questions are being selected
- Monitor engagement rates
- Watch for errors

---

## 🎯 Current State

**What Works Now:**
- ✅ Personalized questions can be added to queue manually via `populate_personalized_queue()`
- ✅ Queue is consumed by `schedule-daily-prompts` (if items exist)
- ✅ All functions are tested and working

**What Doesn't Work Automatically:**
- ❌ Profiles don't refresh automatically
- ❌ Global metrics don't update automatically
- ❌ Queue doesn't populate automatically
- ❌ When queue is empty, it falls back to random selection (not personalized)

**Next Steps:**
1. Create cron job migration
2. Update `schedule-daily-prompts` to use personalized suggestions when queue is empty
3. Test end-to-end flow

