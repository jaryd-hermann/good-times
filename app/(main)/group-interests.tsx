"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  Image,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { FontAwesome } from "@expo/vector-icons"
import { useTheme } from "../../lib/theme-context"
import { typography, spacing } from "../../lib/theme"
import { getAllInterests, getGroupInterests, getUserInterestsForGroup, toggleUserInterest, getCurrentUser } from "../../lib/db"
import { supabase } from "../../lib/supabase"
import { Avatar } from "../../components/Avatar"
import { useTabBar } from "../../lib/tab-bar-context"
import { useAuth } from "../../components/AuthProvider"
import type { Interest, User } from "../../lib/types"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

export default function GroupInterests() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { opacity: tabBarOpacity } = useTabBar()
  const { user: authUser } = useAuth()
  
  const groupId = params.groupId as string | undefined
  const [userId, setUserId] = useState<string>()
  const scrollViewRef = useRef<ScrollView>(null)
  
  // Hide tab bar on this screen - set to 0 immediately and keep it hidden
  useEffect(() => {
    // Set opacity to 0 immediately
    tabBarOpacity.setValue(0)
    
    // Also animate to ensure it's hidden
    Animated.timing(tabBarOpacity, {
      toValue: 0,
      duration: 0,
      useNativeDriver: true,
    }).start()
    
    return () => {
      // Restore tab bar when leaving
      Animated.timing(tabBarOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [tabBarOpacity])
  
  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000",
        cream: "#000000",
        white: "#E8E0D5",
        text: "#F5F0EA",
        textSecondary: "#A0A0A0",
      }
    } else {
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

  // Get current user
  useEffect(() => {
    async function loadUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
        }
      } catch (error) {
        console.error("[group-interests] Error loading user:", error)
      }
    }
    loadUser()
  }, [])

  // Get all available interests
  const { data: allInterests = [] } = useQuery({
    queryKey: ["allInterests"],
    queryFn: getAllInterests,
  })

  // Get group interests with users who selected them
  // Use staleTime: 0 and refetchOnMount: true to ensure fresh data during onboarding
  const { data: groupInterestsData = [] } = useQuery({
    queryKey: ["groupInterests", groupId],
    queryFn: () => (groupId ? getGroupInterests(groupId) : []),
    enabled: !!groupId,
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnMount: true, // Always refetch on mount
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })

  // Get current user's selected interests for this group
  // Use staleTime: 0 and refetchOnMount: true to ensure fresh data during onboarding
  const { data: userSelectedInterests = [] } = useQuery({
    queryKey: ["userInterests", groupId, userId],
    queryFn: () => (groupId && userId ? getUserInterestsForGroup(groupId, userId) : []),
    enabled: !!groupId && !!userId,
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnMount: true, // Always refetch on mount
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })

  // Use auth user for instant avatar updates (no query delay)
  const currentUser = authUser

  // Create a map of interest ID to data with user count
  const interestMap = useMemo(() => {
    const map = new Map<string, Interest & { userCount: number; users: User[]; isSelected: boolean; isUserSelected: boolean }>()
    
    // Initialize with all interests
    for (const interest of allInterests) {
      map.set(interest.id, {
        ...interest,
        userCount: 0,
        users: [],
        isSelected: false, // Selected if ANY member has it (active for group)
        isUserSelected: false, // Selected by current user specifically
      })
    }
    
    // Update with group data
    for (const groupInterest of groupInterestsData) {
      const existing = map.get(groupInterest.id)
      if (existing) {
        existing.userCount = groupInterest.users.length
        existing.users = groupInterest.users
        // Interest is selected/active if ANY member has selected it
        existing.isSelected = groupInterest.users.length > 0
        // Track if current user specifically selected it
        existing.isUserSelected = userSelectedInterests.includes(groupInterest.name)
      }
    }
    
    // Update selected state for interests not in group yet (but user may have selected)
    for (const interest of allInterests) {
      const existing = map.get(interest.id)
      if (existing) {
        // If user selected it but it's not in group data yet, it's still selected
        if (userSelectedInterests.includes(interest.name)) {
          existing.isSelected = true
          existing.isUserSelected = true
        }
      }
    }
    
    return map
  }, [allInterests, groupInterestsData, userSelectedInterests])

  // Sort interests by display_order from interests table
  const sortedInterests = useMemo(() => {
    return Array.from(interestMap.values()).sort((a, b) => {
      // Sort by display_order
      return (a.display_order || 0) - (b.display_order || 0)
    })
  }, [interestMap])

  const handleToggleInterest = async (interestId: string, interestName: string) => {
    if (!groupId || !userId) return
    
    const interest = interestMap.get(interestId)
    // Toggle based on whether current user has selected it, not whether group has it
    const isUserSelected = interest?.isUserSelected || false
    const newSelectedState = !isUserSelected
    
    // Use auth user data for instant updates (no query delay)
    const currentUserData = currentUser ? {
      id: userId!,
      avatar_url: currentUser.avatar_url,
      name: currentUser.name || "",
    } : {
      id: userId!,
      avatar_url: undefined,
      name: "",
    }
    
    // Optimistic updates: update both queries immediately for instant UI feedback
    // Update userInterests first
    queryClient.setQueryData(["userInterests", groupId, userId], (oldData: string[] = []) => {
      if (newSelectedState) {
        return oldData.includes(interestName) ? oldData : [...oldData, interestName]
      } else {
        return oldData.filter(name => name !== interestName)
      }
    })
    
    // Update groupInterests with user avatar - this triggers immediate UI update
    queryClient.setQueryData(["groupInterests", groupId], (oldData: any[] = []) => {
      // Check if interest already exists in the data
      const existingInterestIndex = oldData.findIndex((gi) => gi.id === interestId)
      
      if (existingInterestIndex >= 0) {
        // Interest exists - update it
        return oldData.map((groupInterest) => {
          if (groupInterest.id === interestId) {
            const existingUsers = groupInterest.users || []
            const userExists = existingUsers.some((u: User) => u.id === userId)
            
            let updatedUsers: User[]
            if (newSelectedState) {
              // Adding interest - add user if not already present
              updatedUsers = userExists ? existingUsers : [...existingUsers, currentUserData]
            } else {
              // Removing interest - remove user
              updatedUsers = existingUsers.filter((u: User) => u.id !== userId)
            }
            
            return {
              ...groupInterest,
              users: updatedUsers,
              userCount: updatedUsers.length, // Update count immediately
              // Ensure the interest shows as selected if it has any users
              isSelected: updatedUsers.length > 0,
            }
          }
          return groupInterest
        })
      } else if (newSelectedState) {
        // Interest doesn't exist yet and we're adding it - create new entry
        // Find the interest details from allInterests
        const interestDetails = allInterests.find((i) => i.id === interestId)
        if (interestDetails) {
          return [
            ...oldData,
            {
              ...interestDetails,
              users: [currentUserData],
              userCount: 1,
              isSelected: true,
            },
          ]
        }
      }
      
      // If removing and interest doesn't exist, or interest details not found, return as-is
      return oldData
    })
    
    // Run API call in background - don't await it, let UI update immediately
    toggleUserInterest(groupId, userId, interestId, newSelectedState)
      .then(() => {
        // Refetch in background to sync with server (user avatars, counts, etc.)
        queryClient.invalidateQueries({ queryKey: ["groupInterests", groupId] })
        queryClient.invalidateQueries({ queryKey: ["userInterests", groupId, userId] })
      })
      .catch((error) => {
        console.error("[group-interests] Error toggling interest:", error)
        
        // Revert optimistic update on error
        queryClient.setQueryData(["userInterests", groupId, userId], (oldData: string[] = []) => {
          if (newSelectedState) {
            // Revert: remove if we were adding
            return oldData.filter(name => name !== interestName)
          } else {
            // Revert: add back if we were removing
            return oldData.includes(interestName) ? oldData : [...oldData, interestName]
          }
        })
        
        queryClient.setQueryData(["groupInterests", groupId], (oldData: any[] = []) => {
          return oldData.map((groupInterest) => {
            if (groupInterest.id === interestId) {
              const existingUsers = groupInterest.users || []
              // Revert: remove user if we were adding, add back if we were removing
              const updatedUsers = newSelectedState
                ? existingUsers.filter((u: User) => u.id !== userId)
                : [...existingUsers, currentUserData]
              
              return {
                ...groupInterest,
                users: updatedUsers,
                isSelected: updatedUsers.length > 0,
              }
            }
            return groupInterest
          })
        })
        
        Alert.alert("Error", "Failed to update interest. Please try again.")
      })
  }

  // Use sortedInterests directly (already sorted by display_order)
  const sortedInterestsForDisplay = sortedInterests

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme2Colors.beige,
    },
    header: {
      paddingTop: insets.top + spacing.md,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderBottomWidth: 0,
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      justifyContent: "flex-end",
      alignItems: "flex-end",
    },
    title: {
      fontFamily: "PMGothicLudington-Text115",
      fontSize: 32,
      color: theme2Colors.text,
      marginBottom: spacing.xs,
      textAlign: "left", // Left aligned
    },
    subtitle: {
      ...typography.body,
      color: theme2Colors.textSecondary,
      textAlign: "left", // Left aligned
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme2Colors.white,
      borderWidth: 1,
      borderColor: theme2Colors.text,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
    },
    pillsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl * 2,
      gap: spacing.sm,
    },
    interestPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 1000, // Round pill shape
      borderWidth: 1,
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3, // Android shadow
    },
    interestPillUnselected: {
      backgroundColor: isDark ? "#1A1A1C" : theme2Colors.white, // #1A1A1C in dark mode, white in light mode
      borderColor: isDark ? theme2Colors.white : theme2Colors.text, // White stroke in dark mode, black in light mode
    },
    interestPillSelected: {
      backgroundColor: isDark ? "#F5F0EA" : theme2Colors.text, // Cream (#F5F0EA) in dark mode, black in light mode
      borderColor: isDark ? "#F5F0EA" : theme2Colors.text,
    },
    interestText: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      fontWeight: "400",
      color: isDark ? theme2Colors.white : theme2Colors.text, // White text in dark mode (#1A1A1C pill), black text in light mode (white pill)
    },
    interestTextSelected: {
      fontFamily: "Roboto-Regular",
      fontSize: 14, // Same size as unselected
      fontWeight: "400",
      color: isDark ? "#000000" : theme2Colors.white, // Black in dark mode, white in light mode
    },
    pillCount: {
      fontFamily: "Roboto-Regular",
      fontSize: 14,
      fontWeight: "600",
      color: isDark ? "#000000" : theme2Colors.white, // Black in dark mode, white in light mode
      marginLeft: spacing.xs,
    },
    avatarsContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: spacing.xs,
    },
    avatarWrapper: {
      marginLeft: -8, // Overlap avatars
    },
    avatarWrapperFirst: {
      marginLeft: 0, // First avatar has no negative margin
    },
    addButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme2Colors.yellow,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 0,
    },
    addButtonText: {
      color: "#000000", // Always black (on yellow background)
      fontSize: 14,
      fontWeight: "600",
    },
    bottomButton: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.md,
      paddingBottom: insets.bottom + spacing.md,
      paddingTop: spacing.md,
      backgroundColor: theme2Colors.beige,
      borderTopWidth: 1,
      borderTopColor: isDark ? "#1A1A1C" : "#E5E5E5",
    },
    ctaButton: {
      backgroundColor: "#D97393", // Pink color
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: 1000, // Round pill shape
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      borderWidth: 2,
      borderColor: "rgba(255, 255, 255, 0.6)", // Light white stroke outline
      position: "relative", // For absolute positioning of texture
      overflow: "hidden", // Ensure texture stays within bounds
      maxWidth: SCREEN_WIDTH - spacing.md * 4, // Slightly less wide
      alignSelf: "center", // Center the button
    },
    ctaButtonTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.4, // Adjust opacity to taste
      zIndex: 1, // Above button background but below text
      pointerEvents: "none", // Allow touches to pass through
      borderRadius: 1000, // Match button border radius (round pill)
    },
    ctaButtonText: {
      fontFamily: "Roboto-Regular",
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF", // White text
      textAlign: "center",
      position: "relative",
      zIndex: 2, // Above texture overlay
    },
  }), [theme2Colors, isDark, insets.top, insets.bottom])

  // Render interest name with proper line breaks for "&"
  const renderInterestName = (name: string, isSelected: boolean) => {
    const textStyle = isSelected ? styles.interestTextSelected : styles.interestText
    if (name.includes(" & ")) {
      const parts = name.split(" & ")
      if (parts.length === 2) {
        return (
          <Text style={textStyle} numberOfLines={1}>
            {parts[0]} & {parts[1]}
          </Text>
        )
      }
    }
    return (
      <Text style={textStyle} numberOfLines={1}>
        {name}
      </Text>
    )
  }

  if (!groupId || !userId) {
    return (
      <View style={styles.container}>
        <ScrollView 
          style={styles.content}
          contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Group interests</Text>
              <Text style={styles.subtitle}>Tell us what you're into and we'll ask questions just for you</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => router.back()}
              >
                <FontAwesome name="times" size={16} color={isDark ? "#000000" : theme2Colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.content}>
            <Text style={styles.subtitle}>Please select a group</Text>
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Content - vertical scroll */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 + 80 }} // Extra padding for bottom button
      >
        {/* Header - scrolls with content */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Group interests</Text>
            <Text style={styles.subtitle}>Tell us what you're into and we'll ask questions just for you</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.back()}
            >
              <FontAwesome name="times" size={16} color={isDark ? "#000000" : theme2Colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.pillsContainer}>
          {sortedInterestsForDisplay.map((interest) => {
            const isSelected = interest.isSelected // Selected if ANY member has it
            const isUserSelected = interest.isUserSelected // Selected by current user
            const userCount = interest.userCount
            const hasUsers = interest.users.length > 0
            
            return (
              <TouchableOpacity
                key={interest.id}
                style={[
                  styles.interestPill,
                  isSelected ? styles.interestPillSelected : styles.interestPillUnselected,
                ]}
                onPress={() => handleToggleInterest(interest.id, interest.name)}
                activeOpacity={0.7}
              >
                {renderInterestName(interest.name, isSelected)}
                
                {/* Show avatars if selected (active) and has users */}
                {isSelected && hasUsers && (
                  <View style={styles.avatarsContainer}>
                    {/* Show all avatars of users who have selected this interest */}
                    {interest.users.map((user, index) => (
                      <View
                        key={user.id}
                        style={[
                          styles.avatarWrapper,
                          index === 0 && styles.avatarWrapperFirst,
                        ]}
                      >
                        <Avatar
                          uri={user.avatar_url}
                          name={user.name}
                          size={24}
                          borderWidth={0}
                        />
                      </View>
                    ))}
                    {/* Show yellow "+" if interest is active but current user hasn't selected it yet */}
                    {!isUserSelected && (
                      <View style={styles.avatarWrapper}>
                        <View style={styles.addButton}>
                          <Text style={styles.addButtonText}>+</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>
      
      {/* Fixed bottom button */}
      <View style={styles.bottomButton}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => {
            // Route to home with focus on the group
            if (groupId) {
              router.replace({
                pathname: "/(main)/home",
                params: { focusGroupId: groupId },
              })
            } else {
              router.back()
            }
          }}
          activeOpacity={0.8}
        >
          {/* Texture overlay */}
          <View style={styles.ctaButtonTexture} pointerEvents="none">
            <Image
              source={require("../../assets/images/texture.png")}
              style={{ 
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: "100%",
                height: "100%",
              }}
              resizeMode="stretch"
            />
          </View>
          <Text style={styles.ctaButtonText}>This looks like us</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

