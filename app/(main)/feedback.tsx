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
  const { colors, isDark } = useTheme()
  const [showEmailModal, setShowEmailModal] = useState(false)

  // Theme 2 color palette matching new design system
  const theme2Colors = {
    red: "#B94444",
    yellow: "#E8A037",
    green: "#2D6F4A",
    blue: "#3A5F8C",
    beige: "#E8E0D5",
    cream: "#F5F0EA",
    white: "#FFFFFF",
    text: "#000000",
    textSecondary: "#404040",
  }

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
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.white,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme2Colors.text,
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      color: theme2Colors.text,
      fontSize: 32,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: 0, // No bottom padding - image will touch bottom
    },
    subtitle: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      fontSize: 16,
      marginBottom: spacing.xl,
    },
    optionsContainer: {
      gap: spacing.md,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme2Colors.white,
      borderRadius: 16,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    optionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme2Colors.textSecondary,
      justifyContent: "center",
      alignItems: "center",
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      ...typography.bodyBold,
      color: theme2Colors.text,
      fontSize: 18,
      marginBottom: spacing.xs,
    },
    optionSubtitle: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      fontSize: 14,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xl,
    },
    modalContainer: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: theme2Colors.beige,
      borderRadius: 24,
      padding: spacing.xl,
      gap: spacing.md,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
    },
    modalTitle: {
      fontFamily: "PMGothicLudington-Text115",
      color: theme2Colors.text,
      fontSize: 24,
    },
    modalSubtitle: {
      ...typography.body,
      color: theme2Colors.textSecondary,
    },
    emailContainer: {
      backgroundColor: theme2Colors.white,
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    emailText: {
      ...typography.body,
      color: theme2Colors.text,
      fontSize: 16,
      textAlign: "center",
    },
    copyButton: {
      width: "100%",
      marginTop: spacing.sm,
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    copyButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
      textAlign: "center",
    },
    modalCancel: {
      padding: spacing.sm,
      alignItems: "center",
    },
    modalCancelText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
    },
    personalSection: {
      marginTop: spacing.xl,
      alignItems: "center",
      gap: spacing.md,
      marginHorizontal: -spacing.lg, // Negative margin to extend to edges
    },
    personalText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      paddingHorizontal: spacing.lg, // Add padding back for text
    },
    emilyImage: {
      width: "100%",
      height: 300,
      resizeMode: "cover",
    },
  }), [colors, isDark])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Feedback</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton} activeOpacity={0.7}>
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
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
              <FontAwesome name="envelope" size={24} color={theme2Colors.white} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Email</Text>
              <Text style={styles.optionSubtitle}>{EMAIL}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={theme2Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleMessage}>
            <View style={styles.optionIcon}>
              <FontAwesome name="comment" size={24} color={theme2Colors.white} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Message</Text>
              <Text style={styles.optionSubtitle}>{PHONE}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={theme2Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleWhatsApp}>
            <View style={styles.optionIcon}>
              <FontAwesome name="whatsapp" size={24} color={theme2Colors.white} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>WhatsApp</Text>
              <Text style={styles.optionSubtitle}>{PHONE}</Text>
            </View>
            <FontAwesome name="chevron-right" size={16} color={theme2Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.personalSection}>
          <Text style={styles.personalText}>
            I'm Jaryd, I live in NYC with my wife Julia and 2 cats. I have 5 siblings (this is Emily). I love playing padel, learning guitar, writing my newsletter, and building things (like this app). Thanks for reaching out to help me make this better, I appreciate it
          </Text>
          <Image 
            source={require("../../assets/images/emily.png")} 
            style={styles.emilyImage}
            resizeMode="cover"
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
          {/* Warm fuzzy blur effect matching settings modal */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme2Colors.beige, opacity: 0.3 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(232, 224, 213, 0.4)" }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0, 0, 0, 0.1)" }]} />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowEmailModal(false)}
          />
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Email not available</Text>
            <Text style={styles.modalSubtitle}>
              No email app detected. Copy the email address below:
            </Text>
            <View style={styles.emailContainer}>
              <Text style={styles.emailText}>{EMAIL}</Text>
            </View>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyEmail}
              activeOpacity={0.7}
            >
              <Text style={styles.copyButtonText}>Copy Email</Text>
            </TouchableOpacity>
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

