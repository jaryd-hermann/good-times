# Email System Documentation

## Overview

The Good Times app uses **Resend** for transactional emails, integrated with **Supabase Edge Functions** for serverless email sending. The system is designed to be scalable, maintainable, and easy to extend.

## Tech Stack

- **Resend**: Email delivery service (API-based)
- **Supabase Edge Functions**: Serverless functions for email logic (Deno runtime)
- **Supabase Database Webhooks**: Triggers email sends on database events
- **PostgreSQL Triggers**: Database-level triggers that call Edge Functions via HTTP

## Architecture

```
User Registration
    ↓
Database Trigger (group_members INSERT)
    ↓
PostgreSQL Function (send_welcome_email)
    ↓
HTTP POST to Edge Function
    ↓
Edge Function (send-email)
    ↓
Fetch User & Group Data
    ↓
Call Resend API
    ↓
Email Delivered
```

## Current Implementation

### Email Templates

All email templates are managed in the Resend dashboard and referenced by their template ID in Edge Functions.

#### 1. Welcome Email (`welcome-email`)

**Template ID**: `welcome-email`  
**Trigger**: User joins their first group (either by creating or joining)  
**Template Variables**:
- `member_name` - User's name from `users.name`
- `group_name` - Group name from `groups.name`

**Expected Behavior**:
- Fires when a user joins their first group (either as admin creating a group or as member joining an existing group)
- Triggered by `group_members` INSERT for any role
- Checks if this is the user's first group membership to avoid duplicate emails
- Fetches user profile and group details automatically
- Sends email to user's email address
- Only sends once per user (on first group join, not subsequent groups)

**Edge Function**: `supabase/functions/send-email/index.ts`

**Database Trigger**: `trigger_welcome_email_on_registration` (in `012_setup_email_webhook.sql`)

**Trigger Logic**:
- Fires on ALL `group_members` INSERT operations (both admins and regular members)
- Function checks if this is the user's first group membership
- Only sends email if `COUNT(*) = 0` for existing memberships (excluding current insert)
- Prevents duplicate welcome emails when users join multiple groups

### Edge Function: `send-email`

**Location**: `supabase/functions/send-email/index.ts`

**Purpose**: Generic email sending function that can be called from database triggers or other Edge Functions.

**Request Body**:
```json
{
  "email_type": "welcome",
  "user_id": "uuid",           // Optional - will fetch user data if provided
  "group_id": "uuid",           // Optional - will fetch group data if provided
  "recipient_email": "email",   // Optional - uses user.email if user_id provided
  "template_data": {            // Optional - additional template variables
    "custom_field": "value"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "resend_id": "resend-email-id"
}
```

**Environment Variables Required**:
- `RESEND_API_KEY` - Set in Supabase Dashboard → Edge Functions → Secrets
- `SUPABASE_URL` - Automatically available
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically available

**Email Configuration**:
- **From Address**: `Good Times <welcome@thegoodtimes.app>`
- **Domain**: `thegoodtimes.app` (verified in Resend)

## Database Setup

### SQL Script: `setup_email_webhook.sql`

**Run this script in your Supabase SQL Editor** to set up the welcome email trigger.

This script creates:
1. **Function**: `send_welcome_email()` - Calls the Edge Function via HTTP
2. **Trigger**: `trigger_welcome_email_on_registration` - Fires on `group_members` INSERT

**Before running the script**:
1. Open `setup_email_webhook.sql`
2. Replace `YOUR_PROJECT_REF` with your actual Supabase project reference
   - Found in your project URL: `https://YOUR_PROJECT_REF.supabase.co`
3. Replace `YOUR_ANON_KEY` with your actual Supabase anon key
   - Found in Supabase Dashboard → Project Settings → API → anon/public key

**To run**:
1. Copy the contents of `setup_email_webhook.sql`
2. Paste into Supabase SQL Editor
3. Update the two placeholder values
4. Click "Run"

## Deployment

### 1. Deploy Edge Function

```bash
# From project root
supabase functions deploy send-email
```

### 2. Set Environment Variables

In Supabase Dashboard:
- Go to **Project Settings** → **Edge Functions** → **Secrets**
- Add `RESEND_API_KEY` with your Resend API key

### 3. Run Database Migration

```sql
-- Run in Supabase SQL Editor
-- Make sure to update YOUR_PROJECT_REF and YOUR_ANON_KEY first!
```

### 4. Test

1. Create a test user account
2. Complete onboarding (create a group)
3. Check Resend dashboard for sent email
4. Verify email received with correct `member_name` and `group_name`

## Future Email Types

The system is designed to easily add new email types:

1. **Add template to Resend dashboard**
2. **Add template ID to `EMAIL_TEMPLATES` in Edge Function**
3. **Create trigger or call Edge Function directly**
4. **Update this documentation**

### Planned Email Types

- `group_welcome` - When user joins existing group
- `daily_prompt_reminder` - Scheduled daily email
- `group_invitation` - When user is invited to group
- `weekly_summary` - Weekly activity summary

## Troubleshooting

### Email Not Sending

1. **Check Edge Function logs**:
   - Supabase Dashboard → Edge Functions → `send-email` → Logs
   - Look for errors or missing environment variables

2. **Check Resend dashboard**:
   - View sent emails and any bounce/spam reports
   - Verify API key is correct

3. **Check database trigger**:
   ```sql
   -- Verify trigger exists
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_welcome_email_on_registration';
   
   -- Check if function exists
   SELECT * FROM pg_proc WHERE proname = 'send_welcome_email';
   ```

4. **Test Edge Function directly**:
   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "email_type": "welcome",
       "user_id": "test-user-id",
       "group_id": "test-group-id"
     }'
   ```

### Common Issues

- **"RESEND_API_KEY environment variable is not set"**: Add secret in Supabase Dashboard
- **"Failed to fetch user"**: User ID doesn't exist or RLS policy blocking
- **"Failed to fetch group"**: Group ID doesn't exist or RLS policy blocking
- **Trigger not firing**: Check that `role = 'admin'` condition is met

## Security Considerations

1. **API Keys**: Never expose Resend API key in client code
2. **RLS Policies**: Edge Function uses service role key, bypasses RLS
3. **Input Validation**: Edge Function validates required fields
4. **Rate Limiting**: Resend has rate limits (check your plan)
5. **Email Validation**: Resend validates email addresses before sending

## Monitoring

- **Resend Dashboard**: View all sent emails, opens, clicks, bounces
- **Supabase Logs**: Edge Function execution logs and errors
- **Database Logs**: Trigger execution (if enabled)

## Best Practices

1. **Template Variables**: Always use template variables for dynamic content
2. **Error Handling**: Edge Function logs errors but doesn't fail silently
3. **Testing**: Test with real email addresses before production
4. **Documentation**: Update this file when adding new email types
5. **Template IDs**: Keep template IDs in sync between Resend and code

## Support

- **Resend Docs**: https://resend.com/docs
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **PostgreSQL Triggers**: https://www.postgresql.org/docs/current/triggers.html

