"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { typography, spacing } from "../lib/theme"
import { useTheme } from "../lib/theme-context"
import { Avatar } from "./Avatar"

interface MentionUser {
  id: string
  name: string
  avatar_url?: string
}

interface MentionAutocompleteProps {
  visible: boolean
  query: string // The text after "@" (e.g., "b" for "@b")
  users: MentionUser[]
  onSelect: (user: MentionUser) => void
  position: { x: number; y: number } | null
}

export function MentionAutocomplete({
  visible,
  query,
  users,
  onSelect,
  position,
}: MentionAutocompleteProps) {
  const { colors, isDark } = useTheme()

  // Filter users based on query (case-insensitive)
  const filteredUsers = useMemo(() => {
    if (!query) return users.slice(0, 5) // Show first 5 if no query
    
    const lowerQuery = query.toLowerCase()
    return users
      .filter((user) => user.name.toLowerCase().startsWith(lowerQuery))
      .slice(0, 5) // Limit to 5 results
  }, [query, users])

  if (!visible || filteredUsers.length === 0) return null

  const styles = StyleSheet.create({
    container: {
      position: position ? "absolute" : "relative", // Use relative when inside ScrollView
      backgroundColor: colors.gray[900],
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.gray[700],
      width: "100%", // Use full width of parent container
      maxWidth: 280, // But limit max width
      maxHeight: 200,
      marginTop: position ? 0 : 8, // Add margin when using relative positioning
      // Only apply zIndex and elevation when using absolute positioning
      ...(position ? {
        zIndex: 1000,
        elevation: 10,
      } : {}),
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray[800],
    },
    itemLast: {
      borderBottomWidth: 0,
    },
    name: {
      ...typography.body,
      color: colors.white,
      fontSize: 16,
    },
  })

  return (
    <View
      style={[
        styles.container,
        position && {
          top: position.y,
          left: position.x,
        },
      ]}
    >
      {filteredUsers.map((item, index) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.item, index === filteredUsers.length - 1 && styles.itemLast]}
          onPress={() => onSelect(item)}
          activeOpacity={0.7}
        >
          <Avatar uri={item.avatar_url} name={item.name} size={32} />
          <Text style={styles.name}>{item.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

