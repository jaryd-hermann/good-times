"use client"

import { useEffect } from "react"
import { useRouter } from "expo-router"
import { View, ActivityIndicator } from "react-native"
import { supabase } from "../lib/supabase"
import { colors } from "../lib/theme"

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      // Check if user has completed onboarding
      const { data: user } = await supabase.from("users").select("name, birthday").eq("id", session.user.id).single()

      if (user?.name && user?.birthday) {
        // Check if user is in a group
        const { data: membership } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", session.user.id)
          .limit(1)
          .single()

        if (membership) {
          router.replace("/(main)/home")
        } else {
          router.replace("/(onboarding)/create-group/name-type")
        }
      } else {
        router.replace("/(onboarding)/about")
      }
    } else {
      router.replace("/(onboarding)/welcome-1")
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  )
}
