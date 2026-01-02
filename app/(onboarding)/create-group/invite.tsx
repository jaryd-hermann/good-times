"use client"

import { useMemo, useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../../../lib/supabase"
import * as Contacts from "expo-contacts"
import * as Clipboard from "expo-clipboard"
import { colors, spacing, typography } from "../../../lib/theme"
import { Button } from "../../../components/Button"
import { getCurrentUser } from "../../../lib/db"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../../lib/posthog"
import { FontAwesome } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Image } from "react-native"

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
  onboardingPink: "#D97393", // Pink for onboarding CTAs
}

const POST_AUTH_ONBOARDING_KEY_PREFIX = "has_completed_post_auth_onboarding"

// Helper function to get user-specific onboarding key
function getPostAuthOnboardingKey(userId: string): string {
  return `${POST_AUTH_ONBOARDING_KEY_PREFIX}_${userId}`
}

export default function Invite() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const groupId = params.groupId as string
  const mode = params.mode as string | undefined
  const posthog = usePostHog()
  const insets = useSafeAreaInsets()
  const [searchFocused, setSearchFocused] = useState(false)

  const [contactsModalVisible, setContactsModalVisible] = useState(false)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contacts, setContacts] = useState<InviteContact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Track generated_invite_link event when screen loads
  useEffect(() => {
    if (groupId) {
      try {
        if (posthog) {
          posthog.capture("generated_invite_link", { group_id: groupId })
        } else {
          captureEvent("generated_invite_link", { group_id: groupId })
        }
      } catch (error) {
        if (__DEV__) console.error("[invite] Failed to track generated_invite_link:", error)
      }
    }
  }, [posthog, groupId])

  async function handleShare() {
    try {
      // Get current user's name for the invite message
      const currentUser = await getCurrentUser()
      const userName = currentUser?.name || "me"
      
      const inviteLink = `https://thegoodtimes.app/join/${groupId}`
      // For Share.share, don't include URL in message to avoid duplication (platform adds it)
      const inviteMessage = `I've created a group for us on this new app, Good Times. Join ${userName} here:`
      
      // Track took_invite_action and shared_invite_link events
      try {
        if (posthog) {
          posthog.capture("took_invite_action", { action_type: "share_cta" })
          posthog.capture("shared_invite_link", { group_id: groupId, share_method: "share_sheet" })
        } else {
          captureEvent("took_invite_action", { action_type: "share_cta" })
          captureEvent("shared_invite_link", { group_id: groupId, share_method: "share_sheet" })
        }
      } catch (error) {
        if (__DEV__) console.error("[invite] Failed to track share events:", error)
      }
      
      await Share.share({
        url: inviteLink,
        message: inviteMessage,
        title: "Good Times Invite",
      })
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  async function handleFinish() {
    // Check if user has completed post-auth onboarding (user-specific)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace({
        pathname: "/(main)/home",
        params: { focusGroupId: groupId },
      })
      return
    }

    const onboardingKey = getPostAuthOnboardingKey(user.id)
    const hasCompletedPostAuth = await AsyncStorage.getItem(onboardingKey)
    
    if (!hasCompletedPostAuth) {
      // Store groupId so it can be retrieved during onboarding flow
      // Use a temporary key to pass the groupId through onboarding
      await AsyncStorage.setItem("pending_group_created", groupId)
      console.log(`[invite] Stored pending_group_created: ${groupId}, routing to welcome-post-auth`)
      // Route to post-auth onboarding screens first
      router.replace("/(onboarding)/welcome-post-auth")
      return
    }
    
    // User has completed post-auth onboarding
    // CRITICAL: Set pending_group_created even for existing members creating a new group
    // This ensures swipe-onboarding.tsx knows this is a new group creation
    await AsyncStorage.setItem("pending_group_created", groupId)
    console.log(`[invite] Stored pending_group_created for existing member: ${groupId}`)
    
    // Verify it was set (for debugging)
    const verifyPending = await AsyncStorage.getItem("pending_group_created")
    console.log(`[invite] Verified pending_group_created: ${verifyPending}`)
    
    // TEMPORARILY DISABLED: Skip swipe onboarding - go directly to set-theme or home
    // Check if this is a new group creation (pending_group_created exists)
    // If so, route to set-theme for new users, otherwise go to home
    const pendingGroupCreated = await AsyncStorage.getItem("pending_group_created")
    
    if (pendingGroupCreated === groupId) {
      // New group creation - check if user has completed post-auth onboarding
      // hasCompletedPostAuth was already checked above, so use that value
      // Only show set-theme if user hasn't completed post-auth onboarding (brand new user)
      if (!hasCompletedPostAuth) {
        // Brand new user creating first group - go to set-theme
        console.log(`[invite] New user detected, routing to set-theme for group ${groupId}`)
        router.replace({
          pathname: "/(onboarding)/set-theme",
          params: { groupId },
        })
      } else {
        // Existing user creating another group - skip set-theme, go directly to group-interests
        console.log(`[invite] Existing user creating another group, routing to group-interests (skipping set-theme)`)
        await AsyncStorage.removeItem("pending_group_created")
        router.replace({
          pathname: "/(main)/group-interests",
          params: { groupId },
        })
      }
    } else {
      // Not a new group creation - go to group-interests
      await AsyncStorage.removeItem("pending_group_created")
      router.replace({
        pathname: "/(main)/group-interests",
        params: { groupId },
      })
    }
    
    // OLD CODE - TEMPORARILY DISABLED:
    // // Check if they've completed swipe onboarding for this group
    // const SWIPE_ONBOARDING_KEY_PREFIX = "has_completed_swipe_onboarding"
    // const swipeOnboardingKey = `${SWIPE_ONBOARDING_KEY_PREFIX}_${user.id}_${groupId}`
    // const hasCompletedSwipeOnboarding = await AsyncStorage.getItem(swipeOnboardingKey)
    // console.log(`[invite] hasCompletedSwipeOnboarding for group ${groupId}: ${hasCompletedSwipeOnboarding}`)
    // 
    // if (hasCompletedSwipeOnboarding === "true") {
    //   // Already completed swipe onboarding - clear pending_group_created and go to home
    //   console.log(`[invite] Already completed swipe onboarding, going to home`)
    //   await AsyncStorage.removeItem("pending_group_created")
    //   if (mode === "add") {
    //     router.replace({
    //       pathname: "/(main)/home",
    //       params: { focusGroupId: groupId },
    //     })
    //     return
    //   }
    //   router.replace("/(main)/home")
    //   return
    // }
    // 
    // // Route to swipe onboarding (with groupId param)
    // console.log(`[invite] ⭐ About to navigate to swipe-onboarding`)
    // console.log(`[invite] groupId: ${groupId}`)
    // console.log(`[invite] pending_group_created (verified): ${verifyPending}`)
    // console.log(`[invite] hasCompletedSwipeOnboarding: ${hasCompletedSwipeOnboarding}`)
    // 
    // // Use a small delay to ensure AsyncStorage write completes
    // await new Promise(resolve => setTimeout(resolve, 100))
    // 
    // // Verify one more time before navigating
    // const finalCheck = await AsyncStorage.getItem("pending_group_created")
    // console.log(`[invite] Final check before navigation - pending_group_created: ${finalCheck}`)
    // 
    // if (!finalCheck) {
    //   console.error(`[invite] ❌ ERROR: pending_group_created was cleared before navigation! Re-setting it.`)
    //   await AsyncStorage.setItem("pending_group_created", groupId)
    // }
    // 
    // // Use push instead of replace to ensure navigation works
    // console.log(`[invite] 🚀 Navigating to swipe-onboarding...`)
    // router.push({
    //   pathname: "/(onboarding)/swipe-onboarding",
    //   params: { groupId },
    // })
    // console.log(`[invite] ✅ Navigation called`)
  }

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts
    const term = searchQuery.trim().toLowerCase()
    return contacts.filter((contact) => contact.name.toLowerCase().includes(term))
  }, [contacts, searchQuery])

  async function handleOpenContacts() {
    // Track took_invite_action event
    try {
      if (posthog) {
        posthog.capture("took_invite_action", { action_type: "open_phonebook" })
      } else {
        captureEvent("took_invite_action", { action_type: "open_phonebook" })
      }
    } catch (error) {
      if (__DEV__) console.error("[invite] Failed to track open_phonebook:", error)
    }

    const { status } = await Contacts.requestPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow contacts access to send invites directly.")
      return
    }

    if (contacts.length === 0) {
      setContactsLoading(true)
      try {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
          sort: Contacts.SortTypes.FirstName,
        })

        const mapped =
          data
            ?.map((item) => ({
              id: item.id,
              name: [item.firstName, item.lastName].filter(Boolean).join(" ").trim() || item.name || "Unnamed",
              emails: item.emails?.map((email) => email.email).filter(Boolean) ?? [],
              phones: item.phoneNumbers?.map((phone) => phone.number).filter(Boolean) ?? [],
            }))
            .filter((contact) => contact.emails.length > 0 || contact.phones.length > 0) ?? []

        setContacts(mapped)
      } catch (error: any) {
        Alert.alert("Error", error.message)
        return
      } finally {
        setContactsLoading(false)
      }
    }

    setContactsModalVisible(true)
  }

  function toggleContact(id: string) {
    setSelectedContacts((prev) => (prev.includes(id) ? prev.filter((contactId) => contactId !== id) : [...prev, id]))
  }

  async function handleSendInvites() {
    // Get current user's name for the invite message
    const currentUser = await getCurrentUser()
    const userName = currentUser?.name || "me"
    
    const inviteLink = `https://thegoodtimes.app/join/${groupId}`
    // For Share.share, don't include URL in message to avoid duplication (platform adds it)
    const inviteMessage = `I've created a group for us on this new app, Good Times. Join ${userName} here:`
    
    const selected = contacts.filter((contact) => selectedContacts.includes(contact.id))
    if (selected.length === 0) {
      Alert.alert("Select contacts", "Choose at least one contact to invite.")
      return
    }

    const inviteList = selected
      .map((contact) => {
        const detail = contact.emails[0] ?? contact.phones[0] ?? ""
        return `${contact.name}${detail ? ` (${detail})` : ""}`
      })
      .join(", ")

    // Track shared_invite_link event when sending from contacts
    try {
      if (posthog) {
        posthog.capture("shared_invite_link", { group_id: groupId, share_method: "share_sheet" })
      } else {
        captureEvent("shared_invite_link", { group_id: groupId, share_method: "share_sheet" })
      }
    } catch (error) {
      if (__DEV__) console.error("[invite] Failed to track shared_invite_link:", error)
    }

    try {
      await Share.share({
        message: `${inviteMessage}\n\nInviting: ${inviteList}`,
        url: inviteLink,
        title: "Good Times Invite",
      })
      setContactsModalVisible(false)
      setSelectedContacts([])
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }
  
  async function handleCopyToClipboard() {
    // Get current user's name for the invite message
    const currentUser = await getCurrentUser()
    const userName = currentUser?.name || "me"
    
    const inviteLink = `https://thegoodtimes.app/join/${groupId}`
    const inviteMessage = `I've created a group for us on this new app, Good Times. Join ${userName} here: ${inviteLink}`
    
    // Track took_invite_action and copied_invite_link events
    try {
      if (posthog) {
        posthog.capture("took_invite_action", { action_type: "copy_clipboard" })
        posthog.capture("copied_invite_link", { group_id: groupId })
      } else {
        captureEvent("took_invite_action", { action_type: "copy_clipboard" })
        captureEvent("copied_invite_link", { group_id: groupId })
      }
    } catch (error) {
      if (__DEV__) console.error("[invite] Failed to track copy events:", error)
    }
    
    try {
      await Clipboard.setStringAsync(inviteMessage)
      Alert.alert("Copied!", "Invite link copied to clipboard")
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <FontAwesome name="angle-left" size={18} color={theme2Colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Your people</Text>
        <Text style={styles.subtitle}>Let's invite everyone here who's part of this group.</Text>
      </View>

      <View style={styles.form}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Text style={styles.shareButtonText}>Share your invite link →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleCopyToClipboard}
          activeOpacity={0.8}
        >
          <View style={styles.secondaryButtonTexture} pointerEvents="none">
            <Image
              source={require("../../../assets/images/texture.png")}
              style={styles.secondaryButtonTextureImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.secondaryButtonText}>Copy to clipboard →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleOpenContacts}
          activeOpacity={0.8}
        >
          <View style={styles.secondaryButtonTexture} pointerEvents="none">
            <Image
              source={require("../../../assets/images/texture.png")}
              style={styles.secondaryButtonTextureImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.secondaryButtonText}>Add from contacts →</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Contacts</Text>
        <Text style={styles.placeholder}>Select friends from your contacts or share the invite link directly.</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.finishButton}
          onPress={handleFinish}
          activeOpacity={0.8}
        >
          <View style={styles.buttonTexture} pointerEvents="none">
            <Image
              source={require("../../../assets/images/texture.png")}
              style={styles.textureImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.finishButtonText}>Finish →</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={contactsModalVisible} animationType="slide" onRequestClose={() => setContactsModalVisible(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Contacts</Text>
            <TouchableOpacity onPress={() => setContactsModalVisible(false)} style={styles.modalCloseButton}>
              <FontAwesome name="times" size={16} color={theme2Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search contacts"
              placeholderTextColor={theme2Colors.textSecondary}
              style={[styles.searchInput, searchFocused && styles.searchInputFocused]}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </View>

          {contactsLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme2Colors.text} />
              <Text style={styles.loadingText}>Loading contacts…</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.contactsList}>
              {filteredContacts.map((contact) => {
                const isSelected = selectedContacts.includes(contact.id)
                const detail = contact.emails[0] ?? contact.phones[0] ?? ""
                return (
                  <TouchableOpacity
                    key={contact.id}
                    style={[styles.contactRow, isSelected && styles.contactRowSelected]}
                    onPress={() => toggleContact(contact.id)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      {detail.length > 0 && <Text style={styles.contactDetail}>{detail}</Text>}
                    </View>
                    <View style={[styles.contactIndicator, isSelected && styles.contactIndicatorSelected]} />
                  </TouchableOpacity>
                )
              })}

              {filteredContacts.length === 0 && !contactsLoading && (
                <View style={styles.emptyContacts}>
                  <Text style={styles.emptyContactsText}>No contacts found. Try a different search.</Text>
                </View>
              )}
            </ScrollView>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.sendInvitesButton}
              onPress={handleSendInvites}
              disabled={contactsLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.sendInvitesButtonText}>Send invites</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

type InviteContact = {
  id: string
  name: string
  emails: string[]
  phones: string[]
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl * 4,
  },
  topBar: {
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme2Colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 40,
    color: theme2Colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: theme2Colors.text,
  },
  form: {
    marginBottom: spacing.xxl,
  },
  shareButton: {
    marginBottom: spacing.xl,
    backgroundColor: theme2Colors.blue,
    borderRadius: 25,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
  },
  secondaryButton: {
    marginBottom: spacing.xl,
    backgroundColor: "#F5F0EA",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  secondaryButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.text,
    zIndex: 2,
  },
  secondaryButtonTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
  },
  secondaryButtonTextureImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  label: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.text,
    marginBottom: spacing.md,
  },
  placeholder: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: theme2Colors.textSecondary,
    fontStyle: "italic",
  },
  buttonContainer: {
    alignItems: "flex-end",
  },
  finishButton: {
    width: 140,
    height: 60,
    backgroundColor: theme2Colors.onboardingPink,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme2Colors.blue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  finishButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
    zIndex: 2,
  },
  buttonTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    zIndex: 1,
  },
  textureImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme2Colors.beige,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: "PMGothicLudington-Text115",
    fontSize: 32,
    color: theme2Colors.text,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme2Colors.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme2Colors.text,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchInput: {
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: theme2Colors.text,
    borderRadius: 12,
    backgroundColor: theme2Colors.cream,
    fontFamily: "Roboto-Regular",
    fontSize: 16,
  },
  searchInputFocused: {
    borderColor: theme2Colors.blue,
  },
  contactsList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: theme2Colors.cream,
    borderWidth: 1,
    borderColor: theme2Colors.textSecondary,
  },
  contactRowSelected: {
    borderWidth: 2,
    borderColor: theme2Colors.blue,
  },
  contactName: {
    fontFamily: "Roboto-Bold",
    color: theme2Colors.text,
    fontSize: 16,
  },
  contactDetail: {
    fontFamily: "Roboto-Regular",
    color: theme2Colors.textSecondary,
    marginTop: spacing.xs,
    fontSize: 14,
  },
  contactIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme2Colors.textSecondary,
    backgroundColor: theme2Colors.white,
  },
  contactIndicatorSelected: {
    borderColor: theme2Colors.blue,
    backgroundColor: theme2Colors.blue,
  },
  emptyContacts: {
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyContactsText: {
    fontFamily: "Roboto-Regular",
    color: theme2Colors.textSecondary,
    fontSize: 14,
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: "Roboto-Regular",
    color: theme2Colors.text,
    fontSize: 16,
  },
  modalActions: {
    padding: spacing.lg,
  },
  sendInvitesButton: {
    backgroundColor: theme2Colors.blue,
    borderRadius: 25,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  sendInvitesButtonText: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: theme2Colors.white,
  },
})
