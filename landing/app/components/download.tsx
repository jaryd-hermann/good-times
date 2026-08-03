"use client"

import { useEffect, useState } from "react"
import { APP_STORE_URL } from "@/lib/config"

const OPEN_EVENT = "gt:open-download"

/** Desktop visitors can't install from their computer, so we show a QR instead
 * of sending them to a dead end. Phones/tablets go straight to the App Store. */
function isHandheld() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches
}

function AppleLogo() {
  return (
    <svg className="apple" viewBox="0 0 384 512" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </svg>
  )
}

export function DownloadButton({
  label = "Download on the App Store",
  className = "btn",
}: {
  label?: string
  className?: string
}) {
  const onClick = (e: React.MouseEvent) => {
    if (!isHandheld()) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent(OPEN_EVENT))
    }
    // On phones/tablets, fall through and let the anchor open the App Store.
  }
  return (
    <a className={className} href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      <AppleLogo />
      {label}
    </a>
  )
}

export function DownloadModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const openIt = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, openIt)
    return () => window.removeEventListener(OPEN_EVENT, openIt)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Download Good Times">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
        <h3 className="display">Scan to download</h3>
        <p>Point your phone camera at the code to get Good Times on the App&nbsp;Store.</p>
        <img className="modal-qr" src="/appstore-qr.png" alt="QR code linking to Good Times on the App Store" width={260} height={260} />
        <a className="modal-link" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
          Or open the App Store →
        </a>
      </div>
    </div>
  )
}

/** Sticky download pill that slides in once the hero has scrolled out of view,
 * then fades back out when the final CTA section arrives so it doesn't overlap
 * the primary button there. */
export function FloatingCTA() {
  const [pastHero, setPastHero] = useState(false)
  const [atFooterCta, setAtFooterCta] = useState(false)

  useEffect(() => {
    const hero = document.getElementById("hero")
    const footerCta = document.getElementById("download-cta")
    const observers: IntersectionObserver[] = []

    if (hero) {
      const io = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting), { threshold: 0 })
      io.observe(hero)
      observers.push(io)
    }
    if (footerCta) {
      const io = new IntersectionObserver(([e]) => setAtFooterCta(e.isIntersecting), { threshold: 0 })
      io.observe(footerCta)
      observers.push(io)
    }
    return () => observers.forEach((io) => io.disconnect())
  }, [])

  const show = pastHero && !atFooterCta

  return (
    <div className={`floating-cta${show ? " show" : ""}`} aria-hidden={!show}>
      <DownloadButton label="Download on the App Store" />
    </div>
  )
}
