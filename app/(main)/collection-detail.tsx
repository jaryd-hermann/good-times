"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../../lib/theme-context"
import { typography, spacing } from "../../lib/theme"
import { getCollectionDetails, getDecksByCollection, getGroupActiveDecks } from "../../lib/db"
import { supabase } from "../../lib/supabase"
import type { Deck } from "../../lib/types"
import { Dimensions } from "react-native"
import { usePostHog } from "posthog-react-native"
import { safeCapture } from "../../lib/posthog"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2 // 2 columns with spacing

export default function CollectionDetail() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const collectionId = params.collectionId as string
  const groupId = params.groupId as string
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const posthog = usePostHog()

  const { data: collection } = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: () => getCollectionDetails(collectionId),
    enabled: !!collectionId,
  })

  const { data: decks = [] } = useQuery({
    queryKey: ["decks", collectionId],
    queryFn: () => getDecksByCollection(collectionId),
    enabled: !!collectionId,
  })

  // Check which decks are already active/voting/rejected/finished for this group
  const { data: groupDecks = [] } = useQuery({
    queryKey: ["groupActiveDecks", groupId],
    queryFn: () => (groupId ? getGroupActiveDecks(groupId) : []),
    enabled: !!groupId,
  })

  const usedDeckIds = new Set(groupDecks.map((gd) => gd.deck_id))
  const availableDecks = decks.filter((d) => !usedDeckIds.has(d.id))

  // Track viewed_collection_detail event
  useEffect(() => {
    if (collection && groupId) {
      safeCapture(posthog, "viewed_collection_detail", {
        collection_id: collectionId,
        collection_name: collection.name,
        group_id: groupId,
      })
    }
  }, [posthog, collection, collectionId, groupId])

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      paddingTop: insets.top + spacing.md,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      alignItems: "center", // Centered
    },
    backButton: {
      position: "absolute",
      top: insets.top + spacing.md,
      left: spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.gray[900],
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    headerContent: {
      alignItems: "center", // Centered
      width: "100%",
    },
    collectionName: {
      ...typography.h1,
      fontSize: 28,
      color: colors.white,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    subtitle: {
      ...typography.body,
      color: colors.gray[400],
      textAlign: "center",
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl * 2,
    },
    decksTitle: {
      ...typography.h3,
      fontSize: 20,
      color: colors.white,
      marginBottom: spacing.md,
    },
    decksGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    deckCard: {
      width: CARD_WIDTH,
      backgroundColor: colors.black,
      borderWidth: 1,
      borderColor: colors.white,
      borderRadius: 0, // Square edges
      padding: spacing.md,
      marginBottom: spacing.md,
      alignItems: "center", // Centered content
      justifyContent: "center",
      minHeight: 180, // Vertical card
    },
    deckIcon: {
      width: 70,
      height: 115,
      borderRadius: 0, // Square edges
      marginBottom: spacing.sm,
      backgroundColor: colors.gray[700],
    },
    deckName: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
      marginBottom: spacing.xs,
      textAlign: "center", // Centered text
    },
    deckDescription: {
      ...typography.caption,
      fontSize: 12,
      color: colors.gray[400],
      textAlign: "center", // Centered text
    },
    chevron: {
      position: "absolute",
      top: spacing.sm,
      right: spacing.sm,
    },
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push(`/(main)/explore-decks?groupId=${groupId}`)}
        >
          <FontAwesome name="arrow-left" size={16} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.collectionName}>{collection?.name || "Collection"}</Text>
          <Text style={styles.subtitle}>Pick a deck. Vote to answer.</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.decksGrid}>
          {decks.map((deck) => {
            const isUsed = usedDeckIds.has(deck.id)
            const groupDeck = groupDecks.find((gd) => gd.deck_id === deck.id)
            
            return (
              <TouchableOpacity
                key={deck.id}
                style={styles.deckCard}
                onPress={() => {
                  if (groupDeck?.status === "voting") {
                    router.push(`/(main)/deck-vote?deckId=${deck.id}&groupId=${groupId}`)
                  } else {
                    router.push(`/(main)/deck-detail?deckId=${deck.id}&groupId=${groupId}`)
                  }
                }}
              >
                <Image
                  source={deck.icon_url ? { uri: deck.icon_url } : require("../../assets/images/deck-icon-default.png")}
                  style={styles.deckIcon}
                  resizeMode="cover"
                />
                <Text style={styles.deckName}>{deck.name}</Text>
                <Text style={styles.deckDescription} numberOfLines={2}>
                  {deck.description || ""}
                </Text>
                {isUsed && groupDeck && (
                  <Text style={{ ...styles.deckDescription, marginTop: spacing.xs, color: colors.gray[500] }}>
                    {groupDeck.status === "voting" && "Voting"}
                    {groupDeck.status === "active" && "Active"}
                    {groupDeck.status === "finished" && "Finished"}
                    {groupDeck.status === "rejected" && "Not interested"}
                  </Text>
                )}
                <FontAwesome
                  name="chevron-right"
                  size={12}
                  color={colors.gray[400]}
                  style={styles.chevron}
                />
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

