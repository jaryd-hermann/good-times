import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isEmailAllowed } from "@/lib/auth"

/**
 * Every request is gated here:
 *  - refreshes the Supabase auth session (writes rotated cookies)
 *  - anything under /login is public
 *  - all other routes require a valid session whose email is on the allowlist
 *
 * The allowlist is enforced on every request (not just at login) so revoking an
 * email in ADMIN_ALLOWED_EMAILS instantly locks that person out.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY

  const isLogin = request.nextUrl.pathname.startsWith("/login")

  // If auth isn't configured, don't lock everyone out of a broken deploy on the
  // login page itself, but still refuse to serve protected pages.
  if (!url || !anon) {
    if (isLogin) return response
    const to = request.nextUrl.clone()
    to.pathname = "/login"
    to.searchParams.set("error", "Auth is not configured on the server.")
    return NextResponse.redirect(to)
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const authed = isEmailAllowed(user?.email)

  if (isLogin) {
    // Already signed in? Skip the login page.
    if (authed) {
      const to = request.nextUrl.clone()
      to.pathname = "/"
      to.search = ""
      return NextResponse.redirect(to)
    }
    return response
  }

  if (!authed) {
    const to = request.nextUrl.clone()
    to.pathname = "/login"
    to.search = ""
    return NextResponse.redirect(to)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Run on everything except Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
