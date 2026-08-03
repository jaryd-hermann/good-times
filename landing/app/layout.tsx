import type { Metadata, Viewport } from "next"
import "./globals.css"
import { SITE_URL } from "@/lib/config"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Good Times — Answer one question a day with friends",
  description:
    "One new question every day, answered however you want, in a private space with your favorite people. No AI. No algorithms. No ads. No strangers.",
  openGraph: {
    title: "Good Times — Answer one question a day with friends",
    description:
      "One new question every day, answered however you want, in a private space with your favorite people. No AI. No algorithms. No ads. No strangers.",
    url: SITE_URL,
    siteName: "Good Times",
    images: [{ url: "/icon.png", width: 1024, height: 1024, alt: "Good Times" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Good Times — Answer one question a day with friends",
    description:
      "One new question every day, answered however you want, with your favorite people.",
    images: ["/icon.png"],
  },
  icons: { icon: "/icon.png", apple: "/icon.png" },
}

export const viewport: Viewport = {
  themeColor: "#E8E0D5",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
