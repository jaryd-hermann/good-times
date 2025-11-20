"use client"

import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors, spacing, typography } from "../../lib/theme"
import { FontAwesome } from "@expo/vector-icons"

const EMAIL = "hermannjaryd@gmail.com"
const PHONE = "+19143836826"

export default function Feedback() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  async function handleEmail() {
    try {
      const url = `mailto:${EMAIL}`
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        Alert.alert("Email unavailable", "Unable to open your email client right now.")
      }
    } catch (error: any) {
      Alert.alert("Error", "Unable to open email. Please try again.")
    }
  }

  async function handleMessage() {
    try {
      // Use SMS URL scheme (works on both iOS and Android)
      const url = `sms:${PHONE}`
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        Alert.alert("Messages unavailable", "Unable to open your messaging app right now.")
      }
    } catch (error: any) {
      Alert.alert("Error", "Unable to open messages. Please try again.")
    }
  }

  async function handleWhatsApp() {
    try {
      // Try WhatsApp app first (whatsapp://)
      const whatsappUrl = `whatsapp://send?phone=${PHONE.replace("+", "")}`
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl)

      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl)
      } else {
        // Fallback to web WhatsApp
        const webUrl = `https://wa.me/${PHONE.replace("+", "")}`
        const canOpenWeb = await Linking.canOpenURL(webUrl)
        if (canOpenWeb) {
          await Linking.openURL(webUrl)
        } else {
          Alert.alert(
            "WhatsApp unavailable",
            "WhatsApp doesn't appear to be installed. You can reach me via email or text message instead."
          )
        }
      }
    } catch (error: any) {
      Alert.alert("Error", "Unable to open WhatsApp. Please try email or text message instead.")
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Feedback</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>You can reach me (Jaryd) a few ways</Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.option} onPress={handleEmail}>
            <View style={styles.optionIcon}>
              <FontAwesome name="envelope" size={24} color={colors.accent} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Email</Text>
              <Text style={styles.optionSubtitle}>{EMAIL}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={colors.gray[400]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleMessage}>
            <View style={styles.optionIcon}>
              <FontAwesome name="comment" size={24} color={colors.accent} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Message</Text>
              <Text style={styles.optionSubtitle}>{PHONE}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={colors.gray[400]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleWhatsApp}>
            <View style={styles.optionIcon}>
              <FontAwesome name="whatsapp" size={24} color={colors.accent} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>WhatsApp</Text>
              <Text style={styles.optionSubtitle}>{PHONE}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={colors.gray[400]} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    ...typography.h2,
    color: colors.white,
  },
  title: {
    ...typography.h1,
    color: colors.white,
    fontSize: 32,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray[400],
    fontSize: 16,
    marginBottom: spacing.xl,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[800],
    justifyContent: "center",
    alignItems: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  optionSubtitle: {
    ...typography.body,
    color: colors.gray[400],
    fontSize: 14,
  },
})

