# Why Expo Go Appears & How to Fix It

## 🔍 What's Happening

When you run `npx expo start`, Expo does this:

1. **Starts Metro bundler** (JavaScript bundler)
2. **Looks for a client to connect to:**
   - First checks if Expo Go is installed on simulator → **This is what you're seeing**
   - If Expo Go is found, it tries to use it
   - If no development client is built, it defaults to Expo Go

**The Problem:** Your app uses native modules that Expo Go doesn't support, so Expo Go shows an "incompatible" error.

## ✅ The Solution

You need to **build a development client first** before starting Metro. Here's the correct workflow:

### Step 1: Build Development Client (One Time)

```bash
# This builds your app with all native modules
npx expo run:ios
```

**What this does:**
- Builds a custom development client (NOT Expo Go)
- Installs it on your simulator
- This client has all your native modules built in
- Takes 5-10 minutes the first time

### Step 2: Start Metro Bundler

```bash
# After the client is built, start Metro
npx expo start --dev-client
```

**OR** if the client is already running:
```bash
npx expo start
# It will automatically detect your development client
```

## 🔧 Why This Happened

**What changed:**
- Nothing in your code changed
- The issue is that `npx expo start` by itself **doesn't build anything**
- It just starts Metro and looks for something to connect to
- Since no development client was built, it found Expo Go instead

**Previously you were probably:**
- Running `npx expo run:ios` which builds AND runs
- Or had a development client already installed

## 📋 Correct Workflow

### First Time Setup:
```bash
# 1. Build development client (one time, takes 5-10 min)
npx expo run:ios

# 2. After it builds and launches, you're done!
# The app is now running with hot reload
```

### Daily Development:
```bash
# Option A: Build and run in one command
npx expo run:ios

# Option B: If client is already installed
npx expo start --dev-client
# Then open the app on simulator (it will connect automatically)
```

## 🚨 Important: Use `--dev-client` Flag

When starting Metro, use the `--dev-client` flag to explicitly tell Expo to look for a development client, not Expo Go:

```bash
npx expo start --dev-client
```

This prevents Expo from trying to use Expo Go.

## 🔍 Verify You Have a Development Client

After running `npx expo run:ios`, check your simulator:
- You should see **"Good Times"** app icon (not Expo Go)
- The app should have your custom icon
- It should connect to Metro automatically

## ✅ Quick Fix Right Now

Run this command to build and run your development client:

```bash
npx expo run:ios
```

**This will:**
1. Build your app with all native modules
2. Install it on simulator
3. Launch it
4. Connect to Metro for hot reload

**After this, you'll never see Expo Go again** because you'll have your own development client installed.

## 🎯 Summary

- **`npx expo start`** = Just Metro bundler (tries Expo Go if no client)
- **`npx expo run:ios`** = Builds development client + runs it
- **`npx expo start --dev-client`** = Metro bundler (explicitly looks for dev client)

**Solution:** Run `npx expo run:ios` first, then use `npx expo start --dev-client` for subsequent runs.

