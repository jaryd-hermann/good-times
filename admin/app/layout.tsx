import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"
import { getSessionUser } from "@/lib/supabase/server"
import { signOut } from "./login/actions"

export const metadata: Metadata = {
  title: "Good Times — Curation",
  description: "Question queue, engagement and group health for Good Times v2.",
}

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/queue", label: "Queue" },
  { href: "/groups", label: "Groups" },
  { href: "/bank", label: "Question bank" },
  { href: "/performance", label: "Performance" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/settings", label: "Settings" },
]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  return (
    <html lang="en">
      <body>
        {user ? (
          <header className="topbar">
            <div className="brand">
              Good&nbsp;Times <span className="brand-sub">curation</span>
            </div>
            <nav>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="userbox">
              <span className="useremail">{user.email}</span>
              <form action={signOut}>
                <button type="submit" className="secondary">
                  Sign out
                </button>
              </form>
            </div>
          </header>
        ) : null}
        <main>{children}</main>
      </body>
    </html>
  )
}
