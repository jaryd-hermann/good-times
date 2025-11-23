"use client"

import { View, Text, StyleSheet } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { markCustomQuestionOnboardingSeen } from "../../lib/db"
import { useQueryClient } from "@tanstack/react-query"
import { OnboardingBack } from "../../components/OnboardingBack"
import { getTodayDate } from "../../lib/utils"

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
        <View style={[styles.topBar, { top: insets.top + spacing.md }]}>
          <OnboardingBack />
        </View>
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
    backgroundColor: colors.black,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  topBar: {
    position: "absolute",
    top: spacing.xxl,
    left: spacing.lg,
    zIndex: 1,
  },
  textContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    fontSize: 40,
    marginBottom: spacing.lg,
    color: colors.white,
  },
  body: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    marginBottom: spacing.md,
  },
  expiresParagraph: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    marginTop: spacing.md,
    fontWeight: "600",
  },
  bottomContainer: {
    alignItems: "center",
  },
  button: {
    width: "100%",
    maxWidth: 300,
  },
  buttonText: {
    fontSize: 18,
  },
})

