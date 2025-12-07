"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
  PanResponder,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../../lib/supabase"
import { colors, spacing, typography } from "../../lib/theme"
import { Button } from "../../components/Button"
import { getSwipeableQuestionsForGroup, recordSwipe, getSwipingParticipants } from "../../lib/db"
import { usePostHog } from "posthog-react-native"
import { safeCapture } from "../../lib/posthog"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const SWIPE_ONBOARDING_KEY_PREFIX = "has_completed_swipe_onboarding"

// Helper function to get user+group-specific onboarding key
function getSwipeOnboardingKey(userId: string, groupId: string): string {
  return `${SWIPE_ONBOARDING_KEY_PREFIX}_${userId}_${groupId}`
}

export default function SwipeOnboarding() {
  console.log("[swipe-onboarding] Component mounted/re-rendered")
  const router = useRouter()
  const params = useLocalSearchParams()
  console.log("[swipe-onboarding] Initial params:", params)
  const insets = useSafeAreaInsets()
  const posthog = usePostHog()
  const queryClient = useQueryClient()
  
  const [userId, setUserId] = useState<string>()
  const [groupId, setGroupId] = useState<string>()
  const [isChecking, setIsChecking] = useState(true)
  const [shouldShow, setShouldShow] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [yesSwipeCount, setYesSwipeCount] = useState(0)
  const yesSwipeCountRef = useRef(0)
  const progressBarWidth = useRef(new Animated.Value(0)).current
  
  // Use refs to track values to avoid stale closure issues
  const currentQuestionIndexRef = useRef(0)
  const currentGroupIdRef = useRef<string | undefined>(undefined)
  const userIdRef = useRef<string | undefined>(undefined)
  const cardPosition = useRef(new Animated.ValueXY()).current
  const cardRotation = useRef(new Animated.Value(0)).current
  const cardOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        console.log("[swipe-onboarding] checkOnboardingStatus() called")
        const {
          data: { user },
        } = await supabase.auth.getUser()
        
        if (!user) {
          console.log("[swipe-onboarding] No user found, routing to welcome-1")
          router.replace("/(onboarding)/welcome-1")
          return
        }

        console.log(`[swipe-onboarding] User ID: ${user.id}`)
        console.log(`[swipe-onboarding] Params:`, params)

        setUserId(user.id)
        userIdRef.current = user.id

        // Get the group ID - check pending group created FIRST (most reliable), then params, then pending group join, then user's first group
        let targetGroupId: string | undefined
        
        // CRITICAL: Check AsyncStorage FIRST (most reliable source during onboarding flow)
        // Check for pending group created (from group creation flow)
        const pendingGroupCreated = await AsyncStorage.getItem("pending_group_created")
        console.log(`[swipe-onboarding] pending_group_created: ${pendingGroupCreated}`)
        // Handle params.groupId which might be a string or array in expo-router
        const paramsGroupIdValue = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId
        console.log(`[swipe-onboarding] params.groupId:`, params.groupId, `processed:`, paramsGroupIdValue)
        
        if (pendingGroupCreated) {
          targetGroupId = pendingGroupCreated
          console.log(`[swipe-onboarding] Using pending_group_created: ${targetGroupId}`)
        } else if (paramsGroupIdValue) {
          // Check if groupId is in params (from navigation)
          targetGroupId = paramsGroupIdValue as string
          console.log(`[swipe-onboarding] Using groupId from params: ${targetGroupId}`)
        } else {
          // Check for pending group join (from deep link)
          const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
          console.log(`[swipe-onboarding] pending_group_join: ${pendingGroupId}`)
          if (pendingGroupId) {
            targetGroupId = pendingGroupId
            console.log(`[swipe-onboarding] Using pending_group_join: ${targetGroupId}`)
          } else {
            // Get user's first group
            console.log("[swipe-onboarding] Querying database for user's first group")
            const { data: groups } = await supabase
              .from("group_members")
              .select("group_id")
              .eq("user_id", user.id)
              .limit(1)
            
            console.log(`[swipe-onboarding] Found ${groups?.length || 0} groups`)
            if (groups && groups.length > 0) {
              targetGroupId = groups[0].group_id
              console.log(`[swipe-onboarding] Using first group from database: ${targetGroupId}`)
            }
          }
        }

        console.log(`[swipe-onboarding] Final targetGroupId: ${targetGroupId}`)

        if (!targetGroupId) {
          // No group found - go to home (they'll see create group flow)
          console.log("[swipe-onboarding] No group found, routing to home")
          router.replace("/(main)/home")
          return
        }

        setGroupId(targetGroupId)
        currentGroupIdRef.current = targetGroupId

        // CRITICAL: If pending_group_created exists, this is a new group creation - ALWAYS show onboarding
        // Check this FIRST before checking if completed, because for a new group, we want to show onboarding
        // even if somehow the completion flag exists (shouldn't happen, but be defensive)
        if (pendingGroupCreated) {
          console.log(`[swipe-onboarding] ⭐ pending_group_created EXISTS: ${pendingGroupCreated}, targetGroupId: ${targetGroupId}`)
          // Double-check it matches targetGroupId
          if (pendingGroupCreated === targetGroupId) {
            console.log(`[swipe-onboarding] ✅ pending_group_created matches targetGroupId, showing onboarding immediately`)
            setGroupId(targetGroupId)
            currentGroupIdRef.current = targetGroupId
            setShouldShow(true)
            safeCapture(posthog, "loaded_swipe_onboarding", {
              group_id: targetGroupId,
            })
            setIsChecking(false)
            return
          } else {
            console.warn(`[swipe-onboarding] ⚠️ pending_group_created (${pendingGroupCreated}) doesn't match targetGroupId (${targetGroupId})`)
          }
        }

        // CRITICAL: Check if user has already completed swipe onboarding for this group
        // This prevents existing users from seeing this screen for groups they're already in
        const onboardingKey = getSwipeOnboardingKey(user.id, targetGroupId)
        const hasCompleted = await AsyncStorage.getItem(onboardingKey)
        console.log(`[swipe-onboarding] hasCompleted check for group ${targetGroupId}: ${hasCompleted}`)
        
        if (hasCompleted === "true") {
          // Already completed - go to home (existing user who already completed onboarding)
          // BUT: if pending_group_created exists, we should still show onboarding (handled above)
          console.log(`[swipe-onboarding] Already completed swipe onboarding for this group, going to home`)
          const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
          if (pendingGroupId) {
            await AsyncStorage.removeItem("pending_group_join")
            router.replace({
              pathname: "/(main)/home",
              params: { focusGroupId: targetGroupId },
            })
          } else {
            router.replace("/(main)/home")
          }
          return
        }

        // CRITICAL: If pending_group_join exists, user is joining a NEW group - always show swipe onboarding
        // (unless they've already completed it for this specific group, which is checked above)
        const pendingGroupJoin = await AsyncStorage.getItem("pending_group_join")
        
        // CRITICAL: If groupId is in params OR pending_group_created exists, user is coming from invite screen after creating a group
        // This applies to both new users AND existing members creating a new group
        // Use the same processed value we used above
        const isFromGroupCreation = !!(pendingGroupCreated || paramsGroupIdValue)
        console.log(`[swipe-onboarding] isFromGroupCreation check:`, {
          pendingGroupCreated,
          paramsGroupId: params.groupId,
          paramsGroupIdProcessed: paramsGroupIdValue,
          isFromGroupCreation,
          targetGroupId,
        })
        
        // If pending_group_join exists and matches targetGroupId, this is a new group join - show onboarding
        if (pendingGroupJoin === targetGroupId) {
          console.log(`[swipe-onboarding] User is joining new group (pending_group_join matches), showing onboarding`)
          // Show swipe onboarding - continue below
        } else if (!isFromGroupCreation) {
          // No pending group join or created, and not coming from group creation - check if existing user already a member
          console.log(`[swipe-onboarding] Not from group creation, checking if existing member...`)
          const POST_AUTH_ONBOARDING_KEY_PREFIX = "has_completed_post_auth_onboarding"
          const postAuthKey = `${POST_AUTH_ONBOARDING_KEY_PREFIX}_${user.id}`
          const hasCompletedPostAuth = await AsyncStorage.getItem(postAuthKey)
          
          if (hasCompletedPostAuth === "true") {
            // Existing user (not in onboarding flow) - check if they're already a member of this group
            const { data: existingMember } = await supabase
              .from("group_members")
              .select("id")
              .eq("group_id", targetGroupId)
              .eq("user_id", user.id)
              .maybeSingle()
            
            console.log(`[swipe-onboarding] Existing member check:`, { existingMember: !!existingMember })
            
            if (existingMember) {
              // Existing user who is already a member (and not creating/joining a new group) - they shouldn't see swipe onboarding
              // Mark it as completed and go to home
              console.log(`[swipe-onboarding] Existing member found, skipping onboarding and going to home`)
              await AsyncStorage.setItem(onboardingKey, "true")
              router.replace({
                pathname: "/(main)/home",
                params: { focusGroupId: targetGroupId },
              })
              return
            }
            // Existing user joining a NEW group (but no pending_group_join set) - show swipe onboarding
          }
        } else {
          console.log(`[swipe-onboarding] From group creation, will show onboarding`)
        }
        // If pending_group_created exists OR params.groupId exists, they're creating a new group - show swipe onboarding

        // Show swipe onboarding screen (new user or existing user joining new group)
        console.log(`[swipe-onboarding] Showing swipe onboarding for groupId: ${targetGroupId}, userId: ${user.id}`)
        setShouldShow(true)
        
        // Track loaded_swipe_onboarding event
        safeCapture(posthog, "loaded_swipe_onboarding", {
          group_id: targetGroupId,
        })
      } catch (error) {
        console.error("[swipe-onboarding] Error checking onboarding status:", error)
        router.replace("/(main)/home")
      } finally {
        setIsChecking(false)
      }
    }
    
    // Small delay to ensure params are available (expo-router sometimes needs a moment)
    const timeoutId = setTimeout(() => {
      checkOnboardingStatus()
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [router, params.groupId, posthog])

  // Get swipeable questions for matches tab
  const { data: swipeableQuestionsData = [], refetch: refetchSwipeableQuestions } = useQuery({
    queryKey: ["swipeableQuestions", groupId, userId],
    queryFn: () => (groupId && userId ? getSwipeableQuestionsForGroup(groupId, userId) : []),
    enabled: !!groupId && !!userId && shouldShow,
  })

  // Get swiping participants
  const { data: swipingParticipantsData = [] } = useQuery({
    queryKey: ["swipingParticipants", groupId, userId],
    queryFn: () => (groupId && userId ? getSwipingParticipants(groupId, userId) : []),
    enabled: !!groupId && !!userId && shouldShow,
  })

  // Get count of "yes" swipes for current user (for progress bar)
  const { data: yesSwipeCountData = 0 } = useQuery({
    queryKey: ["yesSwipeCount", groupId, userId],
    queryFn: async () => {
      if (!groupId || !userId) return 0
      const { count, error } = await supabase
        .from("group_question_swipes")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .eq("response", "yes")
      
      if (error) {
        console.error("[swipe-onboarding] Error fetching yes swipe count:", error)
        return 0
      }
      const countValue = count || 0
      setYesSwipeCount(countValue)
      yesSwipeCountRef.current = countValue
      return countValue
    },
    enabled: !!groupId && !!userId && shouldShow,
    refetchOnMount: true,
  })

  // Update progress bar when yes swipe count changes
  useEffect(() => {
    const percentage = Math.min((yesSwipeCount / 5) * 100, 100)
    Animated.timing(progressBarWidth, {
      toValue: percentage,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }, [yesSwipeCount, progressBarWidth])

  // Auto-redirect to home when reaching 5 yes swipes
  useEffect(() => {
    if (yesSwipeCount >= 5 && groupId && userId) {
      console.log("[swipe-onboarding] Reached 5 yes swipes, redirecting to home")
      // Mark swipe onboarding as complete
      const onboardingKey = getSwipeOnboardingKey(userId, groupId)
      AsyncStorage.setItem(onboardingKey, "true")
      
      // Clear pending group keys if they exist
      AsyncStorage.getItem("pending_group_created").then((pendingGroupCreated) => {
        if (pendingGroupCreated) {
          AsyncStorage.removeItem("pending_group_created")
        }
      })
      AsyncStorage.getItem("pending_group_join").then((pendingGroupId) => {
        if (pendingGroupId) {
          AsyncStorage.removeItem("pending_group_join")
        }
      })
      
      // Small delay to let animation complete, then redirect
      setTimeout(() => {
        router.replace({
          pathname: "/(main)/home",
          params: { focusGroupId: groupId },
        })
      }, 500)
    }
  }, [yesSwipeCount, groupId, userId, router])

  // Reset card position and index when new questions load
  useEffect(() => {
    if (swipeableQuestionsData.length > 0) {
      setCurrentQuestionIndex(0)
      currentQuestionIndexRef.current = 0
      cardPosition.setValue({ x: 0, y: 0 })
      cardRotation.setValue(0)
      cardOpacity.setValue(1)
    }
  }, [swipeableQuestionsData.length])

  // Reset card if groupId or userId changes
  useEffect(() => {
    if (groupId && userId && shouldShow) {
      cardPosition.setValue({ x: 0, y: 0 })
      cardRotation.setValue(0)
      cardOpacity.setValue(1)
      setIsSwiping(false)
    }
  }, [groupId, userId, shouldShow])

  // Keep refs in sync with state
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex
  }, [currentQuestionIndex])

  useEffect(() => {
    currentGroupIdRef.current = groupId
  }, [groupId])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  // Swipe handler function
  const handleSwipe = useCallback(async (direction: "yes" | "no") => {
    const questionIndex = currentQuestionIndexRef.current
    const groupIdValue = currentGroupIdRef.current
    const user = userIdRef.current
    const questions = swipeableQuestionsData

    if (!groupIdValue || !user) {
      Alert.alert("Error", "Please try again. Missing group or user information.")
      return
    }

    if (questionIndex >= questions.length) {
      return
    }

    const currentQuestion = questions[questionIndex]
    if (!currentQuestion) {
      return
    }

    try {
      // Track swiped_on_onboarding event
      safeCapture(posthog, "swiped_on_onboarding", {
        group_id: groupIdValue,
        direction,
        question_id: currentQuestion.id,
      })

      // Record swipe
      const result = await recordSwipe(groupIdValue, currentQuestion.id, user, direction)

      // If yes swipe, update count optimistically (before API call completes)
      if (direction === "yes") {
        const newCount = yesSwipeCountRef.current + 1
        yesSwipeCountRef.current = newCount
        setYesSwipeCount(newCount)
        
        // Update progress bar immediately
        const percentage = Math.min((newCount / 5) * 100, 100)
        Animated.timing(progressBarWidth, {
          toValue: percentage,
          duration: 200,
          useNativeDriver: false,
        }).start()
        
        // Refetch count to sync with database (in background)
        queryClient.refetchQueries({ queryKey: ["yesSwipeCount", groupIdValue, user] }).catch(() => {
          // Ignore errors - optimistic update is fine
        })
      }

      // Animate card off screen
      const targetX = direction === "yes" ? SCREEN_WIDTH : -SCREEN_WIDTH

      Animated.parallel([
        Animated.timing(cardPosition, {
          toValue: { x: targetX, y: 0 },
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(async () => {
        // Track match event if matched (but don't show modal)
        if (result.matched && result.matchedWithUsers) {
          // Track matched_on_onboarding event
          safeCapture(posthog, "matched_on_onboarding", {
            group_id: groupIdValue,
            question_id: currentQuestion.id,
            matched_with_count: result.matchedWithUsers.length,
          })
        }

        // Move to next question
        const latestIndex = currentQuestionIndexRef.current
        const latestQuestions = swipeableQuestionsData
        
        if (latestIndex + 1 < latestQuestions.length) {
          const nextIndex = latestIndex + 1
          currentQuestionIndexRef.current = nextIndex
          setCurrentQuestionIndex(nextIndex)
          cardPosition.setValue({ x: 0, y: 0 })
          cardRotation.setValue(0)
          cardOpacity.setValue(1)
        } else {
          // No more questions - refetch
          await refetchSwipeableQuestions()
          currentQuestionIndexRef.current = 0
          setCurrentQuestionIndex(0)
          cardPosition.setValue({ x: 0, y: 0 })
          cardRotation.setValue(0)
          cardOpacity.setValue(1)
        }

        // Refetch participants to update avatars
        queryClient.invalidateQueries({ queryKey: ["swipingParticipants", groupIdValue, user] })
      })
    } catch (error) {
      console.error("[swipe-onboarding] Error recording swipe:", error)
      Animated.parallel([
        Animated.spring(cardPosition, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }),
        Animated.spring(cardRotation, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
      Alert.alert("Error", "Failed to record your swipe. Please try again.")
    }
  }, [groupId, userId, swipeableQuestionsData, refetchSwipeableQuestions, queryClient, posthog, progressBarWidth])

  // PanResponder for swipe gestures
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          return !!(currentGroupIdRef.current && userIdRef.current)
        },
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!currentGroupIdRef.current || !userIdRef.current) return false
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (!currentGroupIdRef.current || !userIdRef.current) return false
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10
        },
        onPanResponderGrant: () => {
          setIsSwiping(true)
        },
        onPanResponderMove: (_, gestureState) => {
          cardPosition.setValue({ x: gestureState.dx, y: gestureState.dy })
          const rotation = gestureState.dx / 20
          cardRotation.setValue(rotation)
        },
        onPanResponderRelease: (_, gestureState) => {
          setIsSwiping(false)
          const SWIPE_THRESHOLD = 50
          const { dx } = gestureState

          const groupIdValue = currentGroupIdRef.current
          const userIdValue = userIdRef.current
          
          if (!groupIdValue || !userIdValue) {
            Animated.parallel([
              Animated.spring(cardPosition, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true,
              }),
              Animated.spring(cardRotation, {
                toValue: 0,
                useNativeDriver: true,
              }),
            ]).start()
            return
          }

          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            const direction = dx > 0 ? "yes" : "no"
            handleSwipe(direction).catch((error) => {
              console.error("[swipe-onboarding] Error in handleSwipe:", error)
              setIsSwiping(false)
              Animated.parallel([
                Animated.spring(cardPosition, {
                  toValue: { x: 0, y: 0 },
                  useNativeDriver: true,
                }),
                Animated.spring(cardRotation, {
                  toValue: 0,
                  useNativeDriver: true,
                }),
                Animated.timing(cardOpacity, {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start()
            })
          } else {
            Animated.parallel([
              Animated.spring(cardPosition, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true,
              }),
              Animated.spring(cardRotation, {
                toValue: 0,
                useNativeDriver: true,
              }),
            ]).start()
          }
        },
        onPanResponderTerminate: () => {
          setIsSwiping(false)
          Animated.parallel([
            Animated.spring(cardPosition, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
            }),
            Animated.spring(cardRotation, {
              toValue: 0,
              useNativeDriver: true,
            }),
          ]).start()
        },
      }),
    [handleSwipe]
  )

  async function handleContinue() {
    if (!userId || !groupId) {
      router.replace("/(main)/home")
      return
    }

    // Mark swipe onboarding as complete for this user+group
    const onboardingKey = getSwipeOnboardingKey(userId, groupId)
    await AsyncStorage.setItem(onboardingKey, "true")
    
    // Clear pending group keys if they exist
    const pendingGroupCreated = await AsyncStorage.getItem("pending_group_created")
    const pendingGroupId = await AsyncStorage.getItem("pending_group_join")
    if (pendingGroupCreated) {
      await AsyncStorage.removeItem("pending_group_created")
    }
    if (pendingGroupId) {
      await AsyncStorage.removeItem("pending_group_join")
    }
    
    // Route to home with focus on the group
    if (pendingGroupCreated || pendingGroupId) {
      router.replace({
        pathname: "/(main)/home",
        params: { focusGroupId: groupId },
      })
    } else {
      router.replace("/(main)/home")
    }
  }

  // Don't render anything until we've checked onboarding status
  if (isChecking) {
    console.log("[swipe-onboarding] Still checking, showing loading indicator")
    return (
      <View style={styles.checkingContainer}>
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    )
  }

  // Don't render if user shouldn't see this screen
  if (!shouldShow) {
    console.log("[swipe-onboarding] shouldShow is false, returning null")
    return null
  }
  
  console.log("[swipe-onboarding] Rendering swipe onboarding screen")

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>Like some questions</Text>
        <Text style={styles.subtitle}>
          Help us understand your group and set your early vibe by swiping some samples
        </Text>
      </View>

      {/* Swipe Container */}
      <View style={styles.swipeContainer}>
        {swipeableQuestionsData.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ ...typography.body, color: colors.gray[400], textAlign: "center" }}>
              Loading questions...
            </Text>
          </View>
        ) : (
          <>
            {/* Progress Bar */}
            {swipeableQuestionsData.length > 0 && groupId && userId && (
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressBarWidth.interpolate({
                          inputRange: [0, 100],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                </View>
              </View>
            )}
            
            {/* Swipe Card */}
            {currentQuestionIndex < swipeableQuestionsData.length && groupId && userId && (
              <>
                <Animated.View
                  style={[
                    styles.swipeCard,
                    {
                      transform: [
                        { translateX: cardPosition.x },
                        { translateY: cardPosition.y },
                        {
                          rotate: cardRotation.interpolate({
                            inputRange: [-200, 0, 200],
                            outputRange: ["-30deg", "0deg", "30deg"],
                          }),
                        },
                      ],
                      opacity: cardOpacity,
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  <Text style={styles.swipeCardQuestion}>
                    {swipeableQuestionsData[currentQuestionIndex].question}
                  </Text>
                </Animated.View>
                
                {/* Yes/No Buttons */}
                <View style={styles.swipeButtons}>
                  <TouchableOpacity
                    style={[styles.swipeButton, styles.swipeButtonNo]}
                    onPress={() => handleSwipe("no")}
                  >
                    <Text style={styles.swipeButtonEmoji}>👎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.swipeButton, styles.swipeButtonYes]}
                    onPress={() => handleSwipe("yes")}
                  >
                    <Text style={styles.swipeButtonEmoji}>👍</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </>
        )}
      </View>

      {/* Continue Button */}
      <Button
        title="Continue"
        onPress={handleContinue}
        style={styles.continueButton}
        textStyle={styles.continueButtonText}
      />
    </View>
  )
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.black,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      alignItems: "center",
    },
    title: {
      ...typography.h1,
      fontSize: 32,
      color: colors.white,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    subtitle: {
      ...typography.body,
      fontSize: 16,
      color: colors.gray[400],
      textAlign: "center",
      paddingHorizontal: spacing.md,
    },
    swipeContainer: {
      flex: 1,
      justifyContent: "flex-start",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    swipeCard: {
      width: SCREEN_WIDTH - spacing.md * 2,
      height: 340,
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.gray[700],
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
    },
    swipeCardQuestion: {
      ...typography.h2,
      fontSize: 24,
      color: colors.white,
      textAlign: "center",
      lineHeight: 32,
    },
    swipeButtons: {
      flexDirection: "row",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
    swipeButton: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    swipeButtonNo: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.white,
    },
    swipeButtonYes: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.accent,
    },
    swipeButtonText: {
      ...typography.bodyBold,
      fontSize: 16,
      color: colors.white,
    },
    swipeButtonYesText: {
      color: colors.accent,
    },
    continueButton: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.xl,
      marginBottom: spacing.xxl,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.accent,
    },
    continueButtonText: {
      color: colors.white,
    },
    swipeButtons: {
      flexDirection: "row",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
    swipeButton: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.gray[800],
      borderWidth: 1,
      borderColor: colors.white,
    },
    swipeButtonNo: {
      backgroundColor: colors.gray[800],
      borderWidth: 1,
      borderColor: colors.white,
    },
    swipeButtonYes: {
      backgroundColor: colors.gray[800],
      borderWidth: 1,
      borderColor: colors.white,
    },
    swipeButtonEmoji: {
      fontSize: 24,
    },
    progressBarContainer: {
      width: "100%",
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    progressBarBackground: {
      width: "100%",
      height: 4,
      backgroundColor: colors.gray[800],
      borderRadius: 2,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: colors.white,
      borderRadius: 2,
    },
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
      backgroundColor: colors.accent,
      paddingVertical: spacing.md,
      borderRadius: 0,
      alignItems: "center",
    },
    modalButtonText: {
      ...typography.bodyBold,
      color: colors.white,
    },
    checkingContainer: {
      flex: 1,
      backgroundColor: colors.black,
      justifyContent: "center",
      alignItems: "center",
    },
  })

