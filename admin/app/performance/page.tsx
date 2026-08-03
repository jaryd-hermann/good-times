import { getPerformance } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function Performance({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const sp = await searchParams
  const days = Number(sp.days ?? 90)

  let rows
  try {
    rows = await getPerformance(days)
  } catch (e) {
    return (
      <>
        <h1>Past performance</h1>
        <div className="banner err">{(e as Error).message}</div>
      </>
    )
  }

  const best = [...rows].sort((a, b) => b.unique_answerers - a.unique_answerers).slice(0, 5)

  return (
    <>
      <h1>Past performance</h1>
      <p className="sub">
        Per-day engagement for questions that have actually run. Use this to find questions
        worth scheduling again.
      </p>

      <form className="inline" method="get">
        <label>
          Last <input type="text" name="days" defaultValue={String(days)} size={4} /> days
        </label>
        <button type="submit">Apply</button>
      </form>

      <h2>Strongest days</h2>
      <div className="grid">
        {best.map((r) => (
          <div className="card" key={r.date}>
            <div className="label">{r.date}</div>
            <div className="value">{r.unique_answerers}</div>
            <div className="foot">{r.question?.slice(0, 70)}</div>
          </div>
        ))}
      </div>

      <h2>All days</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Question</th>
              <th className="num">Answerers</th>
              <th className="num">% active</th>
              <th className="num">Messages</th>
              <th className="num">Reactions</th>
              <th className="num">Groups</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td className="mono">{r.date}</td>
                <td className="q">{r.question}</td>
                <td className="num">
                  <strong>{r.unique_answerers}</strong>
                </td>
                <td className="num">{r.pct_of_active ?? "—"}%</td>
                <td className="num">{r.messages}</td>
                <td className="num">{r.reactions}</td>
                <td className="num">{r.groups_with_answer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
