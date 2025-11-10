"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useRouter } from "expo-router"
import { colors, spacing } from "../../../lib/theme"
import { Input } from "../../../components/Input"
import { Button } from "../../../components/Button"
import { OnboardingBack } from "../../../components/OnboardingBack"
import { useOnboarding } from "../../../components/OnboardingProvider"

export default function CreateGroupNameType() {
  const router = useRouter()
  const { setGroupName, setGroupType, data } = useOnboarding()
  const [groupName, setLocalGroupName] = useState(data.groupName || "")
  const [groupType, setLocalGroupType] = useState<"family" | "friends">(data.groupType || "family")

  function handleContinue() {
    if (!groupName.trim()) {
      Alert.alert("Error", "Please enter a group name")
      return
    }

    setGroupName(groupName.trim())
    setGroupType(groupType)
    router.push("/(onboarding)/memorial")
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <OnboardingBack />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Give your group a name</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.prompt}>What should we call this group?</Text>
        <Input
          value={groupName}
          onChangeText={setLocalGroupName}
          placeholder="Hermann family"
          autoCapitalize="words"
          placeholderTextColor={colors.gray[500]}
          style={styles.inlineInput}
        />

        <Text style={styles.label}>Who's in this group?</Text>
        <View style={styles.typeContainer}>
          <TouchableOpacity
            style={[styles.typeButton, groupType === "family" && styles.typeButtonActive]}
            onPress={() => setLocalGroupType("family")}
          >
            <Text style={[styles.typeText, groupType === "family" && styles.typeTextActive]}>Family</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, groupType === "friends" && styles.typeButtonActive]}
            onPress={() => setLocalGroupType("friends")}
          >
            <Text style={[styles.typeText, groupType === "friends" && styles.typeTextActive]}>Friends</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="→"
          onPress={handleContinue}
          style={styles.button}
          textStyle={styles.buttonText}
        />
      </View>
    </ScrollView>
  )
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
})
