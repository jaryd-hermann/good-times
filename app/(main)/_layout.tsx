import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import { Tabs } from "expo-router"
import { colors, spacing } from "../../lib/theme"
import { View, StyleSheet, TouchableOpacity, Text } from "react-native"
import { FontAwesome } from "@expo/vector-icons"

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const currentRoute = state.routes[state.index]
  if (
    currentRoute.name.startsWith("modals/") ||
    currentRoute.name === "settings" ||
    currentRoute.name.startsWith("group-settings")
  ) {
    return null
  }

  const visibleRoutes = state.routes.filter((route) => route.name === "home" || route.name === "history")

  return (
    <View style={styles.tabWrapper}>
      <View style={styles.tabContainer}>
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
            <View style={[styles.navItem, isFocused && styles.navItemActive]}>
              <FontAwesome
                name={route.name === "home" ? "heart" : "history"}
                size={20}
                color={isFocused ? colors.white : "#848282"}
              />
              <Text style={[styles.navLabel, isFocused && styles.navLabelActive]}>{label}</Text>
            </View>
          </TouchableOpacity>
        )
      })}
      </View>
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
  tabWrapper: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#282626",
    borderRadius: 38,
    width: 194,
    height: 66,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderWidth: 0.1,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 38,
    height: "100%",
    width: "100%",
  },
  navLabel: {
    color: "#848282",
    fontFamily: "Roboto-Medium",
    fontSize: 12,
  },
  navLabelActive: {
    color: colors.white,
  },
  navItemActive: {
    backgroundColor: "#8A8484",
  },
})
