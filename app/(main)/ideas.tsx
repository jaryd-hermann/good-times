"use client"

import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useRouter } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "../../lib/supabase"
import { getAllPrompts, getPromptsByCategory } from "../../lib/db"
import { getTodayDate } from "../../lib/utils"
import { colors, typography, spacing } from "../../lib/theme"
import { FilmFrame } from "../../components/FilmFrame"
import { Button } from "../../components/Button"
import type { PromptCategory } from "../../lib/types"

const CATEGORIES: PromptCategory[] = ["Most Popular", "Family", "Friends", "Remembering", "Fun", "Seasonal", "Birthday"]

export default function Ideas() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | "All">("All")
  const [currentGroupId, setCurrentGroupId] = useState<string>()
  const [userId, setUserId] = useState<string>()

  // Load user and group
  useState(() => {
    loadUserAndGroup()
  })

  async function loadUserAndGroup() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
      // Get user's first group
      const { data: membership } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()
      if (membership) {
        setCurrentGroupId(membership.group_id)
      }
    }
  }

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts", selectedCategory],
    queryFn: () => {
      if (selectedCategory === "All") {
        return getAllPrompts()
      } else {
        return getPromptsByCategory(selectedCategory)
      }
    },
  })

  async function handleAddToQueue(promptId: string) {
    if (!currentGroupId || !userId) return

    try {
      // Get current queue position
      const { data: queueItems } = await supabase
        .from("group_prompt_queue")
        .select("position")
        .eq("group_id", currentGroupId)
        .order("position", { ascending: false })
        .limit(1)

      const nextPosition = queueItems && queueItems.length > 0 ? queueItems[0].position + 1 : 1

      const { error } = await supabase.from("group_prompt_queue").insert({
        group_id: currentGroupId,
        prompt_id: promptId,
        added_by: userId,
        position: nextPosition,
      })

      if (error) throw error

      Alert.alert("Success", "Prompt added to your group's queue")
    } catch (error: any) {
      Alert.alert("Error", error.message)
    }
  }

  function handleAnswer(promptId: string) {
    router.push({
      pathname: "/(main)/modals/entry-composer",
      params: {
        promptId,
        date: getTodayDate(),
      },
    })
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.categorySelector}>
          <Text style={styles.categoryText}>All question ideas</Text>
          <Text style={styles.chevron}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Category filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        <TouchableOpacity
          style={[styles.categoryChip, selectedCategory === "All" && styles.categoryChipActive]}
          onPress={() => setSelectedCategory("All")}
        >
          <Text style={[styles.categoryChipText, selectedCategory === "All" && styles.categoryChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[styles.categoryChipText, selectedCategory === category && styles.categoryChipTextActive]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Prompts list */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {prompts.map((prompt) => (
          <FilmFrame key={prompt.id} style={styles.promptCard}>
            <View style={styles.promptHeader}>
              <Text style={styles.categoryBadge}>{prompt.category}</Text>
            </View>
            <Text style={styles.promptQuestion}>{prompt.question}</Text>
            <Text style={styles.promptDescription}>{prompt.description}</Text>
            <View style={styles.promptActions}>
              <Button
                title="Add to Queue"
                onPress={() => handleAddToQueue(prompt.id)}
                variant="ghost"
                style={styles.actionButton}
              />
              <Button title="Answer" onPress={() => handleAnswer(prompt.id)} style={styles.actionButton} />
            </View>
          </FilmFrame>
        ))}

        {/* Ask your own button */}
        <TouchableOpacity
          style={styles.askOwnButton}
          onPress={() => Alert.alert("Coming Soon", "Custom prompts coming soon")}
        >
          <Text style={styles.askOwnText}>Or, ask this question to your group</Text>
        </TouchableOpacity>
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
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  categorySelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    alignSelf: "flex-start",
  },
  categoryText: {
    fontFamily: "Roboto-Bold",
    fontSize: 16,
    color: colors.black,
  },
  chevron: {
    fontFamily: "Roboto-Regular",
    fontSize: 12,
    color: colors.black,
  },
  categoriesScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[800],
  },
  categoryChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.gray[800],
  },
  categoryChipActive: {
    backgroundColor: colors.accent,
  },
  categoryChipText: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.gray[400],
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  promptCard: {
    marginBottom: spacing.lg,
  },
  promptHeader: {
    marginBottom: spacing.sm,
  },
  categoryBadge: {
    ...typography.caption,
    fontSize: 12,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  promptQuestion: {
    ...typography.h3,
    fontSize: 20,
    marginBottom: spacing.sm,
  },
  promptDescription: {
    ...typography.body,
    fontSize: 14,
    color: colors.gray[400],
    marginBottom: spacing.md,
  },
  promptActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  askOwnButton: {
    padding: spacing.xl,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  askOwnText: {
    ...typography.body,
    color: colors.gray[500],
    textAlign: "center",
  },
})
