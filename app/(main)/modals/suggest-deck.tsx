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
import { FontAwesome } from "@expo/vector-icons"

// Theme 2 color palette - dynamic based on dark/light mode

export default function SuggestDeck() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const groupId = (params.groupId as string) || undefined
  const returnTo = (params.returnTo as string) || "/(main)/explore-decks"

  const [suggestion, setSuggestion] = useState("")
  const [sampleQuestion, setSampleQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string>()
  const [userEmail, setUserEmail] = useState<string>()
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

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
    if (!suggestion.trim()) {
      Alert.alert("Hold on", "Please enter your suggestion.")
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
          email_type: "deck_suggestion",
          user_id: userId,
          group_id: groupId,
          template_data: {
            user_name: currentUser.name || "User",
            user_email: userEmail || "No email",
            group_name: currentGroup?.name || "Unknown Group",
            group_id: groupId,
            suggestion: suggestion.trim(),
            sample_question: sampleQuestion.trim() || "None provided",
          },
        },
      })

      if (error) {
        console.error("[suggest-deck] Edge Function error:", error)
        throw new Error(error.message || "Failed to send suggestion")
      }

      if (!data?.success) {
        console.error("[suggest-deck] Edge Function returned error:", data)
        throw new Error(data?.error || "Failed to send suggestion")
      }

      // Navigate to success modal
      router.push({
        pathname: "/(main)/modals/suggest-deck-success",
        params: { returnTo },
      })
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit suggestion. Please try again.")
    } finally {
      setLoading(false)
    }
  }

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
          backgroundColor: isDark ? theme2Colors.beige : theme2Colors.white, // Black in dark mode
          borderWidth: 1,
          borderColor: isDark ? theme2Colors.text : theme2Colors.text, // Cream in dark mode
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
          minHeight: 100,
          textAlignVertical: "top",
          borderWidth: 2,
          borderColor: theme2Colors.textSecondary,
        },
        inputFocused: {
          borderColor: theme2Colors.blue,
        },
        sampleQuestionInput: {
          minHeight: 80,
        },
        button: {
          marginTop: spacing.lg,
          borderRadius: 25,
        },
      }),
    [insets.top, isDark, theme2Colors]
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Suggest a Deck</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <FontAwesome name="times" size={16} color={isDark ? theme2Colors.text : theme2Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Your Suggestion</Text>
          <Text style={styles.helperText}>
            Suggest a deck, topic, or theme of questions you think your group would enjoy answering
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedInput === "suggestion" && styles.inputFocused,
            ]}
            value={suggestion}
            onChangeText={setSuggestion}
            placeholder="What deck or topic would your group enjoy?"
            placeholderTextColor={theme2Colors.textSecondary}
            multiline
            autoFocus
            onFocus={() => setFocusedInput("suggestion")}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Sample Question (Optional)</Text>
          <TextInput
            style={[
              styles.input,
              styles.sampleQuestionInput,
              focusedInput === "sampleQuestion" && styles.inputFocused,
            ]}
            value={sampleQuestion}
            onChangeText={setSampleQuestion}
            placeholder="What would a sample question be?"
            placeholderTextColor={theme2Colors.textSecondary}
            multiline
            onFocus={() => setFocusedInput("sampleQuestion")}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <Button
          title="Submit idea"
          onPress={handleSubmit}
          loading={loading}
          disabled={!suggestion.trim() || loading}
          style={[styles.button, { backgroundColor: theme2Colors.blue }]}
          textStyle={{ color: theme2Colors.white }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

