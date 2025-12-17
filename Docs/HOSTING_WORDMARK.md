# Hosting Wordmark for Emails

## Current Setup

The wordmark image is now in the `public/` directory, which means it will be automatically served by Vercel at:

**URL:** `https://thegoodtimes.app/wordmark.png`

## How It Works

### Vercel Static File Serving

Vercel automatically serves files from the `public/` directory at the root of your domain:

- `public/wordmark.png` → `https://thegoodtimes.app/wordmark.png`
- `public/favicon.ico` → `https://thegoodtimes.app/favicon.ico`
- etc.

## Deployment Steps

1. **File is already in place**: `public/wordmark.png` ✅

2. **Deploy to Vercel**:
   ```bash
   # If using Vercel CLI
   vercel --prod
   
   # Or push to your main branch (if auto-deploy is enabled)
   git add public/wordmark.png
   git commit -m "Add wordmark for email templates"
   git push
   ```

3. **Verify it's accessible**:
   ```bash
   curl -I https://thegoodtimes.app/wordmark.png
   ```
   
   Should return `200 OK` status.

   Or open in browser:
   ```
   https://thegoodtimes.app/wordmark.png
   ```

## Alternative: Using Supabase Storage

If you prefer to host it on Supabase Storage instead:

1. **Upload to Supabase Storage**:
   - Go to Supabase Dashboard → Storage
   - Create a bucket called `public` (or use existing)
   - Upload `wordmark.png`
   - Make it public

2. **Get the public URL**:
   ```
   https://[PROJECT_REF].supabase.co/storage/v1/object/public/public/wordmark.png
   ```

3. **Update email templates**:
   Replace `https://thegoodtimes.app/wordmark.png` with your Supabase Storage URL in `supabase/functions/send-email/index.ts`

## Testing

After deployment, test the image URL:

```bash
# Check if image loads
curl -I https://thegoodtimes.app/wordmark.png

# Or test in email preview
npm run preview-emails
# Then check the HTML source - the image should load
```

## Troubleshooting

### Image not loading in emails

1. **Check URL is accessible**: Open `https://thegoodtimes.app/wordmark.png` in browser
2. **Check CORS**: Some email clients block external images - this is normal
3. **Check file exists**: Verify `public/wordmark.png` exists in your repo
4. **Check deployment**: Make sure you've deployed to Vercel

### Image loads in browser but not emails

This is normal! Many email clients block external images by default. Users need to:
- Click "Load images" or "Display images" in their email client
- Or add your domain to their trusted senders list

The image will still be there - it just requires user action to display in some email clients.

## Current Status

✅ Wordmark file: `public/wordmark.png`  
✅ Email template URL: `https://thegoodtimes.app/wordmark.png`  
⏳ **Next step**: Deploy to Vercel to make it live

