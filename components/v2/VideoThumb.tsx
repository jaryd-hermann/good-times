import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import { Video, ResizeMode } from "expo-av"

/**
 * A still poster frame for a video, where an <Image> cannot work.
 *
 * <Image> given a video URI renders nothing at all — that is the blank white
 * square that appeared on History cards and in reply stubs. expo-av draws a
 * video's FIRST FRAME as its own poster before playback starts, so a paused,
 * muted, non-interactive Video is a real thumbnail with no new dependency and no
 * pre-generated poster asset.
 *
 * Deliberately not expo-video-thumbnails: that would add a native module, and
 * generating a thumbnail from a REMOTE url means downloading the video first —
 * expensive for something the size of a postage stamp.
 *
 * The honest long-term fix is to generate a poster at upload time and store its
 * url alongside the video, so every surface can render a cheap <Image>. Worth
 * doing if these ever appear somewhere dense enough for the player count to hurt.
 */
export function VideoThumb({
  uri,
  style,
  glyphSize = 16,
}: {
  uri: string
  style?: StyleProp<ViewStyle>
  glyphSize?: number
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        // Never plays. positionMillis 0 pins it to the first frame, which is the
        // whole point — this is a poster, not a player.
        shouldPlay={false}
        isMuted
        positionMillis={0}
      />
      <View style={styles.badge} pointerEvents="none">
        <Text style={[styles.glyph, { fontSize: glyphSize }]}>▶</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", backgroundColor: "#000" },
  badge: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  glyph: { color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
})
