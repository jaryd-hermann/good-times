"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

interface OnboardingData {
  // Group data
  groupName?: string
  groupType?: "family" | "friends"
  
  // Memorial data
  memorialName?: string
  memorialPhoto?: string
  
  // User profile data
  userName?: string
  userBirthday?: Date
  userPhoto?: string
  userEmail?: string
  
  // Invitees (for future use)
  invitees?: string[]
}

interface OnboardingContextType {
  data: OnboardingData
  setGroupName: (name: string) => void
  setGroupType: (type: "family" | "friends") => void
  setMemorialName: (name: string) => void
  setMemorialPhoto: (photo: string | undefined) => void
  setUserName: (name: string) => void
  setUserBirthday: (birthday: Date) => void
  setUserPhoto: (photo: string | undefined) => void
  setUserEmail: (email: string) => void
  clear: () => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

const STORAGE_KEY = "onboarding-data-v1"

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    async function hydrate() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as Omit<OnboardingData, "userBirthday"> & { userBirthday?: string }
          setData({
            ...parsed,
            userBirthday: parsed.userBirthday ? new Date(parsed.userBirthday) : undefined,
          })
        }
      } catch (error) {
        console.warn("[onboarding] hydrate failed", error)
      } finally {
        setHydrated(true)
      }
    }
    hydrate()
  }, [])

  useEffect(() => {
    if (!hydrated) return
    async function persist() {
      try {
        const payload = JSON.stringify({
          ...data,
          userBirthday: data.userBirthday ? data.userBirthday.toISOString() : undefined,
        })
        await AsyncStorage.setItem(STORAGE_KEY, payload)
      } catch (error) {
        console.warn("[onboarding] persist failed", error)
      }
    }
    persist()
  }, [data, hydrated])

  const setGroupName = (name: string) => {
    setData((prev) => ({ ...prev, groupName: name }))
  }

  const setGroupType = (type: "family" | "friends") => {
    setData((prev) => ({ ...prev, groupType: type }))
  }

  const setMemorialName = (name: string) => {
    setData((prev) => ({ ...prev, memorialName: name }))
  }

  const setMemorialPhoto = (photo: string | undefined) => {
    setData((prev) => ({ ...prev, memorialPhoto: photo }))
  }

  const setUserName = (name: string) => {
    setData((prev) => ({ ...prev, userName: name }))
  }

  const setUserBirthday = (birthday: Date) => {
    setData((prev) => ({ ...prev, userBirthday: birthday }))
  }

  const setUserPhoto = (photo: string | undefined) => {
    setData((prev) => ({ ...prev, userPhoto: photo }))
  }

  const setUserEmail = (email: string) => {
    setData((prev) => ({ ...prev, userEmail: email }))
  }

  const clear = () => {
    setData({})
    AsyncStorage.removeItem(STORAGE_KEY).catch((error) => console.warn("[onboarding] clear failed", error))
  }

  return (
    <OnboardingContext.Provider
      value={{
        data,
        setGroupName,
        setGroupType,
        setMemorialName,
        setMemorialPhoto,
        setUserName,
        setUserBirthday,
        setUserPhoto,
        setUserEmail,
        clear,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider")
  }
  return context
}

