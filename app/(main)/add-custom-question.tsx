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

export default function AddCustomQuestion() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const groupId = (params.groupId as string) || undefined
  const date = (params.date as string) || getTodayDate()

  const [question, setQuestion] = useState("")
  const [description, setDescription] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string>()
  const [devForceCustomQuestion, setDevForceCustomQuestion] = useState(false)

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
  const maxWords = 20
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
        description: description.trim() || undefined,
        isAnonymous,
        dateAssigned: date,
      })

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
      backgroundColor: colors.black,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: insets.top + spacing.md,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[800],
    },
    headerTitle: {
      ...typography.h2,
      color: colors.white,
      fontSize: 24,
    },
    closeButton: {
      padding: spacing.sm,
    },
    closeText: {
      ...typography.h2,
      color: colors.white,
      fontSize: 24,
    },
    content: {
      flex: 1,
      padding: spacing.lg,
    },
    fieldGroup: {
      marginBottom: spacing.xl,
    },
    label: {
      ...typography.bodyMedium,
      color: colors.gray[400],
      marginBottom: spacing.sm,
    },
    input: {
      ...typography.body,
      color: colors.white,
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.md,
      minHeight: 100,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: colors.gray[700],
    },
    inputFocused: {
      borderColor: colors.accent,
    },
    descriptionInput: {
      minHeight: 80,
    },
    wordCount: {
      ...typography.caption,
      color: isOverLimit ? colors.accent : colors.gray[400],
      marginTop: spacing.xs,
      textAlign: "right",
    },
    visibilityOptions: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.gray[800],
    },
    visibilityLabel: {
      ...typography.bodyMedium,
      color: colors.gray[400],
      marginBottom: spacing.md,
    },
    visibilityButtons: {
      flexDirection: "row",
    },
    visibilityButton: {
      flex: 1,
      backgroundColor: colors.gray[900],
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
      borderColor: colors.accent,
      backgroundColor: colors.gray[800],
    },
    anonymousIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.gray[700],
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    visibilityButtonTitle: {
      ...typography.bodyBold,
      color: colors.gray[400],
      fontSize: 14,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    visibilityButtonTitleSelected: {
      color: colors.white,
    },
    visibilityButtonSubtext: {
      ...typography.caption,
      color: colors.gray[500],
      fontSize: 12,
      textAlign: "center",
    },
    visibilityButtonSubtextSelected: {
      color: colors.gray[300],
    },
    button: {
      marginTop: spacing.lg,
    },
  }), [colors, isDark, insets.top, isOverLimit])

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ask Your Group</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
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
            style={[styles.input, isOverLimit && { borderColor: colors.accent }]}
            value={question}
            onChangeText={setQuestion}
            placeholder="What would you like to ask your group?"
            placeholderTextColor={colors.gray[500]}
            multiline
            maxLength={200}
            autoFocus
          />
          <Text style={styles.wordCount}>
            {wordCount} / {maxWords} words {isOverLimit && "(too many)"}
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add any context or details..."
            placeholderTextColor={colors.gray[500]}
            multiline
            maxLength={500}
          />
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
                The group will know you asked this
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.visibilityButton,
                isAnonymous && styles.visibilityButtonSelected,
              ]}
              onPress={() => setIsAnonymous(true)}
            >
              <View style={styles.anonymousIcon}>
                <FontAwesome name="user-secret" size={24} color={isAnonymous ? colors.white : colors.gray[400]} />
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
                Your question will be asked anonymously
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Button
          title="Post Question"
          onPress={handleSubmit}
          loading={loading}
          disabled={!question.trim() || isOverLimit || loading}
          style={styles.button}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

