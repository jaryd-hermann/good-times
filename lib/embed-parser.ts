/**
 * Utilities for parsing and handling Spotify, Apple Music, and Soundcloud URLs
 */

export type EmbedPlatform = "spotify" | "apple_music" | "soundcloud"
export type SpotifyEmbedType = "track" | "album" | "playlist" | "artist"
export type AppleMusicEmbedType = "song" | "album" | "playlist" | "artist"
export type SoundcloudEmbedType = "track"

export interface ParsedEmbed {
  platform: EmbedPlatform
  url: string
  embedId: string
  embedType: string
  embedUrl: string // The iframe embed URL
}

/**
 * Parse Spotify URL and extract embed information
 */
export function parseSpotifyUrl(url: string): ParsedEmbed | null {
  // Spotify URL patterns:
  // https://open.spotify.com/track/{id}
  // https://open.spotify.com/album/{id}
  // https://open.spotify.com/playlist/{id}
  // https://open.spotify.com/artist/{id}
  // Also handle shortened: spotify:track:{id}
  
  const spotifyRegex = /(?:https?:\/\/)?(?:open\.)?spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i
  const spotifyUriRegex = /spotify:(track|album|playlist|artist):([a-zA-Z0-9]+)/i
  
  let match = url.match(spotifyRegex)
  let embedType: SpotifyEmbedType = "track"
  let embedId: string = ""
  
  if (match) {
    embedType = match[1] as SpotifyEmbedType
    embedId = match[2]
  } else {
    match = url.match(spotifyUriRegex)
    if (match) {
      embedType = match[1] as SpotifyEmbedType
      embedId = match[2]
    } else {
      return null
    }
  }
  
  // Normalize URL
  const normalizedUrl = `https://open.spotify.com/${embedType}/${embedId}`
  const embedUrl = `https://open.spotify.com/embed/${embedType}/${embedId}?utm_source=generator`
  
  return {
    platform: "spotify",
    url: normalizedUrl,
    embedId,
    embedType,
    embedUrl,
  }
}

/**
 * Parse Apple Music URL and extract embed information
 */
export function parseAppleMusicUrl(url: string): ParsedEmbed | null {
  // Apple Music URL patterns:
  // https://music.apple.com/{country}/album/{name}/{id}
  // https://music.apple.com/{country}/song/{name}/{id}
  // https://music.apple.com/{country}/playlist/{name}/{id}
  // https://music.apple.com/{country}/artist/{name}/{id}
  // Also handle: https://music.apple.com/us/album/album-name/123456789
  
  // Extract country code, type, and ID
  const appleMusicRegex = /(?:https?:\/\/)?music\.apple\.com\/(?:[a-z]{2}\/)?(song|album|playlist|artist)\/[^\/]+\/([0-9]+)/i
  
  const match = url.match(appleMusicRegex)
  if (!match) return null
  
  const embedType = match[1] as AppleMusicEmbedType
  const embedId = match[2]
  
  // Normalize URL (use US as default country)
  const normalizedUrl = `https://music.apple.com/us/${embedType}/${embedId}`
  // Apple Music embed uses iframe - need full URL with proper format
  // Format: https://embed.music.apple.com/{country}/{type}/{id}
  const embedUrl = `https://embed.music.apple.com/us/${embedType}/${embedId}?app=music`
  
  return {
    platform: "apple_music",
    url: normalizedUrl,
    embedId,
    embedType,
    embedUrl,
  }
}

/**
 * Parse Soundcloud URL and extract embed information
 */
export function parseSoundcloudUrl(url: string): ParsedEmbed | null {
  // Soundcloud URL patterns:
  // https://soundcloud.com/{user}/{track}
  // https://on.soundcloud.com/{shortId} (shortened links)
  // Also handle URLs with query parameters
  
  // Handle shortened links: https://on.soundcloud.com/{shortId}
  const shortenedRegex = /(?:https?:\/\/)?on\.soundcloud\.com\/([a-zA-Z0-9]+)/i
  const shortenedMatch = url.match(shortenedRegex)
  
  if (shortenedMatch) {
    const shortId = shortenedMatch[1]
    // For shortened links, we need to use the full URL for embedding
    // The embed URL will use the shortened URL itself
    const normalizedUrl = `https://on.soundcloud.com/${shortId}`
    const encodedUrl = encodeURIComponent(normalizedUrl)
    const embedUrl = `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
    
    return {
      platform: "soundcloud",
      url: normalizedUrl,
      embedId: shortId,
      embedType: "track",
      embedUrl,
    }
  }
  
  // Handle regular Soundcloud URLs: https://soundcloud.com/{user}/{track}
  // Remove query parameters for matching
  const cleanUrl = url.split('?')[0]
  const soundcloudRegex = /(?:https?:\/\/)?(?:www\.)?soundcloud\.com\/([^\/]+)\/([^\/\?]+)/i
  const match = cleanUrl.match(soundcloudRegex)
  
  if (match) {
    const user = match[1]
    const track = match[2]
    // Use user/track as embedId for uniqueness
    const embedId = `${user}/${track}`
    const normalizedUrl = `https://soundcloud.com/${embedId}`
    const encodedUrl = encodeURIComponent(normalizedUrl)
    const embedUrl = `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`
    
    return {
      platform: "soundcloud",
      url: normalizedUrl,
      embedId,
      embedType: "track",
      embedUrl,
    }
  }
  
  return null
}

/**
 * Detect and parse any supported embed URL
 */
export function parseEmbedUrl(url: string): ParsedEmbed | null {
  // Try Spotify first
  const spotify = parseSpotifyUrl(url)
  if (spotify) return spotify
  
  // Try Apple Music
  const appleMusic = parseAppleMusicUrl(url)
  if (appleMusic) return appleMusic
  
  // Try Soundcloud
  const soundcloud = parseSoundcloudUrl(url)
  if (soundcloud) return soundcloud
  
  return null
}

/**
 * Extract all embed URLs from text
 */
export function extractEmbedUrls(text: string): ParsedEmbed[] {
  // URL regex pattern - updated to capture Soundcloud URLs
  const urlRegex = /(https?:\/\/[^\s]+|spotify:[^\s]+)/gi
  const matches = text.match(urlRegex) || []
  
  const embeds: ParsedEmbed[] = []
  for (const match of matches) {
    const parsed = parseEmbedUrl(match.trim())
    if (parsed) {
      embeds.push(parsed)
    }
  }
  
  return embeds
}

/**
 * Remove embed URLs from text (for storing clean text)
 */
export function removeEmbedUrls(text: string, embeds: ParsedEmbed[]): string {
  let cleaned = text
  for (const embed of embeds) {
    // Remove the URL from text
    cleaned = cleaned.replace(embed.url, "").trim()
    // Also remove any variations
    cleaned = cleaned.replace(new RegExp(embed.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").trim()
  }
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim()
  return cleaned
}

