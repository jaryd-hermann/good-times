import { Platform } from "react-native"
import { supabase } from "./supabase"
import * as FileSystem from "expo-file-system/legacy"
import { decode } from "base64-arraybuffer"

// Threshold for using FormData upload (200MB) - files larger than this use more memory-efficient method
const FORMDATA_THRESHOLD = 200 * 1024 * 1024 // 200MB

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
      const MAX_VIDEO_SIZE = options?.maxVideoSize ?? (1024 * 1024 * 1024) // Default 1GB, can be overridden
      const MAX_PHOTO_SIZE = options?.maxPhotoSize ?? (1024 * 1024 * 1024) // Default 1GB, can be overridden
      const MAX_AUDIO_SIZE = options?.maxAudioSize ?? (1024 * 1024 * 1024) // Default 1GB, can be overridden
      
      const maxSize = fileType === "video" ? MAX_VIDEO_SIZE : fileType === "audio" ? MAX_AUDIO_SIZE : MAX_PHOTO_SIZE
      
      if (fileInfo.size > maxSize) {
        const sizeMB = (fileInfo.size / (1024 * 1024)).toFixed(1)
        const maxMB = (maxSize / (1024 * 1024)).toFixed(0)
        throw new Error(`File is too large (${sizeMB}MB). Maximum size for ${fileType}s is ${maxMB}MB. Please choose a smaller file.`)
      }
    }

    // Generate unique filename with timestamp and random component to avoid collisions
    const fileExt = fileUri.split(".").pop() || (fileType === "video" ? "mp4" : fileType === "audio" ? "m4a" : "jpg")
    const randomId = Math.random().toString(36).slice(2, 10)
    const fileName = `${Date.now()}-${randomId}.${fileExt}`
    const filePath = `${groupId}/${entryId}/${fileName}`

    // For large files (>200MB), use FormData upload to avoid loading entire file into memory
    // For smaller files, use the existing base64 method
    if (fileInfo.size !== undefined && fileInfo.size > FORMDATA_THRESHOLD) {
      return await uploadLargeFile(fileUri, filePath, fileType, fileExt)
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
        // If base64 read fails for large file, try FormData method as fallback
        if (fileInfo.size !== undefined && fileInfo.size > FORMDATA_THRESHOLD) {
          console.log("[storage] Base64 read failed for large file, falling back to FormData upload")
          return await uploadLargeFile(fileUri, filePath, fileType, fileExt)
        }
        throw new Error("File is too large to upload. The app ran out of memory. Please try a smaller file.")
      }
      throw new Error(`Failed to read file: ${readError.message || "Unknown error"}`)
    }

    if (!base64 || base64.length === 0) {
      throw new Error("File is empty or could not be read")
    }

    // Upload to Supabase storage
    // Wrap decode in try-catch to handle memory issues
    let decodedData: ArrayBuffer
    try {
      decodedData = decode(base64)
    } catch (decodeError: any) {
      // If decode fails for large file, try FormData method as fallback
      if (fileInfo.size !== undefined && fileInfo.size > FORMDATA_THRESHOLD) {
        console.log("[storage] Base64 decode failed for large file, falling back to FormData upload")
        return await uploadLargeFile(fileUri, filePath, fileType, fileExt)
      }
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
      // If file already exists, return its public URL instead of failing
      // This handles cases where a retry happens after a partial upload
      if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
        console.log(`[storage] File already exists at ${filePath}, returning existing URL`)
        const {
          data: { publicUrl },
        } = supabase.storage.from("entries-media").getPublicUrl(filePath)
        return publicUrl
      }
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

// Upload large files using FormData and fetch to avoid loading entire file into memory
// FormData in React Native can accept file URIs directly, which is more memory-efficient
async function uploadLargeFile(
  fileUri: string,
  filePath: string,
  fileType: "photo" | "video" | "audio",
  fileExt: string
): Promise<string> {
  try {
    // Get auth token from Supabase
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("Not authenticated")
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error("Supabase URL not configured")
    }

    const contentType = getContentType(fileType, fileExt)
    
    // Prepare file URI for FormData
    // On iOS, remove file:// prefix if present
    const normalizedUri = Platform.OS === "ios" && fileUri.startsWith("file://")
      ? fileUri.replace("file://", "")
      : fileUri

    // Use Supabase REST API directly with FormData
    // FormData in React Native accepts file URIs directly, which avoids loading entire file into memory
    const uploadUrl = `${supabaseUrl}/storage/v1/object/entries-media/${filePath}`
    
    const formData = new FormData()
    // @ts-ignore - FormData in React Native accepts objects with uri, type, name
    formData.append("file", {
      uri: normalizedUri,
      type: contentType,
      name: filePath.split("/").pop() || `file.${fileExt}`,
    } as any)

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "x-upsert": "false",
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      // If file already exists, return its public URL instead of failing
      // This handles cases where a retry happens after a partial upload
      if (response.status === 409 || errorText?.includes("already exists") || errorText?.includes("duplicate")) {
        console.log(`[storage] File already exists at ${filePath}, returning existing URL`)
        const {
          data: { publicUrl },
        } = supabase.storage.from("entries-media").getPublicUrl(filePath)
        return publicUrl
      }
      throw new Error(`Upload failed: ${response.status} ${errorText}`)
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("entries-media").getPublicUrl(filePath)

    return publicUrl
  } catch (error: any) {
    console.error("[storage] Error uploading large file:", error)
    // If FormData upload fails, provide helpful error message
    if (error.message?.includes("memory") || error.message?.includes("too large") || error.message?.includes("out of memory")) {
      throw new Error("File is too large to upload. The app ran out of memory. Please try a smaller file or compress the video.")
    }
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
