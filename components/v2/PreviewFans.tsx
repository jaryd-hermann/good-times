import { View, Text, Image, StyleSheet } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { isVideoUrl, isAudioUrl } from "../../lib/v2/media"
import { VideoThumb } from "./VideoThumb"
import { Avatar } from "../Avatar"
import type { PreviewPerson } from "../../lib/v2/types"

const THUMB = 52

/**
 * Media preview on a History card: one small stack per person.
 *
 * A flat strip of everyone's media side by side let one heavy uploader fill the
 * whole row, so it is grouped per person and capped at three each.
 *
 * No name label. These sit under a card that already names the group and shows
 * the member avatars, and a row of tiny captions made it noisy; the card is a
 * glance at WHAT is in the day, not a per-item byline. Voice pills still carry a
 * face because the avatar IS the thumbnail there.
 *
 * Voice notes are deliberately NOT part of the fan. Audio has no frame to show,
 * and a square tile of someone's face reads as a broken photo rather than as a
 * recording. It gets its own pill — round avatar plus a waveform, the same shape
 * as the mention chips — so the media kinds are distinguishable at a glance:
 * photos and video fan as cards, voice is a pill.
 */
export function PreviewFans({ people }: { people: PreviewPerson[] }) {
  const { c } = useV2Colors()
  const s = makeStyles(c)
  if (!people?.length) return null

  return (
    <View style={s.row}>
      {people.slice(0, 4).map((p) => {
        const urls = (p.urls ?? []).slice(0, 3)
        const hasAudio = urls.some(isAudioUrl)
        const visual = urls.filter((u) => !isAudioUrl(u))
        // Fan width: first card full, each extra peeking out.
        const width = THUMB + (Math.max(visual.length, 1) - 1) * 14

        return (
          <View key={p.user_id} style={s.person}>
            {hasAudio ? (
              <View style={s.audioPill}>
                <Avatar uri={p.avatar_url ?? undefined} name={p.name} size={24} />
                <MaterialCommunityIcons name="waveform" size={18} color={c.text} />
              </View>
            ) : null}

            {visual.length > 0 ? (
              <View style={[s.fan, { width }]}>
                {visual.map((u, i) => {
                  const tile = [
                    s.thumb,
                    {
                      left: i * 14,
                      // back cards tilt and sit slightly lower, front card is straight
                      transform: [{ rotate: `${(i - (visual.length - 1)) * 5}deg` }],
                      zIndex: i,
                    },
                  ]
                  // A video URI in <Image> renders nothing at all — that is the
                  // blank white square History cards showed for video answers.
                  return isVideoUrl(u) ? (
                    <VideoThumb key={`${u}-${i}`} uri={u} style={tile} glyphSize={16} />
                  ) : (
                    <Image key={`${u}-${i}`} source={{ uri: u }} style={tile} />
                  )
                })}
                {p.total > 3 ? (
                  <View style={s.moreBadge}>
                    <Text style={s.moreText}>+{p.total - 3}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )
      })}
      {people.length > 4 ? (
        <Text style={s.overflowText}>+{people.length - 4} more</Text>
      ) : null}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: sp.md, marginTop: sp.sm },
    person: { alignItems: "center", gap: 4 },

    /** Mirrors the mention chips: fully rounded, avatar left, bordered. */
    audioPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 999,
      paddingLeft: 3,
      paddingRight: 9,
      paddingVertical: 3,
    },

    fan: { height: THUMB + 6 },
    thumb: {
      position: "absolute",
      top: 0,
      width: THUMB,
      height: THUMB,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.surfaceAlt,
      backgroundColor: c.surface,
    },
    moreBadge: {
      position: "absolute",
      right: -6,
      bottom: -2,
      backgroundColor: c.ink,
      borderRadius: 9,
      paddingHorizontal: 5,
      paddingVertical: 1,
      zIndex: 10,
    },
    moreText: { color: c.bg, fontSize: 10, fontWeight: "800" },
    overflowText: { fontSize: 11, color: c.textSecondary, alignSelf: "center", fontWeight: "600" },
  })
}
