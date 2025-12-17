# Email Onboarding System

This document explains the email onboarding system, including how to preview emails and how the sequence works.

## Overview

When a user joins their first group, they receive **7 emails total**:
1. **Welcome email** - Sent immediately when they join
2. **Day 2 email** - Sent 1 day after joining
3. **Day 3 email** - Sent 2 days after joining
4. **Day 4 email** - Sent 3 days after joining
5. **Day 5 email** - Sent 4 days after joining
6. **Day 6 email** - Sent 5 days after joining
7. **Day 7 email** - Sent 6 days after joining

## Previewing Emails

### Quick Start

To preview all email templates in your browser:

```bash
npm run preview-emails
```

This will generate HTML files in the `email-previews/` directory. Simply open any `.html` file in your browser to see how the email will look.

### Preview Workflow

1. **Generate previews**: Run `npm run preview-emails`
2. **Open in browser**: 
   - Mac: `open email-previews/welcome.html`
   - Or just double-click any HTML file
3. **Edit templates**: Modify templates in `supabase/functions/send-email/index.ts`
4. **Regenerate**: Run the preview command again to see changes

### Customizing Preview Data

Edit `scripts/preview-emails.ts` to change the sample data used in previews:
- `member_name`: The user's name
- `group_name`: The group name
- Other template-specific data

## Email Templates

All email templates are defined in `supabase/functions/send-email/index.ts`:

- **Template config**: `EMAIL_TEMPLATES` object defines subjects and template IDs
- **HTML generation**: `generateEmailHTML()` function creates the HTML content
- **Text generation**: `generateEmailText()` function creates plain text fallback

### Template Structure

Each email template includes:
- HTML version (for email clients)
- Plain text version (fallback)
- Personalization variables (member name, group name, etc.)

## How It Works

### 1. Welcome Email Trigger

When a user joins their first group:
- Database trigger (`send_welcome_email()`) fires
- Sends welcome email immediately via Edge Function
- Schedules follow-up emails via `schedule_onboarding_emails()`

### 2. Email Scheduling

The `schedule_onboarding_emails()` function:
- Creates entries in `onboarding_email_schedule` table
- Sets `scheduled_for` dates (1-6 days after join date)
- Marks emails as `sent: false` initially

### 3. Email Processing

A cron job runs every hour:
- Calls `process-onboarding-emails` Edge Function
- Finds emails where `scheduled_for <= NOW()` and `sent = false`
- Sends each email via `send-email` Edge Function
- Marks emails as `sent: true` after successful send

### 4. Email Logging

All sent emails are logged to `email_logs` table:
- User ID
- Email type
- Resend ID (for tracking)
- Template data used
- Timestamp

## Database Tables

### `email_logs`
Tracks all emails sent to users:
- `user_id`: Who received the email
- `email_type`: Type of email (welcome, onboarding_day_2, etc.)
- `resend_id`: Resend API tracking ID
- `sent_at`: When email was sent

### `onboarding_email_schedule`
Schedules follow-up emails:
- `user_id`: Who should receive the email
- `email_type`: Type of email
- `scheduled_for`: When to send it
- `sent`: Whether it's been sent yet

## Modifying Email Templates

### To Change Email Content

1. Open `supabase/functions/send-email/index.ts`
2. Find the template in `generateEmailHTML()` function
3. Modify the HTML/CSS inline styles
4. Update the corresponding text version in `generateEmailText()`
5. Test with `npm run preview-emails`

### To Change Email Timing

Edit `supabase/migrations/013_add_onboarding_email_tracking.sql`:
- Modify the `INTERVAL` values in `schedule_onboarding_emails()`
- Example: Change `INTERVAL '1 day'` to `INTERVAL '2 days'`

### To Add New Email Types

1. Add to `EMAIL_TEMPLATES` config
2. Add HTML generation case in `generateEmailHTML()`
3. Add text generation case in `generateEmailText()`
4. Update preview script if needed

## Testing

### Test Email Sending (Development)

You can manually trigger emails via Supabase Dashboard:
1. Go to Edge Functions → `send-email`
2. Invoke with JSON:
```json
{
  "email_type": "welcome",
  "user_id": "your-user-id",
  "group_id": "your-group-id"
}
```

### Test Email Processing

Manually trigger the processor:
1. Go to Edge Functions → `process-onboarding-emails`
2. Invoke (no body needed)
3. Check logs to see processed emails

## Cron Job Setup

The cron job runs every hour. To modify:
1. Edit `supabase/migrations/014_add_onboarding_email_cron.sql`
2. Change the cron schedule (e.g., `'0 */2 * * *'` for every 2 hours)
3. Run migration

## Troubleshooting

### Emails Not Sending

1. Check `onboarding_email_schedule` table for pending emails
2. Verify cron job is running: Check Supabase cron logs
3. Check Edge Function logs for errors
4. Verify `RESEND_API_KEY` is set in Supabase secrets

### Preview Not Working

1. Ensure `tsx` is installed: `npm install -D tsx`
2. Check that `email-previews/` directory is writable
3. Verify TypeScript compilation: `tsc --noEmit scripts/preview-emails.ts`

### Email Design Issues

1. Test in multiple email clients (Gmail, Outlook, Apple Mail)
2. Use inline CSS (most email clients don't support `<style>` tags)
3. Test on mobile devices (many users read emails on phones)
4. Keep width under 600px for best compatibility

## Best Practices

1. **Always preview** before deploying changes
2. **Test in multiple clients** - email rendering varies widely
3. **Keep it simple** - complex layouts break in email clients
4. **Use inline styles** - external CSS doesn't work in emails
5. **Include text version** - some clients prefer plain text
6. **Test personalization** - ensure variables are replaced correctly

