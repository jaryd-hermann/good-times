# Email Template Controls

## Email Subject Lines

**Location:** `supabase/functions/send-email/index.ts` - Lines 16-57

Email subjects are controlled in the `EMAIL_TEMPLATES` object:

```typescript
const EMAIL_TEMPLATES = {
  welcome: {
    subject: "Welcome to Good Times!",
    templateId: null,
  },
  onboarding_day_2: {
    subject: "How's it going?",
    templateId: null,
  },
  // ... etc
}
```

**To change a subject:** Edit the `subject` field in the `EMAIL_TEMPLATES` object.

## Email Titles

Email titles appear in two places:

### 1. HTML `<title>` Tag
**Location:** Inside each email template's HTML (in `generateEmailHTML()` function)

This is what appears in the browser tab if the email is opened in a browser:

```html
<title>Welcome to Good Times</title>
```

**To change:** Edit the `<title>` tag in the HTML template for each email type.

### 2. Email Header (Removed)
The black header with the `<h1>` title has been **removed** from all templates as requested. Emails now start directly with the greeting.

## Email Design

All emails now use:
- **Dark theme**: Black background (`#000000`), white text (`#ffffff`)
- **No header**: Removed the black header section
- **Personalized sign-off**: `--Jaryd` instead of "The Good Times Team"

## Template Structure

Each email template has:
1. **HTML version** - `generateEmailHTML()` function (lines ~62-528)
2. **Plain text version** - `generateEmailText()` function (lines ~531-680)

Both versions are sent - email clients choose which to display.

## Quick Reference

| Email Type | Subject | Title Tag |
|------------|---------|-----------|
| welcome | "Welcome to Good Times!" | "Welcome to Good Times" |
| onboarding_day_2 | "How's it going?" | "Day 2 - Getting Started" |
| onboarding_day_3 | "Did you know?" | "Day 3 - Exploring Features" |
| onboarding_day_4 | "Building deeper connections" | "Day 4 - Building Connections" |
| onboarding_day_5 | "Making it a habit" | "Day 5 - Making It a Habit" |
| onboarding_day_6 | "Share the love!" | "Day 6 - Invite Friends" |
| onboarding_day_7 | "You're all set! 🎊" | "Day 7 - You're All Set!" |

## Making Changes

1. **Change subject**: Edit `EMAIL_TEMPLATES` object
2. **Change title**: Edit `<title>` tag in HTML template
3. **Change content**: Edit HTML/text in `generateEmailHTML()` or `generateEmailText()`
4. **Preview changes**: Run `npm run preview-emails` and open HTML files

