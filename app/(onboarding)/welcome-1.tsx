"use client"

import { View, Text, StyleSheet, ImageBackground, Dimensions, TouchableOpacity } from "react-native"
import { useRouter } from "expo-router"
import { colors, typography, spacing } from "../../lib/theme"
import { Button } from "../../components/Button"

const { width, height } = Dimensions.get("window")

export default function Welcome1() {
  const router = useRouter()

  return (
    <ImageBackground source={require("../../assets/images/welcome-bg.png")} style={styles.container} resizeMode="cover">
      <View style={styles.overlay} />
      <View style={styles.content}>
        <View style={styles.loginContainer}>
          <TouchableOpacity onPress={() => router.push("/(onboarding)/auth")} activeOpacity={0.8}>
            <Text style={styles.loginText}>Login</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Good Times</Text>
          <Text style={styles.subtitle}>
            Just you and your favorite people keeping connected, without the pressure, making a shared story.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="→"
            onPress={() => router.push("/(onboarding)/welcome-2")}
            style={styles.button}
            textStyle={styles.buttonText}
          />
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
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingTop: spacing.xxl * 3,
    paddingBottom: spacing.xxl * 2,
  },
  loginContainer: {
    position: "absolute",
    top: spacing.xxl,
    right: spacing.lg,
  },
  loginText: {
    fontFamily: "Roboto-Medium",
    fontSize: 16,
    color: colors.white,
  },
  textContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: "LibreBaskerville-Bold",
    fontSize: 48,
    lineHeight: 56,
    color: colors.white,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 28,
    color: colors.white,
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
