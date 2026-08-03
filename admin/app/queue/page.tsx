import Link from "next/link"
import { revalidatePath } from "next/cache"
import {
  getCurrentQuestion,
  getUpcoming,
  getPast,
  moveQuestion,
  addQuestion,
  assignQuestion,
  clearDate,
  seedRange,
  refreshEngagement,
} from "@/lib/db"

export const dynamic = "force-dynamic"

const iso = (d: Date) => d.toISOString().slice(0, 10)
const day = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

// ---- server actions --------------------------------------------------------

async function doAdd(formData: FormData) {
  "use server"
  const q = String(formData.get("question") || "").trim()
  if (q) await addQuestion(q, true)
  revalidatePath("/queue")
}

async function doMove(formData: FormData) {
  "use server"
  await moveQuestion(String(formData.get("date")), Number(formData.get("dir")) as -1 | 1)
  revalidatePath("/queue")
}

async function doAssign(formData: FormData) {
  "use server"
  const date = String(formData.get("date"))
  const pid = String(formData.get("prompt_id") || "").trim()
  if (date && pid) await assignQuestion(date, pid)
  revalidatePath("/queue")
}

async function doClear(formData: FormData) {
  "use server"
  await clearDate(String(formData.get("date")))
  revalidatePath("/queue")
}

async function doSeed() {
  "use server"
  await refreshEngagement()
  await seedRange(iso(new Date()), iso(new Date(Date.now() + 90 * 864e5)))
  revalidatePath("/queue")
}

// ---- page ------------------------------------------------------------------

export default async function Queue({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const sp = await searchParams
  const view = sp.view === "past" ? "past" : "upcoming"

  let current, upcoming, past
  try {
    ;[current, upcoming, past] = await Promise.all([
      getCurrentQuestion(),
      view === "upcoming" ? getUpcoming(60) : Promise.resolve([]),
      view === "past" ? getPast(90) : Promise.resolve([]),
    ])
  } catch (e) {
    return (
      <>
        <h1>Queue</h1>
        <div className="banner err">{(e as Error).message}</div>
      </>
    )
  }

  const gaps = upcoming.filter((r) => r.is_gap).length

  return (
    <>
      <h1>Question queue</h1>
      <p className="sub">
        One global question per day. Sundays are pinned to the weekly photo dump and cannot
        be moved.
      </p>

      {/* ================= LIVE NOW ================= */}
      <section className="hero">
        <div className="hero-tag">
          <span className="live-dot" /> LIVE NOW · {day(current.date)}
          {current.is_sunday ? <span className="pill sunday">PHOTO DUMP</span> : null}
          {!current.scheduled ? <span className="pill empty">FALLBACK</span> : null}
        </div>
        <h2 className="hero-q">{current.question}</h2>
        <div className="hero-stats">
          <div>
            <strong>{current.answerers}</strong>
            <span>answered</span>
          </div>
          <div>
            <strong>{current.answer_rate}%</strong>
            <span>of {current.active_users} active</span>
          </div>
          <div>
            <strong>
              {current.groups_answered}/{current.groups_total}
            </strong>
            <span>groups live</span>
          </div>
          <div>
            <strong>{current.messages}</strong>
            <span>messages</span>
          </div>
          <div>
            <strong>{current.reactions}</strong>
            <span>reactions</span>
          </div>
        </div>
      </section>

      {/* ================= ADD ================= */}
      <section className="addbox">
        <form action={doAdd} className="addform">
          <input
            type="text"
            name="question"
            placeholder="Type a new question and press Add — it goes to the next free slot"
            autoComplete="off"
            required
            minLength={5}
          />
          <button type="submit">Add to queue</button>
        </form>
        <p className="addhint">
          Creates the question and drops it on the next free non-Sunday date. Reorder it
          below.
        </p>
      </section>

      {/* ================= TABS ================= */}
      <div className="tabs">
        <Link href="/queue?view=upcoming" className={view === "upcoming" ? "tab on" : "tab"}>
          Upcoming
        </Link>
        <Link href="/queue?view=past" className={view === "past" ? "tab on" : "tab"}>
          Past &amp; results
        </Link>
      </div>

      {view === "upcoming" ? (
        <>
          {gaps > 0 ? (
            <div className="banner warn">
              {gaps} upcoming date{gaps === 1 ? " has" : "s have"} no question assigned — they
              fall back to the engagement pool.{" "}
              <form action={doSeed} style={{ display: "inline" }}>
                <button type="submit" className="linkbtn">
                  Fill the gaps
                </button>
              </form>
            </div>
          ) : (
            <div className="banner ok">✓ Every upcoming date has a question assigned.</div>
          )}

          <ol className="board">
            {upcoming.map((r) => (
              <li key={r.date} className={`boardrow${r.is_gap ? " gap" : ""}${r.is_sunday ? " sun" : ""}`}>
                <div className="rank">{r.position}</div>

                <div className="boardmain">
                  <div className="boarddate">
                    {day(r.date)}
                    {r.is_sunday ? <span className="pill sunday">SUN · pinned</span> : null}
                    {r.notes === "manual" ? <span className="pill manual">manual</span> : null}
                    {r.answer_rate != null ? (
                      <span className="pill auto">
                        {(Number(r.answer_rate) * 100).toFixed(0)}% historic
                      </span>
                    ) : null}
                  </div>
                  <div className="boardq">{r.question}</div>
                </div>

                <div className="boardactions">
                  {!r.is_sunday ? (
                    <div className="movecol">
                      <form action={doMove}>
                        <input type="hidden" name="date" value={r.date} />
                        <input type="hidden" name="dir" value="-1" />
                        <button className="move" type="submit" title="Move earlier">
                          ▲
                        </button>
                      </form>
                      <form action={doMove}>
                        <input type="hidden" name="date" value={r.date} />
                        <input type="hidden" name="dir" value="1" />
                        <button className="move" type="submit" title="Move later">
                          ▼
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="movecol locked" title="Sundays are pinned">
                      🔒
                    </div>
                  )}

                  <div className="editcol">
                    <form action={doAssign} className="inline" style={{ margin: 0 }}>
                      <input type="hidden" name="date" value={r.date} />
                      <input type="text" name="prompt_id" placeholder="prompt id" size={10} />
                      <button type="submit" className="secondary">
                        Set
                      </button>
                    </form>
                    {r.prompt_id && !r.is_sunday ? (
                      <form action={doClear}>
                        <input type="hidden" name="date" value={r.date} />
                        <button type="submit" className="linkbtn danger">
                          clear
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Question</th>
                <th className="num">Answered</th>
                <th className="num">% active</th>
                <th className="num">Groups</th>
                <th className="num">Messages</th>
                <th className="num">Reactions</th>
              </tr>
            </thead>
            <tbody>
              {past.map((r) => (
                <tr key={r.date}>
                  <td className="mono">
                    {day(r.date)}
                    {r.is_sunday ? <> <span className="pill sunday">SUN</span></> : null}
                  </td>
                  <td className="q">{r.question}</td>
                  <td className="num">
                    <strong>{r.answerers}</strong>
                  </td>
                  <td className="num">{r.pct_of_active != null ? `${r.pct_of_active}%` : "—"}</td>
                  <td className="num">{r.groups_answered}</td>
                  <td className="num">{r.messages}</td>
                  <td className="num">{r.reactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
