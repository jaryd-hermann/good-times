"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../../lib/theme-context"
import { typography, spacing } from "../../lib/theme"
import { getBirthdayCard, getBirthdayCardEntries, trackBirthdayCardView } from "../../lib/db"
import { usePostHog } from "posthog-react-native"
import { captureEvent, safeCapture } from "../../lib/posthog"
import { EntryCard } from "../../components/EntryCard"
import { supabase } from "../../lib/supabase"

export default function BirthdayCardDetails() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const cardId = params.cardId as string
  const groupId = params.groupId as string
  const returnTo = (params.returnTo as string) || undefined
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const posthog = usePostHog()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scrollY = useRef(new Animated.Value(0)).current
  const headerTranslateY = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)

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

  const { data: card } = useQuery({
    queryKey: ["birthdayCard", cardId],
    queryFn: () => getBirthdayCard(cardId),
    enabled: !!cardId,
  })

  const { data: entries = [] } = useQuery({
    queryKey: ["birthdayCardEntries", cardId],
    queryFn: () => getBirthdayCardEntries(cardId),
    enabled: !!cardId,
  })

  // Get current user ID for tracking
  const [userId, setUserId] = useState<string>()
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    loadUser()
  }, [])

  // Slow fade-in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800, // Slower fade for more excitement
      useNativeDriver: true,
    }).start()
  }, [])

  // Track opened_birthday_card_details event and track view in database
  useEffect(() => {
    if (card && cardId && userId) {
      try {
        // Track PostHog event
        safeCapture(posthog, "opened_birthday_card_details", {
          card_id: cardId,
          group_id: card.group_id,
          birthday_user_id: card.birthday_user_id,
          birthday_date: card.birthday_date,
          entry_count: entries.length,
        })

        // Track view in database (only if user is the birthday person)
        if (card.birthday_user_id === userId) {
          trackBirthdayCardView(cardId, userId).catch((error) => {
            if (__DEV__) console.error("[birthday-card-details] Failed to track view:", error)
          })
        }
      } catch (error) {
        if (__DEV__) console.error("[birthday-card-details] Failed to track opened_birthday_card_details:", error)
      }
    }
  }, [card, cardId, userId, entries.length, posthog])

  function calculateAge(userBirthday: string | null | undefined): { age: number | null; ordinal: string } {
    // Use the user's birthday from the users table
    if (!userBirthday) {
      return { age: null, ordinal: "" }
    }
    
    try {
      const birthdayDate = new Date(userBirthday)
      if (isNaN(birthdayDate.getTime())) {
        return { age: null, ordinal: "" }
      }
      
      const birthYear = birthdayDate.getFullYear()
      const currentYear = new Date().getFullYear()
      const age = Math.max(0, currentYear - birthYear)
      
      // Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
      const getOrdinal = (n: number): string => {
        const s = ["th", "st", "nd", "rd"]
        const v = n % 100
        return s[(v - 20) % 10] || s[v] || s[0]
      }
      
      return { age, ordinal: getOrdinal(age) }
    } catch {
      return { age: null, ordinal: "" }
    }
  }

  function handleBack() {
    if (returnTo) {
      router.replace(returnTo)
    } else if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/(main)/home")
    }
  }

  function handleEntryPress(entryId: string) {
    const entryIds = entries.map((e) => e.id)
    const index = entryIds.indexOf(entryId)
    // Always return to birthday card details page when navigating from within the card
    const cardReturnTo = `/(main)/birthday-card-details?cardId=${cardId}&groupId=${groupId}`
    router.push({
      pathname: "/(main)/modals/birthday-card-entry-detail",
      params: {
        entryId,
        cardId,
        entryIds: JSON.stringify(entryIds),
        index: String(index),
        returnTo: cardReturnTo, // Always return to birthday card details
      },
    })
  }

  // Define styles before early return to ensure they're always available
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingTop: insets.top + spacing.md,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: theme2Colors.beige,
      zIndex: 10,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme2Colors.white,
      borderWidth: 1,
      borderColor: theme2Colors.text,
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.md,
    },
    headerTitle: {
      fontFamily: "Roboto-Regular",
      fontSize: 16,
      color: theme2Colors.textSecondary,
      flex: 1,
      textAlign: "center",
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl * 2,
    },
    contentContainer: {
      paddingTop: insets.top + spacing.md + spacing.md + 40 + spacing.md, // Account for header height
    },
    birthdayText: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      textAlign: "center",
      marginBottom: spacing.xl,
      marginTop: spacing.md,
    },
    emptyState: {
      paddingTop: spacing.xxl * 2,
      alignItems: "center",
    },
    emptyStateText: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
  })

  if (!card) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <FontAwesome name="angle-left" size={18} color={theme2Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>
    )
  }

  // Calculate age from user's birthday
  const userBirthday = (card.birthday_user as any)?.birthday
  const { age, ordinal } = calculateAge(userBirthday)
  const entryIds = entries.map((e) => e.id)

  // Convert birthday card entries to Entry-like format for EntryCard component
  // Add a flag to identify birthday card entries
  const entryCards = entries.map((entry) => ({
    id: entry.id,
    group_id: card.group_id,
    user_id: entry.contributor_user_id,
    prompt_id: "", // No prompt for birthday cards
    date: card.birthday_date,
    text_content: entry.text_content,
    media_urls: entry.media_urls,
    media_types: entry.media_types,
    embedded_media: entry.embedded_media,
    created_at: entry.created_at,
    user: entry.contributor,
    prompt: undefined, // No prompt
    isBirthdayCardEntry: true, // Flag to identify birthday card entries
    cardId: cardId, // Pass cardId for navigation
  }))

  // Calculate header height for scroll offset
  const headerHeight = insets.top + spacing.md + spacing.md + 40 + spacing.md

  // Handle scroll for header hiding
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (event: any) => {
      const currentScrollY = event.nativeEvent.contentOffset.y
      const scrollDiff = currentScrollY - lastScrollY.current
      lastScrollY.current = currentScrollY

      if (scrollDiff > 5 && currentScrollY > 50) {
        // Scrolling down - hide header
        Animated.timing(headerTranslateY, {
          toValue: -(headerHeight + 100),
          duration: 300,
          useNativeDriver: true,
        }).start()
      } else if (scrollDiff < -5) {
        // Scrolling up - show header
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start()
      }
    },
  })

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <FontAwesome name="angle-left" size={18} color={theme2Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your group card</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <Text style={styles.birthdayText}>
          {age !== null ? `Happy ${age}${ordinal} Birthday!` : "Happy Birthday!"}
        </Text>

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No messages yet</Text>
          </View>
        ) : (
          <>
            {entryCards.map((entry, index) => {
              // Always return to birthday card details page when clicking entries
              const cardReturnTo = `/(main)/birthday-card-details?cardId=${cardId}&groupId=${groupId}`
              return (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  entryIds={entryIds}
                  index={index}
                  returnTo={cardReturnTo}
                />
              )
            })}
          </>
        )}
      </ScrollView>
    </Animated.View>
  )
}

