# Setting EAS Environment Variables Manually

## Option 1: Via Expo Dashboard (Easiest)

1. Go to [expo.dev](https://expo.dev) and log in
2. Navigate to your project: **Good Times** (or find it in your projects list)
3. Go to **Settings** → **Environment Variables** (or **Secrets**)
4. Click **Add Variable** or **Create Secret**

### Add these two variables:

**Variable 1:**
- **Name:** `EXPO_PUBLIC_SUPABASE_URL`
- **Value:** `https://ytnnsykbgohiscfgomfe.supabase.co`
- **Type:** Plain text
- **Environment:** Production (or All)

**Variable 2:**
- **Name:** `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g`
- **Type:** Sensitive
- **Environment:** Production (or All)

5. Save both variables

## Option 2: Via EAS CLI (Non-Interactive)

If you prefer CLI, you can use the non-interactive flag:

```bash
# Set URL (plain text)
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://ytnnsykbgohiscfgomfe.supabase.co" --type string --visibility project --environment production --non-interactive

# Set Anon Key (sensitive)
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bm5zeWtiZ29oaXNjZmdvbWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NTAxMjYsImV4cCI6MjA3NzQyNjEyNn0.hsr5uNE-Tmuz8dLoPH7lJI7CaeTJkzQBIDr1-K0lI0g" --type string --visibility project --environment production --non-interactive
```

## Verify

After setting them (either method), verify:
```bash
eas env:list --scope project
```

## Next Steps

Once the environment variables are set, rebuild:
```bash
eas build --platform ios --profile production
```

The app should now have access to Supabase and won't crash on startup!

