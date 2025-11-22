"use client"

import { useState, useMemo } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Modal, Image, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { spacing, typography } from "../../lib/theme"
import { useTheme } from "../../lib/theme-context"
import { FontAwesome } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"
import { Button } from "../../components/Button"

const EMAIL = "hermannjaryd@gmail.com"
const PHONE = "+19143836826"

export default function Feedback() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [showEmailModal, setShowEmailModal] = useState(false)

  async function handleEmail() {
    try {
      // Try Gmail app first (iOS and Android)
      // Format: googlegmail://co?to=email@example.com
      const gmailUrl = `googlegmail://co?to=${encodeURIComponent(EMAIL)}`
      
      try {
        // Check if Gmail can be opened
        const canOpenGmail = await Linking.canOpenURL(gmailUrl)
        if (canOpenGmail) {
          await Linking.openURL(gmailUrl)
          return
        }
      } catch (gmailError) {
        // Gmail check failed, try opening directly anyway (canOpenURL can be unreliable)
        try {
          await Linking.openURL(gmailUrl)
          return
        } catch (openError) {
          // Gmail not available, continue to next option
        }
      }
      
      // Try alternative Gmail scheme (Android)
      const gmailAltUrl = `gmail://co?to=${encodeURIComponent(EMAIL)}`
      try {
        const canOpenGmailAlt = await Linking.canOpenURL(gmailAltUrl)
        if (canOpenGmailAlt) {
          await Linking.openURL(gmailAltUrl)
          return
        }
      } catch (gmailAltError) {
        // Try opening directly
        try {
          await Linking.openURL(gmailAltUrl)
          return
        } catch (openError) {
          // Not available
        }
      }
      
      // Try standard mailto: (works for Apple Mail and other email apps)
      const mailtoUrl = `mailto:${EMAIL}`
      try {
        const canOpenMail = await Linking.canOpenURL(mailtoUrl)
        if (canOpenMail) {
          await Linking.openURL(mailtoUrl)
          return
        }
      } catch (mailError) {
        // Try opening directly
        try {
          await Linking.openURL(mailtoUrl)
          return
        } catch (openError) {
          // Mail app not available
        }
      }
      
      // If no email app found, show copy modal
      setShowEmailModal(true)
    } catch (error: any) {
      // Fallback to copy modal on any error
      console.warn("[Feedback] Error opening email:", error)
      setShowEmailModal(true)
    }
  }

  async function handleCopyEmail() {
    try {
      await Clipboard.setStringAsync(EMAIL)
      Alert.alert("Copied", "Email address copied to clipboard")
      setShowEmailModal(false)
    } catch (error: any) {
      Alert.alert("Error", "Unable to copy email address")
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
      // Remove + and any spaces from phone number
      const cleanPhone = PHONE.replace(/[\s+]/g, "")
      
      // Try WhatsApp app first (whatsapp://send?phone=)
      const whatsappUrl = `whatsapp://send?phone=${cleanPhone}`
      
      try {
        await Linking.openURL(whatsappUrl)
        // If this succeeds, WhatsApp opened
        return
      } catch (whatsappError) {
        // WhatsApp app not available, try web version
        const webUrl = `https://wa.me/${cleanPhone}`
        try {
          await Linking.openURL(webUrl)
          return
        } catch (webError) {
          // Neither worked
          Alert.alert(
            "WhatsApp unavailable",
            "Unable to open WhatsApp. You can reach me via email or text message instead."
          )
        }
      }
    } catch (error: any) {
      Alert.alert("Error", "Unable to open WhatsApp. Please try email or text message instead.")
    }
  }

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
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
    scrollView: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2, // Extra padding at bottom to ensure image is fully visible
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.9)",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    modalContainer: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.black,
      borderRadius: 24,
      padding: spacing.xl,
      gap: spacing.md,
    },
    modalTitle: {
      ...typography.h2,
      color: colors.white,
      fontSize: 24,
    },
    modalSubtitle: {
      ...typography.body,
      color: colors.gray[400],
    },
    emailContainer: {
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray[700],
    },
    emailText: {
      ...typography.body,
      color: colors.white,
      fontSize: 16,
      textAlign: "center",
    },
    copyButton: {
      width: "100%",
      marginTop: spacing.sm,
    },
    modalCancel: {
      padding: spacing.sm,
      alignItems: "center",
    },
    modalCancelText: {
      ...typography.body,
      color: colors.gray[400],
    },
    personalSection: {
      marginTop: spacing.xl,
      alignItems: "center",
      gap: spacing.md,
    },
    personalText: {
      ...typography.body,
      color: colors.gray[400],
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    emilyImage: {
      width: "100%",
      maxWidth: 300,
      height: 300,
      borderRadius: 16,
    },
  }), [colors])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Feedback</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>You can reach me (Jaryd) a few ways</Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.option} onPress={handleEmail}>
            <View style={styles.optionIcon}>
              <FontAwesome name="envelope" size={24} color={colors.white} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Email</Text>
              <Text style={styles.optionSubtitle}>{EMAIL}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={colors.gray[400]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleMessage}>
            <View style={styles.optionIcon}>
              <FontAwesome name="comment" size={24} color={colors.white} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Message</Text>
              <Text style={styles.optionSubtitle}>{PHONE}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={colors.gray[400]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleWhatsApp}>
            <View style={styles.optionIcon}>
              <FontAwesome name="whatsapp" size={24} color={colors.white} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>WhatsApp</Text>
              <Text style={styles.optionSubtitle}>{PHONE}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={colors.gray[400]} />
          </TouchableOpacity>
        </View>

        <View style={styles.personalSection}>
          <Text style={styles.personalText}>
            I'm Jaryd, I live in NYC with my wife Julia and 2 cats. I have 5 siblings (this is Emily). I love playing padel, learning guitar, writing my newsletter, and building things (like this app). Thanks for reaching out to help me make this better, I appreciate it
          </Text>
          <Image 
            source={require("../../assets/images/emily.png")} 
            style={styles.emilyImage}
            resizeMode="contain"
          />
        </View>
      </ScrollView>

      {/* Email Copy Modal */}
      <Modal
        visible={showEmailModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Email not available</Text>
            <Text style={styles.modalSubtitle}>
              No email app detected. Copy the email address below:
            </Text>
            <View style={styles.emailContainer}>
              <Text style={styles.emailText}>{EMAIL}</Text>
            </View>
            <Button
              title="Copy Email"
              onPress={handleCopyEmail}
              style={styles.copyButton}
            />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowEmailModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

