"use client"

import { useEffect, useRef } from "react"
import { View, StyleSheet, Animated } from "react-native"
import { useTheme } from "../lib/theme-context"
import { spacing } from "../lib/theme"

export function PromptSkeleton() {
  const { colors, isDark } = useTheme()
  const shimmerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    )
    shimmer.start()
    return () => shimmer.stop()
  }, [shimmerAnim])

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  })

  const backgroundColor = isDark ? colors.white : colors.black
  const shimmerColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"

  return (
    <View style={styles.container}>
      {/* Category tag skeleton */}
      <View style={[styles.categorySkeleton, { backgroundColor: shimmerColor }]}>
        <Animated.View
          style={[
            styles.shimmer,
            {
              opacity: shimmerOpacity,
              backgroundColor: backgroundColor,
            },
          ]}
        />
      </View>

      {/* Question text skeleton */}
      <View style={styles.questionContainer}>
        <View style={[styles.questionLine1, { backgroundColor: shimmerColor }]}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                opacity: shimmerOpacity,
                backgroundColor: backgroundColor,
              },
            ]}
          />
        </View>
        <View style={[styles.questionLine2, { backgroundColor: shimmerColor }]}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                opacity: shimmerOpacity,
                backgroundColor: backgroundColor,
              },
            ]}
          />
        </View>
        <View style={[styles.questionLine3, { backgroundColor: shimmerColor }]}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                opacity: shimmerOpacity,
                backgroundColor: backgroundColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Description skeleton */}
      <View style={styles.descriptionContainer}>
        <View style={[styles.descriptionLine1, { backgroundColor: shimmerColor }]}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                opacity: shimmerOpacity,
                backgroundColor: backgroundColor,
              },
            ]}
          />
        </View>
        <View style={[styles.descriptionLine2, { backgroundColor: shimmerColor }]}>
          <Animated.View
            style={[
              styles.shimmer,
              {
                opacity: shimmerOpacity,
                backgroundColor: backgroundColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Button skeleton */}
      <View style={[styles.buttonSkeleton, { backgroundColor: shimmerColor }]}>
        <Animated.View
          style={[
            styles.shimmer,
            {
              opacity: shimmerOpacity,
              backgroundColor: backgroundColor,
            },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  categorySkeleton: {
    width: 100,
    height: 24,
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  questionContainer: {
    marginBottom: spacing.md,
  },
  questionLine1: {
    height: 24,
    borderRadius: 4,
    marginBottom: spacing.xs,
    overflow: "hidden",
    width: "95%",
  },
  questionLine2: {
    height: 24,
    borderRadius: 4,
    marginBottom: spacing.xs,
    overflow: "hidden",
    width: "85%",
  },
  questionLine3: {
    height: 24,
    borderRadius: 4,
    overflow: "hidden",
    width: "60%",
  },
  descriptionContainer: {
    marginBottom: spacing.lg,
  },
  descriptionLine1: {
    height: 16,
    borderRadius: 4,
    marginBottom: spacing.xs,
    overflow: "hidden",
    width: "90%",
  },
  descriptionLine2: {
    height: 16,
    borderRadius: 4,
    overflow: "hidden",
    width: "70%",
  },
  buttonSkeleton: {
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    width: "100%",
  },
  shimmer: {
    flex: 1,
    width: "100%",
  },
})

