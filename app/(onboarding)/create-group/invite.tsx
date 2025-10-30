"use client"

import { View, Text, StyleSheet, ScrollView, Share, Alert } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { colors, spacing } from "../../../lib/theme"
import { Button } from "../../../components/Button"

export default function Invite() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const groupId = params.groupId as string

  async function handleShare() {
    try {
      const inviteLink = `goodtimes://join/${groupId}`
      await Share.share({
        message: `Join my Good Times group! ${inviteLink}`,
        url: inviteLink,
      })
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  function handleSkip() {
    router.replace("/(main)/home")
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Your people</Text>
        <Text style={styles.subtitle}>Let's invite everyone here who's part of this group.</Text>
      </View>

      <View style={styles.form}>
        <Button title="Share your invite link →" onPress={handleShare} variant="secondary" style={styles.shareButton} />

        <Text style={styles.label}>Contacts</Text>
        <Text style={styles.placeholder}>Contact list integration coming soon</Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Skip for now" onPress={handleSkip} variant="ghost" />
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
    alignItems: "center",
  },
})
