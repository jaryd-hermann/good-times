import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Cookie-bound Supabase client used ONLY for authentication (login sessions).
 * Uses the anon key + the visitor's cookies, so it acts as the logged-in user.
 *
 * This is separate from lib/db.ts, which uses the service-role key to read/write
 * operator data. Auth here is purely the gate; the service role does the work.
 */
export async function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY. See admin/.env.local.example."
    )
  }

  const cookieStore = await cookies()

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component where cookies are read-only. The
          // middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  })
}

/**
 * Returns the authenticated user (or null) for the current request. Never
 * throws — a missing session, unconfigured env, or build-time prerender all
 * resolve to null so the layout can simply hide the authed chrome.
 */
export async function getSessionUser() {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}
