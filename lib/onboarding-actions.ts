import { supabase } from "./supabase"
import { createGroup, createMemorial, updateQuestionCategoryPreference } from "./db"
import type { OnboardingData } from "../components/OnboardingProvider"

export async function createGroupFromOnboarding(data: OnboardingData) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You need to be signed in to create another group.")
  }

  const groupName = data.groupName?.trim()
  const groupType = data.groupType ?? "family"

  if (!groupName) {
    throw new Error("Please add a group name before continuing.")
  }

  // Pass NSFW preference to createGroup to avoid race condition
  const group = await createGroup(groupName, groupType, user.id, data.enableNSFW ?? false)

  // Set NSFW preference for friends groups (still needed for persistence)
  if (groupType === "friends") {
    // If NSFW is enabled, set preference to "more", otherwise set to "none" (disabled)
    const nsfwPreference = data.enableNSFW ? "more" : "none"
    try {
      await updateQuestionCategoryPreference(group.id, "Edgy/NSFW", nsfwPreference, user.id)
    } catch (error) {
      // If category doesn't exist yet, that's okay - it will be set later when prompts are added
      console.warn("[onboarding] Failed to set NSFW preference:", error)
    }
  }

  // Save all memorials - both from the array and the current single memorial (for backward compatibility)
  const memorialsToSave: Array<{ name: string; photo?: string }> = []
  
  // Add memorials from the array
  if (data.memorials && data.memorials.length > 0) {
    memorialsToSave.push(...data.memorials)
  }
  
  // Add current memorial if it exists and isn't already in the array
  if (data.memorialName && data.memorialName.trim().length > 0) {
    const isDuplicate = data.memorials?.some(
      (m) => m.name === data.memorialName && m.photo === data.memorialPhoto
    )
    if (!isDuplicate) {
      memorialsToSave.push({
        name: data.memorialName,
        photo: data.memorialPhoto,
      })
    }
  }

  // Create all memorials
  for (const memorial of memorialsToSave) {
    await createMemorial({
      user_id: user.id,
      group_id: group.id,
      name: memorial.name,
      photo_url: memorial.photo,
    })
  }

  return group
}

