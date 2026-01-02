#!/usr/bin/env python3
"""
Script to generate SQL migration from CSV file
Run this to generate the complete migration SQL file
"""

import csv
import sys

def escape_sql_string(s):
    """Escape single quotes for SQL"""
    if s is None:
        return 'NULL'
    return "'" + s.replace("'", "''") + "'"

def generate_sql_migration(csv_file_path, output_file_path):
    """Generate SQL migration from CSV"""
    
    sql_lines = [
        "-- Migration: Update prompts table from CSV data",
        "-- 1. Update existing prompts (matching IDs)",
        "-- 2. Insert new prompts (blank IDs in CSV)",
        "-- 3. Delete prompts not in CSV (Standard/Deck categories only)",
        "-- 4. Add deck column showing deck name",
        "",
        "-- Step 1: Add deck column to prompts table",
        "ALTER TABLE prompts ADD COLUMN IF NOT EXISTS deck TEXT;",
        "",
        "-- Step 2: Create temporary table with CSV data",
        "CREATE TEMP TABLE csv_prompts (",
        "  id TEXT,",
        "  question TEXT,",
        "  category TEXT,",
        "  deck_id TEXT,",
        "  deck_order INTEGER",
        ");",
        "",
        "-- Step 3: Insert CSV data into temporary table",
        "-- Note: Skipping empty rows and placeholder text",
        "INSERT INTO csv_prompts (id, question, category, deck_id, deck_order) VALUES"
    ]
    
    values = []
    
    with open(csv_file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Skip empty rows
            if not row.get('question') or row.get('question').strip() == '':
                continue
            
            # Skip placeholder text
            if 'Update coming soon' in row.get('question', ''):
                continue
            
            # Skip rows with no category
            if not row.get('category') or row.get('category').strip() == '':
                continue
            
            # Handle ID (can be empty for new questions)
            prompt_id = row.get('id', '').strip() if row.get('id') else ''
            question = row.get('question', '').strip()
            category = row.get('category', '').strip()
            deck_id = row.get('deck_id', '').strip() if row.get('deck_id') else ''
            deck_order = row.get('deck_order', '').strip() if row.get('deck_order') else ''
            
            # Build VALUES clause
            id_val = escape_sql_string(prompt_id) if prompt_id else 'NULL'
            question_val = escape_sql_string(question)
            category_val = escape_sql_string(category)
            deck_id_val = escape_sql_string(deck_id) if deck_id else 'NULL'
            deck_order_val = deck_order if deck_order and deck_order.isdigit() else 'NULL'
            
            values.append(f"({id_val}, {question_val}, {category_val}, {deck_id_val}, {deck_order_val})")
    
    # Join all values with commas and add semicolon
    sql_lines.append(",\n".join(values) + ";")
    
    # Add update, insert, delete, and deck column update statements
    sql_lines.extend([
        "",
        "-- Step 4: Update existing prompts (where ID exists in CSV and DB)",
        "UPDATE prompts p",
        "SET ",
        "  question = csv.question,",
        "  category = csv.category,",
        "  deck_id = CASE ",
        "    WHEN csv.deck_id IS NOT NULL AND csv.deck_id != '' THEN csv.deck_id::UUID ",
        "    ELSE p.deck_id ",
        "  END,",
        "  deck_order = CASE ",
        "    WHEN csv.deck_order IS NOT NULL THEN csv.deck_order ",
        "    ELSE p.deck_order ",
        "  END",
        "FROM csv_prompts csv",
        "WHERE csv.id IS NOT NULL ",
        "  AND csv.id != ''",
        "  AND p.id::TEXT = csv.id",
        "  AND csv.question IS NOT NULL ",
        "  AND csv.question != '';",
        "",
        "-- Step 5: Insert new prompts (where ID is blank in CSV)",
        "INSERT INTO prompts (id, question, category, deck_id, deck_order)",
        "SELECT ",
        "  uuid_generate_v4(),",
        "  csv.question,",
        "  csv.category,",
        "  CASE WHEN csv.deck_id IS NOT NULL AND csv.deck_id != '' THEN csv.deck_id::UUID ELSE NULL END,",
        "  csv.deck_order",
        "FROM csv_prompts csv",
        "WHERE (csv.id IS NULL OR csv.id = '')",
        "  AND csv.question IS NOT NULL ",
        "  AND csv.question != '';",
        "",
        "-- Step 6: Delete prompts that exist in DB with category 'Standard' or 'Deck' but ID not in CSV",
        "DELETE FROM prompts",
        "WHERE category IN ('Standard', 'Deck')",
        "  AND id::TEXT NOT IN (",
        "    SELECT id FROM csv_prompts ",
        "    WHERE id IS NOT NULL AND id != ''",
        "  );",
        "",
        "-- Step 7: Update deck column with deck names",
        "UPDATE prompts p",
        "SET deck = d.name",
        "FROM decks d",
        "WHERE p.deck_id = d.id;",
        "",
        "-- Step 8: Set deck to NULL where deck_id is NULL",
        "UPDATE prompts",
        "SET deck = NULL",
        "WHERE deck_id IS NULL;",
        "",
        "-- Clean up temporary table",
        "DROP TABLE csv_prompts;"
    ])
    
    # Write to output file
    with open(output_file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))
    
    print(f"Migration SQL generated: {output_file_path}")
    print(f"Total rows processed: {len(values)}")

if __name__ == '__main__':
    csv_file = '/Users/jarydhermann/Desktop/questions - Sheet7.csv'
    output_file = 'supabase/migrations/053_update_prompts_from_csv.sql'
    
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    generate_sql_migration(csv_file, output_file)

