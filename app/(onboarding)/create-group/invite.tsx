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
import { OnboardingBack } from "../../../components/OnboardingBack"
import { getCurrentUser } from "../../../lib/db"
import { usePostHog } from "posthog-react-native"
import { captureEvent } from "../../../lib/posthog"

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
      // Route to post-auth onboarding screens first
      router.replace("/(onboarding)/welcome-post-auth")
      return
    }
    
    // User has completed post-auth onboarding, go to home
    if (mode === "add") {
      router.replace({
        pathname: "/(main)/home",
        params: { focusGroupId: groupId },
      })
      return
    }
    router.replace("/(main)/home")
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
        <OnboardingBack />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Your people</Text>
        <Text style={styles.subtitle}>Let's invite everyone here who's part of this group.</Text>
      </View>

      <View style={styles.form}>
        <Button
          title="Share your invite link →"
          onPress={handleShare}
          style={[styles.shareButton, styles.sharePrimary]}
          textStyle={styles.sharePrimaryText}
        />
        <Button
          title="Copy to clipboard"
          onPress={handleCopyToClipboard}
          variant="ghost"
          style={styles.contactsButton}
          textStyle={styles.contactsButtonText}
        />
        <Button
          title="Add from contacts"
          onPress={handleOpenContacts}
          variant="ghost"
          style={styles.contactsButton}
          textStyle={styles.contactsButtonText}
        />

        <Text style={styles.label}>Contacts</Text>
        <Text style={styles.placeholder}>Select friends from your contacts or share the invite link directly.</Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Finish →" onPress={handleFinish} style={styles.finishButton} />
      </View>

      <Modal visible={contactsModalVisible} animationType="slide" onRequestClose={() => setContactsModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Contacts</Text>
            <TouchableOpacity onPress={() => setContactsModalVisible(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search contacts"
              placeholderTextColor={colors.gray[500]}
              style={styles.searchInput}
            />
          </View>

          {contactsLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.accent} />
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
            <Button title="Send invites" onPress={handleSendInvites} disabled={contactsLoading} />
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
    backgroundColor: colors.white,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
  },
  topBar: {
    marginBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: "LibreBaskerville-Bold",
    fontSize: 40,
    color: colors.black,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.black,
  },
  form: {
    marginBottom: spacing.xxl,
  },
  shareButton: {
    marginBottom: spacing.xl,
  },
  sharePrimary: {
    backgroundColor: colors.black,
  },
  sharePrimaryText: {
    color: colors.white,
  },
  contactsButton: {
    marginBottom: spacing.xl,
    borderColor: colors.black,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  contactsButtonText: {
    color: colors.black,
  },
  label: {
    fontFamily: "Roboto-Bold",
    fontSize: 18,
    color: colors.black,
    marginBottom: spacing.md,
  },
  placeholder: {
    fontFamily: "Roboto-Regular",
    fontSize: 14,
    color: colors.gray[500],
    fontStyle: "italic",
  },
  buttonContainer: {
    alignItems: "flex-end",
  },
  finishButton: {
    width: 100,
    height: 60,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.black,
    paddingTop: spacing.xxl * 2,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h1,
    color: colors.white,
    fontSize: 32,
  },
  modalCloseButton: {
    padding: spacing.sm,
  },
  modalCloseText: {
    ...typography.h2,
    color: colors.white,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.gray[700],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.white,
    borderRadius: 8,
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
    backgroundColor: colors.gray[900],
  },
  contactRowSelected: {
    borderWidth: 1,
    borderColor: colors.white,
  },
  contactName: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 16,
  },
  contactDetail: {
    ...typography.body,
    color: colors.gray[400],
    marginTop: spacing.xs,
  },
  contactIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray[600],
  },
  contactIndicatorSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  emptyContacts: {
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyContactsText: {
    ...typography.body,
    color: colors.gray[400],
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.white,
  },
  modalActions: {
    padding: spacing.lg,
  },
})
