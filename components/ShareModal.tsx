"use client"

import { useMemo, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ImageBackground,
  Image,
  Linking,
  Platform,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"
import { spacing, typography } from "../lib/theme"
import { useTheme } from "../lib/theme-context"

const ogBackground = require("../assets/images/og.png")
const gtLogo = require("../assets/images/1.png")

interface ShareModalProps {
  visible: boolean
  onClose: () => void
  entryId: string
  groupId: string
  date: string
  questionText: string
  answerPreview: string
  mediaUrl?: string | null
}

function formatShareDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number)
    const d = new Date(year, month - 1, day)
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
  } catch {
    return dateStr
  }
}

export function ShareModal({
  visible,
  onClose,
  entryId,
  groupId,
  date,
  questionText,
  answerPreview,
  mediaUrl,
}: ShareModalProps) {
  const insets = useSafeAreaInsets()
  const { isDark } = useTheme()
  const [copied, setCopied] = useState(false)

  const theme2Colors = useMemo(
    () =>
      isDark
        ? {
            beige: "#000000",
            cream: "#111111",
            white: "#E8E0D5",
            text: "#F5F0EA",
            textSecondary: "#A0A0A0",
          }
        : {
            beige: "#E8E0D5",
            cream: "#F5F0EA",
            white: "#FFFFFF",
            text: "#000000",
            textSecondary: "#404040",
          },
    [isDark]
  )

  const shareUrl = `https://thegoodtimes.app/share/${entryId}`
  const shareText = `Great group question today in Good Times! Check this answer out. And I want to know what you think?! ${shareUrl}`

  const truncatedAnswer = useMemo(() => {
    const words = answerPreview.split(/\s+/).slice(0, 5)
    return words.join(" ") + (answerPreview.split(/\s+/).length > 5 ? "..." : "")
  }, [answerPreview])

  const formattedDate = useMemo(() => formatShareDate(date), [date])

  async function handleCopy() {
    await Clipboard.setStringAsync(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleWhatsApp() {
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareText)}`)
  }

  function handleMessages() {
    const separator = Platform.OS === "ios" ? "&" : "?"
    Linking.openURL(`sms:${separator}body=${encodeURIComponent(shareText)}`)
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: "transparent",
        },
        sheet: {
          backgroundColor: theme2Colors.beige,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          width: "100%",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 20,
        },
        closeRow: {
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
        },
        closeButton: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isDark ? "#000000" : theme2Colors.white,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
          borderColor: isDark ? "#F5F0EA" : theme2Colors.text,
        },
        previewCard: {
          marginBottom: spacing.md,
          borderRadius: 16,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)",
        },
        previewInner: {
          width: "100%",
          aspectRatio: 1200 / 630,
          backgroundColor: "#000000",
        },
        previewBlurOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.55)",
        },
        previewQuestion: {
          fontFamily: "PMGothicLudington-Text115",
          fontSize: 22,
          color: "#FFFFFF",
          textAlign: "center",
          marginBottom: spacing.sm,
        },
        previewAnswer: {
          fontFamily: "Roboto-Regular",
          fontSize: 13,
          color: "rgba(255,255,255,0.45)",
          textAlign: "center",
          fontStyle: "italic",
        },
        previewDivider: {
          height: 1,
          backgroundColor: "rgba(255,255,255,0.2)",
          marginTop: spacing.md,
          marginBottom: spacing.xs,
        },
        previewDateLine: {
          fontFamily: "Roboto-Regular",
          fontSize: 11,
          color: "#FFFFFF",
          textAlign: "center",
        },
        title: {
          ...typography.h2,
          color: theme2Colors.text,
          fontSize: 24,
          fontFamily: "PMGothicLudington-Text115",
        },
        subtext: {
          ...typography.body,
          color: theme2Colors.textSecondary,
          fontSize: 14,
          lineHeight: 20,
          marginBottom: spacing.sm,
        },
        actionsRow: {
          flexDirection: "row",
          justifyContent: "space-around",
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
        },
        actionButton: {
          alignItems: "center",
          gap: spacing.xs,
          minWidth: 80,
        },
        actionIconCircle: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: isDark ? "#222222" : theme2Colors.cream,
          justifyContent: "center",
          alignItems: "center",
        },
        actionLabel: {
          ...typography.caption,
          color: theme2Colors.text,
          fontSize: 12,
          fontFamily: "Roboto-Medium",
        },
        copiedLabel: {
          color: "#2D6F4A",
        },
      }),
    [theme2Colors, isDark, insets.bottom]
  )

  function PreviewContent() {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ position: "absolute", top: 8, right: 8 }}>
          <Image source={gtLogo} style={{ width: 28, height: 28 }} resizeMode="contain" />
        </View>
        <View style={{ justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xl, flex: 1 }}>
          <Text style={styles.previewQuestion} numberOfLines={3}>
            {questionText}
          </Text>
          {truncatedAnswer && truncatedAnswer.trim() !== "" && (
            <Text style={styles.previewAnswer} numberOfLines={1}>
              {truncatedAnswer}
            </Text>
          )}
        </View>
        <View style={{ width: "60%", alignSelf: "center", paddingBottom: spacing.sm }}>
          <View style={styles.previewDivider} />
          <Text style={styles.previewDateLine}>
            {formattedDate} | Good Times
          </Text>
        </View>
      </View>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: isDark
                ? "rgba(0, 0, 0, 0.4)"
                : "rgba(232, 224, 213, 0.4)",
            },
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: isDark
                ? "rgba(0, 0, 0, 0.3)"
                : "rgba(0, 0, 0, 0.1)",
            },
          ]}
        />
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View
          style={styles.sheet}
        >
            {/* Close button row - above preview card */}
            <View style={styles.closeRow}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <FontAwesome
                  name="times"
                  size={16}
                  color={isDark ? "#F5F0EA" : theme2Colors.text}
                />
              </TouchableOpacity>
            </View>

            {/* Preview Card */}
            <View style={styles.previewCard}>
              {mediaUrl ? (
                <ImageBackground
                  source={{ uri: mediaUrl }}
                  style={styles.previewInner}
                  resizeMode="cover"
                >
                  <View style={styles.previewBlurOverlay} />
                  <PreviewContent />
                </ImageBackground>
              ) : (
                <ImageBackground
                  source={ogBackground}
                  style={styles.previewInner}
                  resizeMode="cover"
                >
                  <PreviewContent />
                </ImageBackground>
              )}
            </View>

            <Text style={styles.title}>Nudge your group</Text>
            <Text style={styles.subtext}>
              Share this answer in your group text or Whatsapp to encourage
              people to answer today's question
            </Text>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCopy}
                activeOpacity={0.7}
              >
                <View style={styles.actionIconCircle}>
                  <FontAwesome
                    name={copied ? "check" : "clipboard"}
                    size={22}
                    color={copied ? "#2D6F4A" : theme2Colors.text}
                  />
                </View>
                <Text
                  style={[styles.actionLabel, copied && styles.copiedLabel]}
                >
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleWhatsApp}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionIconCircle,
                    { backgroundColor: "#25D366" },
                  ]}
                >
                  <FontAwesome name="whatsapp" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.actionLabel}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleMessages}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionIconCircle,
                    { backgroundColor: "#34C759" },
                  ]}
                >
                  <FontAwesome name="comment" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.actionLabel}>Messages</Text>
              </TouchableOpacity>
            </View>
          </View>
      </View>
    </Modal>
  )
}
