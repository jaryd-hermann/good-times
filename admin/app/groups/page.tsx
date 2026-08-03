import { getGroups, type GroupRow } from "@/lib/db"

export const dynamic = "force-dynamic"

function daysAgo(d: string | null) {
  if (!d) return null
  const then = new Date(d + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - then.getTime()) / 864e5)
}

function freshness(d: string | null) {
  const n = daysAgo(d)
  if (n === null) return { label: "never", cls: "cold" }
  if (n === 0) return { label: "today", cls: "hot" }
  if (n === 1) return { label: "yesterday", cls: "hot" }
  if (n <= 7) return { label: `${n}d ago`, cls: "warm" }
  if (n <= 30) return { label: `${n}d ago`, cls: "cool" }
  return { label: `${n}d ago`, cls: "cold" }
}

function Members({ members }: { members: GroupRow["members"] }) {
  if (!members?.length) return <span className="dim">no members</span>
  const sorted = [...members].sort((a, b) => b.answers - a.answers)
  return (
    <div className="memberchips">
      {sorted.map((m) => (
        <span key={m.id} className="memberchip" title={`${m.answers} answers`}>
          {m.name}
          <span className="memberchip-n">{m.answers}</span>
        </span>
      ))}
    </div>
  )
}

export default async function Groups({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const sp = await searchParams
  const days = Number(sp.days ?? 30)

  let rows: GroupRow[]
  try {
    rows = await getGroups(days)
  } catch (e) {
    return (
      <>
        <h1>Groups</h1>
        <div className="banner err">{(e as Error).message}</div>
      </>
    )
  }

  const live = rows.filter((r) => (daysAgo(r.last_answered) ?? 999) <= 7).length
  const dormant = rows.filter((r) => (daysAgo(r.last_answered) ?? 999) > 30).length
  const solo = rows.filter((r) => r.member_count <= 1).length

  return (
    <>
      <h1>Groups</h1>
      <p className="sub">
        Engagement rate is answers ÷ (members × days that group actually had activity), over
        the last {days} days — comparable across groups of different sizes.
      </p>

      <div className="grid">
        <div className="card">
          <div className="label">Groups</div>
          <div className="value">{rows.length}</div>
        </div>
        <div className="card">
          <div className="label">Active this week</div>
          <div className="value">{live}</div>
          <div className="foot">answered in last 7 days</div>
        </div>
        <div className="card">
          <div className="label">Dormant</div>
          <div className="value">{dormant}</div>
          <div className="foot">nothing in 30+ days</div>
        </div>
        <div className="card">
          <div className="label">Solo groups</div>
          <div className="value">{solo}</div>
          <div className="foot">one member, nobody to talk to</div>
        </div>
      </div>

      <form className="inline" method="get" style={{ marginTop: 24 }}>
        <label>
          Window <input type="text" name="days" defaultValue={String(days)} size={4} /> days
        </label>
        <button type="submit">Apply</button>
      </form>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th className="num">Members</th>
              <th>Who</th>
              <th className="num">Answers</th>
              <th className="num">Messages</th>
              <th>Last answered</th>
              <th className="num">Engagement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const f = freshness(r.last_answered)
              return (
                <tr key={r.group_id}>
                  <td>
                    <strong>{r.group_name}</strong>
                    {r.member_count <= 1 ? <> <span className="pill empty">solo</span></> : null}
                  </td>
                  <td className="num">{r.member_count}</td>
                  <td style={{ maxWidth: 320 }}>
                    <Members members={r.members} />
                  </td>
                  <td className="num">
                    <strong>{r.total_answers}</strong>
                  </td>
                  <td className="num">{r.total_messages}</td>
                  <td>
                    <span className={`fresh ${f.cls}`}>{f.label}</span>
                  </td>
                  <td className="num">
                    {r.engagement_rate != null ? (
                      <span className="bar-wrap">
                        <span
                          className="bar"
                          style={{ width: `${Math.min(Number(r.engagement_rate), 100)}%` }}
                        />
                        <span className="bar-label">{r.engagement_rate}%</span>
                      </span>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
