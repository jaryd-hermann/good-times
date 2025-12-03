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
import { useQuery } from "@tanstack/react-query"
import { supabase } from "../../../lib/supabase"
import { getCurrentUser, getGroup } from "../../../lib/db"
import { typography, spacing } from "../../../lib/theme"
import { useTheme } from "../../../lib/theme-context"
import { Button } from "../../../components/Button"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function ContributeFeaturedQuestion() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const groupId = (params.groupId as string) || undefined
  const returnTo = (params.returnTo as string) || "/(main)/explore-decks"

  const [question1, setQuestion1] = useState("")
  const [question2, setQuestion2] = useState("")
  const [question3, setQuestion3] = useState("")
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string>()
  const [userEmail, setUserEmail] = useState<string>()

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
  })

  const { data: currentGroup } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => (groupId ? getGroup(groupId) : null),
    enabled: !!groupId,
  })

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setUserEmail(user.email || undefined)
      }
    }
    loadUser()
  }, [])

  async function handleSubmit() {
    const questions = [question1.trim(), question2.trim(), question3.trim()].filter(q => q.length > 0)
    
    if (questions.length === 0) {
      Alert.alert("Hold on", "Please enter at least one question.")
      return
    }

    if (!groupId || !userId || !currentUser) {
      Alert.alert("Error", "Missing required information.")
      return
    }

    setLoading(true)
    try {
      // Call Supabase Edge Function to send email
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          email_type: "featured_question_suggestion",
          user_id: userId,
          group_id: groupId,
          template_data: {
            user_name: currentUser.name || "User",
            user_email: userEmail || "No email",
            group_name: currentGroup?.name || "Unknown Group",
            group_id: groupId,
            questions: questions,
          },
        },
      })

      if (error) {
        console.error("[contribute-featured-question] Edge Function error:", error)
        throw new Error(error.message || "Failed to send suggestion")
      }

      if (!data?.success) {
        console.error("[contribute-featured-question] Edge Function returned error:", data)
        throw new Error(data?.error || "Failed to send suggestion")
      }

      // Navigate back
      router.push(returnTo)
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit questions. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        helperText: {
          ...typography.caption,
          color: colors.gray[500],
          marginBottom: spacing.md,
          fontSize: 12,
        },
        input: {
          ...typography.body,
          color: colors.white,
          backgroundColor: colors.gray[900],
          borderRadius: 12,
          padding: spacing.md,
          minHeight: 80,
          textAlignVertical: "top",
          borderWidth: 1,
          borderColor: colors.gray[700],
        },
        inputFocused: {
          borderColor: colors.accent,
        },
        button: {
          marginTop: spacing.lg,
        },
      }),
    [colors, isDark, insets.top]
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contribute a Question</Text>
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
          <Text style={styles.label}>Question 1</Text>
          <Text style={styles.helperText}>
            Suggest a question you think would be great for featured questions
          </Text>
          <TextInput
            style={styles.input}
            value={question1}
            onChangeText={setQuestion1}
            placeholder="Enter your question..."
            placeholderTextColor={colors.gray[500]}
            multiline
            autoFocus
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Question 2 (Optional)</Text>
          <TextInput
            style={styles.input}
            value={question2}
            onChangeText={setQuestion2}
            placeholder="Enter another question..."
            placeholderTextColor={colors.gray[500]}
            multiline
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Question 3 (Optional)</Text>
          <TextInput
            style={styles.input}
            value={question3}
            onChangeText={setQuestion3}
            placeholder="Enter another question..."
            placeholderTextColor={colors.gray[500]}
            multiline
          />
        </View>

        <Button
          title="Submit questions"
          onPress={handleSubmit}
          loading={loading}
          disabled={!question1.trim() || loading}
          style={styles.button}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

