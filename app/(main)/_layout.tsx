import { Tabs } from "expo-router"
import { colors } from "../../lib/theme"
import { View, StyleSheet } from "react-native"

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.gray[500],
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color }) => <View style={[styles.icon, { backgroundColor: color }]} />,
        }}
      />
      <Tabs.Screen
        name="ideas"
        options={{
          tabBarIcon: ({ color }) => <View style={[styles.icon, { backgroundColor: color }]} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ color }) => <View style={[styles.icon, { backgroundColor: color }]} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color }) => <View style={[styles.icon, { backgroundColor: color }]} />,
        }}
      />
      <Tabs.Screen
        name="modals/entry-detail"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="modals/entry-composer"
        options={{
          href: null,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    height: 80,
    paddingBottom: 20,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
})
