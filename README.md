# Good Times

A private, nostalgic journaling app for families and friends living apart. 

## Tech Stack

- **React Native (Expo)** - Mobile framework
- **TypeScript** - Type safety
- **Expo Router** - File-based navigation
- **Supabase** - Backend (auth, database, storage)
- **React Query** - Data fetching and caching
- **Expo AV** - Audio recording for voice notes

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (Mac) or physical iOS device

### Installation

\`\`\`bash
npm install
\`\`\`

### Environment Variables

Create a `.env` file in the root directory:

\`\`\`
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

### Running Locally

\`\`\`bash
npx expo start
\`\`\`

Press `i` to open in iOS Simulator.

## Supabase Setup

1. Create a new Supabase project
2. Run the migrations in `supabase/migrations/` (in order: 001, 002, 003)
3. Import `prompts_seed_us.csv` into the `prompts` table
4. Enable Auth providers (Email, Google, Apple)
5. **Create storage bucket `entries-media`**:
   - Go to Storage in Supabase Dashboard
   - Click "New bucket"
   - Name: `entries-media`
   - **Check "Public bucket"** (required for media URLs to work)
   - Click "Create bucket"
6. Run migration `003_create_storage_bucket.sql` to set up RLS policies for storage

## Project Structure

\`\`\`
app/
  _layout.tsx              # Root layout with fonts and providers
  index.tsx                # Auth check and routing
  (auth)/                  # Authentication screens
  (onboarding)/            # Onboarding flow
  (main)/                  # Main app tabs
    home.tsx               # Daily prompts feed
    ideas.tsx              # Prompt library
    history.tsx            # Timeline view
    modals/                # Modal screens
components/                # Reusable components
lib/                       # Utilities and config
  supabase.ts              # Supabase client
  theme.ts                 # Design tokens
  types.ts                 # TypeScript types
assets/
  images/                  # Design assets
  fonts/                   # Libre Baskerville + Roboto
\`\`\`

## Design System

- **Fonts**: Libre Baskerville (headings), Roboto (body)
- **Colors**: Black background (#000000), White text, Accent (#de2f08)
- **Film Frame**: Inner color #0D0F1B for prompt/entry cards

## Features

- Daily group prompts with text, photo, video, and audio responses
- Private groups for family or friends
- Memorial feature to remember loved ones
- Browsable prompt library with categories
- Timeline history view (days, weeks, months, years)
- Push notifications for new prompts and entries
- Birthday prompts automatically injected

## iOS Permissions

The app requires:
- Camera access (for photos/videos)
- Photo library access (for selecting media)
- Microphone access (for voice notes)

## Building for Production

\`\`\`bash
eas build --platform ios
\`\`\`

## OTA Updates

\`\`\`bash
eas update --branch production
