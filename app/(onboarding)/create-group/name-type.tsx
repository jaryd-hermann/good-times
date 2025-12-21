"use client"

import { useState, useRef, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image, TextInput } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { colors, spacing, typography } from "../../../lib/theme"
import { useOnboarding } from "../../../components/OnboardingProvider"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../../lib/posthog"
import { FontAwesome } from "@expo/vector-icons"

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
  onboardingPink: "#D97393", // Pink for onboarding CTAs
}

export default function CreateGroupNameType() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const mode = params.mode as string | undefined
  const { setGroupName, setGroupType, setEnableNSFW, data } = useOnboarding()
  const [groupName, setLocalGroupName] = useState(data.groupName || "")
  const [groupType, setLocalGroupType] = useState<"family" | "friends">(data.groupType || "family")
  const [groupNameFocused, setGroupNameFocused] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)

  const posthog = usePostHog()

  // Track loaded_create_group event
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_create_group")
      } else {
        captureEvent("loaded_create_group")
      }
    } catch (error) {
      if (__DEV__) console.error("[create-group] Failed to track event:", error)
    }
  }, [posthog])

  // Auto-focus the input when component mounts
  useEffect(() => {
    // Small delay to ensure the component is fully rendered
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  function handleContinue() {
    if (!groupName.trim()) {
      Alert.alert("Error", "Please enter a group name")
      return
    }

    setGroupName(groupName.trim())
    setGroupType(groupType)
    setEnableNSFW(false) // NSFW removed - users can add via decks instead
    router.push({
      pathname: "/(onboarding)/memorial",
      params: mode ? { mode } : undefined,
    })
  }

  function handleGroupTypeChange(type: "family" | "friends") {
    setLocalGroupType(type)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onFocus={() => {
          // Scroll up slightly when input is focused
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({ y: 100, animated: true })
          }, 100)
        }}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <FontAwesome name="angle-left" size={18} color={theme2Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Create Your Group</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.prompt}>What should we call you guys?</Text>
          <View style={styles.fieldGroup}>
            <TextInput
              ref={inputRef}
              value={groupName}
              onChangeText={setLocalGroupName}
              placeholder="Group name"
              autoCapitalize="words"
              autoFocus={true}
              placeholderTextColor={theme2Colors.textSecondary}
              style={[
                styles.fieldInput,
                groupNameFocused && styles.fieldInputFocused,
              ]}
              onFocus={() => {
                setGroupNameFocused(true)
                // Scroll up when keyboard opens
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: 100, animated: true })
                }, 100)
              }}
              onBlur={() => setGroupNameFocused(false)}
            />
          </View>

          <Text style={styles.label}>Who's in this group?</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity
              style={[styles.typeButton, groupType === "family" && styles.typeButtonActive]}
              onPress={() => handleGroupTypeChange("family")}
            >
              <Text style={[styles.typeText, groupType === "family" && styles.typeTextActive]}>Family</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, groupType === "friends" && styles.typeButtonActive]}
              onPress={() => handleGroupTypeChange("friends")}
            >
              <Text style={[styles.typeText, groupType === "friends" && styles.typeTextActive]}>Friends</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaButtonText}>→</Text>
            <View style={styles.buttonTexture} pointerEvents="none">
              <Image
                source={require("../../../assets/images/texture.png")}
                style={styles.textureImage}
                resizeMode="cover"
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 4,
  },
  topBar: {
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme2Colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 40,
    lineHeight: 48,
    color: theme2Colors.text,
  },
  form: {
    marginBottom: spacing.lg,
  },
  prompt: {
    fontFamily: "Roboto-Regular",
    fontSize: 18,
    lineHeight: 26,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  fieldGroup: {
    marginBottom: spacing.xl,
  },
  fieldInput: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: theme2Colors.text,
    backgroundColor: theme2Colors.cream,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  fieldInputFocused: {
    borderColor: theme2Colors.blue,
  },
  label: {
    fontFamily: "Roboto-Regular",
    fontSize: 18,
    lineHeight: 26,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  typeContainer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  typeButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
    backgroundColor: theme2Colors.white,
  },
  typeButtonActive: {
    backgroundColor: theme2Colors.blue,
    borderColor: theme2Colors.blue,
  },
  typeText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.textSecondary,
  },
  typeTextActive: {
    color: theme2Colors.white,
  },
  buttonContainer: {
    alignItems: "flex-end",
    marginTop: spacing.md,
  },
  ctaButton: {
    width: 100,
    height: 60,
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ctaButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 32,
    color: theme2Colors.white,
    zIndex: 2,
  },
  buttonTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
  },
  textureImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
})
