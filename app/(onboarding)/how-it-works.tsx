"use client"

import { View, Text, StyleSheet, ImageBackground, Dimensions, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"

const { width, height } = Dimensions.get("window")

export default function HowItWorks() {
  const router = useRouter()

  return (
    <ImageBackground
      source={require("../../assets/images/onboarding3-bg.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>How to use it</Text>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>1.</Text>
            <Text style={styles.stepText}>
              Every day, your group gets a new question or prompt to answer. Something simple, meaningful, or fun.
            </Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>2.</Text>
            <Text style={styles.stepText}>
              Share your answer with text, photos, or voice notes. It takes just a minute or two.
            </Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>3.</Text>
            <Text style={styles.stepText}>
              Once you've shared, you can see what everyone else said. React, comment, and connect.
            </Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>4.</Text>
            <Text style={styles.stepText}>
              Over time, you build a shared story. A living record of your lives together.
            </Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>5.</Text>
            <Text style={styles.stepText}>
              Look back anytime to relive memories, see how you've grown, and feel close even when you're far apart.
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="→"
            onPress={() => router.push("/(onboarding)/about")}
            style={styles.button}
            textStyle={styles.buttonText}
          />
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 3,
    paddingBottom: spacing.xxl * 2,
  },
  textContainer: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    fontSize: 40,
    marginBottom: spacing.xl,
  },
  step: {
    flexDirection: "row",
    marginBottom: spacing.lg,
  },
  stepNumber: {
    ...typography.h3,
    fontSize: 18,
    marginRight: spacing.md,
    minWidth: 30,
  },
  stepText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    flex: 1,
  },
  buttonContainer: {
    alignItems: "flex-end",
  },
  button: {
    width: 100,
    height: 60,
  },
  buttonText: {
    fontSize: 32,
  },
})
