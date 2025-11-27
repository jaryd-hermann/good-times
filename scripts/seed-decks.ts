/**
 * Seed script for Collections, Decks, and Questions
 * 
 * Usage:
 * 1. Place CSV files in scripts/data/ directory:
 *    - collections.csv
 *    - decks.csv
 *    - deck_questions.csv
 * 
 * 2. Set environment variables:
 *    SUPABASE_URL=your_project_url
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 * 
 * 3. Run: npx tsx scripts/seed-decks.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Simple CSV parser (no external dependencies)
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n")
  if (lines.length === 0) return []

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Simple CSV parsing (handles quoted values)
    const values: string[] = []
    let current = ""
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        values.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    values.push(current.trim())

    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index]?.replace(/^"|"$/g, "") || ""
    })
    rows.push(row)
  }

  return rows
}

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface Collection {
  name: string
  description?: string
  display_order: number | string
}

interface Deck {
  collection_name: string
  name: string
  description?: string
  display_order: number | string
}

interface Question {
  deck_name: string
  question: string
  description?: string
  deck_order: number | string
}

async function seedCollections(collections: Collection[]): Promise<Map<string, string>> {
  console.log(`\n📦 Seeding ${collections.length} collections...`)
  const collectionIdMap = new Map<string, string>()

  for (const collection of collections) {
    // Check if collection already exists
    const { data: existing } = await supabase
      .from("collections")
      .select("id")
      .eq("name", collection.name)
      .maybeSingle()

    if (existing) {
      console.log(`  ⏭️  Collection "${collection.name}" already exists, skipping`)
      collectionIdMap.set(collection.name, existing.id)
      continue
    }

    const { data, error } = await supabase
      .from("collections")
      .insert({
        name: collection.name,
        description: collection.description || null,
        display_order: Number(collection.display_order),
      })
      .select("id")
      .single()

    if (error) {
      console.error(`  ❌ Error inserting collection "${collection.name}":`, error.message)
      continue
    }

    console.log(`  ✅ Created collection: "${collection.name}" (${data.id})`)
    collectionIdMap.set(collection.name, data.id)
  }

  return collectionIdMap
}

async function seedDecks(
  decks: Deck[],
  collectionIdMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log(`\n🃏 Seeding ${decks.length} decks...`)
  const deckIdMap = new Map<string, string>()

  for (const deck of decks) {
    const collectionId = collectionIdMap.get(deck.collection_name)
    if (!collectionId) {
      console.error(`  ❌ Collection "${deck.collection_name}" not found for deck "${deck.name}"`)
      continue
    }

    // Check if deck already exists
    const { data: existing } = await supabase
      .from("decks")
      .select("id")
      .eq("name", deck.name)
      .maybeSingle()

    if (existing) {
      console.log(`  ⏭️  Deck "${deck.name}" already exists, skipping`)
      deckIdMap.set(deck.name, existing.id)
      continue
    }

    const { data, error } = await supabase
      .from("decks")
      .insert({
        collection_id: collectionId,
        name: deck.name,
        description: deck.description || null,
        display_order: Number(deck.display_order),
      })
      .select("id")
      .single()

    if (error) {
      console.error(`  ❌ Error inserting deck "${deck.name}":`, error.message)
      continue
    }

    console.log(`  ✅ Created deck: "${deck.name}" (${data.id})`)
    deckIdMap.set(deck.name, data.id)
  }

  return deckIdMap
}

async function seedQuestions(
  questions: Question[],
  deckIdMap: Map<string, string>
): Promise<void> {
  console.log(`\n❓ Seeding ${questions.length} questions...`)

  // Group questions by deck
  const questionsByDeck = new Map<string, Question[]>()
  for (const question of questions) {
    if (!questionsByDeck.has(question.deck_name)) {
      questionsByDeck.set(question.deck_name, [])
    }
    questionsByDeck.get(question.deck_name)!.push(question)
  }

  let totalInserted = 0
  let totalSkipped = 0

  for (const [deckName, deckQuestions] of questionsByDeck.entries()) {
    const deckId = deckIdMap.get(deckName)
    if (!deckId) {
      console.error(`  ❌ Deck "${deckName}" not found`)
      continue
    }

    console.log(`  📝 Processing "${deckName}" (${deckQuestions.length} questions)...`)

    // Check existing questions for this deck
    const { data: existingQuestions } = await supabase
      .from("prompts")
      .select("id, deck_order")
      .eq("deck_id", deckId)

    const existingOrders = new Set(existingQuestions?.map((q) => q.deck_order) || [])

    for (const question of deckQuestions) {
      // Skip if question with this order already exists
      if (existingOrders.has(question.deck_order)) {
        console.log(`    ⏭️  Question at order ${question.deck_order} already exists, skipping`)
        totalSkipped++
        continue
      }

      const { error } = await supabase.from("prompts").insert({
        question: question.question,
        description: question.description || null,
        category: "Custom", // Deck questions don't have categories
        is_default: false,
        deck_id: deckId,
        deck_order: Number(question.deck_order),
      })

      if (error) {
        console.error(`    ❌ Error inserting question:`, error.message)
        continue
      }

      totalInserted++
    }

    console.log(`    ✅ Inserted ${totalInserted} questions for "${deckName}"`)
  }

  console.log(`\n📊 Summary: ${totalInserted} questions inserted, ${totalSkipped} skipped`)
}

async function main() {
  console.log("🚀 Starting deck seeding process...\n")

  const dataDir = path.join(__dirname, "data")

  // Read CSV files
  let collections: Collection[] = []
  let decks: Deck[] = []
  let questions: Question[] = []

  try {
    const collectionsCsv = fs.readFileSync(path.join(dataDir, "collections.csv"), "utf-8")
    collections = parseCSV(collectionsCsv) as Collection[]

    const decksCsv = fs.readFileSync(path.join(dataDir, "decks.csv"), "utf-8")
    decks = parseCSV(decksCsv) as Deck[]

    const questionsCsv = fs.readFileSync(path.join(dataDir, "deck_questions.csv"), "utf-8")
    questions = parseCSV(questionsCsv) as Question[]
  } catch (error) {
    console.error("Error reading CSV files:", error)
    console.error("\nMake sure CSV files are in scripts/data/ directory:")
    console.error("  - collections.csv")
    console.error("  - decks.csv")
    console.error("  - deck_questions.csv")
    process.exit(1)
  }

  // Validate data
  console.log("📋 Validating data...")
  console.log(`  Collections: ${collections.length}`)
  console.log(`  Decks: ${decks.length}`)
  console.log(`  Questions: ${questions.length}`)

  // Seed in order: collections → decks → questions
  const collectionIdMap = await seedCollections(collections)
  const deckIdMap = await seedDecks(decks, collectionIdMap)
  await seedQuestions(questions, deckIdMap)

  console.log("\n✅ Seeding complete!")
  console.log("\nNext steps:")
  console.log("  1. Upload icon images to Supabase Storage")
  console.log("  2. Update icon_url fields in collections and decks tables")
  console.log("  3. Test the feature in the app")
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})

