# Seed Scripts

## Deck Seeding

### Prerequisites

1. Create `scripts/data/` directory:
```bash
mkdir -p scripts/data
```

3. Place CSV files in `scripts/data/`:
   - `collections.csv`
   - `decks.csv`
   - `deck_questions.csv`

### Setup Environment Variables

Create a `.env` file in the project root (or export in terminal):

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Run Seeding

```bash
npm run seed-decks
```

Or directly:
```bash
npx tsx scripts/seed-decks.ts
```

### CSV Format

See `Docs/DECK_FEATURE_TESTING_GUIDE.md` for detailed CSV format requirements.

