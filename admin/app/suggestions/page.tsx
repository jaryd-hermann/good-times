import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getSuggestions, setSuggestionStatus } from "@/lib/db"

export const dynamic = "force-dynamic"

// ---- server actions --------------------------------------------------------

async function mark(formData: FormData) {
  "use server"
  const id = String(formData.get("id") || "")
  const status = String(formData.get("status") || "")
  const from = String(formData.get("from") || "all")
  if (!id || !["new", "accepted", "rejected"].includes(status)) return
  await setSuggestionStatus(id, status)
  revalidatePath("/suggestions")
  redirect(`/suggestions?status=${from}`)
}

// ---- page ------------------------------------------------------------------

const FILTERS = [
  { key: "new", label: "New" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
]

function when(iso: string) {
  const d = new Date(iso)
  const days = Math.round((Date.now() - d.getTime()) / 864e5)
  const stamp = d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
  if (days === 0) return `today · ${stamp}`
  if (days === 1) return `yesterday · ${stamp}`
  return `${days}d ago · ${stamp}`
}

export default async function Suggestions({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  // Defaults to "new": the point of this tab is the decision queue, and landing
  // on every suggestion ever makes the ones needing a call harder to find.
  const status = sp.status ?? "new"
  const rows = await getSuggestions(status)

  return (
    <>
      <h1>Suggestions</h1>
      <p className="sub">
        Questions sent in from the app (You + Settings → Suggest a question).
      </p>

      <nav className="tabs">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/suggestions?status=${f.key}`}
            className={status === f.key ? "tab on" : "tab"}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="dim" style={{ marginTop: 24 }}>
          {status === "new"
            ? "Nothing waiting. Every suggestion has been triaged."
            : "No suggestions here yet."}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "45%" }}>Question</th>
              <th>From</th>
              <th>Submitted</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.question}</strong>
                </td>
                <td>
                  {r.user_name ?? <span className="dim">unknown</span>}
                  <br />
                  <span className="dim">{r.user_email ?? "—"}</span>
                </td>
                <td className="dim">{when(r.created_at)}</td>
                <td>
                  <span className={`pill ${r.status}`}>{r.status}</span>
                </td>
                <td>
                  {/* Plain forms, no client JS: this is a low-traffic operator
                      tool and a server action per button keeps it that way. */}
                  <div className="rowactions">
                    {r.status !== "accepted" ? (
                      <form action={mark}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="accepted" />
                        <input type="hidden" name="from" value={status} />
                        <button type="submit">Accept</button>
                      </form>
                    ) : null}
                    {r.status !== "rejected" ? (
                      <form action={mark}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <input type="hidden" name="from" value={status} />
                        <button type="submit" className="secondary">
                          Reject
                        </button>
                      </form>
                    ) : null}
                    {r.status !== "new" ? (
                      <form action={mark}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="new" />
                        <input type="hidden" name="from" value={status} />
                        <button type="submit" className="secondary">
                          Reopen
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="dim" style={{ marginTop: 20 }}>
        Accepting records the decision here; it does not add the question to the bank.
        Copy it into <Link href="/bank">Question bank</Link> to schedule it.
      </p>
    </>
  )
}
