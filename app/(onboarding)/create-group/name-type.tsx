"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { supabase } from "../../../lib/supabase"
import { createGroup, createMemorial } from "../../../lib/db"
import { colors, spacing } from "../../../lib/theme"
import { Input } from "../../../components/Input"
import { Button } from "../../../components/Button"

export default function CreateGroupNameType() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [groupName, setGroupName] = useState("")
  const [groupType, setGroupType] = useState<"family" | "friends">("family")
  const [loading, setLoading] = useState(false)

  async function handleContinue() {
    if (!groupName.trim()) {
      Alert.alert("Error", "Please enter a group name")
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Create group
      const group = await createGroup(groupName.trim(), groupType, user.id)

      // Create memorial if provided
      if (params.memorialName) {
        await createMemorial({
          user_id: user.id,
          group_id: group.id,
          name: params.memorialName as string,
          photo_url: params.memorialPhoto as string | undefined,
        })
      }

      router.push({
        pathname: "/(onboarding)/create-group/invite",
        params: { groupId: group.id },
      })
    } catch (error: any) {
      Alert.alert("Error", error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Give your group a name</Text>
      </View>

      <View style={styles.form}>
        <Input
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Hermann family"
          autoCapitalize="words"
          style={styles.input}
        />

        <Text style={styles.label}>Who's in this group?</Text>
        <View style={styles.typeContainer}>
          <TouchableOpacity
            style={[styles.typeButton, groupType === "family" && styles.typeButtonActive]}
            onPress={() => setGroupType("family")}
          >
            <Text style={[styles.typeText, groupType === "family" && styles.typeTextActive]}>Family</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, groupType === "friends" && styles.typeButtonActive]}
            onPress={() => setGroupType("friends")}
          >
            <Text style={[styles.typeText, groupType === "friends" && styles.typeTextActive]}>Friends</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="→"
          onPress={handleContinue}
          loading={loading}
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
  input: {
    backgroundColor: colors.white,
    borderColor: colors.gray[300],
    color: colors.black,
    marginBottom: spacing.xl,
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
