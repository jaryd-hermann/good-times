"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
} from "react-native"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../../lib/theme-context"
import { typography, spacing } from "../../lib/theme"
import { getDeckDetails, getDeckQuestions, castVote, getVoteStatus, getUserVote, getGroupMembers, getCollectionDetails, getGroupActiveDecks } from "../../lib/db"
import { supabase } from "../../lib/supabase"
import { Button } from "../../components/Button"
import { usePostHog } from "posthog-react-native"
import { safeCapture } from "../../lib/posthog"

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

export default function DeckVote() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const deckId = params.deckId as string
  const groupId = params.groupId as string
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [userId, setUserId] = useState<string>()
  const [selectedVote, setSelectedVote] = useState<"yes" | "no" | null>(null)
  const [helpModalVisible, setHelpModalVisible] = useState(false)
  const queryClient = useQueryClient()
  const posthog = usePostHog()

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

  const { data: deck } = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => getDeckDetails(deckId),
    enabled: !!deckId,
  })

  // Get collection info
  const { data: collection } = useQuery({
    queryKey: ["collection", deck?.collection_id],
    queryFn: () => (deck?.collection_id ? getCollectionDetails(deck.collection_id) : null),
    enabled: !!deck?.collection_id,
  })

  // Get who requested the vote
  const { data: activeDeck } = useQuery({
    queryKey: ["activeDeck", groupId, deckId],
    queryFn: async () => {
      if (!groupId || !deckId) return null
      const decks = await getGroupActiveDecks(groupId)
      return decks.find((d) => d.deck_id === deckId) || null
    },
    enabled: !!groupId && !!deckId,
  })

  // Get requester name
  const { data: requesterName } = useQuery({
    queryKey: ["requester", activeDeck?.requested_by],
    queryFn: async () => {
      if (!activeDeck?.requested_by) return null
      const { data } = await supabase
        .from("users")
        .select("name")
        .eq("id", activeDeck.requested_by)
        .single()
      return data?.name || null
    },
    enabled: !!activeDeck?.requested_by,
  })

  const { data: questions = [] } = useQuery({
    queryKey: ["deckQuestions", deckId],
    queryFn: () => getDeckQuestions(deckId),
    enabled: !!deckId,
  })

  const { data: voteStatus } = useQuery({
    queryKey: ["voteStatus", groupId, deckId],
    queryFn: () => (groupId && deckId ? getVoteStatus(groupId, deckId) : null),
    enabled: !!groupId && !!deckId,
  })

  const { data: userVote } = useQuery({
    queryKey: ["userVote", groupId, deckId, userId],
    queryFn: () => (groupId && deckId && userId ? getUserVote(groupId, deckId, userId) : null),
    enabled: !!groupId && !!deckId && !!userId,
  })

  // Set selected vote from user's existing vote
  useEffect(() => {
    if (userVote) {
      setSelectedVote(userVote)
    }
  }, [userVote])

  const voteMutation = useMutation({
    mutationFn: async (vote: "yes" | "no") => {
      if (!groupId || !deckId || !userId) throw new Error("Missing required params")
      await castVote(groupId, deckId, userId, vote)
    },
    onSuccess: (_, vote) => {
      // Track cast_deck_vote event
      safeCapture(posthog, "cast_deck_vote", {
        deck_id: deckId,
        deck_name: deck?.name,
        collection_id: deck?.collection_id,
        collection_name: collection?.name,
        group_id: groupId,
        vote: vote,
      })
      
      queryClient.invalidateQueries({ queryKey: ["voteStatus", groupId, deckId] })
      queryClient.invalidateQueries({ queryKey: ["userVote", groupId, deckId, userId] })
      queryClient.invalidateQueries({ queryKey: ["groupActiveDecks", groupId] })
      // Refresh vote status to check if activation happened
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["voteStatus", groupId, deckId] })
      }, 1000)
      // Navigate back to explore page after voting
      router.push(`/(main)/explore-decks?groupId=${groupId}`)
    },
    onError: (error) => {
      console.error("[deck-vote] Error casting vote:", error)
      alert(error instanceof Error ? error.message : "Failed to cast vote")
    },
  })

  const handleVote = async (vote: "yes" | "no") => {
    setSelectedVote(vote)
    voteMutation.mutate(vote)
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingTop: insets.top + spacing.md, // Start on same line as back button
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
      alignItems: "center",
      width: "100%",
      flexDirection: "row", // Row layout for back button alignment
      justifyContent: "center",
    },
    proposerTextContainer: {
      flex: 1,
      alignItems: "center",
      marginLeft: 50, // Offset for back button
      marginRight: 50, // Balance
      width: "85%", // Wider text section
    },
    proposerText: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.xs,
      textAlign: "center",
      width: "80%", // Narrower to align with back button
    },
    deckNameContainer: {
      width: "100%",
      alignItems: "center",
      paddingHorizontal: spacing.xs, // Less padding for wider text
    },
    deckDescriptionContainer: {
      width: "100%",
      alignItems: "center",
      paddingHorizontal: spacing.xs, // Minimal padding for wider description
    },
    deckName: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginBottom: spacing.md, // More space
      textAlign: "center",
      // Allow text to wrap naturally to fit all text
    },
    deckDescription: {
      fontFamily: "Roboto-Regular",
      fontSize: 16, // Match deck-detail
      color: theme2Colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: spacing.lg, // More space
      paddingHorizontal: spacing.xs, // Minimal padding for wider text
      width: "95%", // Wider description
    },
    separator: {
      width: "100%",
      height: 1,
      backgroundColor: theme2Colors.textSecondary,
      marginBottom: spacing.lg,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl * 4, // More padding for scrolling
    },
    voteInfo: {
      backgroundColor: theme2Colors.cream,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      padding: spacing.md,
      marginBottom: spacing.xl,
    },
    voteInfoTitle: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 18,
      color: theme2Colors.text,
      marginBottom: spacing.xs,
    },
    voteInfoText: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.textSecondary,
      lineHeight: 20,
    },
    questionsPreview: {
      marginBottom: spacing.xl,
    },
    questionsTitle: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.textSecondary,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    questionsCarousel: {
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    questionCard: {
      width: SCREEN_WIDTH * 0.85,
      backgroundColor: theme2Colors.cream,
      borderWidth: 2,
      borderColor: theme2Colors.textSecondary,
      borderRadius: 20,
      padding: spacing.lg,
      marginRight: spacing.md,
      minHeight: 200,
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
    voteButtons: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xl,
      paddingHorizontal: spacing.md,
    },
    voteButton: {
      flex: 1,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 0,
    },
    voteButtonSelected: {
      borderWidth: 2,
      borderColor: theme2Colors.text,
    },
    voteButtonYes: {
      backgroundColor: theme2Colors.blue,
    },
    voteButtonNo: {
      backgroundColor: theme2Colors.red,
    },
    voteButtonText: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
    },
    voteButtonTextNo: {
      ...typography.bodyBold,
      fontSize: 18,
      color: theme2Colors.white,
    },
    helpLink: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
    },
    helpLinkText: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      color: theme2Colors.textSecondary,
      textAlign: "center",
      textDecorationLine: "underline",
    },
    helpModalBackdrop: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "flex-end",
    },
    helpModalBackdropOverlay1: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(232, 224, 213, 0.4)",
    },
    helpModalBackdropOverlay2: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.1)",
    },
    helpModalContent: {
      backgroundColor: theme2Colors.beige,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
      padding: spacing.xl,
      paddingBottom: insets.bottom + spacing.xl,
    },
    helpModalTitle: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    helpModalText: {
      fontFamily: "Roboto-Regular",
      fontSize: 16,
      color: theme2Colors.textSecondary,
      lineHeight: 24,
      marginBottom: spacing.xl,
    },
    helpModalButton: {
      backgroundColor: theme2Colors.blue,
      borderRadius: 25,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
    },
    helpModalButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: theme2Colors.white,
    },
    voteStatus: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme2Colors.textSecondary,
    },
    voteStatusText: {
      fontFamily: "Roboto-Regular",
      fontSize: 12,
      color: theme2Colors.textSecondary,
      textAlign: "center",
    },
    currentVote: {
      marginTop: spacing.sm,
      padding: spacing.sm,
      backgroundColor: theme2Colors.cream,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme2Colors.textSecondary,
    },
    currentVoteText: {
      fontFamily: "Roboto-Regular",
      fontSize: 12,
      color: theme2Colors.text,
      textAlign: "center",
    },
  })

  const hasVoted = !!userVote
  const isVoting = voteStatus?.status === "voting"

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <FontAwesome name="angle-left" size={16} color={theme2Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.proposerTextContainer}>
            {requesterName && (
              <Text style={styles.proposerText}>
                {requesterName} proposes these questions to the group.
              </Text>
            )}
            <View style={styles.deckNameContainer}>
              <Text style={styles.deckName}>{deck?.name || "Deck"}</Text>
            </View>
            <View style={styles.deckDescriptionContainer}>
              <Text style={styles.deckDescription}>{deck?.description || ""}</Text>
            </View>
          </View>
        </View>
        <View style={styles.separator} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Questions Preview - Carousel */}
        {questions.length > 0 && (
          <View style={styles.questionsPreview}>
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
                <View key={question.id} style={styles.questionCard}>
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
          </View>
        )}

        {/* Vote Buttons */}
        {isVoting && (
          <View style={styles.voteButtons}>
            <TouchableOpacity
              style={[
                styles.voteButton,
                styles.voteButtonYes,
                selectedVote === "yes" && styles.voteButtonSelected,
              ]}
              onPress={() => handleVote("yes")}
              disabled={voteMutation.isPending}
            >
              <Text style={styles.voteButtonText}>Vote Yes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.voteButton,
                styles.voteButtonNo,
                selectedVote === "no" && styles.voteButtonSelected,
              ]}
              onPress={() => handleVote("no")}
              disabled={voteMutation.isPending}
            >
              <Text style={styles.voteButtonTextNo}>Vote No</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Help Link */}
        {isVoting && (
          <TouchableOpacity
            style={styles.helpLink}
            onPress={() => setHelpModalVisible(true)}
          >
            <Text style={styles.helpLinkText}>How does this work?</Text>
          </TouchableOpacity>
        )}

        {/* Vote Status */}
        {voteStatus && (
          <View style={styles.voteStatus}>
            <Text style={styles.voteStatusText}>
              {voteStatus.yes_votes} yes • {voteStatus.no_votes} no • {voteStatus.total_members} total members
            </Text>
            <Text style={styles.voteStatusText}>
              Need {voteStatus.majority_threshold} yes votes to activate
            </Text>
            {hasVoted && (
              <View style={styles.currentVote}>
                <Text style={styles.currentVoteText}>
                  Your vote: {userVote === "yes" ? "Yes" : "No"}
                </Text>
              </View>
            )}
          </View>
        )}

        {voteStatus?.status === "active" && (
          <View style={styles.voteInfo}>
            <Text style={styles.voteInfoTitle}>✓ Deck activated!</Text>
            <Text style={styles.voteInfoText}>
              This deck has been added to your group's question rotation. Questions will start appearing in your daily prompts.
            </Text>
          </View>
        )}

        {voteStatus?.status === "rejected" && (
          <View style={styles.voteInfo}>
            <Text style={styles.voteInfoTitle}>Deck not added</Text>
            <Text style={styles.voteInfoText}>
              The majority of your group voted no, so this deck won't be added to your question rotation.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Help Modal */}
      <Modal
        transparent
        animationType="slide"
        visible={helpModalVisible}
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.helpModalBackdrop}
          activeOpacity={1}
          onPress={() => setHelpModalVisible(false)}
        >
          <View style={styles.helpModalBackdropOverlay1} />
          <View style={styles.helpModalBackdropOverlay2} />
          <View
            style={styles.helpModalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.helpModalTitle}>How does this work?</Text>
            <Text style={styles.helpModalText}>
              If the majority of your group votes yes, this deck will be added to your daily question rotation. One question from this deck will be included each week.
            </Text>
            <TouchableOpacity
              onPress={() => setHelpModalVisible(false)}
              style={styles.helpModalButton}
            >
              <Text style={styles.helpModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

