import { memo, useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { Image, useWindowDimensions } from "react-native"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { AvatarStack } from "./AvatarStack"
import { MediaCarousel } from "./MediaCarousel"
import { segmentMentions } from "../../lib/v2/mentions"
import type { Author } from "../../lib/v2/types"
import type { ThreadMessage } from "../../lib/v2/types"

/** Lines of body text shown before the Show more fold (design 4A). */
const CLAMP_LINES = 6

function time(iso: string) {
  return new Date(iso)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase()
    .replace(" ", "")
}

export const ThreadItem = memo(function ThreadItem({
  message: m,
  isMine,
  members,
  onReply,
  onToggleReaction,
  onAddReaction,
}: {
  message: ThreadMessage
  isMine: boolean
  /**
   * Needed to render @-mentions. Must be a STABLE reference — this component is
   * memo()'d, and a fresh array each render would defeat that and bring back the
   * image flashing that the callback refs above were added to stop.
   */
  members?: Author[]
  onReply: (m: ThreadMessage) => void
  onToggleReaction: (messageId: string, emoji: string) => void
  onAddReaction: (m: ThreadMessage) => void
}) {
  const { c } = useV2Colors()
  const win = useWindowDimensions()
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const s = makeStyles(c)

  // ---- system (birthday) -------------------------------------------------
  if (m.kind === "system") {
    return (
      <View style={s.systemWrap}>
        <TouchableOpacity style={s.systemBanner} onPress={() => onReply(m)} activeOpacity={0.85}>
          <Text style={s.systemText}>
            🎂 It&rsquo;s {m.system_payload?.name ?? "someone"}&rsquo;s birthday
          </Text>
          <Text style={s.systemHint}>Tap to say something</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ---- gated -------------------------------------------------------------
  if (m.redacted) {
    return (
      <View style={[s.card, s.cardLocked]}>
        <View style={s.headRow}>
          <AvatarStack members={m.author ? [m.author] : []} size={26} />
          <Text style={s.author}>{m.author?.name ?? "Someone"}</Text>
        </View>
        <View style={s.blurLine} />
        <View style={[s.blurLine, { width: "82%" }]} />
        <View style={[s.blurLine, { width: "56%" }]} />
      </View>
    )
  }

  const reactions = m.reactions ?? []
  // No "text answer" placeholder: when an answer is photos or a voice note, the
  // media IS the answer and a fabricated caption just looked like a bug.
  const body = m.answer ? m.answer.text_content || m.answer.transcript || "" : m.text || ""

  const ReactionRow = () =>
    reactions.length === 0 ? null : (
      <View style={s.reactionRow}>
        {reactions.map((r) => (
          <TouchableOpacity
            key={r.emoji}
            style={[s.reaction, r.mine ? s.reactionMine : null]}
            onPress={() => onToggleReaction(m.id, r.emoji)}
          >
            <Text style={s.reactionEmoji}>{r.emoji}</Text>
            {r.count > 1 ? <Text style={s.reactionCount}>{r.count}</Text> : null}
          </TouchableOpacity>
        ))}
      </View>
    )

  // ---- answer card -------------------------------------------------------
  if (m.kind === "answer" && m.answer) {
    return (
      <View style={[s.card, isMine ? s.cardMine : null]}>
        <View style={s.headRow}>
          <AvatarStack members={m.author ? [m.author] : []} size={40} />
          <Text style={s.author}>{isMine ? "You" : m.author?.name ?? "Someone"}</Text>
          <Text style={[s.badge, isMine ? s.badgeMine : null]}>
            {isMine ? "YOUR ANSWER" : m.answer.mode === "video" ? "VIDEO ANSWER" : "ANSWER"}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={s.time}>
            {time(m.created_at)}
            {isMine && m.answer.share_count > 1 ? ` · ${m.answer.share_count} groups` : ""}
          </Text>
        </View>

        {m.answer.media_urls?.length ? (
          <MediaCarousel
            urls={m.answer.media_urls}
            types={m.answer.media_types}
            captions={m.answer.captions}
            days={m.answer.media_days}
          />
        ) : null}

        {body ? (
          <>
            <Text
              style={s.body}
              numberOfLines={expanded ? undefined : CLAMP_LINES}
              onTextLayout={(e) => {
                if (!expanded && e.nativeEvent.lines.length >= CLAMP_LINES) setOverflows(true)
              }}
            >
              {body}
            </Text>
            {overflows ? (
              <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={s.foldBtn}>
                <Text style={s.foldText}>{expanded ? "Show less ▲" : "Show more ▼"}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        <View style={s.footRow}>
          <ReactionRow />
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => onAddReaction(m)} hitSlop={8}>
            <Text style={s.reactLink}>😀＋</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReply(m)} style={{ marginLeft: sp.md }}>
            <Text style={s.replyLink}>Reply ↩</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ---- chat bubble -------------------------------------------------------
  return (
    <View style={[s.bubbleWrap, isMine ? s.bubbleWrapMine : null]}>
      <View style={[s.bubble, isMine ? s.bubbleMine : null]}>
        {!isMine ? (
          <View style={s.bubbleAuthorRow}>
            <AvatarStack members={m.author ? [m.author] : []} size={22} />
            <Text style={s.bubbleAuthor}>{m.author?.name ?? "Someone"}</Text>
          </View>
        ) : null}

        {m.reply_to ? (
          <View style={s.quote}>
            {/* Thumbnail of what was replied to. A media-only message produced an
                empty quote before, so the reply lost all context. */}
            {/* A video URI in <Image> renders nothing — that is the blank white
                square in replies to video. Videos get a play tile instead; only
                photos are actually an image. */}
            {m.reply_to.reply_media && m.reply_to.reply_media_type === "video" ? (
              <View style={[s.quoteThumb, s.quoteThumbVideo]}>
                <Text style={s.quoteThumbGlyph}>▶</Text>
              </View>
            ) : m.reply_to.reply_media && m.reply_to.reply_media_type !== "audio" ? (
              <Image source={{ uri: m.reply_to.reply_media }} style={s.quoteThumb} />
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              {/* numberOfLines, or a short name still wrapped mid-word ("Jar/yd")
                  once the thumbnail took its share of a narrow bubble. */}
              <Text style={s.quoteAuthor} numberOfLines={1}>
                {m.reply_to.author}
              </Text>
              <Text style={s.quoteText} numberOfLines={1}>
                {m.reply_to.excerpt}
              </Text>
            </View>
          </View>
        ) : null}

        {m.media_urls?.length ? (
          <MediaCarousel
            urls={m.media_urls}
            types={m.media_types}
            // Fill the bubble (86% of the screen, less padding and border) instead
            // of a fixed 200 that left a dead margin beside every photo.
            width={win.width * 0.86 - sp.md * 2 - 3}
          />
        ) : null}

        {m.text ? (
          <Text style={s.bubbleText}>
            {/* Mentions render as the bare name in bold — no "@" — so the message
                reads as a sentence rather than as markup. */}
            {segmentMentions(m.text, members ?? []).map((seg, i) =>
              seg.mention ? (
                <Text key={i} style={s.mention}>
                  {seg.text}
                </Text>
              ) : (
                <Text key={i}>{seg.text}</Text>
              ),
            )}
          </Text>
        ) : null}

        {/* Inside the card, bottom-right. Floating underneath left them ambiguous
            about which message they belonged to in a dense thread. */}
        <View style={s.bubbleFoot}>
          <ReactionRow />
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => onAddReaction(m)} hitSlop={8}>
            <Text style={s.replyLinkSmall}>React</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReply(m)} style={{ marginLeft: sp.md }}>
            <Text style={s.replyLinkSmall}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
})

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    // White with a black stroke in BOTH themes. An answer is the anchor of the
    // thread and has to out-rank the chat bubbles around it; c.surface tracked the
    // page too closely to do that. Fixed colours mean the body text has to be
    // pinned dark too — c.text is white in dark mode and would vanish here.
    card: {
      backgroundColor: "#FFFFFF",
      borderWidth: 2,
      borderColor: "#000000",
      borderRadius: 14,
      padding: sp.md,
      marginBottom: sp.sm,
    },
    cardMine: { borderColor: "#000000" },
    cardLocked: { opacity: 0.85 },
    headRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: sp.sm },
    author: { fontWeight: "800", color: "#000000", fontSize: 14 },
    badge: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.4,
      color: "#000000",
      borderWidth: 1,
      borderColor: "#000000",
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      overflow: "hidden",
    },
    badgeMine: { backgroundColor: c.blue, color: "#fff", borderColor: c.blue },
    time: { fontSize: 11, color: "#5A5A5A" },
    body: { color: "#000000", fontSize: 15, lineHeight: 21 },
    foldBtn: { marginTop: 6 },
    foldText: { color: c.blue, fontWeight: "700", fontSize: 13 },
    footRow: { flexDirection: "row", alignItems: "center", marginTop: sp.sm },
    replyLink: { color: c.blue, fontWeight: "700", fontSize: 13 },
    reactLink: { fontSize: 15 },
    replyLinkSmall: { color: c.textSecondary, fontWeight: "600", fontSize: 11 },

    reactionRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
    reaction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: c.bg,
    },
    reactionMine: { borderColor: c.blue, backgroundColor: c.surfaceAlt },
    reactionEmoji: { fontSize: 13 },
    reactionCount: { fontSize: 11, fontWeight: "800", color: c.text },

    blurLine: {
      height: 11,
      borderRadius: 5,
      // Fixed grey: c.textSecondary is light in dark mode and disappeared against
      // the white card, leaving a locked answer looking blank.
      backgroundColor: "#000000",
      opacity: 0.14,
      marginBottom: 7,
      width: "100%",
    },

    bubbleWrap: { marginBottom: sp.sm, alignItems: "flex-start", maxWidth: "86%" },
    bubbleWrapMine: { alignSelf: "flex-end", alignItems: "flex-end" },
    bubble: {
      backgroundColor: c.bubble,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      padding: sp.md,
    },
    bubbleMine: { backgroundColor: c.bubbleMine, borderColor: c.blue },
    bubbleAuthorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
    bubbleAuthor: { fontWeight: "800", fontSize: 12, color: c.text },
    bubbleFoot: { flexDirection: "row", alignItems: "center", marginTop: sp.sm },
    bubbleText: { color: c.text, fontSize: 15, lineHeight: 20 },
    mention: { fontWeight: "800" },
    bubbleReply: { paddingTop: 3, paddingHorizontal: 4 },

    quoteThumb: {
      flexShrink: 0,
      width: 34,
      height: 34,
      borderRadius: 6,
      backgroundColor: c.surfaceAlt,
    },
    quote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderLeftWidth: 3,
      borderLeftColor: c.red,
      paddingLeft: sp.sm,
      marginBottom: 6,
      opacity: 0.9,
    },
    quoteThumbVideo: { alignItems: "center", justifyContent: "center", backgroundColor: c.bubble },
    quoteThumbGlyph: { color: "#fff", fontSize: 13 },
    quoteAuthor: { fontSize: 11, fontWeight: "800", color: c.red },
    quoteText: { fontSize: 12, color: c.textSecondary },

    systemWrap: { alignItems: "center", marginVertical: sp.md },
    systemBanner: {
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: sp.lg,
      paddingVertical: sp.sm,
      alignItems: "center",
    },
    systemText: { fontWeight: "800", color: c.accentInk, fontSize: 14 },
    systemHint: { fontSize: 11, color: c.accentInk, opacity: 0.7, marginTop: 2 },
  })
}
