import { supabase } from "./supabase"
import { createGroup, createMemorial, updateQuestionCategoryPreference } from "./db"
import { uploadMemorialPhoto, isLocalFileUri } from "./storage"
import { getTodayDate } from "./utils"
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

  // Check if memorials will be created (before creating group to pass to queue initialization)
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

  const hasMemorials = memorialsToSave.length > 0

  // Pass NSFW and memorial preferences to createGroup to avoid race condition
  const group = await createGroup(groupName, groupType, user.id, data.enableNSFW ?? false, hasMemorials)

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

  // Create all memorials (after group is created)
  for (const memorial of memorialsToSave) {
    // Upload memorial photo if it's a local file path
    let photoUrl = memorial.photo
    if (photoUrl && isLocalFileUri(photoUrl)) {
      try {
        console.log(`[onboarding-actions] Uploading memorial photo for ${memorial.name}...`)
        photoUrl = await uploadMemorialPhoto(photoUrl, user.id, group.id)
        console.log(`[onboarding-actions] ✅ Memorial photo uploaded:`, photoUrl)
      } catch (error: any) {
        console.error(`[onboarding-actions] ❌ Failed to upload memorial photo:`, error)
        // Continue without photo if upload fails
        photoUrl = undefined
      }
    }
    
    await createMemorial({
      user_id: user.id,
      group_id: group.id,
      name: memorial.name,
      photo_url: photoUrl,
    })
  }

  // Schedule an ice breaker question immediately for the new group (ice_breaker_order = 1)
  // This ensures new groups always have a question when they first open the app
  try {
    console.log(`[onboarding-actions] Scheduling ice breaker question for new group ${group.id}...`)
    const today = getTodayDate()
    
    // Small delay to ensure queue initialization completes
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Get the first ice breaker question (ice_breaker_order = 1)
    const { data: iceBreakerPrompt, error: iceBreakerError } = await supabase
      .from("prompts")
      .select("id")
      .eq("ice_breaker", true)
      .eq("ice_breaker_order", 1)
      .maybeSingle()
    
    if (iceBreakerPrompt && !iceBreakerError) {
      // Check if a prompt already exists for today (shouldn't happen for new group, but check anyway)
      const { data: existingPrompt } = await supabase
        .from("daily_prompts")
        .select("id")
        .eq("group_id", group.id)
        .eq("date", today)
        .is("user_id", null)
        .maybeSingle()
      
      if (!existingPrompt) {
        // Insert the ice breaker question
        const { error: insertError } = await supabase
          .from("daily_prompts")
          .insert({
            group_id: group.id,
            prompt_id: iceBreakerPrompt.id,
            date: today,
          })
        
        if (insertError) {
          console.error(`[onboarding-actions] Failed to insert ice breaker prompt:`, insertError)
        } else {
          console.log(`[onboarding-actions] ✅ Ice breaker question (order 1) scheduled for new group`)
        }
      } else {
        console.log(`[onboarding-actions] Daily prompt already exists for today, skipping ice breaker`)
      }
    } else {
      console.warn(`[onboarding-actions] Ice breaker question (order 1) not found:`, iceBreakerError)
    }
  } catch (error: any) {
    console.error(`[onboarding-actions] Error scheduling ice breaker question:`, error)
    // This is critical - try to schedule via the function as fallback
    try {
      const { error: scheduleError } = await supabase.functions.invoke("schedule-daily-prompts")
      if (scheduleError) {
        console.error(`[onboarding-actions] Fallback schedule-daily-prompts also failed:`, scheduleError)
      }
    } catch (fallbackError) {
      console.error(`[onboarding-actions] Fallback scheduling failed:`, fallbackError)
    }
  }

  return group
}

