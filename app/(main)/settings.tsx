"use client"

import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native"
import { useRouter } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/AuthProvider"
import { colors } from "@/lib/theme"

export default function SettingsScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("*, memorial_person_name, memorial_person_group_id")
        .eq("id", user?.id)
        .single()
      return data
    },
  })

  const { data: memorialGroup } = useQuery({
    queryKey: ["memorial-group", profile?.memorial_person_group_id],
    queryFn: async () => {
      if (!profile?.memorial_person_group_id) return null
      const { data } = await supabase.from("groups").select("name").eq("id", profile.memorial_person_group_id).single()
      return data
    },
    enabled: !!profile?.memorial_person_group_id,
  })

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut()
          router.replace("/(auth)/sign-in")
        },
      },
    ])
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 32, fontFamily: "LibreBaskerville-Bold", color: colors.text, marginBottom: 30 }}>
          Settings
        </Text>

        {/* Profile Section */}
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 18, fontFamily: "LibreBaskerville-Bold", color: colors.text, marginBottom: 15 }}>
            Profile
          </Text>
          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 16, color: colors.text, marginBottom: 8 }}>{profile?.full_name}</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>{user?.email}</Text>
          </View>
        </View>

        {/* Memorial Person Section */}
        {profile?.memorial_person_name && (
          <View style={{ marginBottom: 30 }}>
            <Text style={{ fontSize: 18, fontFamily: "LibreBaskerville-Bold", color: colors.text, marginBottom: 15 }}>
              In Memory Of
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 16, color: colors.text, marginBottom: 4 }}>{profile.memorial_person_name}</Text>
              {memorialGroup && (
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Group: {memorialGroup.name}</Text>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={{ marginTop: 20 }}>
          <TouchableOpacity
            onPress={handleSignOut}
            style={{
              backgroundColor: colors.error,
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontFamily: "Roboto-Medium" }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}
