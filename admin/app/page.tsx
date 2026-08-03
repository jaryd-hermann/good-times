import Link from "next/link"
import { getDashboard } from "@/lib/db"

export const dynamic = "force-dynamic"

function Stat({ label, value, foot }: { label: string; value: React.ReactNode; foot?: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {foot ? <div className="foot">{foot}</div> : null}
    </div>
  )
}

export default async function Dashboard() {
  let s
  try {
    s = await getDashboard()
  } catch (e) {
    return (
      <>
        <h1>Dashboard</h1>
        <div className="banner err">
          Could not reach Supabase: {(e as Error).message}
        </div>
      </>
    )
  }

  const gap = s.unscheduledNext7 ?? []

  return (
    <>
      <h1>Dashboard</h1>
      <p className="sub">Live from production. Everything here is read-only.</p>

      {gap.length > 0 ? (
        <div className="banner warn">
          ⚠ {gap.length} date{gap.length === 1 ? "" : "s"} in the next 7 days have no
          assigned question ({gap.join(", ")}). The app will serve an engagement-ranked
          fallback, but curation should fill these. <Link href="/queue">Open the queue →</Link>
        </div>
      ) : (
        <div className="banner ok">✓ Every date in the next 7 days has a question assigned.</div>
      )}

      <div className="grid">
        <Stat label="Users" value={s.users} />
        <Stat label="Groups" value={s.groups} foot={`avg ${s.avgGroupSize} members`} />
        <Stat label="Answers today" value={s.answersToday} />
        <Stat
          label="Answer rate today"
          value={`${s.todayAnswerRate}%`}
          foot={`of ${s.activeUsers30d} active in last 30d`}
        />
        <Stat
          label="Groups silent today"
          value={s.groupsSilentToday}
          foot="nobody has answered yet"
        />
        <Stat
          label="Unscheduled next 30d"
          value={s.unscheduledNext30}
          foot={s.unscheduledNext30 === 0 ? "queue is full" : "needs filling"}
        />
      </div>

      <h2>Today&rsquo;s question</h2>
      <div className="card">
        <div className="label">{new Date().toDateString()}</div>
        <div style={{ fontSize: 19, fontWeight: 700, marginTop: 8, maxWidth: 720 }}>
          {s.todayQuestion ?? "(none resolved)"}
        </div>
      </div>
    </>
  )
}
