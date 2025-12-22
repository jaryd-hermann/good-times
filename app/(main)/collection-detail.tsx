"use client"

import { useState, useEffect, useMemo } from "react"
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

// Theme 2 color palette matching new design system
// Theme 2 color palette - will be made dynamic in component

// Helper function to get deck image source based on deck name
function getDeckImageSource(deckName: string | undefined, iconUrl: string | undefined) {
  if (!deckName) {
    // Use icon-daily as default fallback
    return require("../../assets/images/icon-daily.png")
  }
  
  const nameLower = deckName.toLowerCase()
  
  if (nameLower.includes("everyday reflections") || nameLower.includes("reflections")) {
    return require("../../assets/images/icon-reflections.png")
  }
  
  if (nameLower.includes("past & present") || nameLower.includes("past and present")) {
    return require("../../assets/images/icon-past.png")
  }
  
  if (nameLower.includes("relationships and connection") || nameLower.includes("relationships")) {
    return require("../../assets/images/icon-relationships.png")
  }
  
  // Real life routine collection
  if (nameLower.includes("right now")) {
    return require("../../assets/images/icon-rightnow.png")
  }
  
  if (nameLower.includes("home") && !nameLower.includes("homemade") && !nameLower.includes("homework")) {
    return require("../../assets/images/icon-home.png")
  }
  
  if (nameLower.includes("daily joys")) {
    return require("../../assets/images/icon-daily.png")
  }
  
  // Raw truths collection
  if (nameLower.includes("mayhem")) {
    return require("../../assets/images/icon-mayhem.png")
  }
  
  if (nameLower.includes("hot takes only") || nameLower.includes("hot takes")) {
    return require("../../assets/images/icon-hottakes.png")
  }
  
  if (nameLower.includes("night out energy") || nameLower.includes("night out")) {
    return require("../../assets/images/icon-nightout.png")
  }
  
  // Nostalgia collection
  if (nameLower.includes("old photos")) {
    return require("../../assets/images/icon-oldphotos.png")
  }
  
  if (nameLower.includes("childhood")) {
    return require("../../assets/images/icon-childhood.png")
  }
  
  if (nameLower.includes("milestones")) {
    return require("../../assets/images/icon-milestones.png")
  }
  
  // Memorial collection
  if (nameLower.includes("shared memories")) {
    return require("../../assets/images/icon-sharedmemories.png")
  }
  
  if (nameLower.includes("their legacy") || nameLower.includes("legacy")) {
    return require("../../assets/images/icon-legacy.png")
  }
  
  // Mindset & Growth collection
  if (nameLower.includes("little lessons")) {
    return require("../../assets/images/icon-littlelessons.png")
  }
  
  if (nameLower.includes("personal philosophies")) {
    return require("../../assets/images/icon-lifephilosophies.png")
  }
  
  // Fallback to icon_url if available, otherwise default
  if (iconUrl) {
    return { uri: iconUrl }
  }
  
  // Use icon-daily as default fallback
  return require("../../assets/images/icon-daily.png")
}

export default function CollectionDetail() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const collectionId = params.collectionId as string
  const groupId = params.groupId as string
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const posthog = usePostHog()
  
  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      // Dark mode colors
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000", // Black (was beige) - page background
        cream: "#000000", // Black (was cream) - for card backgrounds
        white: "#E8E0D5", // Beige (was white)
        text: "#F5F0EA", // Cream (was black) - text color
        textSecondary: "#A0A0A0", // Light gray (was dark gray)
      }
    } else {
      // Light mode colors (current/default)
      return {
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
    }
  }, [isDark])

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

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingTop: insets.top + spacing.md,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
      alignItems: "center",
      backgroundColor: theme2Colors.beige,
    },
    backButton: {
      position: "absolute",
      top: insets.top + spacing.md,
      left: spacing.md,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.white,
      borderWidth: 1,
      borderColor: theme2Colors.text,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    headerContent: {
      alignItems: "center",
      width: "100%",
    },
    collectionName: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    subtitle: {
      fontFamily: "Roboto-Regular",
      fontSize: 16,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl * 2,
    },
    decksTitle: {
      fontFamily: "Roboto-Bold",
      fontSize: 20,
      color: theme2Colors.text,
      marginBottom: spacing.md,
      fontWeight: "700",
    },
    decksGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    deckCard: {
      width: CARD_WIDTH,
      backgroundColor: theme2Colors.cream,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      borderRadius: 20,
      marginBottom: spacing.md,
      alignItems: "stretch",
      overflow: "hidden",
    },
    deckIcon: {
      width: CARD_WIDTH,
      height: CARD_WIDTH,
      borderRadius: 0, // Keep square for image
      backgroundColor: theme2Colors.textSecondary,
    },
    deckCardContent: {
      padding: spacing.md,
      paddingBottom: spacing.lg,
      alignItems: "center",
      position: "relative",
      minHeight: 80,
      justifyContent: "flex-start",
    },
    deckName: {
      fontFamily: "Roboto-Bold",
      fontSize: 16,
      color: theme2Colors.text,
      textAlign: "center",
      fontWeight: "600",
    },
    deckDescription: {
      fontFamily: "Roboto-Regular",
      fontSize: 12,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
    chevron: {
      position: "absolute",
      bottom: spacing.md,
      right: spacing.md,
    },
  }), [colors, isDark, theme2Colors])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push(`/(main)/explore-decks?groupId=${groupId}`)}
        >
          <FontAwesome name="angle-left" size={16} color={theme2Colors.text} />
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
                  source={getDeckImageSource(deck.name, deck.icon_url)}
                  style={styles.deckIcon}
                  resizeMode="cover"
                />
                <View style={styles.deckCardContent}>
                  <Text style={styles.deckName}>{deck.name}</Text>
                  <FontAwesome
                    name="chevron-right"
                    size={12}
                    color={theme2Colors.textSecondary}
                    style={styles.chevron}
                  />
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

