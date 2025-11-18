"use client"

import { useState, useRef } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Modal } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { colors, spacing, typography } from "../../../lib/theme"
import { Input } from "../../../components/Input"
import { Button } from "../../../components/Button"
import { OnboardingBack } from "../../../components/OnboardingBack"
import { useOnboarding } from "../../../components/OnboardingProvider"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function CreateGroupNameType() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const mode = params.mode as string | undefined
  const { setGroupName, setGroupType, setEnableNSFW, data } = useOnboarding()
  const [groupName, setLocalGroupName] = useState(data.groupName || "")
  const [groupType, setLocalGroupType] = useState<"family" | "friends">(data.groupType || "family")
  const [enableNSFW, setLocalEnableNSFW] = useState(data.enableNSFW || false)
  const [showNSFWModal, setShowNSFWModal] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const inputRef = useRef<any>(null)
  const insets = useSafeAreaInsets()

  function handleContinue() {
    if (!groupName.trim()) {
      Alert.alert("Error", "Please enter a group name")
      return
    }

    setGroupName(groupName.trim())
    setGroupType(groupType)
    setEnableNSFW(enableNSFW)
    router.push({
      pathname: "/(onboarding)/memorial",
      params: mode ? { mode } : undefined,
    })
  }

  function handleGroupTypeChange(type: "family" | "friends") {
    setLocalGroupType(type)
    // Reset NSFW when switching to family
    if (type === "family") {
      setLocalEnableNSFW(false)
      setEnableNSFW(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onFocus={() => {
          // Scroll up slightly when input is focused
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({ y: 100, animated: true })
          }, 100)
        }}
      >
        <View style={styles.topBar}>
          <OnboardingBack />
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Give your group a name</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.prompt}>What should we call this group?</Text>
          <Input
            ref={inputRef}
            value={groupName}
            onChangeText={setLocalGroupName}
            placeholder="Hermann family"
            autoCapitalize="words"
            placeholderTextColor={colors.gray[500]}
            style={styles.inlineInput}
            onFocus={() => {
              // Scroll up when keyboard opens
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 100, animated: true })
              }, 100)
            }}
          />

        <Text style={styles.label}>Who's in this group?</Text>
        <View style={styles.typeContainer}>
          <TouchableOpacity
            style={[styles.typeButton, groupType === "family" && styles.typeButtonActive]}
            onPress={() => handleGroupTypeChange("family")}
          >
            <Text style={[styles.typeText, groupType === "family" && styles.typeTextActive]}>Family</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, groupType === "friends" && styles.typeButtonActive]}
            onPress={() => handleGroupTypeChange("friends")}
          >
            <Text style={[styles.typeText, groupType === "friends" && styles.typeTextActive]}>Friends</Text>
          </TouchableOpacity>
        </View>

        {groupType === "friends" && (
          <View style={styles.nsfwSection}>
            <View style={styles.nsfwRow}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => {
                  const newValue = !enableNSFW
                  setLocalEnableNSFW(newValue)
                  setEnableNSFW(newValue)
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, enableNSFW && styles.checkboxChecked]}>
                  {enableNSFW && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Include NSFW questions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowNSFWModal(true)}
                style={styles.meaningLink}
              >
                <Text style={styles.meaningLinkText}>Meaning?</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={showNSFWModal}
        onRequestClose={() => setShowNSFWModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowNSFWModal(false)}
        >
          <View 
            style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.lg }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>NSFW Questions</Text>
            <Text style={styles.modalText}>
              These are a little more spicy questions designed for close friend groups to have some riskier fun. Nothing crazy embarassing or explicit, and all still in the spirit of bonding.{"\n\n"}You can turn these questions on or off, or change the frequency of them, anytime in your group settings.
            </Text>
            <Button
              title="Got it"
              onPress={() => setShowNSFWModal(false)}
              style={styles.modalButton}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.buttonContainer}>
        <Button
          title="→"
          onPress={handleContinue}
          style={styles.button}
          textStyle={styles.buttonText}
        />
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollView: {
    flex: 1,
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
    fontSize: 32,
    color: colors.black,
  },
  form: {
    marginBottom: spacing.xxl,
  },
  prompt: {
    fontFamily: "Roboto-Regular",
    fontSize: 16,
    color: colors.black,
    marginBottom: spacing.xs,
  },
  inlineInput: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: spacing.xs,
    minHeight: undefined,
    height: undefined,
    fontFamily: "LibreBaskerville-Regular",
    fontSize: 26,
    lineHeight: 32,
    color: colors.black,
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  label: {
    fontFamily: "Roboto-Medium",
    fontSize: 16,
    color: colors.black,
    marginBottom: spacing.md,
  },
  typeContainer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  typeButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  typeButtonActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  typeText: {
    fontFamily: "LibreBaskerville-Regular",
    fontSize: 20,
    color: colors.gray[500],
  },
  typeTextActive: {
    color: colors.white,
  },
  buttonContainer: {
    alignItems: "flex-end",
  },
  button: {
    width: 100,
    height: 60,
  },
  buttonText: {
    fontSize: 32,
  },
  nsfwSection: {
    marginTop: spacing.lg,
  },
  nsfwRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.black,
    marginRight: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.black,
  },
  checkmark: {
    color: colors.white,
    fontSize: 16,
    fontFamily: "Roboto-Bold",
  },
  checkboxLabel: {
    ...typography.body,
    fontSize: 16,
    color: colors.black,
  },
  meaningLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  meaningLinkText: {
    ...typography.body,
    fontSize: 16,
    color: colors.black,
    textDecorationLine: "underline",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.black,
    padding: spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 24,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  modalText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.gray[300],
  },
  modalButton: {
    marginTop: spacing.md,
  },
})
