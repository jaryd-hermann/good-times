import React, { createContext, useContext, useRef, useState } from "react"
import { Animated } from "react-native"
import { ScrollView } from "react-native"

interface TabBarContextType {
  opacity: Animated.Value
  scrollToTop: () => void
  setScrollToTopCallback: (callback: () => void) => void
  showBackToTop: boolean
  setShowBackToTop: (show: boolean) => void
  backToTopOpacity: Animated.Value
}

const TabBarContext = createContext<TabBarContextType | undefined>(undefined)

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current
  const scrollToTopCallbackRef = useRef<(() => void) | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const backToTopOpacity = useRef(new Animated.Value(0)).current

  const scrollToTop = () => {
    if (scrollToTopCallbackRef.current) {
      scrollToTopCallbackRef.current()
    }
  }

  const setScrollToTopCallback = (callback: () => void) => {
    scrollToTopCallbackRef.current = callback
  }

  return (
    <TabBarContext.Provider value={{ 
      opacity, 
      scrollToTop, 
      setScrollToTopCallback,
      showBackToTop,
      setShowBackToTop,
      backToTopOpacity
    }}>
      {children}
    </TabBarContext.Provider>
  )
}

export function useTabBar() {
  const context = useContext(TabBarContext)
  if (!context) {
    throw new Error("useTabBar must be used within TabBarProvider")
  }
  return context
}

