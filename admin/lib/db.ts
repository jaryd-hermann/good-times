import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Service-role client. SERVER ONLY — `server-only` above makes importing this
 * from a client component a build error, so the key can never reach the bundle.
 *
 * RLS is disabled on the public schema (see docs/V2_PLAN.md section 13.3), so the
 * service role is not what grants access here; it is used because this is an
 * operator tool that intentionally reads across every user and group.
 */
function admin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Copy admin/.env.local.example to admin/.env.local."
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export type ScheduleRow = {
  date: string
  prompt_id: string | null
  question: string
  category: string
  notes: string | null
  is_sunday: boolean
  answer_count: number
}

export type DashboardStats = {
  users: number
  groups: number
  avgGroupSize: number
  answersToday: number
  activeUsers30d: number
  todayQuestion: string | null
  todayAnswerRate: number
  groupsSilentToday: number
  unscheduledNext7: string[]
  unscheduledNext30: number
}

export async function getDashboard(): Promise<DashboardStats> {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_dashboard")
  if (error) throw new Error(`dashboard: ${error.message}`)
  return data as DashboardStats
}

export async function getSchedule(from: string, to: string): Promise<ScheduleRow[]> {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_schedule", { p_from: from, p_to: to })
  if (error) throw new Error(`schedule: ${error.message}`)
  return (data ?? []) as ScheduleRow[]
}

export type BankRow = {
  id: string
  question: string
  category: string
  answer_rate: number | null
  times_asked: number | null
  total_answers: number | null
  last_asked: string | null
  scheduled_for: string | null
}

export async function getBank(search: string, filter: string, limit = 100): Promise<BankRow[]> {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_bank", {
    p_search: search || null,
    p_filter: filter || "all",
    p_limit: limit,
  })
  if (error) throw new Error(`bank: ${error.message}`)
  return (data ?? []) as BankRow[]
}

export type PerformanceRow = {
  date: string
  question: string
  unique_answerers: number
  pct_of_active: number
  messages: number
  reactions: number
  groups_with_answer: number
}

export async function getPerformance(days = 60): Promise<PerformanceRow[]> {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_performance", { p_days: days })
  if (error) throw new Error(`performance: ${error.message}`)
  return (data ?? []) as PerformanceRow[]
}

// ---- queue -----------------------------------------------------------------

export type CurrentQuestion = {
  date: string
  prompt_id: string
  question: string
  scheduled: boolean
  is_sunday: boolean
  answerers: number
  active_users: number
  answer_rate: number
  messages: number
  reactions: number
  groups_answered: number
  groups_total: number
}

export type UpcomingRow = {
  date: string
  position: number
  prompt_id: string | null
  question: string
  category: string
  notes: string | null
  is_sunday: boolean
  is_gap: boolean
  answer_rate: number | null
  times_asked: number | null
}

export type PastRow = {
  date: string
  question: string
  prompt_id: string | null
  is_sunday: boolean
  answerers: number
  messages: number
  reactions: number
  groups_answered: number
  pct_of_active: number | null
}

export async function getCurrentQuestion(): Promise<CurrentQuestion> {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_current_question")
  if (error) throw new Error(`current: ${error.message}`)
  return data as CurrentQuestion
}

export async function getUpcoming(limit = 60): Promise<UpcomingRow[]> {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_upcoming", { p_limit: limit })
  if (error) throw new Error(`upcoming: ${error.message}`)
  return (data ?? []) as UpcomingRow[]
}

export async function getPast(limit = 90): Promise<PastRow[]> {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_past", { p_limit: limit })
  if (error) throw new Error(`past: ${error.message}`)
  return (data ?? []) as PastRow[]
}

export async function moveQuestion(date: string, dir: -1 | 1) {
  const db = admin()
  const { data, error } = await db.rpc("v2_move_question", { p_date: date, p_dir: dir })
  if (error) throw new Error(`move: ${error.message}`)
  return data as { error?: string; moved?: string; swapped_with?: string }
}

/**
 * Create a curated question and schedule it. With no date it goes to the soonest
 * free weekday (the next slot); with a date it's pinned to that exact day.
 */
export async function addQuestion(question: string, date?: string) {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_add_question", {
    p_question: question,
    p_date: date || null,
  })
  if (error) throw new Error(`add: ${error.message}`)
  return data as { error?: string; prompt_id?: string; date?: string; assigned?: boolean }
}

// ---- mutations -------------------------------------------------------------

export async function assignQuestion(date: string, promptId: string) {
  const db = admin()
  const { error } = await db
    .from("question_schedule")
    .upsert({ date, prompt_id: promptId, notes: "manual" }, { onConflict: "date" })
  if (error) throw new Error(`assign: ${error.message}`)
}

export async function clearDate(date: string) {
  const db = admin()
  const { error } = await db.from("question_schedule").delete().eq("date", date)
  if (error) throw new Error(`clear: ${error.message}`)
}

export async function seedRange(from: string, to: string): Promise<number> {
  const db = admin()
  const { data, error } = await db.rpc("v2_seed_question_schedule", {
    from_date: from,
    to_date: to,
    actor: null,
  })
  if (error) throw new Error(`seed: ${error.message}`)
  return (data as number) ?? 0
}

export async function refreshEngagement() {
  const db = admin()
  const { error } = await db.rpc("v2_refresh_prompt_engagement")
  if (error) throw new Error(`refresh: ${error.message}`)
}

// ---- groups ----------------------------------------------------------------

export type GroupMember = {
  id: string
  name: string
  avatar_url: string | null
  answers: number
}

export type GroupRow = {
  group_id: string
  group_name: string
  created_at: string
  member_count: number
  members: GroupMember[]
  total_answers: number
  total_messages: number
  last_answered: string | null
  active_days: number
  engagement_rate: number | null
}

export async function getGroups(days = 30): Promise<GroupRow[]> {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_groups", { p_days: days })
  if (error) throw new Error(`groups: ${error.message}`)
  return (data ?? []) as GroupRow[]
}

// ---- daily admin digest ----------------------------------------------------

export type DigestSettings = {
  enabled: boolean
  recipient: string
}

export type DigestStats = {
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

const DIGEST_ENABLED = "admin_digest_enabled"
const DIGEST_RECIPIENT = "admin_digest_recipient"

export async function getDigestSettings(): Promise<DigestSettings> {
  const db = admin()
  const { data, error } = await db
    .from("app_settings")
    .select("key,value")
    .in("key", [DIGEST_ENABLED, DIGEST_RECIPIENT])
  if (error) throw new Error(`digest settings: ${error.message}`)
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]))
  return {
    enabled: (map.get(DIGEST_ENABLED) ?? "false").toLowerCase() === "true",
    recipient: map.get(DIGEST_RECIPIENT) ?? "",
  }
}

export async function setDigestSettings(s: DigestSettings): Promise<void> {
  const db = admin()
  const { error } = await db.from("app_settings").upsert(
    [
      { key: DIGEST_ENABLED, value: s.enabled ? "true" : "false", updated_at: new Date().toISOString() },
      { key: DIGEST_RECIPIENT, value: s.recipient.trim(), updated_at: new Date().toISOString() },
    ],
    { onConflict: "key" }
  )
  if (error) throw new Error(`save digest settings: ${error.message}`)
}

export async function getDigestStats(): Promise<DigestStats> {
  const db = admin()
  const { data, error } = await db.rpc("v2_admin_digest_stats")
  if (error) throw new Error(`digest stats: ${error.message}`)
  return data as DigestStats
}

/** Fires the digest edge function immediately, bypassing the on/off toggle. */
export async function sendDigestNow(): Promise<{ sent_to?: string[]; error?: string }> {
  const db = admin()
  const { data, error } = await db.functions.invoke("send-admin-digest", {
    body: { force: true },
  })
  if (error) throw new Error(`send digest: ${error.message}`)
  return data as { sent_to?: string[]; error?: string }
}

// ---- user-suggested questions ----------------------------------------------

export type SuggestionRow = {
  id: string
  question: string
  user_name: string | null
  user_email: string | null
  status: "new" | "accepted" | "rejected"
  created_at: string
}

/**
 * Submissions from the app's "Suggest a question" screen.
 *
 * name/email come off the row rather than a join to users: they were copied at
 * submission time so a suggestion still says who sent it after a rename or an
 * account deletion.
 */
export async function getSuggestions(status?: string): Promise<SuggestionRow[]> {
  const db = admin()
  let q = db
    .from("suggested_questions")
    .select("id, question, user_name, user_email, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500)
  if (status && status !== "all") q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw new Error(`suggestions: ${error.message}`)
  return (data ?? []) as SuggestionRow[]
}

export async function setSuggestionStatus(id: string, status: string): Promise<void> {
  const db = admin()
  const { error } = await db.from("suggested_questions").update({ status }).eq("id", id)
  if (error) throw new Error(`setSuggestionStatus: ${error.message}`)
}
