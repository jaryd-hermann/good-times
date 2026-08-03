# Good Times — curation portal

Operator tool for the v2 global question queue. Next.js App Router, reads and
writes Supabase with the service-role key **server-side only**. Access is gated
behind email + password login, restricted to an allowlist of authorized emails.

## Run it locally

```bash
cd admin
cp .env.local.example .env.local     # fill in the values below
npm install
npm run dev                          # http://localhost:3111
```

### Environment variables

| Var | Where to find it | Notes |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API | already filled in the example |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **server-only**, reads/writes data |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API | used only for the login session |
| `ADMIN_ALLOWED_EMAILS` | you decide | comma-separated allowlist; empty = nobody can log in |

## Auth

- Login is email + password via Supabase Auth (`app/login`).
- `middleware.ts` refreshes the session and gates **every** route: no valid
  session, or an email not in `ADMIN_ALLOWED_EMAILS`, is bounced to `/login`.
- The allowlist is enforced on every request, so removing an email from
  `ADMIN_ALLOWED_EMAILS` revokes access immediately (no need to delete the user).

### Create an authorized user

```bash
# loads admin/.env.local for the service-role key
npm run create-user -- someone@example.com 'a-strong-password'
```

Then add `someone@example.com` to `ADMIN_ALLOWED_EMAILS` (in `.env.local` for dev
and in the Vercel project settings for production).

## Deploy to Vercel

1. **Import the repo** in Vercel and set **Root Directory** to `admin`. Next.js
   is auto-detected; the build command (`next build`) and output are standard.
2. **Add the environment variables** above under Project → Settings →
   Environment Variables (Production + Preview). Use the same values as
   `.env.local`, and set `ADMIN_ALLOWED_EMAILS` to your real allowlist.
3. **Deploy.** Node 22 is used automatically (pinned via `engines` in
   `package.json`).
4. **Create your login users** — run `npm run create-user` locally against the
   same Supabase project (the users live in Supabase, shared by dev and prod).

Everything is rendered on demand (no static caching of live data), and the
service-role key is never sent to the browser (`lib/db.ts` is `server-only`).

## Daily digest — "Good Times, Yesterday"

An automated email summarizing the previous day (yesterday's question, answer
rate, active groups, new users/groups, messages, reactions, silent groups).
Toggle it on/off and set the recipient(s) from the portal → **Settings**.

Pieces:

- `supabase/migrations/114_v2_admin_daily_digest.sql` — seeds the `app_settings`
  toggle (`admin_digest_enabled`, `admin_digest_recipient`), the
  `v2_admin_digest_stats(date)` RPC, and the daily cron (`v2-admin-digest`,
  12:00 UTC ≈ 8am ET).
- `supabase/functions/send-admin-digest/` — composes the HTML and sends it via
  Resend. No-ops unless the toggle is on; the "Send a test now" button calls it
  with `{ force: true }`.

To activate on the backend (one-time):

```bash
supabase db push                          # applies migration 114
supabase functions deploy send-admin-digest
```

Requirements (already used by other functions): the `RESEND_API_KEY` function
secret, and `app_settings` rows `supabase_url` + `supabase_service_role_key`
(the cron reads these to call the function). The cron always runs; the on/off
switch lives in `app_settings` so you control it from the UI.

## Screens

| Route | What it does |
|---|---|
| `/` | Users, groups, answers today, answer rate, silent groups, queue-gap warning |
| `/queue` | The schedule. Seed gaps by engagement, assign or clear any date. Sundays pinned to the photo dump. |
| `/bank` | Searchable prompt bank with measured answer rate. Copy an id to assign it. |
| `/performance` | Per-day engagement for questions that have run. |
| `/groups` | Per-group membership and engagement health. |
| `/settings` | Toggle the daily digest email + set recipients; preview yesterday's numbers. |

## Notes

- Seeding is idempotent and **never overwrites a hand-assigned date**.
- Answer rate = answers ÷ people actually asked, from `prompt_usage_stats`, min 3 asks.
- All reads go through `v2_admin_*` RPCs so the portal stays thin.
