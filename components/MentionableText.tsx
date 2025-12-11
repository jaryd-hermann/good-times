"use client"

import React, { useEffect, useState } from "react"
import { Text, Alert, Linking } from "react-native"
import { getGroupMembers } from "../lib/db"

interface MentionableTextProps {
  text: string
  textStyle: any
  linkStyle: any
  mentionStyle: any
  groupId: string
  onMentionPress: (userId: string, userName: string, avatarUrl?: string) => void
  numberOfLines?: number // Optional prop for text truncation
}

export function MentionableText({
  text,
  textStyle,
  linkStyle,
  mentionStyle,
  groupId,
  onMentionPress,
  numberOfLines,
}: MentionableTextProps) {
  const [members, setMembers] = useState<Array<{ user_id: string; user?: { name?: string; avatar_url?: string } }>>([])
  
  // Fetch group members to resolve mentions
  useEffect(() => {
    async function loadMembers() {
      if (!groupId) return
      try {
        const groupMembers = await getGroupMembers(groupId)
        setMembers(groupMembers)
      } catch (error) {
        console.error("[MentionableText] Failed to load members:", error)
      }
    }
    loadMembers()
  }, [groupId])
  
  // URL regex pattern - matches http/https URLs
  const urlRegex = /(https?:\/\/[^\s]+)/gi
  // Mention regex pattern - matches @Name (word characters only)
  const mentionRegex = /@(\w+)/g
  
  const parts: Array<{ text: string; type: "text" | "link" | "mention"; userId?: string; userName?: string; avatarUrl?: string }> = []
  let lastIndex = 0
  
  // Find all URLs and mentions
  const allMatches: Array<{ index: number; length: number; type: "link" | "mention"; text: string; userId?: string; userName?: string; avatarUrl?: string }> = []
  
  // Find URLs
  let match
  while ((match = urlRegex.exec(text)) !== null) {
    allMatches.push({
      index: match.index,
      length: match[0].length,
      type: "link",
      text: match[0],
    })
  }
  
  // Find mentions
  mentionRegex.lastIndex = 0 // Reset regex
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionName = match[1]
    // Find user ID for this mention
    const member = members.find((m) => 
      m.user?.name?.toLowerCase() === mentionName.toLowerCase()
    )
    if (member) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type: "mention",
        text: match[0],
        userId: member.user_id,
        userName: member.user?.name,
        avatarUrl: member.user?.avatar_url,
      })
    }
  }
  
  // Sort matches by index
  allMatches.sort((a, b) => a.index - b.index)
  
  // Build parts array
  for (const match of allMatches) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        type: "text",
      })
    }
    
    // Add the match
    parts.push({
      text: match.text,
      type: match.type,
      userId: match.userId,
      userName: match.userName,
      avatarUrl: match.avatarUrl,
    })
    
    lastIndex = match.index + match.length
  }
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      type: "text",
    })
  }
  
  // If no matches found, return plain text
  if (parts.length === 0) {
    return <Text style={textStyle} numberOfLines={numberOfLines}>{text}</Text>
  }
  
  const handleLinkPress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        Alert.alert("Error", "Cannot open this URL")
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open URL")
    }
  }
  
  const handleMentionPress = (userId: string, userName: string, avatarUrl?: string) => {
    if (userId && userName) {
      onMentionPress(userId, userName, avatarUrl)
    }
  }
  
  return (
    <Text style={textStyle} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        if (part.type === "link") {
          return (
            <Text
              key={index}
              style={linkStyle}
              onPress={() => handleLinkPress(part.text)}
            >
              {part.text}
            </Text>
          )
        } else if (part.type === "mention" && part.userId && part.userName) {
          return (
            <Text
              key={index}
              style={mentionStyle}
              onPress={() => handleMentionPress(part.userId!, part.userName!, part.avatarUrl)}
            >
              {part.userName}
            </Text>
          )
        }
        return <Text key={index}>{part.text}</Text>
      })}
    </Text>
  )
}

