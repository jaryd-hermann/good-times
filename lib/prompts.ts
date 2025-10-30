// Prompt categories and their descriptions
export const PROMPT_CATEGORIES = {
  "For You": "Personalized prompts based on your group",
  Favorites: "Your saved favorite prompts",
  Optimist: "Positive and uplifting questions",
  "Go-Getter": "Action-oriented and ambitious prompts",
  Soulkeeper: "Deep, reflective, and meaningful questions",
  "Remembering Them": "Questions to honor those we remember",
  Storyteller: "Narrative and story-sharing prompts",
  Dreamer: "Imaginative and aspirational questions",
  Connector: "Relationship and connection-focused prompts",
  Adventurer: "Experience and exploration questions",
} as const

export type PromptCategory = keyof typeof PROMPT_CATEGORIES

// Helper to get prompts by category
export async function getPromptsByCategory(category: PromptCategory) {
  // This would filter prompts from the database by category
  // Implementation depends on your database schema
  return []
}

// Helper to personalize "Remembering Them" prompts
export function personalizeMemorialPrompt(question: string, memorialPersonName?: string) {
  if (!memorialPersonName) return question

  // Replace placeholders with the memorial person's name
  return question.replace(/\[Name\]/g, memorialPersonName).replace(/\[name\]/g, memorialPersonName)
}
