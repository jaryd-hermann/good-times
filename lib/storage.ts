import { supabase } from "./supabase"
import * as FileSystem from "expo-file-system/legacy"
import { decode } from "base64-arraybuffer"

export async function uploadMedia(
  groupId: string,
  entryId: string,
  fileUri: string,
  fileType: "photo" | "video" | "audio",
): Promise<string> {
  try {
    // Read file as base64 - SDK 54 uses string literal
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: "base64" as any,
    })

    // Generate unique filename
    const fileExt = fileUri.split(".").pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${groupId}/${entryId}/${fileName}`

    // Upload to Supabase storage
    const { data, error } = await supabase.storage.from("entries-media").upload(filePath, decode(base64), {
      contentType: getContentType(fileType, fileExt || ""),
      upsert: false,
    })

    if (error) throw error

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("entries-media").getPublicUrl(data.path)

    return publicUrl
  } catch (error) {
    console.error("[v0] Error uploading media:", error)
    throw error
  }
}

function getContentType(fileType: "photo" | "video" | "audio", fileExt: string): string {
  if (fileType === "photo") {
    return `image/${fileExt}`
  } else if (fileType === "video") {
    return `video/${fileExt}`
  } else if (fileType === "audio") {
    return `audio/${fileExt}`
  }
  return "application/octet-stream"
}

export async function deleteMedia(url: string): Promise<void> {
  try {
    const path = url.split("/entries-media/")[1]
    if (!path) return

    const { error } = await supabase.storage.from("entries-media").remove([path])
    if (error) throw error
  } catch (error) {
    console.error("[v0] Error deleting media:", error)
    throw error
  }
}

export async function uploadAvatar(localUri: string, userId: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: "base64" as any,
    })

    if (!base64 || base64.length === 0) {
      throw new Error("Failed to read image file")
    }

    const fileExt = localUri.split(".").pop() ?? "jpg"
    const fileName = `${userId}-${Date.now()}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    const contentType = `image/${fileExt === "png" ? "png" : fileExt === "webp" ? "webp" : "jpeg"}`

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, decode(base64), {
      cacheControl: "3600",
      upsert: true,
      contentType,
    })

    if (uploadError) throw uploadError

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error("[storage] Error uploading avatar:", error)
    throw error
  }
}
