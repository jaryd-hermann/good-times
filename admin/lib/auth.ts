/**
 * Authorization allowlist. Only these emails may sign in and hold a session.
 * Set ADMIN_ALLOWED_EMAILS as a comma-separated list (case-insensitive) in the
 * environment (Vercel project settings for production, .env.local for dev).
 */
export function allowedEmails(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  const list = allowedEmails()
  // Fail closed: an empty/misconfigured allowlist grants nobody access.
  if (list.length === 0) return false
  return list.includes(email.toLowerCase())
}
