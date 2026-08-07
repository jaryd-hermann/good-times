import type { Author } from "./types"

/**
 * @-mentions, parsed from the message text itself.
 *
 * The alternative — storing offset ranges alongside the text — breaks the moment
 * anyone edits the string, and there is nowhere to put those ranges: `messages`
 * has `text` and a `mentions uuid[]`, nothing positional. So the text carries
 * "@Name" and the uuid[] carries who that resolved to at send time. The array is
 * what drives notifications; the text is what drives display.
 *
 * Names are matched LONGEST FIRST, because "@Sam" would otherwise match inside
 * "@Sam Taylor" and leave " Taylor" stranded as plain text.
 */

/** Members whose name starts with `query`, for the picker. Empty query = all. */
export function matchMembers(members: Author[], query: string, limit = 6): Author[] {
  const q = query.trim().toLowerCase()
  const named = members.filter((m) => (m.name ?? "").trim().length > 0)
  if (!q) return named.slice(0, limit)
  return named
    .filter((m) => (m.name ?? "").toLowerCase().includes(q))
    // Prefix matches first: typing "ja" should offer "Jaryd" before "Benjamin".
    .sort((a, b) => {
      const an = (a.name ?? "").toLowerCase().startsWith(q) ? 0 : 1
      const bn = (b.name ?? "").toLowerCase().startsWith(q) ? 0 : 1
      return an - bn
    })
    .slice(0, limit)
}

/**
 * The in-progress "@query" immediately before the cursor, or null.
 *
 * Only triggers when the @ starts a word — an email address should never open
 * the picker. Bails once the query grows past a plausible name, so a stray @ in
 * the middle of a sentence stops holding the picker open.
 */
export function activeMentionQuery(text: string, cursor: number): { query: string; at: number } | null {
  const upto = text.slice(0, cursor)
  const at = upto.lastIndexOf("@")
  if (at === -1) return null

  const before = at === 0 ? "" : upto[at - 1]
  if (before && !/\s/.test(before)) return null

  const query = upto.slice(at + 1)
  if (query.includes("\n") || query.length > 32) return null
  return { query, at }
}

/** Replaces the in-progress "@query" with the chosen name, and leaves a space. */
export function applyMention(
  text: string,
  at: number,
  cursor: number,
  name: string,
): { text: string; cursor: number } {
  const head = text.slice(0, at)
  const tail = text.slice(cursor)
  const inserted = `@${name} `
  return { text: head + inserted + tail, cursor: (head + inserted).length }
}

/**
 * Which members the finished text actually mentions.
 *
 * Resolved at SEND time rather than tracked while typing: someone can delete
 * half a name, and a mention array that still claimed them would notify a person
 * whose name is no longer in the message.
 */
export function resolveMentions(text: string, members: Author[]): string[] {
  // Derived from the SAME segmentation the renderer uses, deliberately. A naive
  // text.includes("@" + name) matches "@Sam" inside "@Sam Taylor", so mentioning
  // one person quietly notified a second who was never mentioned — and the bolded
  // text and the notification disagreed about who had been named.
  const mentioned = new Set(
    segmentMentions(text, members)
      .filter((seg) => seg.mention)
      .map((seg) => seg.text),
  )

  const ids: string[] = []
  for (const m of members) {
    const name = (m.name ?? "").trim()
    if (name && mentioned.has(name) && !ids.includes(m.id)) ids.push(m.id)
  }
  return ids
}

/**
 * Splits text into plain and mention segments for rendering.
 *
 * Mentions render as the bare name in bold — no "@" — so a message reads like a
 * sentence rather than like markup.
 */
export type TextSegment = {
  text: string
  mention: boolean
  /** Set on link segments — the absolute url to open. Plain text leaves it undefined. */
  href?: string
}

export function segmentMentions(text: string, members: Author[]): TextSegment[] {
  const names = byLongestName(members)
    .map((m) => (m.name ?? "").trim())
    .filter(Boolean)
  if (names.length === 0) return [{ text, mention: false }]

  const out: TextSegment[] = []
  let i = 0
  let buffer = ""

  outer: while (i < text.length) {
    if (text[i] === "@") {
      for (const name of names) {
        if (text.startsWith(`@${name}`, i)) {
          if (buffer) {
            out.push({ text: buffer, mention: false })
            buffer = ""
          }
          out.push({ text: name, mention: true })
          i += name.length + 1
          continue outer
        }
      }
    }
    buffer += text[i]
    i += 1
  }

  if (buffer) out.push({ text: buffer, mention: false })
  return out
}

/** Longest names first so "Sam" cannot match inside "Sam Taylor". */
function byLongestName(members: Author[]): Author[] {
  return [...members].sort((a, b) => (b.name ?? "").length - (a.name ?? "").length)
}

/**
 * http(s):// or a bare www. host.
 *
 * Deliberately NOT a general "anything.com" matcher: that turns "see you
 * tomorrow...ok" and every "e.g." into a broken link. Requiring a scheme or an
 * explicit www. keeps false positives near zero, which matters more here than
 * catching every possible url someone might type without one.
 */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi

/**
 * Sentence punctuation that follows a url far more often than it belongs to one:
 * "look at https://x.com/a." — the period ends the sentence, not the path.
 * A closing bracket is only trimmed when unmatched, so wikipedia-style urls
 * ending in ")" survive.
 */
function trimTrailing(url: string): { url: string; rest: string } {
  let end = url.length
  while (end > 0) {
    const ch = url[end - 1]
    if (".,;:!?".includes(ch)) {
      end -= 1
      continue
    }
    if (ch === ")" || ch === "]") {
      const open = ch === ")" ? "(" : "["
      const slice = url.slice(0, end)
      const opens = slice.split(open).length - 1
      const closes = slice.split(ch).length - 1
      if (closes > opens) {
        end -= 1
        continue
      }
    }
    break
  }
  return { url: url.slice(0, end), rest: url.slice(end) }
}

/** Splits one plain string into text and link segments. */
export function segmentLinks(text: string): TextSegment[] {
  const out: TextSegment[] = []
  let last = 0
  URL_RE.lastIndex = 0

  for (let m = URL_RE.exec(text); m; m = URL_RE.exec(text)) {
    const { url, rest } = trimTrailing(m[0])
    if (!url) continue
    if (m.index > last) out.push({ text: text.slice(last, m.index), mention: false })
    out.push({
      text: url,
      mention: false,
      // Linking.openURL needs a scheme; a bare "www.x.com" silently fails.
      href: /^https?:\/\//i.test(url) ? url : `https://${url}`,
    })
    if (rest) out.push({ text: rest, mention: false })
    last = m.index + m[0].length
  }

  if (last < text.length) out.push({ text: text.slice(last), mention: false })
  return out.length ? out : [{ text, mention: false }]
}

/**
 * Mentions AND links in one pass, for rendering a message body.
 *
 * Links are found only INSIDE the plain segments — running the url matcher over
 * the whole string first would let a name containing a dot swallow a mention.
 */
export function segmentRich(text: string, members: Author[]): TextSegment[] {
  return segmentMentions(text, members).flatMap((seg) =>
    seg.mention ? [seg] : segmentLinks(seg.text)
  )
}
