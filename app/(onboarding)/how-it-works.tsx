"use client"

import { View, Text, StyleSheet, ImageBackground, Dimensions } from "react-native"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"
import { OnboardingBack } from "../../components/OnboardingBack"
import { OnboardingProgress } from "../../components/OnboardingProgress"
import { useOnboarding } from "../../components/OnboardingProvider"
import { supabase } from "../../lib/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"

const { width, height } = Dimensions.get("window")

const STEPS = [
  "Every day, your group gets a new question. Something simple, meaningful, or fun.",
  "Answer with text, photos, video, or voice notes. It takes just a minute or two.",
  "Enjoy everyones answers. Get closer and connect without the pressure.",
  "Build your group's story. A living history of your lives together.",
  "Flip through your history to relive memories and feel closer even when you're far apart.",
]

export default function HowItWorks() {
  const router = useRouter()
  const { data } = useOnboarding()

  return (
    <ImageBackground
      source={require("../../assets/images/onboarding3-bg.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.content}>
        <View style={styles.topBar}>
          <OnboardingBack />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>How to use it</Text>

          <View style={styles.steps}>
            {STEPS.map((step, index) => (
              <View key={step} style={styles.step}>
                <Text style={styles.stepNumber}>{index + 1}.</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomContainer}>
          <OnboardingProgress total={3} current={3} />
          <View style={styles.buttonContainer}>
            <Button
              title="→"
              onPress={async () => {
                // Check for pending group join
                const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
                if (pendingGroupId) {
                  // Save user profile first if we have onboarding data
                  const {
                    data: { session },
                  } = await supabase.auth.getSession()
                  if (session) {
                    // Save profile if we have onboarding data
                    if (data.userName && data.userBirthday) {
                      const birthday = data.userBirthday.toISOString().split("T")[0]
                      const emailFromSession = data.userEmail ?? session.user.email
                      if (emailFromSession) {
                        await supabase
                          .from("users")
                          .upsert(
                            {
                              id: session.user.id,
                              email: emailFromSession,
                              name: data.userName.trim(),
                              birthday,
                              avatar_url: data.userPhoto,
                            } as any,
                            { onConflict: "id" }
                          )
                      }
                    }
                    
                    // Join the group and go to home
                    const { error } = await supabase.from("group_members").insert({
                      group_id: pendingGroupId,
                      user_id: session.user.id,
                      role: "member",
                    } as any)
                    if (!error) {
                      await AsyncStorage.removeItem("pending_group_join")
                      router.replace({
                        pathname: "/(main)/home",
                        params: { focusGroupId: pendingGroupId },
                      })
                      return
                    }
                  }
                }
                router.push("/(onboarding)/create-group/name-type")
              }}
              style={styles.button}
              textStyle={styles.buttonText}
            />
          </View>
        </View>
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
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
    marginBottom: spacing.xl,
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  stepNumber: {
    ...typography.h3,
    fontSize: 18,
    minWidth: 30,
  },
  stepText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    flex: 1,
  },
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  buttonContainer: {
    alignItems: "flex-end",
    marginLeft: spacing.md,
  },
  button: {
    width: 100,
    height: 60,
  },
  buttonText: {
    fontSize: 32,
  },
})
