import { Stack } from "expo-router"
import { OnboardingProvider } from "../../components/OnboardingProvider"

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          animation: "fade",
          animationDuration: 400,
        }} 
      />
    </OnboardingProvider>
  )
}
