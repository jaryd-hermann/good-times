import Link from "next/link"
import { revalidatePath } from "next/cache"
import {
  getCurrentQuestion,
  getSchedule,
  getPast,
  moveQuestion,
  addQuestion,
  assignQuestion,
  clearDate,
} from "@/lib/db"

export const dynamic = "force-dynamic"

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (n: number) => iso(new Date(Date.now() + n * 864e5))
const day = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

const WINDOW_DAYS = 14

// ---- server actions --------------------------------------------------------

async function doAdd(formData: FormData) {
  "use server"
  const q = String(formData.get("question") || "").trim()
  const date = String(formData.get("date") || "").trim()
  if (q) await addQuestion(q, date || undefined)
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
      view === "upcoming"
        ? getSchedule(addDays(1), addDays(WINDOW_DAYS))
        : Promise.resolve([]),
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

  const isAuto = (n: string | null) => (n ?? "").startsWith("auto")
  const curated = upcoming.filter((r) => !r.is_sunday && r.prompt_id && !isAuto(r.notes))
  const empties = upcoming.filter((r) => !r.is_sunday && (!r.prompt_id || isAuto(r.notes)))

  return (
    <>
      <h1>Question queue</h1>
      <p className="sub">
        One curated question per day for the next two weeks. Empty days send an
        automatic fallback until you add one. Sundays are the weekly photo dump.
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
            placeholder="Type a new question…"
            autoComplete="off"
            required
            minLength={5}
          />
          <input
            type="date"
            name="date"
            min={addDays(0)}
            title="Pick a date, or leave blank for the next open slot"
          />
          <button type="submit">Add</button>
        </form>
        <p className="addhint">
          Leave the date blank to drop it on the next open weekday, or pick a date
          (holidays, themed days, etc.). Sundays stay reserved for the photo dump.
        </p>
      </section>

      {/* ================= TABS ================= */}
      <div className="tabs">
        <Link href="/queue?view=upcoming" className={view === "upcoming" ? "tab on" : "tab"}>
          Next 2 weeks
        </Link>
        <Link href="/queue?view=past" className={view === "past" ? "tab on" : "tab"}>
          Past &amp; results
        </Link>
      </div>

      {view === "upcoming" ? (
        <>
          {empties.length > 0 ? (
            <div className="banner warn">
              {curated.length} curated · {empties.length} open day
              {empties.length === 1 ? "" : "s"} in the next two weeks. Open days send a
              fallback — fill them below.
            </div>
          ) : (
            <div className="banner ok">✓ Every day in the next two weeks has a curated question.</div>
          )}

          <ol className="board">
            {upcoming.map((r) => {
              const auto = isAuto(r.notes)
              const empty = !r.is_sunday && (!r.prompt_id || auto)

              // --- Sunday: pinned photo dump ---
              if (r.is_sunday) {
                return (
                  <li key={r.date} className="boardrow sun">
                    <div className="boardmain">
                      <div className="boarddate">
                        {day(r.date)}
                        <span className="pill sunday">SUN · photo dump</span>
                      </div>
                      <div className="boardq">Weekly photo dump</div>
                    </div>
                    <div className="boardactions">
                      <div className="movecol locked" title="Sundays are pinned">
                        🔒
                      </div>
                    </div>
                  </li>
                )
              }

              // --- empty day: add inline ---
              if (empty) {
                return (
                  <li key={r.date} className="boardrow gap">
                    <div className="boardmain">
                      <div className="boarddate">{day(r.date)}</div>
                      <form action={doAdd} className="emptyadd">
                        <input type="hidden" name="date" value={r.date} />
                        <input
                          type="text"
                          name="question"
                          placeholder="No question yet — a fallback will be sent. Type one to curate this day…"
                          autoComplete="off"
                          required
                          minLength={5}
                        />
                        <button type="submit" className="secondary">
                          Add
                        </button>
                      </form>
                    </div>
                  </li>
                )
              }

              // --- curated (human) question ---
              return (
                <li key={r.date} className="boardrow">
                  <div className="boardmain">
                    <div className="boarddate">
                      {day(r.date)}
                      <span className="pill manual">curated</span>
                      {r.answer_count > 0 ? (
                        <span className="pill auto">{r.answer_count} answered</span>
                      ) : null}
                    </div>
                    <div className="boardq">{r.question}</div>
                  </div>

                  <div className="boardactions">
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

                    <div className="editcol">
                      <form action={doAssign} className="inline" style={{ margin: 0 }}>
                        <input type="hidden" name="date" value={r.date} />
                        <input type="text" name="prompt_id" placeholder="prompt id" size={10} />
                        <button type="submit" className="secondary">
                          Set
                        </button>
                      </form>
                      <form action={doClear}>
                        <input type="hidden" name="date" value={r.date} />
                        <button type="submit" className="linkbtn danger">
                          clear
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              )
            })}
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
