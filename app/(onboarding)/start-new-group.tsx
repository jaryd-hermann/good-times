"use client"

import { StyleSheet, Text, TouchableOpacity, View, Image, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { spacing, typography } from "../../lib/theme"
import { useOnboarding } from "../../components/OnboardingProvider"
import { FontAwesome } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"

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
  onboardingPink: "#D97393", // Pink for onboarding CTAs
}

export default function StartNewGroup() {
  const router = useRouter()
  const { clear } = useOnboarding()
  const insets = useSafeAreaInsets()

  function handleContinue() {
    clear()
    router.push({
      pathname: "/(onboarding)/create-group/name-type",
      params: { mode: "add" },
    })
  }

  function handleBackHome() {
    router.back()
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section - Image */}
        <View style={styles.imageContainer}>
          <View style={styles.imageWrapper}>
            <Image
              source={require("../../assets/images/friends.png")}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Bottom Section - Content */}
        <View style={styles.content}>
          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>Start another group</Text>
            <Text style={styles.body}>
              Keep a new story going with a fresh group. We'll walk you through the details in just a minute.
            </Text>
          </View>

          {/* Bottom Container */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackHome}
              activeOpacity={0.8}
            >
              <FontAwesome name="angle-left" size={18} color={theme2Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaButtonText}>→</Text>
              <View style={styles.buttonTexture} pointerEvents="none">
                <Image
                  source={require("../../assets/images/texture.png")}
                  style={styles.textureImage}
                  resizeMode="cover"
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageContainer: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.lg,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 0.8,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: theme2Colors.beige,
    borderWidth: 2,
    borderColor: theme2Colors.text,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl * 4,
    backgroundColor: theme2Colors.beige,
  },
  textContainer: {
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme2Colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 40,
    lineHeight: 48,
    color: theme2Colors.text,
    marginBottom: spacing.lg,
  },
  body: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  bottomContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  ctaButton: {
    width: 100,
    height: 60,
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ctaButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 32,
    color: theme2Colors.white,
    zIndex: 2,
  },
  buttonTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
  },
  textureImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
})

