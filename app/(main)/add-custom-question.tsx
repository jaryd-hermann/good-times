"use client"

import { useState, useEffect, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import { createCustomQuestion, getCustomQuestionOpportunity, getCurrentUser } from "../../lib/db"
import { typography, spacing } from "../../lib/theme"
import { useTheme } from "../../lib/theme-context"
import { Button } from "../../components/Button"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getTodayDate } from "../../lib/utils"
import { Avatar } from "../../components/Avatar"
import { FontAwesome } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../lib/posthog"

export default function AddCustomQuestion() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const groupId = (params.groupId as string) || undefined
  const date = (params.date as string) || getTodayDate()

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      // Dark mode colors
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000", // Black (was beige) - page background
        cream: "#000000", // Black (was cream) - for card backgrounds
        white: "#E8E0D5", // Beige (was white)
        text: "#F5F0EA", // Cream (was black) - text color
        textSecondary: "#A0A0A0", // Light gray (was dark gray)
      }
    } else {
      // Light mode colors (current/default)
      return {
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
    }
  }, [isDark])

  const [question, setQuestion] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string>()
  const [devForceCustomQuestion, setDevForceCustomQuestion] = useState(false)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)
  const posthog = usePostHog()

  // Track loaded_custom_question_screen event
  useEffect(() => {
    try {
      if (posthog) {
        posthog.capture("loaded_custom_question_screen", { group_id: groupId, date })
      } else {
        captureEvent("loaded_custom_question_screen", { group_id: groupId, date })
      }
    } catch (error) {
      if (__DEV__) console.error("[add-custom-question] Failed to track loaded_custom_question_screen:", error)
    }
  }, [posthog, groupId, date])

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
  })

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    loadUser()
    
    // Check dev mode setting
    if (__DEV__) {
      async function loadDevSettings() {
        const forceCustomQuestion = await AsyncStorage.getItem("dev_force_custom_question")
        setDevForceCustomQuestion(forceCustomQuestion === "true")
      }
      loadDevSettings()
    }
  }, [])

  // Fetch opportunity to verify it exists
  const { data: opportunity } = useQuery({
    queryKey: ["customQuestionOpportunity", groupId, date, userId],
    queryFn: () => (groupId && userId ? getCustomQuestionOpportunity(userId, groupId, date) : null),
    enabled: !!groupId && !!userId,
  })

  function countWords(text: string): number {
    return text.trim().split(/\s+/).filter((word) => word.length > 0).length
  }

  const wordCount = countWords(question)
  const maxWords = 30
  const isOverLimit = wordCount > maxWords

  async function handleSubmit() {
    if (!question.trim()) {
      Alert.alert("Hold on", "Please enter a question.")
      return
    }

    if (isOverLimit) {
      Alert.alert("Hold on", `Your question must be ${maxWords} words or less.`)
      return
    }

    if (!groupId || !userId) {
      Alert.alert("Error", "Missing group or user information.")
      return
    }

    // In dev mode with force toggle, bypass opportunity check
    const isDevMode = __DEV__ && devForceCustomQuestion
    if (!isDevMode && !opportunity) {
      Alert.alert("Error", "No custom question opportunity found for this date.")
      return
    }

    setLoading(true)
    try {
      await createCustomQuestion({
        groupId,
        userId,
        question: question.trim(),
        isAnonymous,
        dateAssigned: date,
      })

      // Track created_custom_question event
      try {
        if (posthog) {
          posthog.capture("created_custom_question", {
            group_id: groupId,
            date: date,
            text_length: question.trim().length,
            description: false,
            visibility: isAnonymous ? "anonymous" : "public",
          })
        } else {
          captureEvent("created_custom_question", {
            group_id: groupId,
            date: date,
            text_length: question.trim().length,
            description: false,
            visibility: isAnonymous ? "anonymous" : "public",
          })
        }
      } catch (error) {
        if (__DEV__) console.error("[add-custom-question] Failed to track created_custom_question:", error)
      }

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ["customQuestionOpportunity"] })
      await queryClient.invalidateQueries({ queryKey: ["dailyPrompt"] })
      await queryClient.invalidateQueries({ queryKey: ["entries"] })

      // Navigate to success modal
      router.push({
        pathname: "/(main)/modals/custom-question-success",
        params: { returnTo: "/(main)/home" },
      })
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create custom question.")
    } finally {
      setLoading(false)
    }
  }

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: insets.top + spacing.md,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 0,
    },
    headerTitle: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white,
      borderWidth: 1,
      borderColor: theme2Colors.text,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      flex: 1,
      padding: spacing.lg,
    },
    fieldGroup: {
      marginBottom: spacing.xl,
    },
    label: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      fontWeight: "600",
      color: theme2Colors.text,
      marginBottom: spacing.xs,
    },
    input: {
      fontFamily: "Roboto-Regular",
      fontSize: 16,
      color: theme2Colors.text,
      backgroundColor: theme2Colors.cream,
      borderRadius: 12,
      padding: spacing.md,
      minHeight: 100,
      textAlignVertical: "top",
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
    },
    inputFocused: {
      borderColor: theme2Colors.blue,
    },
    wordCount: {
      fontFamily: "Roboto-Regular",
      fontSize: 12,
      color: isOverLimit ? theme2Colors.red : theme2Colors.textSecondary,
      marginTop: spacing.xs,
      textAlign: "right",
    },
    visibilityOptions: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme2Colors.textSecondary,
    },
    visibilityLabel: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      fontWeight: "600",
      color: theme2Colors.text,
      marginBottom: spacing.md,
    },
    visibilityButtons: {
      flexDirection: "row",
    },
    visibilityButton: {
      flex: 1,
      backgroundColor: theme2Colors.cream,
      borderRadius: 12,
      padding: spacing.md,
      alignItems: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    visibilityButtonFirst: {
      marginRight: spacing.md,
    },
    visibilityButtonSelected: {
      borderColor: theme2Colors.yellow,
      backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white,
    },
    anonymousIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.textSecondary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    visibilityButtonTitle: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      fontWeight: "600",
      color: theme2Colors.textSecondary,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    visibilityButtonTitleSelected: {
      color: theme2Colors.text,
    },
    visibilityButtonSubtext: {
      fontFamily: "Roboto-Regular",
      fontSize: 12,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
    visibilityButtonSubtextSelected: {
      color: theme2Colors.text,
    },
    button: {
      marginTop: spacing.lg,
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
    },
    buttonText: {
      color: theme2Colors.white,
    },
  }), [insets.top, isOverLimit, theme2Colors, isDark])

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>It's your turn</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <FontAwesome name="times" size={16} color={isDark ? theme2Colors.white : theme2Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Your Question</Text>
          <TextInput
            style={[
              styles.input,
              focusedInput === "question" && styles.inputFocused,
              isOverLimit && { borderColor: theme2Colors.red },
            ]}
            value={question}
            onChangeText={setQuestion}
            placeholder="What would you like to ask everyone?"
            placeholderTextColor={theme2Colors.textSecondary}
            multiline
            maxLength={200}
            autoFocus
            onFocus={() => setFocusedInput("question")}
            onBlur={() => setFocusedInput(null)}
          />
          <Text style={styles.wordCount}>
            {wordCount} / {maxWords} words {isOverLimit && "(too many)"}
          </Text>
        </View>

        <View style={styles.visibilityOptions}>
          <Text style={styles.visibilityLabel}>Who sees this?</Text>
          <View style={styles.visibilityButtons}>
            <TouchableOpacity
              style={[
                styles.visibilityButton,
                styles.visibilityButtonFirst,
                !isAnonymous && styles.visibilityButtonSelected,
              ]}
              onPress={() => setIsAnonymous(false)}
            >
              <Avatar
                uri={currentUser?.avatar_url}
                name={currentUser?.name || "User"}
                size={40}
              />
              <Text style={[
                styles.visibilityButtonTitle,
                !isAnonymous && styles.visibilityButtonTitleSelected,
              ]}>
                Show my name
              </Text>
              <Text style={[
                styles.visibilityButtonSubtext,
                !isAnonymous && styles.visibilityButtonSubtextSelected,
              ]}>
                They'll know you asked
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.visibilityButton,
                isAnonymous && styles.visibilityButtonSelected,
              ]}
              onPress={() => setIsAnonymous(true)}
            >
              <View style={[
                styles.anonymousIcon,
                isAnonymous && { backgroundColor: theme2Colors.text }
              ]}>
                <FontAwesome name="user-secret" size={24} color={isAnonymous ? theme2Colors.white : theme2Colors.textSecondary} />
              </View>
              <Text style={[
                styles.visibilityButtonTitle,
                isAnonymous && styles.visibilityButtonTitleSelected,
              ]}>
                Keep anonymous
              </Text>
              <Text style={[
                styles.visibilityButtonSubtext,
                isAnonymous && styles.visibilityButtonSubtextSelected,
              ]}>
                They won't know you asked
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Button
          title="Ask everyone"
          onPress={handleSubmit}
          loading={loading}
          disabled={!question.trim() || isOverLimit || loading}
          style={styles.button}
          textStyle={styles.buttonText}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

