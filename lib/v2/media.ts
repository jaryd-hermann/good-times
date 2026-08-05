/**
 * Is this stored media a video?
 *
 * Prefer the explicit `media_types` array wherever it is available — the thread,
 * the carousel and the lightbox all have it and should use it.
 *
 * This exists for the ONE payload that does not carry types: v2_get_history's
 * preview_people, which unnests answers.media_urls WITH ORDINALITY but drops
 * media_types on the floor. Without it those previews rendered a video URI
 * through <Image>, which draws nothing — the blank white squares on the History
 * cards.
 *
 * Extension sniffing is a fallback, not a design: uploadMedia writes
 * `${timestamp}-${id}.${fileExt}` from the real file, so the extension is
 * currently trustworthy. Carrying media_types through the history RPC would be
 * the robust fix and would let this go away.
 */
const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm", "avi", "mkv", "3gp", "qt"]

export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  // Strip any query string before looking at the extension — signed storage URLs
  // carry a token, and "…/clip.mp4?token=abc" must still read as mp4.
  const path = url.split("?")[0].split("#")[0]
  const ext = path.split(".").pop()?.toLowerCase()
  return !!ext && VIDEO_EXTENSIONS.includes(ext)
}

const AUDIO_EXTENSIONS = ["m4a", "mp3", "aac", "wav", "caf", "aiff", "ogg", "opus"]

export function isAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const path = url.split("?")[0].split("#")[0]
  const ext = path.split(".").pop()?.toLowerCase()
  return !!ext && AUDIO_EXTENSIONS.includes(ext)
}
