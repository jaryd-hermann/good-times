import { supabase } from "./supabase"
import * as FileSystem from "expo-file-system/legacy"
import { decode } from "base64-arraybuffer"

export async function uploadMedia(
  groupId: string,
  entryId: string,
  fileUri: string,
  fileType: "photo" | "video" | "audio",
  options?: {
    maxVideoSize?: number // Optional override for video max size (in bytes)
    maxPhotoSize?: number // Optional override for photo max size (in bytes)
    maxAudioSize?: number // Optional override for audio max size (in bytes)
  }
): Promise<string> {
  try {
    // CRITICAL: Validate file exists and check size BEFORE reading into memory
    // This prevents memory crashes with large files
    const fileInfo = await FileSystem.getInfoAsync(fileUri)
    if (!fileInfo.exists) {
      throw new Error("File does not exist")
    }

    // Check file size before attempting to read into memory
    // This is critical to prevent crashes with large videos
    if (fileInfo.size !== undefined) {
      const MAX_VIDEO_SIZE = options?.maxVideoSize ?? (100 * 1024 * 1024) // Default 100MB, can be overridden
      const MAX_PHOTO_SIZE = options?.maxPhotoSize ?? (50 * 1024 * 1024) // Default 50MB, can be overridden
      const MAX_AUDIO_SIZE = options?.maxAudioSize ?? (50 * 1024 * 1024) // Default 50MB, can be overridden
      
      const maxSize = fileType === "video" ? MAX_VIDEO_SIZE : fileType === "audio" ? MAX_AUDIO_SIZE : MAX_PHOTO_SIZE
      
      if (fileInfo.size > maxSize) {
        const sizeMB = (fileInfo.size / (1024 * 1024)).toFixed(1)
        const maxMB = (maxSize / (1024 * 1024)).toFixed(0)
        throw new Error(`File is too large (${sizeMB}MB). Maximum size for ${fileType}s is ${maxMB}MB. Please choose a smaller file.`)
      }
    }

    // Read file as base64 - SDK 54 uses string literal
    // Wrap in try-catch to handle memory issues with large files
    let base64: string
    try {
      base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: "base64" as any,
      })
    } catch (readError: any) {
      // Check if it's a memory-related error
      if (readError.message?.includes("memory") || readError.message?.includes("too large") || readError.message?.includes("out of memory")) {
        throw new Error("File is too large to upload. The app ran out of memory. Please try a smaller file.")
      }
      throw new Error(`Failed to read file: ${readError.message || "Unknown error"}`)
    }

    if (!base64 || base64.length === 0) {
      throw new Error("File is empty or could not be read")
    }

    // Generate unique filename
    const fileExt = fileUri.split(".").pop() || (fileType === "video" ? "mp4" : fileType === "audio" ? "m4a" : "jpg")
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${groupId}/${entryId}/${fileName}`

    // Upload to Supabase storage
    // Wrap decode in try-catch to handle memory issues
    let decodedData: ArrayBuffer
    try {
      decodedData = decode(base64)
    } catch (decodeError: any) {
      if (decodeError.message?.includes("memory") || decodeError.message?.includes("too large")) {
        throw new Error("File is too large to upload. Please try a smaller file.")
      }
      throw new Error(`Failed to process file: ${decodeError.message || "Unknown error"}`)
    }

    const { data, error } = await supabase.storage.from("entries-media").upload(filePath, decodedData, {
      contentType: getContentType(fileType, fileExt),
      upsert: false,
    })

    if (error) {
      // Provide more specific error messages
      if (error.message?.includes("size") || error.message?.includes("large")) {
        throw new Error("File is too large to upload. Please try a smaller file.")
      }
      throw error
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("entries-media").getPublicUrl(data.path)

    return publicUrl
  } catch (error: any) {
    console.error("[storage] Error uploading media:", error)
    // Re-throw with more user-friendly message if it's our custom error
    if (error.message && (error.message.includes("too large") || error.message.includes("memory"))) {
      throw error
    }
    // Otherwise wrap in a more user-friendly error
    throw new Error(`Failed to upload ${fileType}: ${error.message || "Unknown error"}`)
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

// Helper function to check if a URI is a local file path
// This detects local file paths that need to be uploaded to storage
export function isLocalFileUri(uri: string | undefined): boolean {
  if (!uri) return false
  
  // If it's already an HTTPS/HTTP URL, it's not a local file
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return false
  }
  
  // Check for various local file URI formats:
  // - file:// (standard on iOS/Android)
  // - file:/ (iOS sometimes uses this)
  // - Starts with / (absolute path on iOS simulator or Android)
  // - Starts with file: (any file: protocol)
  // - Starts with content:// (Android content URI)
  // - Starts with ph:// (iOS Photo Library identifier - needs to be converted)
  const isLocalFile = (
    uri.startsWith("file://") ||
    uri.startsWith("file:/") ||
    (uri.startsWith("/") && !uri.startsWith("//")) || // Absolute path but not // (which is http)
    uri.startsWith("file:") ||
    uri.startsWith("content://") ||
    uri.startsWith("ph://") ||
    uri.startsWith("assets-library://") // Legacy iOS format
  )
  
  if (isLocalFile) {
    console.log(`[storage] Detected local file URI: ${uri.substring(0, 50)}...`)
  }
  
  return isLocalFile
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

export async function uploadMemorialPhoto(localUri: string, userId: string, groupId: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: "base64" as any,
    })

    if (!base64 || base64.length === 0) {
      throw new Error("Failed to read image file")
    }

    const fileExt = localUri.split(".").pop() ?? "jpg"
    const fileName = `${groupId}-${Date.now()}.${fileExt}`
    const filePath = `${groupId}/${fileName}`

    const contentType = `image/${fileExt === "png" ? "png" : fileExt === "webp" ? "webp" : "jpeg"}`

    // Upload to avatars bucket (reusing existing bucket for simplicity)
    // Alternatively, could create a separate memorials bucket
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
    console.error("[storage] Error uploading memorial photo:", error)
    throw error
  }
}
