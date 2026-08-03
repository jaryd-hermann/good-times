import { memo, useMemo } from "react"
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native"
import { Avatar } from "../Avatar"
import { AvatarStack } from "./AvatarStack"
import { Texture } from "./Texture"
import { MediaCarousel } from "./MediaCarousel"
import * as haptics from "../../lib/v2/haptics"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import type { Author, MyAnswer } from "../../lib/v2/types"

export function shiftDate(base: string, days: number) {
  const d = new Date(base + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Today's question. One day, no carousel.
 *
 * This used to be a 5-day pager. Swiping back to answer a missed day sounds
 * generous but it fights the premise — one question, today, everyone at once — and
 * it cost a horizontal FlatList, a per-day question range query, and a paging
 * bug-surface (jumping offsets, blank pages) for a path almost nobody took.
 * History is where past days live.
 */
export const QuestionCard = memo(function QuestionCard({
  questionText,
  myAnswer,
  answeredFaces,
  answeredCount,
  profile,
  groupCount,
  onAnswer,
  onEdit,
}: {
  questionText: string
  myAnswer: MyAnswer | null
  answeredFaces: Author[]
  answeredCount: number
  profile: { name: string | null; avatar_url: string | null } | null | undefined
  groupCount: number
  onAnswer: () => void
  onEdit: () => void
}) {
  const { c, isDark } = useV2Colors()
  const win = useWindowDimensions()
  const s = useMemo(() => makeStyles(c, isDark), [c, isDark])

  if (myAnswer) {
    return (
      <View style={s.answeredCard}>
        <Texture radius={16} opacity={0.28} />
        <Text style={s.answeredQuestion}>{questionText}</Text>
        <View style={s.rule} />

        {/* Built like ThreadItem's own-answer card so what you see here is what
            lands in the group: same avatar size, same "You". The ANSWERED
            timestamp and "Shared to N groups" are gone — status chrome, not the
            answer. */}
        <View style={s.answerHead}>
          <AvatarStack
            members={[
              {
                id: "me",
                name: profile?.name ?? "You",
                avatar_url: profile?.avatar_url ?? null,
              },
            ]}
            size={40}
          />
          <Text style={s.answerAuthor}>You</Text>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => {
              haptics.tap()
              onEdit()
            }}
            hitSlop={8}
          >
            <Text style={s.editLink}>Edit</Text>
          </Pressable>
        </View>

        {/* Capture showed text only, so a photo answer looked empty here while the
            thread showed the pictures. Same carousel as the thread. */}
        {myAnswer.media_urls?.length ? (
          <MediaCarousel
            urls={myAnswer.media_urls}
            types={myAnswer.media_types}
            captions={myAnswer.captions}
            days={myAnswer.media_days}
            // Explicit: the default assumes sp.md card padding, but this card uses
            // sp.lg, so the photo hung 16px past the right border.
            width={win.width - sp.lg * 2 - sp.lg * 2 - 4}
          />
        ) : null}

        {/* Only render text that exists — a photo or voice answer needs no
            "text answer" placeholder standing in for it. */}
        {myAnswer.text_content || myAnswer.transcript ? (
          <Text style={s.myAnswerText} numberOfLines={6}>
            {myAnswer.text_content || myAnswer.transcript}
          </Text>
        ) : null}
      </View>
    )
  }

  return (
    <View style={s.questionCard}>
      <Texture radius={16} opacity={0.3} />
      {groupCount > 1 ? (
        <View style={s.topRow}>
          <Text style={s.audienceInline} numberOfLines={1}>
            Answer goes to all your groups
          </Text>
        </View>
      ) : null}

      <Text style={s.questionText} numberOfLines={4}>
        {questionText || "…"}
      </Text>

      {answeredCount > 0 ? (
        <View style={s.byRow}>
          <AvatarStack members={answeredFaces} size={26} />
          <Text style={s.byText}>
            {answeredCount} {answeredCount === 1 ? "person has" : "people have"} answered
          </Text>
        </View>
      ) : (
        <View style={s.byRow}>
          {/* Black stroke so the avatar reads as a sticker on the amber card
              rather than dissolving into it. */}
          <Avatar
            uri={profile?.avatar_url ?? undefined}
            name={profile?.name}
            size={26}
            borderColor={c.border}
          />
          <Text style={s.byText}>Be the first to answer</Text>
        </View>
      )}

      <Pressable
        onPress={() => {
          haptics.commit()
          onAnswer()
        }}
        style={({ pressed }) => [s.cta, pressed ? s.ctaPressed : null]}
      >
        <Text style={s.ctaText}>Answer to unlock</Text>
      </Pressable>
    </View>
  )
})

function makeStyles(c: ReturnType<typeof useV2Colors>["c"], isDark: boolean) {
  const card = { borderWidth: 2, borderColor: c.border, borderRadius: 16, padding: sp.lg } as const
  return StyleSheet.create({
    // White stroke in dark mode: c.border is #333, which vanishes against the
    // black page and left the card looking like it was bleeding into the screen.
    questionCard: {
      ...card,
      backgroundColor: c.accent,
      minHeight: 250,
      borderColor: isDark ? "#FFFFFF" : c.border,
    },
    topRow: { flexDirection: "row", alignItems: "center", gap: sp.sm },
    audienceInline: { flex: 1, fontSize: 11, fontWeight: "700", color: c.accentInk, opacity: 0.75 },
    questionText: {
      fontSize: 25,
      fontWeight: "800",
      color: c.accentInk,
      letterSpacing: -0.5,
      lineHeight: 30,
    },
    byRow: { flexDirection: "row", alignItems: "center", gap: sp.sm, marginTop: sp.md },
    byText: { color: c.accentInk, fontWeight: "600", fontSize: 13 },

    // Bevelled: sits on a hard shadow and presses into it.
    cta: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 28,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: sp.lg,
      shadowColor: c.border,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 5,
    },
    ctaPressed: {
      transform: [{ translateY: 5 }],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      elevation: 0,
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },

    // Blue border is what marks a card as yours in the thread; match it here.
    answeredCard: { ...card, backgroundColor: c.surface, borderColor: c.blue, minHeight: 220 },
    answerHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: sp.sm },
    answerAuthor: { fontWeight: "800", color: c.text, fontSize: 14 },
    editLink: { color: c.blue, fontWeight: "700" },
    answeredQuestion: { fontSize: 18, fontWeight: "800", color: c.text },
    rule: { height: 1, backgroundColor: c.border, opacity: 0.25, marginVertical: sp.md },
    myAnswerText: { color: c.text, fontSize: 15, lineHeight: 21 },
  })
}
