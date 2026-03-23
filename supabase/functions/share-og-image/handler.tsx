import React from "https://esm.sh/react@18.2.0"
import { ImageResponse } from "https://deno.land/x/og_edge@0.0.6/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const STORAGE_BASE =
  "https://ytnnsykbgohiscfgomfe.supabase.co/storage/v1/object/public/entries-media/app-assets"
const OG_BG_URL = `${STORAGE_BASE}/og.png`
const GT_LOGO_URL = `${STORAGE_BASE}/gt-logo.png`

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(" ") + "..."
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number)
    const d = new Date(year, month - 1, day)
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
  } catch {
    return dateStr
  }
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  try {
    const url = new URL(req.url)
    const entryId = url.searchParams.get("entryId")

    if (!entryId) {
      return new Response("Missing entryId", { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: entry, error } = await supabase
      .from("entries")
      .select(`
      id, text_content, media_urls, media_types, date,
      prompt:prompts(question)
      `)
      .eq("id", entryId)
      .maybeSingle()

    if (error || !entry) {
      console.error("[share-og-image] Query error:", error)
      return new Response("Entry not found", { status: 404 })
    }

    const question = (entry.prompt as any)?.question || "A question from Good Times"
    const answerPreview = truncateWords(entry.text_content || "", 5)
    const dateLine = `${formatDate(entry.date)} | Good Times`
    const firstPhotoUrl = entry.media_urls?.find((_: string, i: number) =>
      entry.media_types?.[i] === "photo"
    )

    const bgUrl = firstPhotoUrl || OG_BG_URL
    const hasPhoto = !!firstPhotoUrl

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          <img
            src={bgUrl}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {hasPhoto && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(0,0,0,0.6)",
              }}
            />
          )}
          <img
            src={GT_LOGO_URL}
            style={{
              position: "absolute",
              top: 20,
              right: 25,
              width: 55,
              height: 55,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              flex: 1,
              padding: "0 80px",
              position: "relative",
            }}
          >
            <div
              style={{
                color: "white",
                fontSize: 48,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: 1.3,
                textShadow: "0 2px 10px rgba(0,0,0,0.3)",
              }}
            >
              {question}
            </div>
            {answerPreview ? (
              <div
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 22,
                  fontStyle: "italic",
                  textAlign: "center",
                  marginTop: 24,
                  textShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }}
              >
                {answerPreview}
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "absolute",
              bottom: 30,
              width: "100%",
            }}
          >
            <div
              style={{
                width: 300,
                height: 1,
                backgroundColor: "rgba(255,255,255,0.3)",
                marginBottom: 12,
              }}
            />
            <div
              style={{
                color: "white",
                fontSize: 16,
                textShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            >
              {dateLine}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  } catch (err) {
    console.error("[share-og-image] Error:", err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
