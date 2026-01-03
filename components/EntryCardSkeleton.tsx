"use client"

import { useEffect, useRef, useMemo } from "react"
import { View, StyleSheet, Animated } from "react-native"
import { useTheme } from "../lib/theme-context"
import { spacing } from "../lib/theme"

export function EntryCardSkeleton() {
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

  // Theme 2 color palette - match EntryCard exactly
  const theme2Colors = useMemo(() => {
    if (isDark) {
      return {
        cream: "#111111", // Dark gray for card background
        text: "#F5F0EA",
        textSecondary: "#A0A0A0",
      }
    } else {
      return {
        cream: "#F5F0EA", // Cream for card background
        text: "#000000",
        textSecondary: "#404040",
      }
    }
  }, [isDark])

  const backgroundColor = isDark ? colors.white : colors.black
  const shimmerColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"

  return (
    <View style={styles.entryWrapper}>
      <View 
        style={[
          styles.entryCard,
          {
            backgroundColor: theme2Colors.cream,
            borderColor: theme2Colors.textSecondary,
          }
        ]}
      >
        {/* Avatar and name skeleton */}
        <View style={styles.entryHeader}>
          <View style={styles.entryAuthor}>
            <View style={[styles.avatarSkeleton, { backgroundColor: shimmerColor }]}>
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
            <View style={styles.headerTextContainer}>
              <View style={[styles.nameSkeleton, { backgroundColor: shimmerColor }]}>
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
          </View>
        </View>

        {/* Question/prompt skeleton */}
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
        </View>

        {/* Media placeholder skeleton */}
        <View style={[styles.mediaSkeleton, { backgroundColor: shimmerColor }]}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  entryWrapper: {
    width: "100%",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  entryCard: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  entryAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
  },
  avatarSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  headerTextContainer: {
    flex: 1,
  },
  nameSkeleton: {
    height: 16,
    borderRadius: 4,
    overflow: "hidden",
    width: "40%",
  },
  questionContainer: {
    marginBottom: spacing.md,
  },
  questionLine1: {
    height: 20,
    borderRadius: 4,
    marginBottom: spacing.xs,
    overflow: "hidden",
    width: "90%",
  },
  questionLine2: {
    height: 20,
    borderRadius: 4,
    overflow: "hidden",
    width: "70%",
  },
  mediaSkeleton: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
  },
  shimmer: {
    flex: 1,
    width: "100%",
  },
})

