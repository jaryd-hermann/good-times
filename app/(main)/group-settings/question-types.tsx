"use client"

import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { supabase } from "../../../lib/supabase"
import {
  getQuestionCategoryPreferences,
  updateQuestionCategoryPreference,
  clearQuestionCategoryPreference,
  getAllPrompts,
  isGroupAdmin,
  getGroup,
} from "../../../lib/db"
import { colors, spacing, typography } from "../../../lib/theme"
import { FontAwesome } from "@expo/vector-icons"

type Preference = "more" | "less" | "none" | null

export default function QuestionTypesSettings() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const groupId = params.groupId as string
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string>()
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [groupType, setGroupType] = useState<"family" | "friends" | null>(null)

  const { data: preferences = [] } = useQuery({
    queryKey: ["questionPreferences", groupId],
    queryFn: () => getQuestionCategoryPreferences(groupId),
    enabled: !!groupId,
  })

  const { data: allPrompts = [] } = useQuery({
    queryKey: ["allPrompts"],
    queryFn: getAllPrompts,
  })

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const admin = await isGroupAdmin(groupId, user.id)
        setIsAdmin(admin)
        if (!admin) {
          Alert.alert("Access Denied", "Only admins can change question preferences.")
          router.replace({
            pathname: "/(main)/group-settings",
            params: { groupId },
          })
        }
        // Load group type
        const group = await getGroup(groupId)
        if (group) {
          setGroupType(group.type)
        }
      }
    }
    if (groupId) {
      loadUser()
    }
  }, [groupId, router])

  // Get unique categories from prompts, filtering out Edgy/NSFW for family groups
  const allCategories = Array.from(new Set(allPrompts.map((p) => p.category))).sort()
  // Ensure "A Bit Deeper" always shows if it's in the descriptions (even if no prompts exist yet)
  const categoriesFromPrompts = groupType === "family" 
    ? allCategories.filter((c) => c !== "Edgy/NSFW")
    : allCategories
  // Add "A Bit Deeper" if it's not already in the list but is in descriptions
  const categories = categoriesFromPrompts.includes("A Bit Deeper") 
    ? categoriesFromPrompts 
    : [...categoriesFromPrompts, "A Bit Deeper"].sort()

  function getPreferenceForCategory(category: string): Preference {
    const pref = preferences.find((p) => p.category === category)
    return (pref?.preference as Preference) || null
  }

  async function handlePreferenceChange(category: string, preference: "more" | "less" | "none") {
    if (!userId || !groupId) return

    const currentPreference = getPreferenceForCategory(category)
    // If clicking the same preference, unselect it (clear the preference)
    if (currentPreference === preference) {
      setSaving(category)
      try {
        await clearQuestionCategoryPreference(groupId, category, userId)
        await queryClient.invalidateQueries({ queryKey: ["questionPreferences", groupId] })
        await queryClient.invalidateQueries({ queryKey: ["dailyPrompt"] })
      } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to clear preference")
      } finally {
        setSaving(null)
      }
      return
    }

    setSaving(category)
    try {
      await updateQuestionCategoryPreference(groupId, category, preference, userId)
      await queryClient.invalidateQueries({ queryKey: ["questionPreferences", groupId] })
      await queryClient.invalidateQueries({ queryKey: ["dailyPrompt"] })
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update preference")
    } finally {
      setSaving(null)
    }
  }

  // Category descriptions mapping
  const categoryDescriptions: Record<string, string> = {
    "Most Popular": "Questions that are frequently answered by groups",
    Family: "Questions designed for family connections and memories",
    Friends: "Questions perfect for friend groups and social circles",
    Remembering: "Questions to honor and remember loved ones",
    Fun: "Lighthearted and entertaining questions",
    Seasonal: "Questions tied to holidays and seasons",
    Birthday: "Questions for celebrating birthdays and special occasions",
    "Edgy/NSFW": "Mature content questions for adult groups",
    "A Bit Deeper": "Thought-provoking questions for deeper conversations",
  }

  if (!isAdmin) {
    return null
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Question Types</Text>
        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: "/(main)/group-settings",
              params: { groupId },
            })
          }
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>
          Control which types of questions appear in your group. Disabled categories will never appear as daily prompts.
        </Text>

        {categories.map((category) => {
          const currentPreference = getPreferenceForCategory(category)
          const isSaving = saving === category

          return (
            <View key={category} style={styles.categoryCard}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {categoryDescriptions[category] && (
                <Text style={styles.categoryDescription}>{categoryDescriptions[category]}</Text>
              )}
              <View style={styles.preferenceButtons}>
                <TouchableOpacity
                  style={[
                    styles.preferenceButton,
                    currentPreference === "more" && styles.preferenceButtonActive,
                    isSaving && styles.preferenceButtonDisabled,
                  ]}
                  onPress={() => handlePreferenceChange(category, "more")}
                  disabled={isSaving}
                >
                  <Text
                    style={[
                      styles.preferenceButtonText,
                      currentPreference === "more" && styles.preferenceButtonTextActive,
                    ]}
                  >
                    More
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.preferenceButton,
                    currentPreference === "less" && styles.preferenceButtonActive,
                    isSaving && styles.preferenceButtonDisabled,
                  ]}
                  onPress={() => handlePreferenceChange(category, "less")}
                  disabled={isSaving}
                >
                  <Text
                    style={[
                      styles.preferenceButtonText,
                      currentPreference === "less" && styles.preferenceButtonTextActive,
                    ]}
                  >
                    Less
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.preferenceButton,
                    currentPreference === "none" && styles.preferenceButtonActive,
                    isSaving && styles.preferenceButtonDisabled,
                  ]}
                  onPress={() => handlePreferenceChange(category, "none")}
                  disabled={isSaving}
                >
                  <Text
                    style={[
                      styles.preferenceButtonText,
                      currentPreference === "none" && styles.preferenceButtonTextActive,
                    ]}
                  >
                    None
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    ...typography.h2,
    color: colors.white,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.gray[400],
    marginBottom: spacing.sm,
  },
  categoryCard: {
    backgroundColor: colors.gray[900],
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  categoryTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  categoryDescription: {
    ...typography.caption,
    color: colors.gray[400],
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  preferenceButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  preferenceButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.gray[800],
    alignItems: "center",
  },
  preferenceButtonActive: {
    backgroundColor: colors.accent,
  },
  preferenceButtonDisabled: {
    opacity: 0.5,
  },
  preferenceButtonText: {
    ...typography.bodyMedium,
    color: colors.gray[300],
  },
  preferenceButtonTextActive: {
    color: colors.white,
  },
})

