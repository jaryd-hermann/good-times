import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  getDigestSettings,
  setDigestSettings,
  getDigestStats,
  sendDigestNow,
} from "@/lib/db"

export const dynamic = "force-dynamic"

// ---- server actions --------------------------------------------------------

async function saveSettings(formData: FormData) {
  "use server"
  const enabled = formData.get("enabled") === "on"
  const recipient = String(formData.get("recipient") || "").trim()
  await setDigestSettings({ enabled, recipient })
  revalidatePath("/settings")
  redirect("/settings?saved=1")
}

async function sendTest() {
  "use server"
  let target: string
  try {
    const res = await sendDigestNow()
    target = res?.error
      ? `/settings?error=${encodeURIComponent(res.error)}`
      : `/settings?sent=${encodeURIComponent((res?.sent_to ?? []).join(", "))}`
  } catch (e) {
    target = `/settings?error=${encodeURIComponent((e as Error).message)}`
  }
  redirect(target)
}

// ---- page ------------------------------------------------------------------

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; sent?: string; error?: string }>
}) {
  const sp = await searchParams

  let settings, stats
  try {
    ;[settings, stats] = await Promise.all([getDigestSettings(), getDigestStats()])
  } catch (e) {
    return (
      <>
        <h1>Settings</h1>
        <div className="banner err">{(e as Error).message}</div>
      </>
    )
  }

  return (
    <>
      <h1>Settings</h1>
      <p className="sub">Control the automated admin reports.</p>

      {sp.saved ? <div className="banner ok">✓ Saved.</div> : null}
      {sp.sent ? (
        <div className="banner ok">✓ Test digest sent to {sp.sent || "(no recipient)"}.</div>
      ) : null}
      {sp.error ? <div className="banner err">{sp.error}</div> : null}

      <h2>Daily digest — “Good Times, Yesterday”</h2>
      <div className="card" style={{ maxWidth: 640 }}>
        <form action={saveSettings}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={settings.enabled}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontWeight: 700 }}>Send the daily digest email</span>
          </label>

          <label className="field" style={{ marginBottom: 16 }}>
            <span>Recipient email(s)</span>
            <input
              type="text"
              name="recipient"
              defaultValue={settings.recipient}
              placeholder="hermannjaryd@gmail.com"
              style={{ width: "100%" }}
            />
          </label>
          <p className="dim" style={{ marginTop: -8, marginBottom: 16 }}>
            Comma-separate for multiple recipients. Sends every morning around 8am ET.
          </p>

          <button type="submit">Save</button>
        </form>

        <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "18px 0" }} />

        <form action={sendTest}>
          <button type="submit" className="secondary">
            Send a test now
          </button>
          <p className="dim" style={{ marginTop: 8 }}>
            Sends yesterday’s digest immediately to the recipient(s) above, even if the
            toggle is off.
          </p>
        </form>
      </div>

      <h2>What yesterday’s email will contain</h2>
      <p className="sub" style={{ marginBottom: 12 }}>
        {new Date(stats.date + "T00:00:00").toDateString()} — “{stats.question ?? "(none resolved)"}”
      </p>
      <div className="grid">
        <Stat label="Answers" value={stats.answerers} foot={`${stats.answerRate}% of ${stats.activeUsers30d} active`} />
        <Stat label="Active groups" value={`${stats.groupsAnswered}/${stats.groupsTotal}`} foot={`${stats.groupEngagement}% answered`} />
        <Stat label="New users" value={stats.newUsers} foot={`${stats.totalUsers} total`} />
        <Stat label="New groups" value={stats.newGroups} foot={`${stats.totalGroups} total`} />
        <Stat label="Messages" value={stats.messages} foot="chat replies" />
        <Stat label="Reactions" value={stats.reactions} />
        <Stat label="Silent groups" value={stats.silentGroups} foot="nobody answered" />
        <Stat label="Shares" value={stats.answerMessages} foot="answers posted" />
      </div>
    </>
  )
}

function Stat({ label, value, foot }: { label: string; value: React.ReactNode; foot?: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {foot ? <div className="foot">{foot}</div> : null}
    </div>
  )
}
