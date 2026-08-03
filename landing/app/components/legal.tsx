import Image from "next/image"
import Link from "next/link"

/** Shared chrome for the Privacy and Terms pages: brand header linking home,
 * a readable prose column, and cross-links at the bottom. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="legal-wrap">
      <header className="legal-head">
        <Link href="/" aria-label="Good Times home">
          <Image src="/wordmark.png" alt="Good Times" width={640} height={188} className="legal-mark" />
        </Link>
        <Link href="/" className="legal-back">← Back to home</Link>
      </header>

      <article className="legal">
        <h1 className="display">{title}</h1>
        <p className="legal-updated">Last updated {updated}</p>
        {children}
      </article>

      <footer className="legal-foot">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <span>© {new Date().getFullYear()} Good Times</span>
      </footer>
    </div>
  )
}
