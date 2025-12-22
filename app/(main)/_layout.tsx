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

  const visibleRoutes = state.routes.filter((route) => route.name === "home" || route.name === "explore-decks")

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

  // Theme 2 color palette - dynamic based on dark/light mode
  const theme2Colors = useMemo(() => {
    if (isDark) {
      // Dark mode colors
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#000000", // Black (was beige)
        cream: "#000000", // Black (was cream)
        white: "#E8E0D5", // Beige (was white)
        text: "#F5F0EA", // Cream (was black) - text color
        textSecondary: "#A0A0A0", // Light gray (was dark gray)
      }
    } else {
      // Light mode colors (current/default)
      return {
        red: "#B94444",
        yellow: "#E8A037",
        green: "#2D6F4A",
        blue: "#3A5F8C",
        beige: "#E8E0D5",
        cream: "#F5F0EA",
        white: "#FFFFFF",
        text: "#000000",
        textSecondary: "#404040",
      }
    }
  }, [isDark])

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
      backgroundColor: isDark ? "#000000" : theme2Colors.cream, // Black in dark mode, cream in light mode
      borderRadius: 38,
      width: 200, // Width to accommodate 2 tabs
      height: 76, // Increased height slightly
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      borderWidth: 2,
      borderColor: theme2Colors.blue, // Blue stroke not yellow
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
      position: "relative", // For absolute positioning of texture
      overflow: "hidden", // Ensure texture stays within bounds
    },
    tabContainerTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.4, // Adjust opacity to taste
      zIndex: 2, // Above background but below tab content
      pointerEvents: "none", // Allow touches to pass through
      borderRadius: 38, // Match container border radius
      overflow: "hidden", // Ensure texture respects border radius
      backgroundColor: "transparent", // Ensure no background interferes
    },
    tabButton: {
      flex: 1,
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      zIndex: 3, // Above texture overlay
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
      color: theme2Colors.textSecondary,
      fontFamily: "Roboto-Medium",
      fontSize: 12,
    },
    navLabelActive: {
      color: isDark ? "#000000" : theme2Colors.text, // Black text in dark mode when selected (cream background), normal text in light mode
    },
    navItemActive: {
      backgroundColor: isDark ? "#F5F0EA" : theme2Colors.cream, // Keep cream (#F5F0EA) in dark mode for selected state, cream in light mode
      borderWidth: 2,
      borderColor: theme2Colors.blue, // Blue outline
      position: "relative", // For absolute positioning of texture
      overflow: "hidden", // Ensure texture stays within bounds
    },
    navItemActiveTexture: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.4, // Adjust opacity to taste
      zIndex: 1, // Above background but below icon/text
      pointerEvents: "none", // Allow touches to pass through
      borderRadius: 36, // Slightly less than navItemActive to account for border
      overflow: "hidden", // Ensure texture respects border radius
      backgroundColor: "transparent", // Ensure no background interferes
    },
  }), [bottomOffset, theme2Colors, isDark])

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
    currentRoute.name.startsWith("deck-vote") ||
    currentRoute.name === "birthday-card-details"
  ) {
    return null
  }

  return (
    <Animated.View style={[styles.tabWrapper, { opacity: tabBarOpacity }]}>
      <View style={styles.tabContainer}>
        {/* Texture overlay for entire nav container - must be inside container to respect borderRadius */}
        <View style={styles.tabContainerTexture} pointerEvents="none">
          <Image
            source={require("../../assets/images/texture.png")}
            style={{ 
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              height: "100%",
              borderRadius: 38, // Match container border radius
            }}
            resizeMode="cover"
          />
        </View>
      {visibleRoutes.map((route) => {
        const isFocused = state.index === state.routes.indexOf(route)
        const label = route.name === "home" ? "Answer" : "Ask"
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
          iconSource = require("../../assets/images/1.png")
        } else {
          iconSource = require("../../assets/images/Ask.png")
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
              {/* Texture overlay for selected state */}
              {isFocused && (
                <View style={styles.navItemActiveTexture} pointerEvents="none">
                  <Image
                    source={require("../../assets/images/texture.png")}
                    style={{ 
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      width: "100%",
                      height: "100%",
                      borderRadius: 36, // Match navItemActive border radius
                    }}
                    resizeMode="cover"
                  />
                </View>
              )}
              <Animated.View style={{ transform: [{ scale: iconScale }], position: "relative", zIndex: 2 }}>
                <Image
                  source={iconSource}
                  style={{
                    width: route.name === "home" ? 40 : 20, // Larger icon for Answer tab
                    height: route.name === "home" ? 40 : 20, // Larger icon for Answer tab
                    // For Answer tab (home route), show in color when focused, gray when not focused
                    // For Ask tab, always use tintColor
                    tintColor: route.name === "home" 
                      ? (isFocused ? undefined : theme2Colors.textSecondary) // No tint when focused (full color), gray tint when not focused
                      : (isFocused ? (isDark ? "#000000" : theme2Colors.text) : theme2Colors.textSecondary), // Ask tab: black when focused in dark mode (cream bg), normal text in light mode, gray when not
                    opacity: route.name === "home" && !isFocused ? 0.6 : 1, // Slight opacity reduction for Answer tab when not focused
                  }}
                  resizeMode="contain"
                />
              </Animated.View>
              {/* Only show label for Ask tab, hide for Answer tab */}
              {route.name !== "home" && (
                <Text style={[styles.navLabel, isFocused && styles.navLabelActive, { position: "relative", zIndex: 2 }]}>{label}</Text>
              )}
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
