"use client"

import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { markCustomQuestionOnboardingSeen } from "../../lib/db"
import { useQueryClient } from "@tanstack/react-query"
import { getTodayDate } from "../../lib/utils"
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
}

export default function CustomQuestionOnboarding() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  
  // Get groupId and date from params (passed from home.tsx)
  const groupId = (params.groupId as string) || undefined
  const date = (params.date as string) || getTodayDate()

  async function handleContinue() {
    const {
      data: { user },
    } = await require("../../lib/supabase").supabase.auth.getUser()
    if (user) {
      await markCustomQuestionOnboardingSeen(user.id)
      await queryClient.invalidateQueries({ queryKey: ["profile"] })
    }
    router.push({
      pathname: "/(main)/add-custom-question",
      params: {
        groupId: groupId || "",
        date: date,
      },
    })
  }

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl * 2 }]}>
        <TouchableOpacity 
          style={[styles.closeButton, { top: insets.top + spacing.md }]}
          onPress={() => router.back()}
        >
          <FontAwesome name="times" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Ask anything...</Text>
          <Text style={styles.body}>
            It's your turn to ask the group a custom question. We'll send it to everyone in a day or two.
          </Text>
          <Text style={styles.expiresParagraph}>
            Your turn ends today, ask now!
          </Text>
        </View>

        <View style={styles.bottomContainer}>
          <Button
            title="Ask my question"
            onPress={handleContinue}
            style={styles.button}
            textStyle={styles.buttonText}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  closeButton: {
    position: "absolute",
    top: spacing.xxl,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme2Colors.white,
    borderWidth: 1,
    borderColor: theme2Colors.text,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  textContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 40,
    marginBottom: spacing.lg,
    color: theme2Colors.text,
  },
  body: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  expiresParagraph: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.text,
    marginTop: spacing.md,
    fontWeight: "600",
  },
  bottomContainer: {
    alignItems: "center",
  },
  button: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: theme2Colors.blue,
    borderRadius: 25,
  },
  buttonText: {
    fontSize: 18,
    color: theme2Colors.white,
  },
})

