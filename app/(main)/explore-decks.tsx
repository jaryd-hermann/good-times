"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  Animated,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../../lib/theme-context"
import { typography, spacing } from "../../lib/theme"
import { getCollections, getGroupActiveDecks, getDeckQuestionsLeftCount, getDecksByCollection, getCurrentUser, getVoteStatus } from "../../lib/db"
import { supabase } from "../../lib/supabase"
import { useTabBar } from "../../lib/tab-bar-context"
import type { Collection, GroupActiveDeck } from "../../lib/types"
import { usePostHog } from "posthog-react-native"
import { safeCapture } from "../../lib/posthog"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2 // 2 columns with spacing

export default function ExploreDecks() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()
  const [helpModalVisible, setHelpModalVisible] = useState(false)
  const scrollY = useRef(new Animated.Value(0)).current
  const headerTranslateY = useRef(new Animated.Value(0)).current
  const contentPaddingTop = useRef(new Animated.Value(0)).current
  const lastScrollY = useRef(0)
  const { opacity: tabBarOpacity } = useTabBar()
  const posthog = usePostHog()

  // Track loaded_explore_decks event
  useEffect(() => {
    if (currentGroupId) {
      safeCapture(posthog, "loaded_explore_decks", {
        group_id: currentGroupId,
      })
    }
  }, [posthog, currentGroupId])

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        // Get user's groups and use first one (or from params)
        const { getUserGroups } = await import("../../lib/db")
        const groups = await getUserGroups(user.id)
        if (groups.length > 0) {
          setCurrentGroupId(params.groupId as string || groups[0].id)
        }
      }
    }
    loadUser()
  }, [params.groupId])

  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: getCollections,
  })

  const { data: activeDecks = [] } = useQuery({
    queryKey: ["groupActiveDecks", currentGroupId],
    queryFn: () => (currentGroupId ? getGroupActiveDecks(currentGroupId) : []),
    enabled: !!currentGroupId,
  })

  // Get deck counts for each collection
  const { data: collectionDeckCounts = {} } = useQuery({
    queryKey: ["collectionDeckCounts", collections.map(c => c.id).join(","), currentGroupId],
    queryFn: async () => {
      const counts: Record<string, number> = {}
      for (const collection of collections) {
        const decks = await getDecksByCollection(collection.id)
        // Count decks that are not active/rejected/finished for this group
        if (currentGroupId) {
          const { data: groupDecks } = await supabase
            .from("group_active_decks")
            .select("deck_id")
            .eq("group_id", currentGroupId)
            .in("status", ["active", "rejected", "finished"])
          
          const usedDeckIds = new Set((groupDecks || []).map((gd: any) => gd.deck_id))
          const unusedDecks = decks.filter(d => !usedDeckIds.has(d.id))
          counts[collection.id] = unusedDecks.length
        } else {
          counts[collection.id] = decks.length
        }
      }
      return counts
    },
    enabled: collections.length > 0,
  })

  // Get questions left count for each active deck
  const { data: deckQuestionsLeft = {} } = useQuery({
    queryKey: ["deckQuestionsLeft", currentGroupId, activeDecks.map(d => d.deck_id).join(",")],
    queryFn: async () => {
      if (!currentGroupId || activeDecks.length === 0) return {}
      const counts: Record<string, number> = {}
      for (const deck of activeDecks) {
        if (deck.status === "active") {
          const count = await getDeckQuestionsLeftCount(currentGroupId, deck.deck_id)
          counts[deck.deck_id] = count
        }
      }
      return counts
    },
    enabled: !!currentGroupId && activeDecks.length > 0,
  })

  // Get vote status for voting decks to show counts
  const { data: voteStatuses = {} } = useQuery({
    queryKey: ["voteStatuses", currentGroupId, activeDecks.filter(d => d.status === "voting").map(d => d.deck_id).join(",")],
    queryFn: async () => {
      if (!currentGroupId) return {}
      const statuses: Record<string, { yes_votes: number; no_votes: number }> = {}
      for (const deck of activeDecks) {
        if (deck.status === "voting") {
          try {
            const status = await getVoteStatus(currentGroupId, deck.deck_id)
            statuses[deck.deck_id] = {
              yes_votes: status.yes_votes,
              no_votes: status.no_votes,
            }
          } catch (error) {
            console.warn(`[explore-decks] Error getting vote status for deck ${deck.deck_id}:`, error)
          }
        }
      }
      return statuses
    },
    enabled: !!currentGroupId && activeDecks.some(d => d.status === "voting"),
  })

  // Sort active decks: voting -> active -> finished -> rejected
  // Filter to show all statuses (voting, active, finished, rejected)
  const sortedActiveDecks = [...(activeDecks || [])].sort((a, b) => {
    const order = { voting: 0, active: 1, finished: 2, rejected: 3 }
    return (order[a.status] || 99) - (order[b.status] || 99)
  })

  // Calculate header height
  // Header structure:
  // - insets.top + spacing.md (paddingTop from Animated.View inline style)
  // - spacing.sm (paddingTop from styles.header)
  // - 32px (title fontSize)
  // - spacing.md (title marginBottom)
  // - ~50px (subtitle height - estimated for 2-3 lines with lineHeight ~20px)
  // - spacing.lg (subtitle marginBottom)
  // - spacing.lg (header paddingBottom)
  // - spacing.lg (extra padding after header divider)
  const headerHeight = useMemo(() => {
    return insets.top + spacing.md + spacing.sm + 32 + spacing.md + 50 + spacing.lg + spacing.lg + spacing.lg
  }, [insets.top])

  useEffect(() => {
    // Set initial padding to header height
    const initialPadding = headerHeight
    contentPaddingTop.setValue(initialPadding)
  }, [headerHeight])

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false, // Need false for paddingTop animation
    listener: (event: any) => {
      const currentScrollY = event.nativeEvent.contentOffset.y
      const scrollDiff = currentScrollY - lastScrollY.current
      lastScrollY.current = currentScrollY

      if (scrollDiff > 5 && currentScrollY > 50) {
        // Scrolling down - hide header and reduce padding, fade tab bar
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: -(headerHeight + 100),
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(contentPaddingTop, {
            toValue: spacing.md,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(tabBarOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start()
      } else if (scrollDiff < -5) {
        // Scrolling up - show header and restore padding, show tab bar
        Animated.parallel([
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(contentPaddingTop, {
            toValue: headerHeight,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(tabBarOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start()
      }
    },
  })

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg, // More padding at bottom
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.gray[800] : "#000000",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.black,
      zIndex: 10,
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      justifyContent: "flex-end",
      alignItems: "center", // Center align icon with title
    },
    title: {
      ...typography.h1,
      fontSize: 32,
      color: colors.white,
      marginBottom: spacing.md, // More padding below title
    },
    subtitle: {
      ...typography.body,
      color: colors.gray[400],
      marginBottom: spacing.lg, // More padding below description
      textAlign: "left", // Align left like title
    },
    helpButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.gray[800],
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      flex: 1,
      // No marginTop - header will overlay content when visible
    },
    contentContainer: {
      paddingTop: spacing.lg, // Extra padding after header divider (in addition to animated paddingTop)
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl * 2,
    },
    carouselSection: {
      marginBottom: spacing.xxl + spacing.lg, // More padding before Collections
    },
    carouselTitle: {
      fontFamily: "Roboto-Bold",
      fontSize: 16,
      color: "#C7C7C7",
      marginBottom: spacing.md,
      fontWeight: "700",
    },
    carousel: {
      flexDirection: "row",
    },
    deckCard: {
      width: CARD_WIDTH, // Match collection card width
      marginRight: spacing.md,
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.md,
      alignItems: "center", // Center content
      borderWidth: 1,
      borderColor: colors.white,
    },
    deckCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between", // Space between badge and chevron
      alignItems: "flex-start",
      marginBottom: spacing.sm,
      width: "100%",
      position: "relative",
    },
    statusBadgeContainer: {
      flex: 1,
      alignItems: "center", // Center the badge
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      borderWidth: 1,
    },
    statusBadgeVoting: {
      borderColor: colors.accent,
    },
    statusBadgeActive: {
      borderColor: "#4CAF50", // Green
    },
    statusBadgeFinished: {
      borderColor: colors.gray[600],
    },
    statusBadgeRejected: {
      borderColor: colors.gray[600],
    },
    statusText: {
      ...typography.caption,
      fontSize: 10,
      color: colors.white,
    },
    deckIcon: {
      width: 70,
      height: 115,
      borderRadius: 8,
      marginBottom: spacing.sm,
      backgroundColor: colors.gray[700],
      alignSelf: "center", // Center icon
    },
    deckName: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
      marginBottom: spacing.xs,
      textAlign: "center", // Center deck name
    },
    deckStats: {
      ...typography.caption,
      fontSize: 12,
      color: colors.gray[300],
    },
    collectionsTitle: {
      fontFamily: "Roboto-Bold",
      fontSize: 16,
      color: "#C7C7C7",
      marginBottom: spacing.md,
      fontWeight: "700",
    },
    collectionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      paddingBottom: spacing.xxl * 2,
    },
    collectionCard: {
      width: CARD_WIDTH,
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    collectionIcon: {
      width: 70,
      height: 115,
      borderRadius: 8,
      marginBottom: spacing.sm,
      backgroundColor: colors.gray[700],
    },
    collectionName: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
      marginBottom: spacing.xs,
    },
    collectionDescription: {
      ...typography.caption,
      fontSize: 12,
      color: colors.gray[400],
      marginBottom: spacing.sm,
    },
    collectionDecksCount: {
      ...typography.caption,
      fontSize: 12,
      color: colors.gray[300],
    },
    chevron: {
      position: "absolute",
      top: spacing.sm,
      right: spacing.sm,
    },
    // Modal styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.black,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      paddingBottom: insets.bottom + spacing.lg,
    },
    modalTitle: {
      ...typography.h2,
      fontSize: 24,
      color: colors.white,
      marginBottom: spacing.md,
    },
    modalText: {
      ...typography.body,
      color: colors.gray[300],
      lineHeight: 24,
      marginBottom: spacing.lg,
    },
    modalButton: {
      marginTop: spacing.md,
    },
  })

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md },
          {
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Question Decks</Text>
          <Text style={styles.subtitle}>Explore collections and intentional question decks to add for your group.</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setHelpModalVisible(true)}
          >
            <FontAwesome name="question-circle" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Content */}
      <Animated.ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: contentPaddingTop,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Your decks carousel */}
        {sortedActiveDecks.length > 0 && (
          <View style={styles.carouselSection}>
            <Text style={styles.carouselTitle}>Your decks</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}>
              {sortedActiveDecks.map((deck) => {
                const questionsLeft = deckQuestionsLeft[deck.deck_id] || 0
                const isFinished = deck.status === "finished" || questionsLeft === 0
                
                return (
                  <TouchableOpacity
                    key={deck.id}
                    style={styles.deckCard}
                    onPress={() => {
                      if (deck.status === "voting") {
                        router.push(`/(main)/deck-vote?deckId=${deck.deck_id}&groupId=${currentGroupId}`)
                      } else {
                        router.push(`/(main)/deck-detail?deckId=${deck.deck_id}&groupId=${currentGroupId}`)
                      }
                    }}
                  >
                    <View style={styles.deckCardHeader}>
                      <View style={styles.statusBadgeContainer}>
                        <View
                          style={[
                            styles.statusBadge,
                            deck.status === "voting" && styles.statusBadgeVoting,
                            deck.status === "active" && styles.statusBadgeActive,
                            deck.status === "finished" && styles.statusBadgeFinished,
                            deck.status === "rejected" && styles.statusBadgeRejected,
                          ]}
                        >
                          <Text style={styles.statusText}>
                            {deck.status === "voting" && "Voting"}
                            {deck.status === "active" && "Live"}
                            {deck.status === "finished" && "Deck finished"}
                            {deck.status === "rejected" && "Verdict: Not interested"}
                          </Text>
                        </View>
                      </View>
                      <FontAwesome 
                        name="chevron-right" 
                        size={12} 
                        color={colors.gray[400]}
                        style={{ position: "absolute", top: 0, right: 0 }}
                      />
                    </View>
                    
                    <Image
                      source={deck.deck?.icon_url ? { uri: deck.deck.icon_url } : require("../../assets/images/deck-icon-default.png")}
                      style={styles.deckIcon}
                      resizeMode="cover"
                    />
                    
                    <Text style={styles.deckName}>{deck.deck?.name || "Unknown Deck"}</Text>
                    
                    {/* Stats - only show for voting (with vote counts) or active (with questions left) or finished */}
                    {deck.status === "voting" && voteStatuses[deck.deck_id] && (
                      <Text style={styles.deckStats}>
                        {voteStatuses[deck.deck_id].yes_votes} Yes • {voteStatuses[deck.deck_id].no_votes} No
                      </Text>
                    )}
                    {deck.status === "active" && !isFinished && (
                      <Text style={styles.deckStats}>
                        {questionsLeft} questions left
                      </Text>
                    )}
                    {deck.status === "finished" && (
                      <Text style={styles.deckStats}>All questions answered</Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        )}

        {/* Collections grid */}
        <Text style={styles.collectionsTitle}>Collections</Text>
        <View style={styles.collectionsGrid}>
          {collections.map((collection) => (
            <TouchableOpacity
              key={collection.id}
              style={styles.collectionCard}
              onPress={() => router.push(`/(main)/collection-detail?collectionId=${collection.id}&groupId=${currentGroupId}`)}
            >
              {collection.icon_url && (
                <Image
                  source={{ uri: collection.icon_url }}
                  style={styles.collectionIcon}
                  resizeMode="cover"
                />
              )}
              <Text style={styles.collectionName}>{collection.name}</Text>
              <Text style={styles.collectionDescription} numberOfLines={2}>
                {collection.description || ""}
              </Text>
              <Text style={styles.collectionDecksCount}>
                {collectionDeckCounts[collection.id] || 0} unused {collectionDeckCounts[collection.id] === 1 ? 'deck' : 'decks'}
              </Text>
              <FontAwesome
                name="chevron-right"
                size={12}
                color={colors.gray[400]}
                style={styles.chevron}
              />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.ScrollView>

      {/* Help Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={helpModalVisible}
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setHelpModalVisible(false)}
        >
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Question Decks</Text>
            <Text style={styles.modalText}>
              Question decks are curated collections of questions that your group can vote to add to your daily question rotation.{"\n\n"}
              When a deck is activated, one question from that deck will be included each week alongside your regular questions.{"\n\n"}
              You can have up to 3 active decks at a time. Once all questions in a deck have been asked, it will be marked as finished and no longer count toward your limit.
            </Text>
            <TouchableOpacity
              onPress={() => setHelpModalVisible(false)}
              style={styles.modalButton}
            >
              <Text style={{ ...typography.bodyBold, color: colors.white }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

