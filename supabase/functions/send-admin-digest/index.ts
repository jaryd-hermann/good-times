// @ts-expect-error - Deno URL imports are valid at runtime in Supabase Edge Functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error - Deno URL imports are valid at runtime in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const RESEND_API_URL = "https://api.resend.com/emails"
const FROM_EMAIL = "Good Times <welcome@thegoodtimes.app>"

// The admin digest. Cron pings this every morning; it no-ops unless
// admin_digest_enabled = 'true'. Pass { force: true } to bypass the toggle
// (used by the "Send test" button), and { date: 'YYYY-MM-DD' } to render a
// specific day instead of yesterday.
type Body = { force?: boolean; date?: string }

type Stats = {
  date: string
  question: string | null
  answerers: number
  activeUsers30d: number
  answerRate: number
  messages: number
  answerMessages: number
  reactions: number
  groupsAnswered: number
  groupsTotal: number
  groupEngagement: number
  silentGroups: number
  newUsers: number
  newGroups: number
  totalUsers: number
  totalGroups: number
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function statCard(label: string, value: string | number, foot?: string): string {
  return `
    <td style="padding:6px;" width="50%">
      <div style="border:2px solid #14110d;border-radius:12px;background:#f5f0ea;padding:14px 16px;">
        <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b6357;font-weight:700;">${esc(label)}</div>
        <div style="font-size:28px;font-weight:800;letter-spacing:-.02em;margin-top:4px;color:#14110d;">${esc(String(value))}</div>
        ${foot ? `<div style="font-size:12px;color:#6b6357;margin-top:2px;">${esc(foot)}</div>` : ""}
      </div>
    </td>`
}

function buildHtml(s: Stats): string {
  const dateLabel = prettyDate(s.date)
  const rows: string[] = [
    `<tr>${statCard("Answers", s.answerers, `${s.answerRate}% of ${s.activeUsers30d} active`)}${statCard("Active groups", `${s.groupsAnswered}/${s.groupsTotal}`, `${s.groupEngagement}% answered`)}</tr>`,
    `<tr>${statCard("New users", s.newUsers, `${s.totalUsers} total`)}${statCard("New groups", s.newGroups, `${s.totalGroups} total`)}</tr>`,
    `<tr>${statCard("Messages", s.messages, "chat replies")}${statCard("Reactions", s.reactions, "on the day")}</tr>`,
    `<tr>${statCard("Silent groups", s.silentGroups, "nobody answered")}${statCard("Shares", s.answerMessages, "answers posted")}</tr>`,
  ]

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#e8e0d5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#14110d;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="font-weight:800;font-size:18px;letter-spacing:-.02em;">Good&nbsp;Times <span style="color:#6b6357;font-weight:500;">yesterday</span></div>
    <h1 style="font-size:24px;margin:14px 0 2px;letter-spacing:-.02em;">Good Times, Yesterday</h1>
    <p style="color:#6b6357;margin:0 0 18px;">${esc(dateLabel)}</p>

    <div style="border:2px solid #14110d;border-radius:14px;background:#e5a13c;box-shadow:4px 4px 0 #14110d;padding:18px 20px;margin-bottom:18px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#14110d;">Yesterday's question</div>
      <div style="font-size:20px;font-weight:800;line-height:1.25;margin-top:8px;color:#14110d;">${esc(s.question ?? "(none resolved)")}</div>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows.join("\n")}
    </table>

    <p style="color:#6b6357;font-size:12px;margin-top:22px;">
      You're receiving this because you're on the Good Times admin digest list.
      Toggle it or change the recipient from the admin portal → Settings.
    </p>
  </div>
</body>
</html>`
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY")

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    let body: Body = {}
    try {
      body = (await req.json()) as Body
    } catch {
      // Cron sends an empty body — that's fine.
    }

    // Read the toggle + recipient. Missing rows are treated as "off".
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["admin_digest_enabled", "admin_digest_recipient"])

    const map = new Map<string, string>((settings ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
    const enabled = (map.get("admin_digest_enabled") ?? "false").toLowerCase() === "true"
    const recipientRaw = map.get("admin_digest_recipient") ?? ""

    if (!enabled && !body.force) {
      return new Response(
        JSON.stringify({ success: true, skipped: "admin_digest_enabled is not true" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      )
    }

    const recipients = recipientRaw
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No admin_digest_recipient configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Gather the numbers (defaults to yesterday inside the RPC).
    const { data: stats, error: statsErr } = await supabase.rpc("v2_admin_digest_stats", {
      p_date: body.date ?? undefined,
    })
    if (statsErr) throw new Error(`stats: ${statsErr.message}`)

    const s = stats as Stats
    const subject = `Good Times, Yesterday — ${prettyDate(s.date)}`
    const html = buildHtml(s)

    const resendResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: recipients, subject, html }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      throw new Error(`Resend API error: ${resendResponse.status} - ${errorText}`)
    }

    const resend = await resendResponse.json()

    return new Response(
      JSON.stringify({ success: true, sent_to: recipients, resend_id: resend.id, date: s.date }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[send-admin-digest] error:", message)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
