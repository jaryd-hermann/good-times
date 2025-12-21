"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../../lib/theme-context"
import { typography, spacing } from "../../lib/theme"
import { getDeckDetails, getDeckQuestions, requestDeckVote, getVoteStatus, getUserVote, getCurrentUser, getCollectionDetails, castVote } from "../../lib/db"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/Button"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { usePostHog } from "posthog-react-native"
import { safeCapture } from "../../lib/posthog"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const QUESTION_CARD_WIDTH = SCREEN_WIDTH - spacing.md * 2

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

export default function DeckDetail() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const deckId = params.deckId as string
  const groupId = params.groupId as string
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [userId, setUserId] = useState<string>()
  const [voteModalVisible, setVoteModalVisible] = useState(false)
  const [requestingVote, setRequestingVote] = useState(false)
  const [devOverrideMemberLimit, setDevOverrideMemberLimit] = useState(false)
  const queryClient = useQueryClient()
  const posthog = usePostHog()

  // Track viewed_deck_detail event
  useEffect(() => {
    if (deck && groupId) {
      safeCapture(posthog, "viewed_deck_detail", {
        deck_id: deckId,
        deck_name: deck.name,
        collection_id: deck.collection_id,
        collection_name: collection?.name,
        group_id: groupId,
      })
    }
  }, [posthog, deck, deckId, groupId, collection])

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

    // Load dev override setting
    if (__DEV__) {
      async function loadDevSettings() {
        const override = await AsyncStorage.getItem("dev_override_deck_member_limit")
        setDevOverrideMemberLimit(override === "true")
      }
      loadDevSettings()
    }
  }, [])

  const { data: deck } = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => getDeckDetails(deckId),
    enabled: !!deckId,
  })

  // Get collection info for the deck
  const { data: collection } = useQuery({
    queryKey: ["collection", deck?.collection_id],
    queryFn: () => (deck?.collection_id ? getCollectionDetails(deck.collection_id) : null),
    enabled: !!deck?.collection_id,
  })

  const { data: questions = [] } = useQuery({
    queryKey: ["deckQuestions", deckId],
    queryFn: () => getDeckQuestions(deckId),
    enabled: !!deckId,
  })

  // Check if deck is already being voted on or active
  const { data: voteStatus } = useQuery({
    queryKey: ["voteStatus", groupId, deckId],
    queryFn: () => (groupId && deckId ? getVoteStatus(groupId, deckId) : null),
    enabled: !!groupId && !!deckId,
    retry: 1, // Reduce retries to avoid timeout
    staleTime: 30000, // Cache for 30 seconds
  })

  const { data: userVote } = useQuery({
    queryKey: ["userVote", groupId, deckId, userId],
    queryFn: () => (groupId && deckId && userId ? getUserVote(groupId, deckId, userId) : null),
    enabled: !!groupId && !!deckId && !!userId,
  })

  const requestVoteMutation = useMutation({
    mutationFn: async () => {
      if (!groupId || !deckId || !userId) throw new Error("Missing required params")
      await requestDeckVote(groupId, deckId, userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voteStatus", groupId, deckId] })
      queryClient.invalidateQueries({ queryKey: ["groupActiveDecks", groupId] })
      setVoteModalVisible(false)
      router.back()
    },
    onError: (error) => {
      console.error("[deck-detail] Error requesting vote:", error)
      alert(error instanceof Error ? error.message : "Failed to request vote")
    },
  })

  const handleRequestVote = async () => {
    if (!groupId || !deckId || !userId) {
      alert("Missing required information")
      return
    }

    // Check if group has 3+ members (unless dev override is enabled)
    if (!__DEV__ || !devOverrideMemberLimit) {
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)

      if (!members || members.length < 3) {
        alert("Your group needs at least 3 members to vote on decks")
        return
      }
    }

    setRequestingVote(true)
    try {
      await requestDeckVote(groupId, deckId, userId, __DEV__ && devOverrideMemberLimit)
      
      // Track requested_deck_vote event
      safeCapture(posthog, "requested_deck_vote", {
        deck_id: deckId,
        deck_name: deck?.name,
        collection_id: deck?.collection_id,
        collection_name: collection?.name,
        group_id: groupId,
      })
      
      setVoteModalVisible(false)
      queryClient.invalidateQueries({ queryKey: ["voteStatus", groupId, deckId] })
      queryClient.invalidateQueries({ queryKey: ["groupActiveDecks", groupId] })
      router.back()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to request vote")
    } finally {
      setRequestingVote(false)
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingTop: insets.top + spacing.md + 50, // Move content down to avoid back button
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      alignItems: "center", // Centered content
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
      alignItems: "center", // Centered
      width: "100%",
    },
    collectionName: {
      fontFamily: "Roboto-Bold",
      fontSize: 16,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.md,
      fontWeight: "700",
    },
    deckName: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    deckDescription: {
      fontFamily: "Roboto-Regular",
      fontSize: 16,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    separator: {
      width: "100%",
      height: 1,
      backgroundColor: theme2Colors.textSecondary,
      marginBottom: spacing.lg,
    },
    content: {
      flex: 1,
      paddingBottom: spacing.xxl * 2,
    },
    questionsTitle: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      textAlign: "center",
    },
    questionsCarousel: {
      paddingHorizontal: spacing.md,
    },
    questionCard: {
      width: SCREEN_WIDTH * 0.85,
      backgroundColor: theme2Colors.cream,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      borderRadius: 20,
      padding: spacing.lg,
      marginRight: spacing.md,
      opacity: 1,
      minHeight: 200,
    },
    questionCardFaded: {
      opacity: 0.3,
    },
    carouselMessage: {
      width: SCREEN_WIDTH * 0.85,
      backgroundColor: theme2Colors.beige,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      borderRadius: 20,
      padding: spacing.lg,
      marginRight: spacing.md,
      justifyContent: "center",
      alignItems: "center",
      minHeight: 200,
    },
    carouselMessageText: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    questionNumber: {
      position: "absolute",
      top: spacing.md,
      right: spacing.md,
      fontFamily: "Roboto-Bold",
      fontSize: 16,
      color: theme2Colors.textSecondary,
      fontWeight: "700",
    },
    questionText: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 22,
      color: theme2Colors.text,
      lineHeight: 28,
      marginTop: spacing.md,
    },
    ctaContainer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      alignItems: "center",
    },
    ctaSubtext: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    voteStatusContainer: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: theme2Colors.cream,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      marginBottom: spacing.md,
      marginHorizontal: spacing.md,
    },
    voteStatusText: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.text,
      marginBottom: spacing.xs,
    },
    voteStatusSubtext: {
      fontFamily: "Roboto-Regular",
      fontSize: 12,
      color: theme2Colors.textSecondary,
    },
    activeStatusContainer: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: theme2Colors.cream,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      marginBottom: spacing.md,
      marginHorizontal: spacing.md,
    },
    activeStatusText: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 18,
      color: theme2Colors.text,
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    activeStatusSubtext: {
      fontFamily: "Roboto-Regular",
      fontSize: 12,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
    // Modal styles (bottom slide-up)
    modalBackdrop: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "flex-end",
    },
    modalBackdropOverlay1: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(232, 224, 213, 0.4)",
    },
    modalBackdropOverlay2: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.1)",
    },
    modalContent: {
      backgroundColor: theme2Colors.beige,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      padding: spacing.xl,
      paddingBottom: insets.bottom + spacing.xl,
    },
    modalTitle: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    modalText: {
      fontFamily: "Roboto-Regular",
      fontSize: 16,
      color: theme2Colors.textSecondary,
      lineHeight: 24,
      marginBottom: spacing.xl,
      textAlign: "center",
    },
    modalButton: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      marginTop: spacing.md,
    },
    modalButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.white,
    },
    modalCancelButton: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
    },
    modalCancelButtonText: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
  })

  // Show CTA if no vote status, rejected, or if voting hasn't started yet (no votes cast)
  const showVoteCTA = !voteStatus || voteStatus.status === "rejected" || (voteStatus.status === "voting" && voteStatus.yes_votes === 0 && voteStatus.no_votes === 0)
  const isVoting = voteStatus?.status === "voting" && (voteStatus.yes_votes > 0 || voteStatus.no_votes > 0) // Only show if vote actually started
  const isActive = voteStatus?.status === "active"
  const isFinished = voteStatus?.status === "finished"

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Navigate back to collection detail if we have collection_id
            if (collection?.id) {
              router.push(`/(main)/collection-detail?collectionId=${collection.id}&groupId=${groupId}`)
            } else {
              router.back()
            }
          }}
        >
          <FontAwesome name="angle-left" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          {collection && (
            <Text style={styles.collectionName}>{collection.name}</Text>
          )}
          <Text style={styles.deckName}>{deck?.name || "Deck"}</Text>
          <Text style={styles.deckDescription}>{deck?.description || ""}</Text>
        </View>
        <View style={styles.separator} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vote Status Banner - Only show if vote is actually active (has votes) */}
        {isVoting && voteStatus && voteStatus.yes_votes + voteStatus.no_votes > 0 && (
          <View style={styles.voteStatusContainer}>
            <Text style={styles.voteStatusText}>
              Voting in progress: {voteStatus.yes_votes} yes, {voteStatus.no_votes} no
            </Text>
            <Text style={styles.voteStatusSubtext}>
              {voteStatus.yes_votes >= voteStatus.majority_threshold
                ? "Majority reached! Deck will be activated."
                : `Need ${voteStatus.majority_threshold - voteStatus.yes_votes} more yes votes`}
            </Text>
          </View>
        )}

        {isActive && (
          <View style={styles.activeStatusContainer}>
            <Text style={styles.activeStatusText}>This deck is active</Text>
            <Text style={styles.activeStatusSubtext}>
              Questions from this deck are being included in your daily rotation
            </Text>
          </View>
        )}

        {isFinished && (
          <View style={styles.voteStatusContainer}>
            <Text style={styles.voteStatusText}>Deck finished</Text>
            <Text style={styles.voteStatusSubtext}>
              All questions from this deck have been asked
            </Text>
          </View>
        )}

        {/* Questions Carousel */}
        <Text style={styles.questionsTitle}>
          {questions.length} {questions.length === 1 ? 'question' : 'questions'} in this deck
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.questionsCarousel}
          contentContainerStyle={{ 
            paddingRight: (SCREEN_WIDTH * 0.85 + spacing.md) * 1.15, // Limit to 15% into card 2
            paddingLeft: 0,
          }}
          scrollEnabled={true}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH * 0.85 + spacing.md}
          snapToAlignment="start"
          bounces={false}
          scrollEventThrottle={16}
        >
          {questions.slice(0, 2).map((question, index) => (
            <View
              key={question.id}
              style={styles.questionCard}
            >
              <Text style={styles.questionNumber}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Text style={styles.questionText}>{question.question}</Text>
            </View>
          ))}
          {/* Message card after 2nd question */}
          <View style={styles.carouselMessage}>
            <Text style={styles.carouselMessageText}>
              To see the rest of the questions, add this deck for your group
            </Text>
          </View>
        </ScrollView>

        {/* CTA Button */}
        {showVoteCTA && (
          <View style={styles.ctaContainer}>
            <TouchableOpacity
              style={{
                backgroundColor: theme2Colors.blue,
                borderRadius: 25,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 56,
                width: "100%",
              }}
              onPress={() => setVoteModalVisible(true)}
              disabled={requestingVote}
            >
              <Text style={{ ...typography.bodyBold, fontSize: 16, color: theme2Colors.white }}>
                {requestingVote ? "Loading..." : "Add this deck →"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.ctaSubtext}>
              If the majority vote yes, we'll shuffle this deck of questions into your list.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Vote Request Modal - Bottom Slide Up */}
      <Modal
        transparent
        animationType="slide"
        visible={voteModalVisible}
        onRequestClose={() => setVoteModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setVoteModalVisible(false)}
        >
          <View style={styles.modalBackdropOverlay1} />
          <View style={styles.modalBackdropOverlay2} />
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Great choice!</Text>
            <Text style={styles.modalText}>
              We'll ask your group if they're interested in this deck, and if the majority vote yes, we'll shuffle these into your upcoming days. We'll let you know too.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={async () => {
                if (!groupId || !deckId || !userId) {
                  alert("Missing required information")
                  return
                }

                // Check if group has 3+ members (unless dev override is enabled)
                if (!__DEV__ || !devOverrideMemberLimit) {
                  const { data: members } = await supabase
                    .from("group_members")
                    .select("user_id")
                    .eq("group_id", groupId)

                  if (!members || members.length < 3) {
                    alert("Your group needs at least 3 members to vote on decks")
                    return
                  }
                }
                
                setRequestingVote(true)
                try {
                  // Request vote (this creates the voting record)
                  await requestDeckVote(groupId, deckId, userId, __DEV__ && devOverrideMemberLimit)
                  
                  // Cast the requester's vote as yes
                  await castVote(groupId, deckId, userId, "yes")
                  
                  // Track requested_deck_vote event
                  safeCapture(posthog, "requested_deck_vote", {
                    deck_id: deckId,
                    deck_name: deck?.name,
                    collection_id: deck?.collection_id,
                    collection_name: collection?.name,
                    group_id: groupId,
                  })
                  
                  // Close modal and navigate to explore
                  setVoteModalVisible(false)
                  queryClient.invalidateQueries({ queryKey: ["voteStatus", groupId, deckId] })
                  queryClient.invalidateQueries({ queryKey: ["groupActiveDecks", groupId] })
                  queryClient.invalidateQueries({ queryKey: ["pendingVotes", groupId, userId] })
                  router.push(`/(main)/explore-decks?groupId=${groupId}`)
                } catch (error) {
                  alert(error instanceof Error ? error.message : "Failed to start vote")
                } finally {
                  setRequestingVote(false)
                }
              }}
              disabled={requestingVote}
            >
              <Text style={styles.modalButtonText}>
                {requestingVote ? "Loading..." : "Vote yes to start"}
              </Text>
            </TouchableOpacity>
            {__DEV__ && (
              <TouchableOpacity
                onPress={async () => {
                  const currentValue = await AsyncStorage.getItem("dev_override_deck_member_limit")
                  const newValue = currentValue === "true" ? "false" : "true"
                  await AsyncStorage.setItem("dev_override_deck_member_limit", newValue)
                  setDevOverrideMemberLimit(newValue === "true")
                  alert(`Dev override: ${newValue === "true" ? "ENABLED" : "DISABLED"}\n\n3-member limit ${newValue === "true" ? "bypassed" : "enforced"}`)
                }}
                style={{ marginTop: spacing.md, padding: spacing.sm }}
              >
                <Text style={{ fontFamily: "Roboto-Regular", fontSize: 10, color: theme2Colors.textSecondary, textAlign: "center" }}>
                  [DEV] Override 3-member limit: {devOverrideMemberLimit ? "ON" : "OFF"}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setVoteModalVisible(false)}
              style={styles.modalCancelButton}
            >
              <Text style={styles.modalCancelButtonText}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

