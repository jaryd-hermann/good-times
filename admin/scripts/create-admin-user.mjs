/**
 * Provision (or reset the password of) a Supabase Auth user that can log in to
 * the admin portal.
 *
 * Usage (loads admin/.env.local for SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   npm run create-user -- someone@example.com 'a-strong-password'
 *
 * Calls the GoTrue admin REST API directly (no supabase-js) so it works on any
 * Node version. If the email already exists, its password is updated instead —
 * handy since admin logins reuse the app's Supabase Auth users. After creating
 * the user, add their email to ADMIN_ALLOWED_EMAILS (both .env.local for dev and
 * the Vercel project settings for production).
 */
const [, , email, password] = process.argv

if (!email || !password) {
  console.error("Usage: npm run create-user -- <email> <password>")
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment.")
  console.error("Run via: npm run create-user -- <email> <password>  (loads .env.local)")
  process.exit(1)
}

const base = url.replace(/\/$/, "")
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
}

async function findUserByEmail(target) {
  const want = target.toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${base}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers })
    if (!res.ok) break
    const body = await res.json().catch(() => ({}))
    const users = body.users ?? body ?? []
    if (!users.length) break
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === want)
    if (hit) return hit
    if (users.length < 1000) break
  }
  return null
}

const createRes = await fetch(`${base}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({ email, password, email_confirm: true }),
})

const created = await createRes.json().catch(() => ({}))

if (createRes.ok) {
  console.log(`Created auth user: ${created.email} (${created.id})`)
  console.log("Now add this email to ADMIN_ALLOWED_EMAILS (dev .env.local + Vercel).")
  process.exit(0)
}

const alreadyExists =
  createRes.status === 422 ||
  /already been registered|already registered|email exists/i.test(
    created.msg || created.error_description || created.error || ""
  )

if (!alreadyExists) {
  console.error("Failed to create user:", created.msg || created.error_description || created.error || createRes.statusText)
  process.exit(1)
}

// Exists already: reset its password so it can be used for admin login.
const existing = await findUserByEmail(email)
if (!existing) {
  console.error("User exists but could not be located to update the password.")
  process.exit(1)
}

const updateRes = await fetch(`${base}/auth/v1/admin/users/${existing.id}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ password, email_confirm: true }),
})

const updated = await updateRes.json().catch(() => ({}))

if (!updateRes.ok) {
  console.error("Failed to update password:", updated.msg || updated.error_description || updated.error || updateRes.statusText)
  process.exit(1)
}

console.log(`Updated password for existing user: ${updated.email ?? email} (${existing.id})`)
console.log("Ensure this email is in ADMIN_ALLOWED_EMAILS (dev .env.local + Vercel).")
