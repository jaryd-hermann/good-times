import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import { Tabs } from "expo-router"
import { colors } from "../../lib/theme"
import { View, StyleSheet, TouchableOpacity, Text } from "react-native"
import { FontAwesome } from "@expo/vector-icons"

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const currentRoute = state.routes[state.index]
  if (currentRoute.name.startsWith("modals/") || currentRoute.name === "settings") {
    return null
  }

  const visibleRoutes = state.routes.filter((route) => route.name === "home" || route.name === "history")

  return (
    <View style={styles.tabBar}>
      {visibleRoutes.map((route) => {
        const isFocused = state.index === state.routes.indexOf(route)
        const label = route.name === "home" ? "Today" : "History"

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          })

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        return (
          <TouchableOpacity key={route.key} onPress={onPress} style={styles.tabButton} activeOpacity={0.8}>
            <View style={[styles.tabPill, isFocused && styles.tabPillActive]}>
              <View style={styles.tabContent}>
                <FontAwesome
                  name={route.name === "home" ? "plus" : "history"}
                  size={16}
                  color={isFocused ? colors.black : colors.gray[400]}
                />
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{label}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: "none" },
      })}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="history" />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
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
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  tabButton: {
    flex: 1,
    maxWidth: 140,
  },
  tabPill: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabPillActive: {
    backgroundColor: colors.white,
  },
  tabLabel: {
    color: colors.gray[400],
    fontFamily: "Roboto-Medium",
    fontSize: 14,
  },
  tabLabelActive: {
    color: colors.black,
  },
})
