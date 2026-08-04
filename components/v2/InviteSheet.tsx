import { useEffect, useState } from "react"
import { View, Text, StyleSheet, Pressable, Modal, Share, ActivityIndicator } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"
import { useV2Colors, v2Spacing as sp } from "../../lib/v2/theme"
import { getInviteCode, inviteUrl } from "../../lib/v2/onboarding"
import * as haptics from "../../lib/v2/haptics"
import { v2Analytics } from "../../lib/v2/analytics"

/**
 * Invite sheet — one component for every "get people in here" entry point.
 *
 * The group settings sheet previously fired the OS share drawer straight from a
 * tap, so the code itself was never visible; anyone wanting to read it out or
 * paste it elsewhere had no way to see it. Showing the code AND offering the
 * share drawer covers both.
 */
export function InviteSheet({
  visible,
  groupId,
  groupName,
  userId,
  onClose,
}: {
  visible: boolean
  groupId: string
  groupName: string
  userId?: string
  onClose: () => void
}) {
  const { c } = useV2Colors()
  const s = makeStyles(c)
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !userId || token) return
    let cancelled = false
    getInviteCode(groupId, userId)
      .then((res) => {
        if (cancelled) return
        if (res.token) setToken(res.token)
        else setError(res.error ?? "Couldn't make an invite")
      })
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [visible, userId, groupId, token])

  async function copy() {
    if (!token) return
    haptics.tap()
    await Clipboard.setStringAsync(token)
    if (groupId) v2Analytics.groupMemberInvited({ groupId, channel: "copy" })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    if (!token) return
    haptics.commit()
    await Share.share({
      message: `Join your group, "${groupName}". Answer one question a day with friends. No AI. No Algorithms. No Ads.\n\n${inviteUrl(token)}\n\n\u2192 download + use your code: ${token}`,
    })
    if (groupId) v2Analytics.groupMemberInvited({ groupId, channel: "share" })
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <Pressable style={s.close} onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={22} color={c.text} />
        </Pressable>

        <Text style={s.title}>Invite to {groupName}</Text>
        <Text style={s.sub}>Send them the link, or read out the code.</Text>

        {error ? (
          <Text style={s.error}>{error}</Text>
        ) : !token ? (
          <ActivityIndicator color={c.text} style={{ marginVertical: sp.xl }} />
        ) : (
          <>
            {/* The whole block is the copy target — a small "Copy code" link was an
                unnecessarily precise tap for the screen's main action. */}
            <Pressable
              onPress={copy}
              style={({ pressed }) => [s.codeCard, pressed ? { transform: [{ translateY: 2 }] } : null]}
            >
              <Text style={s.codeLabel}>INVITE CODE · TAP TO COPY</Text>
              <Text style={s.code}>{token}</Text>
              <Text style={s.copied}>{copied ? "Copied ✓" : " "}</Text>
            </Pressable>

            <Pressable
              onPress={share}
              style={({ pressed }) => [s.ctaShadow, pressed ? s.ctaPressed : null]}
            >
              <View style={s.cta}>
                <Text style={s.ctaText}>Share invite link</Text>
              </View>
            </Pressable>
            <Text style={s.helper}>Send to your group. One tap join</Text>
          </>
        )}
      </View>
    </Modal>
  )
}

function makeStyles(c: ReturnType<typeof useV2Colors>["c"]) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: {
      position: "absolute",
      left: sp.lg,
      right: sp.lg,
      top: "20%",
      backgroundColor: c.bg,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 20,
      padding: sp.xl,
    },
    close: { position: "absolute", top: sp.md, right: sp.md, zIndex: 5 },
    title: { fontSize: 22, fontWeight: "800", color: c.text, paddingRight: sp.xl },
    sub: { fontSize: 14, color: c.textSecondary, marginTop: 4, marginBottom: sp.lg },
    error: { color: c.red, fontWeight: "700", marginVertical: sp.lg },

    codeCard: {
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: sp.lg,
      marginBottom: sp.lg,
    },
    codeLabel: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.8,
      color: c.textSecondary,
    },
    code: { fontSize: 32, fontWeight: "800", letterSpacing: 2, color: c.text, marginTop: 6 },
    copied: { fontSize: 12, fontWeight: "800", color: c.green, marginTop: 4 },

    ctaShadow: {
      borderRadius: 28,
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
    cta: {
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      overflow: "hidden",
    },
    ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },
    helper: {
      textAlign: "center",
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      marginTop: sp.sm,
    },
  })
}
