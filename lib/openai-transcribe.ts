const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions"

export function getOpenAiApiKey(): string {
  return (process.env.EXPO_PUBLIC_OPENAI_API_KEY || "").trim()
}

export async function transcribeAudioFromUri(uri: string): Promise<string> {
  const apiKey = getOpenAiApiKey()
  if (!apiKey) {
    throw new Error(
      "Missing OpenAI API key. Add EXPO_PUBLIC_OPENAI_API_KEY to your .env locally and as an EAS project secret for production builds."
    )
  }

  const formData = new FormData()
  formData.append(
    "file",
    // React Native file shape for multipart upload
    { uri, name: "recording.m4a", type: "audio/m4a" } as unknown as Blob
  )
  formData.append("model", "whisper-1")

  const res = await fetch(TRANSCRIBE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `Transcription failed (${res.status})`)
  }

  const json = (await res.json()) as { text?: string }
  return (json.text || "").trim()
}
