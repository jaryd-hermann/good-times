# Good Times App - Deployment Guide

## Prerequisites

1. **Supabase Project**
   - Create a new project at [supabase.com](https://supabase.com)
   - Note your project URL and anon key
   - Run the SQL migrations in `supabase/migrations/` in order

2. **Expo Account**
   - Sign up at [expo.dev](https://expo.dev)
   - Install EAS CLI: `npm install -g eas-cli`
   - Login: `eas login`

3. **Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in your Supabase credentials

## Database Setup

1. Run migrations in Supabase SQL Editor:
   \`\`\`sql
   -- Run 001_initial_schema.sql
   -- Run 002_add_cron_jobs.sql (update URLs with your project ref)
   \`\`\`

2. Seed prompts data:
   - Import `supabase/prompts_seed_us.csv` into the `prompts` table
   - Use Supabase dashboard: Table Editor → prompts → Insert → Import data from CSV

3. Enable Storage:
   - Create buckets: `avatars`, `entries`, `memorial-photos`
   - Set public access policies for each bucket

## Edge Functions Setup

1. Deploy edge functions:
   \`\`\`bash
   supabase functions deploy schedule-daily-prompts
   supabase functions deploy send-daily-notifications
   \`\`\`

2. Update cron job URLs in `002_add_cron_jobs.sql` with your project reference

## Mobile App Build

### Development Build

\`\`\`bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
\`\`\`

### Production Build

\`\`\`bash
# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
\`\`\`

## Push Notifications Setup

1. **iOS**
   - Create APNs key in Apple Developer Portal
   - Add to Expo project: `eas credentials`

2. **Android**
   - Firebase Cloud Messaging is automatically configured by Expo

3. **Test notifications**
   - Use Expo push notification tool: https://expo.dev/notifications

## Environment Variables

Required environment variables:

\`\`\`
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

## Monitoring

- View logs in Supabase Dashboard → Edge Functions → Logs
- Monitor cron jobs in Supabase Dashboard → Database → Cron Jobs
- Check app analytics in Expo Dashboard

## Troubleshooting

- **Push notifications not working**: Verify push tokens are being saved to user profiles
- **Daily prompts not scheduling**: Check cron job logs in Supabase
- **Media upload failing**: Verify storage bucket policies are set correctly
