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
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"

export default function ContributeFeaturedQuestion() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  
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
          backgroundColor: theme2Colors.beige,
        },
        header: {
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: theme2Colors.textSecondary,
          backgroundColor: theme2Colors.beige,
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
          backgroundColor: theme2Colors.white,
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
          color: theme2Colors.text,
          marginBottom: spacing.sm,
          fontWeight: "600",
        },
        helperText: {
          fontFamily: "Roboto-Regular",
          fontSize: 12,
          color: theme2Colors.textSecondary,
          marginBottom: spacing.md,
        },
        input: {
          fontFamily: "Roboto-Regular",
          fontSize: 16,
          color: theme2Colors.text,
          backgroundColor: theme2Colors.cream,
          borderRadius: 12,
          padding: spacing.md,
          minHeight: 80,
          textAlignVertical: "top",
          borderWidth: 2,
          borderColor: theme2Colors.textSecondary,
        },
        inputFocused: {
          borderColor: theme2Colors.blue,
        },
        button: {
          marginTop: spacing.lg,
          backgroundColor: theme2Colors.blue,
          borderRadius: 25,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 56,
        },
        buttonText: {
          ...typography.bodyBold,
          fontSize: 16,
          color: theme2Colors.white,
        },
        buttonDisabled: {
          backgroundColor: theme2Colors.textSecondary,
          opacity: 0.5,
        },
      }),
    [insets.top]
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
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
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
            placeholderTextColor={theme2Colors.textSecondary}
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
            placeholderTextColor={theme2Colors.textSecondary}
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
            placeholderTextColor={theme2Colors.textSecondary}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (!question1.trim() || loading) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!question1.trim() || loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Submitting..." : "Submit questions"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

