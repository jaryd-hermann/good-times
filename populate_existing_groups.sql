DO $$
DECLARE
  group_record RECORD;
  today_date DATE := CURRENT_DATE;
  day_index INTEGER;
  group_offset INTEGER;
  selected_prompt_id UUID;
BEGIN
  FOR group_record IN SELECT id, type FROM groups LOOP
    IF NOT EXISTS (
      SELECT 1 FROM daily_prompts 
      WHERE group_id = group_record.id 
      AND date = today_date
      AND user_id IS NULL
    ) THEN
      group_offset := length(group_record.id::text);
      day_index := (today_date - '2020-01-01'::date)::integer + group_offset;
      
      SELECT id INTO selected_prompt_id
      FROM prompts
      WHERE birthday_type IS NULL
        AND (group_record.type = 'friends' OR category != 'Edgy/NSFW')
      ORDER BY id
      LIMIT 1
      OFFSET (day_index % (
        SELECT COUNT(*) FROM prompts 
        WHERE birthday_type IS NULL 
        AND (group_record.type = 'friends' OR category != 'Edgy/NSFW')
      ));
      
      IF selected_prompt_id IS NOT NULL THEN
        INSERT INTO daily_prompts (group_id, prompt_id, date, user_id)
        SELECT group_record.id, selected_prompt_id, today_date, NULL
        WHERE NOT EXISTS (
          SELECT 1 FROM daily_prompts 
          WHERE group_id = group_record.id 
          AND date = today_date 
          AND user_id IS NULL
        );
      END IF;
    END IF;
  END LOOP;
END $$;

