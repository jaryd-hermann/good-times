import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import { Tabs } from "expo-router"
import { spacing } from "../../lib/theme"
import { useTheme } from "../../lib/theme-context"
import { View, StyleSheet, TouchableOpacity, Text, Animated, Platform, Image } from "react-native"
import { FontAwesome } from "@expo/vector-icons"
import { useEffect, useRef, useMemo } from "react"
import { useTabBar } from "../../lib/tab-bar-context"
import { usePathname } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const currentRoute = state.routes[state.index]
  const previousIndexRef = useRef(state.index)
  const animatedValuesRef = useRef<Record<string, Animated.Value>>({})
  const { opacity: tabBarOpacity } = useTabBar()
  const { colors, isDark } = useTheme()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  
  // Calculate bottom offset for Android navigation bar
  const bottomOffset = Platform.OS === "android" ? insets.bottom + 24 : 24

  const visibleRoutes = state.routes.filter((route) => route.name === "home" || route.name === "explore-decks" || route.name === "history")

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

  // Create dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    tabWrapper: {
      position: "absolute",
      bottom: bottomOffset,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    tabContainer: {
      flexDirection: "row",
      backgroundColor: isDark ? "#282626" : "#ffffff",
      borderRadius: 38,
      width: 280, // Increased width to accommodate 3 tabs
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
      color: isDark ? "#848282" : colors.gray[500],
      fontFamily: "Roboto-Medium",
      fontSize: 12,
    },
    navLabelActive: {
      color: colors.white,
    },
    navItemActive: {
      backgroundColor: isDark ? "#8A8484" : colors.gray[800],
    },
  }), [colors, isDark, bottomOffset])

  // Early return AFTER all hooks
  // Hide tab bar on profile screen or other modal/settings screens
  const isProfileScreen = pathname?.includes("/settings/profile")
  if (
    isProfileScreen ||
    currentRoute.name.startsWith("modals/") ||
    currentRoute.name === "settings" ||
    currentRoute.name.startsWith("group-settings") ||
    currentRoute.name === "feedback" ||
    currentRoute.name === "custom-question-onboarding" ||
    currentRoute.name === "add-custom-question" ||
    currentRoute.name.startsWith("collection-detail") ||
    currentRoute.name.startsWith("deck-detail") ||
    currentRoute.name.startsWith("deck-vote")
  ) {
    return null
  }

  return (
    <Animated.View style={[styles.tabWrapper, { opacity: tabBarOpacity }]}>
      <View style={styles.tabContainer}>
      {visibleRoutes.map((route) => {
        const isFocused = state.index === state.routes.indexOf(route)
        const label = route.name === "home" ? "Answer" : route.name === "explore-decks" ? "Ask" : "Remember"
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

        // Determine icon source based on route
        let iconSource
        if (route.name === "home") {
          iconSource = require("../../assets/images/Answer.png")
        } else if (route.name === "explore-decks") {
          iconSource = require("../../assets/images/Ask.png")
        } else {
          iconSource = require("../../assets/images/Remember.png")
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
                <Image
                  source={iconSource}
                  style={{
                    width: 20,
                    height: 20,
                    tintColor: isFocused ? colors.white : (isDark ? "#848282" : colors.gray[500]),
                  }}
                  resizeMode="contain"
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
      <Tabs.Screen name="explore-decks" />
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
