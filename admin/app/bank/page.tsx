import { getBank } from "@/lib/db"

export const dynamic = "force-dynamic"

const FILTERS = [
  { v: "all", l: "All" },
  { v: "top", l: "Has engagement data" },
  { v: "unused", l: "Never scheduled" },
  { v: "scheduled", l: "Already scheduled" },
  { v: "never_asked", l: "Never asked (no data)" },
]

export default async function Bank({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const sp = await searchParams
  const search = sp.q ?? ""
  const filter = sp.filter ?? "top"

  let rows
  try {
    rows = await getBank(search, filter)
  } catch (e) {
    return (
      <>
        <h1>Question bank</h1>
        <div className="banner err">{(e as Error).message}</div>
      </>
    )
  }

  return (
    <>
      <h1>Question bank</h1>
      <p className="sub">
        Answer rate is measured as answers ÷ people actually asked, from{" "}
        <code>prompt_usage_stats</code>, minimum 3 asks. Copy an id and paste it into the
        queue to assign it to a date.
      </p>

      <form className="inline" method="get">
        <input type="search" name="q" placeholder="Search questions…" defaultValue={search} size={32} />
        <select name="filter" defaultValue={filter}>
          {FILTERS.map((f) => (
            <option key={f.v} value={f.v}>
              {f.l}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>

      <p className="dim">{rows.length} results</p>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>Category</th>
              <th className="num">Answer rate</th>
              <th className="num">Asked</th>
              <th className="num">Answers</th>
              <th>Scheduled</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="q">{r.question}</td>
                <td className="dim">{r.category}</td>
                <td className="num">
                  {r.answer_rate != null ? (
                    <strong>{(Number(r.answer_rate) * 100).toFixed(0)}%</strong>
                  ) : (
                    <span className="dim">—</span>
                  )}
                </td>
                <td className="num">{r.times_asked ?? <span className="dim">—</span>}</td>
                <td className="num">{r.total_answers ?? <span className="dim">—</span>}</td>
                <td className="mono dim">{r.scheduled_for ?? ""}</td>
                <td>
                  <code style={{ fontSize: 11 }}>{r.id}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
