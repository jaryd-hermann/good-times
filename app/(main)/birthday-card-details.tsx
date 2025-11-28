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
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../../lib/theme-context"
import { typography, spacing } from "../../lib/theme"
import { getBirthdayCard, getBirthdayCardEntries, makeBirthdayCardPublic, trackBirthdayCardView } from "../../lib/db"
import { usePostHog } from "posthog-react-native"
import { captureEvent, safeCapture } from "../../lib/posthog"
import { EntryCard } from "../../components/EntryCard"
import { Button } from "../../components/Button"
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

  // Fade-in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
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

  const makePublicMutation = useMutation({
    mutationFn: () => {
      if (!card) throw new Error("Card not found")
      return makeBirthdayCardPublic(cardId, card.birthday_user_id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthdayCard", cardId] })
      queryClient.invalidateQueries({ queryKey: ["publicBirthdayCards", groupId] })
      safeCapture(posthog, "made_birthday_card_public", {
        card_id: cardId,
        group_id: groupId,
      })
      Alert.alert("Card is now public", "Your birthday card is now visible to everyone in your group in History.")
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to make card public")
    },
  })

  function handleMakePublic() {
    Alert.alert(
      "Make card public?",
      "This will make your birthday card visible to everyone in your group in History. You can't undo this.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Make Public",
          style: "destructive",
          onPress: () => makePublicMutation.mutate(),
        },
      ]
    )
  }

  function calculateAge(birthdayYear: number, birthdayDate: string): number {
    const currentYear = new Date(birthdayDate).getFullYear()
    return currentYear - birthdayYear
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
    router.push({
      pathname: "/(main)/modals/birthday-card-entry-detail",
      params: {
        entryId,
        cardId,
        entryIds: JSON.stringify(entryIds),
        index: String(index),
        returnTo: returnTo || `/(main)/birthday-card-details?cardId=${cardId}&groupId=${groupId}`,
      },
    })
  }

  if (!card) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <FontAwesome name="arrow-left" size={18} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
      </View>
    )
  }

  const age = calculateAge(card.birthday_year, card.birthday_date)
  const entryIds = entries.map((e) => e.id)

  // Convert birthday card entries to Entry-like format for EntryCard component
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
  }))

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      paddingTop: insets.top + spacing.md,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      position: "relative",
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.gray[900],
      justifyContent: "center",
      alignItems: "center",
      marginRight: spacing.md,
    },
    headerTitle: {
      ...typography.h1,
      fontSize: 28,
      color: colors.white,
      flex: 1,
      textAlign: "center",
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl * 2,
    },
    birthdayText: {
      ...typography.h1,
      fontSize: 32,
      color: colors.white,
      textAlign: "center",
      marginBottom: spacing.xl,
      marginTop: spacing.md,
    },
    makePublicButton: {
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
    },
    emptyState: {
      paddingTop: spacing.xxl * 2,
      alignItems: "center",
    },
    emptyStateText: {
      ...typography.body,
      color: colors.gray[400],
      textAlign: "center",
    },
  })

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <FontAwesome name="arrow-left" size={18} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Birthday Card</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.birthdayText}>Happy {age} Birthday!</Text>

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No messages yet</Text>
          </View>
        ) : (
          <>
            {entryCards.map((entry, index) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                entryIds={entryIds}
                index={index}
                returnTo={returnTo || `/(main)/birthday-card-details?cardId=${cardId}&groupId=${groupId}`}
              />
            ))}

            {!card.is_public && (
              <Button
                title="Make Public"
                onPress={handleMakePublic}
                style={styles.makePublicButton}
                loading={makePublicMutation.isPending}
              />
            )}
          </>
        )}
      </ScrollView>
    </Animated.View>
  )
}

