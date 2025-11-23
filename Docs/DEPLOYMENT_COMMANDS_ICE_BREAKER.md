# Ice Breaker Feature - Deployment Commands

## 1. Database Migration

### Option A: Supabase CLI (Recommended)
```bash
# Push all pending migrations to your Supabase project
supabase db push

# Or run migrations interactively
supabase migration up
```

### Option B: Supabase Dashboard (Alternative)
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/019_add_ice_breaker_column.sql`
4. Paste and run the SQL script

## 2. Deploy Edge Functions

### Deploy `initialize-group-queue` function:
```bash
supabase functions deploy initialize-group-queue
```

### Deploy `schedule-daily-prompts` function:
```bash
supabase functions deploy schedule-daily-prompts
```

### Deploy both functions at once:
```bash
supabase functions deploy initialize-group-queue schedule-daily-prompts
```

## 3. Verify Deployment

### Check migration status:
```bash
supabase migration list
```

### Test the functions:
```bash
# Test initialize-group-queue (you'll need to provide the group_id)
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/initialize-group-queue' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"group_id": "YOUR_GROUP_ID"}'

# Test schedule-daily-prompts
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/schedule-daily-prompts' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

## 4. Post-Deployment Checklist

- [ ] Migration `019_add_ice_breaker_column.sql` has been applied
- [ ] `ice_breaker` column exists in `prompts` table
- [ ] `ice_breaker_queue_completed_date` column exists in `groups` table
- [ ] Indexes have been created
- [ ] `initialize-group-queue` function deployed successfully
- [ ] `schedule-daily-prompts` function deployed successfully
- [ ] Test creating a new group to verify ice-breaker initialization works

## Notes

- **New groups** created after deployment will automatically use ice-breaker logic
- **Existing groups** will continue using normal logic (they already have `ice_breaker_queue_completed_date` set or will be NULL, which triggers normal mode)
- To test with an existing group, you can manually set `ice_breaker_queue_completed_date` to `NULL` in the database (not recommended for production)

