# Set Up Custom Question Scheduler

## ✅ Current Status

The function is working! You just created 6 opportunities for today (Monday, 2026-02-09).

## 🔧 Next Step: Set Up Automatic Scheduling

To ensure the function runs automatically every Monday and Thursday, you need to set up a scheduler.

### Option 1: Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on **`assign-custom-question-opportunity`**
3. Click the **"Schedule"** tab (or "Cron Jobs" depending on your Supabase version)
4. Click **"Add Schedule"** or **"Create Schedule"**
5. Configure:
   - **Schedule Name**: `custom-question-assignment`
   - **Cron Expression**: `0 1 * * 1,4`
     - This means: Run at 12:01 AM UTC on Monday (1) and Thursday (4)
   - **OR** use AWS EventBridge format: `cron(1 0 ? * MON,THU *)`
6. Save

### Option 2: External Cron Service

If Supabase doesn't support scheduling in your plan, use an external service:

#### GitHub Actions
Create `.github/workflows/custom-question-assignment.yml`:
```yaml
name: Assign Custom Questions
on:
  schedule:
    - cron: '1 0 * * 1,4'  # Monday and Thursday at 12:01 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  assign:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke Function
        run: |
          curl -X POST \
            "https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/assign-custom-question-opportunity" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

#### Vercel Cron
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/assign-custom-questions",
    "schedule": "1 0 * * 1,4"
  }]
}
```

Then create `api/cron/assign-custom-questions.ts`:
```typescript
export default async function handler(req: any, res: any) {
  const response = await fetch(
    "https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/assign-custom-question-opportunity",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );
  
  const data = await response.json();
  res.json(data);
}
```

## ✅ Verify It's Working

After setting up the scheduler:

1. **Wait for next Monday or Thursday**
2. **Check Supabase Dashboard → Edge Functions → Logs**
   - Look for `assign-custom-question-opportunity` execution
   - Should see logs around 12:01 AM UTC
3. **Check database**:
```sql
SELECT 
  date_assigned,
  COUNT(*) as opportunities,
  COUNT(*) FILTER (WHERE date_asked IS NULL) as pending_banners
FROM custom_questions
WHERE date_assigned >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date_assigned
ORDER BY date_assigned DESC;
```

## 🎯 Expected Behavior

- **Every Monday**: Function runs at 12:01 AM UTC, creates opportunities for that Monday
- **Every Thursday**: Function runs at 12:01 AM UTC, creates opportunities for that Thursday
- **Banners show**: When `date_assigned = CURRENT_DATE` AND `date_asked IS NULL`
- **Banners disappear**: When user creates the question (sets `date_asked`)

## 📝 Manual Trigger (If Needed)

If the scheduler fails or you need to manually trigger:

```bash
export SUPABASE_SERVICE_ROLE_KEY='your-key'
npm run invoke-custom-questions
```

Or use the full deploy script:
```bash
npm run deploy-custom-questions
```

## 🐛 Troubleshooting

### Scheduler Not Running
- Check Supabase Dashboard → Edge Functions → Logs
- Verify cron expression is correct
- Check timezone (should be UTC)
- Verify function is deployed

### No Opportunities Created
- Check if groups are eligible: `SELECT COUNT(*) FROM group_activity_tracking WHERE is_eligible_for_custom_questions = true`
- Check function logs for errors
- Verify function has correct permissions

### Banners Not Showing
- Verify `date_assigned = CURRENT_DATE`
- Verify `date_asked IS NULL`
- Check frontend banner display logic
- Verify user is viewing the correct group
