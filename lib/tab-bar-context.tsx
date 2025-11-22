import React, { createContext, useContext, useRef } from "react"
import { Animated } from "react-native"

interface TabBarContextType {
  opacity: Animated.Value
}

const TabBarContext = createContext<TabBarContextType | undefined>(undefined)

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current

  return <TabBarContext.Provider value={{ opacity }}>{children}</TabBarContext.Provider>
}

export function useTabBar() {
  const context = useContext(TabBarContext)
  if (!context) {
    throw new Error("useTabBar must be used within TabBarProvider")
  }
  return context
}

