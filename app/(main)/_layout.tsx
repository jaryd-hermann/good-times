import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import { Tabs } from "expo-router"
import { colors, spacing } from "../../lib/theme"
import { View, StyleSheet, TouchableOpacity, Text, Animated } from "react-native"
import { FontAwesome } from "@expo/vector-icons"
import { useEffect, useRef } from "react"
import { useTabBar } from "../../lib/tab-bar-context"

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const currentRoute = state.routes[state.index]
  const previousIndexRef = useRef(state.index)
  const animatedValuesRef = useRef<Record<string, Animated.Value>>({})
  const { opacity: tabBarOpacity } = useTabBar()

  const visibleRoutes = state.routes.filter((route) => route.name === "home" || route.name === "history")

  // Initialize animated values for each route
  visibleRoutes.forEach((route) => {
    if (!animatedValuesRef.current[route.key]) {
      animatedValuesRef.current[route.key] = new Animated.Value(0)
    }
  })

  // Animate tab changes
  useEffect(() => {
    const currentIndex = state.index
    const previousIndex = previousIndexRef.current

    if (currentIndex !== previousIndex) {
      // Animate out previous tab
      const previousRoute = state.routes[previousIndex]
      if (previousRoute && animatedValuesRef.current[previousRoute.key]) {
        Animated.timing(animatedValuesRef.current[previousRoute.key], {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start()
      }

      // Animate in current tab
      const currentRoute = state.routes[currentIndex]
      if (currentRoute && animatedValuesRef.current[currentRoute.key]) {
        Animated.timing(animatedValuesRef.current[currentRoute.key], {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start()
      }

      previousIndexRef.current = currentIndex
    } else {
      // Initialize current tab
      const currentRoute = state.routes[currentIndex]
      if (currentRoute && animatedValuesRef.current[currentRoute.key]) {
        animatedValuesRef.current[currentRoute.key].setValue(1)
      }
    }
  }, [state.index, state.routes])

  // Early return AFTER all hooks
  if (
    currentRoute.name.startsWith("modals/") ||
    currentRoute.name === "settings" ||
    currentRoute.name.startsWith("group-settings") ||
    currentRoute.name === "feedback"
  ) {
    return null
  }

  return (
    <Animated.View style={[styles.tabWrapper, { opacity: tabBarOpacity }]}>
      <View style={styles.tabContainer}>
      {visibleRoutes.map((route) => {
        const isFocused = state.index === state.routes.indexOf(route)
        const label = route.name === "home" ? "Today" : "History"
        const animatedValue = animatedValuesRef.current[route.key] || new Animated.Value(isFocused ? 1 : 0)

        const iconScale = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.1],
        })

        const iconOpacity = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1],
        })

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
            <Animated.View 
              style={[
                styles.navItem, 
                isFocused && styles.navItemActive,
                {
                  opacity: iconOpacity,
                }
              ]}
            >
              <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                <FontAwesome
                  name={route.name === "home" ? "home" : "book"}
                  size={20}
                  color={isFocused ? colors.white : "#848282"}
                />
              </Animated.View>
              <Text style={[styles.navLabel, isFocused && styles.navLabelActive]}>{label}</Text>
            </Animated.View>
          </TouchableOpacity>
        )
      })}
      </View>
    </Animated.View>
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
