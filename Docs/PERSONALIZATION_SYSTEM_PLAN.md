# Personalization System Execution Plan

## Overview
Build a deterministic personalization system that learns from group engagement patterns to recommend questions that match each group's "vibe". The system will progressively introduce questions based on what groups have engaged with, swiped on, and explicitly selected (decks).

## Feature Set & Scope

### Core Features
1. **Group Vibe Profiling**: Build profiles from engagement data (entries, swipes, deck selections)
2. **Question Classification**: Tag questions with attributes (depth, vulnerability, time orientation, etc.)
3. **Question Scoring**: Calculate fit scores for questions based on group profiles
4. **Progressive Introduction**: Gradually introduce questions that match and slightly expand group preferences
5. **Early Signal Detection**: Use swipe data and deck selections to build profiles before groups have answered many questions
6. **Global Question Metrics**: Track popularity metrics (asked count, answered count) across all groups

### Out of Scope (For Now)
- Machine learning models (start deterministic)
- Real-time personalization (daily batch updates)
- User-level personalization (group-level only)
- A/B testing framework (separate initiative)

## Data Requirements

### 1. Question Classification Attributes (Phase 1)
Add to `prompts` table:
- `depth_level` (INTEGER, 1-5): Surface (1) → Deep/Introspective (5)
- `vulnerability_score` (INTEGER, 1-5): Safe/Casual (1) → Intimate/Vulnerable (5)
- `emotional_weight` (ENUM): 'light', 'moderate', 'heavy'
- `time_orientation` (ENUM): 'past', 'present', 'future', 'timeless'
- `focus_type` (ENUM): 'self', 'others', 'group', 'external'
- `answer_length_expectation` (ENUM): 'quick', 'medium', 'long'
- `media_affinity` (TEXT[]): Array of ['text', 'photo', 'video', 'audio']
- `clarity_level` (INTEGER, 1-5): Clear/Straightforward (1) → Ambiguous/Open (5)
- `topics` (TEXT[]): Array of topic tags, e.g., ['family', 'childhood', 'nostalgia'], ['work', 'career'], ['relationships', 'friendship']
- `mood_tags` (TEXT[]): Array of mood/tonal tags, e.g., ['nostalgic', 'funny', 'reflective'], ['lighthearted', 'serious'], ['sentimental', 'humorous']
- `is_conversation_starter` (BOOLEAN): Does this question typically lead to discussion/threads?

### 2. Deck Classification (Phase 1)
Add to `decks` table (or create `deck_classifications` table):
- `depth_level` (INTEGER, 1-5): Average depth of questions in deck
- `vulnerability_score` (INTEGER, 1-5): Average vulnerability of deck
- `emotional_weight` (ENUM): Dominant emotional weight
- `time_orientation` (ENUM): Dominant time orientation
- `focus_type` (ENUM): Dominant focus type
- `media_affinity` (TEXT[]): Common media types in deck
- `deck_vibe_tags` (TEXT[]): Custom tags describing deck theme

### 3. Global Question Metrics (Phase 1)
Add to `prompts` table:
- `total_asked_count` (INTEGER, default 0): Total times question has been scheduled
- `total_answered_count` (INTEGER, default 0): Total entries created for this question
- `global_completion_rate` (FLOAT): Calculated as `total_answered_count / NULLIF(total_asked_count, 0)`
- `last_asked_date` (DATE): Most recent date question was asked
- `popularity_score` (FLOAT): Calculated metric combining asked/answered counts

### 4. Group Profile Storage (Phase 1)
Create `group_vibe_profiles` materialized view (or table):
- All metrics calculated from engagement data
- Refreshed daily after entries are created

### 5. Swipe Data Integration (Phase 1)
Enhance `question_swipes` table usage:
- Already tracks: `group_id`, `prompt_id`, `user_id`, `direction` ('yes'/'no')
- Use for: Instant profile building, preference detection

## Phase Breakdown

### Phase 1: Schema Updates & Data Foundation
**Goal**: Update database schema to support classification and metrics

**Tasks**:
1. **Update `prompts` table**:
   ```sql
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS depth_level INTEGER CHECK (depth_level BETWEEN 1 AND 5);
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS vulnerability_score INTEGER CHECK (vulnerability_score BETWEEN 1 AND 5);
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS emotional_weight TEXT CHECK (emotional_weight IN ('light', 'moderate', 'heavy'));
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS time_orientation TEXT CHECK (time_orientation IN ('past', 'present', 'future', 'timeless'));
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS focus_type TEXT CHECK (focus_type IN ('self', 'others', 'group', 'external'));
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS answer_length_expectation TEXT CHECK (answer_length_expectation IN ('quick', 'medium', 'long'));
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS media_affinity TEXT[];
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS clarity_level INTEGER CHECK (clarity_level BETWEEN 1 AND 5);
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS topics TEXT[];
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS mood_tags TEXT[];
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_conversation_starter BOOLEAN DEFAULT false;
   
   -- Global metrics
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS total_asked_count INTEGER DEFAULT 0;
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS total_answered_count INTEGER DEFAULT 0;
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS global_completion_rate FLOAT;
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS last_asked_date DATE;
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS popularity_score FLOAT;
   ```

2. **Create/Update `decks` classification**:
   ```sql
   -- Option A: Add to existing decks table
   ALTER TABLE decks ADD COLUMN IF NOT EXISTS depth_level INTEGER CHECK (depth_level BETWEEN 1 AND 5);
   ALTER TABLE decks ADD COLUMN IF NOT EXISTS vulnerability_score INTEGER CHECK (vulnerability_score BETWEEN 1 AND 5);
   ALTER TABLE decks ADD COLUMN IF NOT EXISTS emotional_weight TEXT CHECK (emotional_weight IN ('light', 'moderate', 'heavy'));
   ALTER TABLE decks ADD COLUMN IF NOT EXISTS time_orientation TEXT CHECK (time_orientation IN ('past', 'present', 'future', 'timeless'));
   ALTER TABLE decks ADD COLUMN IF NOT EXISTS focus_type TEXT CHECK (focus_type IN ('self', 'others', 'group', 'external'));
   ALTER TABLE decks ADD COLUMN IF NOT EXISTS media_affinity TEXT[];
   ALTER TABLE decks ADD COLUMN IF NOT EXISTS deck_vibe_tags TEXT[];
   
   -- Option B: Create separate deck_classifications table (better for normalization)
   CREATE TABLE IF NOT EXISTS deck_classifications (
     deck_id UUID PRIMARY KEY REFERENCES decks(id) ON DELETE CASCADE,
     depth_level INTEGER CHECK (depth_level BETWEEN 1 AND 5),
     vulnerability_score INTEGER CHECK (vulnerability_score BETWEEN 1 AND 5),
     emotional_weight TEXT CHECK (emotional_weight IN ('light', 'moderate', 'heavy')),
     time_orientation TEXT CHECK (time_orientation IN ('past', 'present', 'future', 'timeless')),
     focus_type TEXT CHECK (focus_type IN ('self', 'others', 'group', 'external')),
     media_affinity TEXT[],
     deck_vibe_tags TEXT[],
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Create indexes**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_prompts_depth_level ON prompts(depth_level);
   CREATE INDEX IF NOT EXISTS idx_prompts_vulnerability_score ON prompts(vulnerability_score);
   CREATE INDEX IF NOT EXISTS idx_prompts_time_orientation ON prompts(time_orientation);
   CREATE INDEX IF NOT EXISTS idx_prompts_popularity_score ON prompts(popularity_score DESC);
   CREATE INDEX IF NOT EXISTS idx_prompts_is_conversation_starter ON prompts(is_conversation_starter);
   CREATE INDEX IF NOT EXISTS idx_question_swipes_group_prompt ON question_swipes(group_id, prompt_id);
   
   -- GIN indexes for array columns (enables efficient array queries)
   CREATE INDEX IF NOT EXISTS idx_prompts_topics_gin ON prompts USING GIN(topics);
   CREATE INDEX IF NOT EXISTS idx_prompts_mood_tags_gin ON prompts USING GIN(mood_tags);
   CREATE INDEX IF NOT EXISTS idx_prompts_media_affinity_gin ON prompts USING GIN(media_affinity);
   ```

4. **Create function to update global question metrics**:
   ```sql
   CREATE OR REPLACE FUNCTION update_question_global_metrics()
   RETURNS void AS $$
   BEGIN
     -- Update asked count
     UPDATE prompts p
     SET total_asked_count = (
       SELECT COUNT(*) 
       FROM daily_prompts dp 
       WHERE dp.prompt_id = p.id
     );
     
     -- Update answered count
     UPDATE prompts p
     SET total_answered_count = (
       SELECT COUNT(*) 
       FROM entries e 
       WHERE e.prompt_id = p.id
     );
     
     -- Update completion rate
     UPDATE prompts p
     SET global_completion_rate = 
       CASE 
         WHEN total_asked_count > 0 THEN 
           total_answered_count::FLOAT / total_asked_count::FLOAT
         ELSE 0
       END;
     
     -- Update last asked date
     UPDATE prompts p
     SET last_asked_date = (
       SELECT MAX(date) 
       FROM daily_prompts dp 
       WHERE dp.prompt_id = p.id
     );
     
     -- Calculate popularity score (weighted combination)
     UPDATE prompts p
     SET popularity_score = (
       -- Weight: 40% completion rate, 30% total answered, 30% recency
       (COALESCE(global_completion_rate, 0) * 0.4) +
       (LEAST(total_answered_count::FLOAT / 100.0, 1.0) * 0.3) + -- Normalize to 0-1
       (CASE 
         WHEN last_asked_date IS NULL THEN 0
         WHEN last_asked_date > CURRENT_DATE - INTERVAL '7 days' THEN 1.0
         WHEN last_asked_date > CURRENT_DATE - INTERVAL '30 days' THEN 0.7
         WHEN last_asked_date > CURRENT_DATE - INTERVAL '90 days' THEN 0.4
         ELSE 0.1
       END * 0.3)
     );
   END;
   $$ LANGUAGE plpgsql;
   ```

**Testing**:
- Verify all columns added successfully
- Test function updates metrics correctly
- Verify indexes improve query performance

**Deliverable**: Database schema ready for classification data

---

### Phase 2: Question Classification
**Goal**: Populate classification attributes for all existing questions

**Tasks**:
1. **Create classification script/tool**:
   - Manual tagging interface OR
   - Bulk SQL updates for initial classification
   - Consider using AI/LLM to suggest classifications (optional)

2. **Classification approach**:
   - Start with high-level categories → map to attributes
   - Use question text analysis for depth/vulnerability
   - Review sample questions to establish baseline

3. **Update prompts**:
   ```sql
   -- Example: Classify questions based on category patterns
   UPDATE prompts 
   SET depth_level = CASE
     WHEN category IN ('Memories', 'Reflection', 'Deep Thoughts') THEN 4
     WHEN category IN ('Fun', 'Lighthearted', 'Quick') THEN 2
     ELSE 3
   END
   WHERE depth_level IS NULL;
   
   -- Continue for other attributes...
   ```

4. **Deck classification**:
   - Calculate deck attributes from questions in deck
   - OR manually classify decks based on theme
   ```sql
   -- Calculate deck attributes from questions
   INSERT INTO deck_classifications (deck_id, depth_level, vulnerability_score, ...)
   SELECT 
     d.id as deck_id,
     AVG(p.depth_level)::INTEGER as depth_level,
     AVG(p.vulnerability_score)::INTEGER as vulnerability_score,
     -- ... other attributes
   FROM decks d
   JOIN prompts p ON p.deck_id = d.id
   GROUP BY d.id;
   ```

**Testing**:
- Verify all questions have classifications
- Spot-check classifications make sense
- Verify deck classifications are accurate

**Deliverable**: All questions and decks classified

---

### Phase 3: Profile Assessment & Question Scoring
**Goal**: Build functions to assess group profiles and score questions

**Tasks**:
1. **Create `group_vibe_profiles` materialized view**:
   ```sql
   CREATE MATERIALIZED VIEW group_vibe_profiles AS
   SELECT 
     g.id as group_id,
     g.type as group_type,
     
     -- Basic engagement metrics
     COUNT(DISTINCT dp.id) as total_prompts_asked,
     COUNT(DISTINCT e.id) as total_entries,
     COUNT(DISTINCT gm.user_id) as member_count,
     COUNT(DISTINCT e.id)::FLOAT / NULLIF(
       COUNT(DISTINCT dp.id) * COUNT(DISTINCT gm.user_id), 0
     ) as avg_completion_rate,
     
     -- Answer characteristics
     AVG(LENGTH(e.text)) as avg_answer_length,
     PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LENGTH(e.text)) as median_answer_length,
     
     -- Media affinity
     COUNT(CASE WHEN e.media_urls IS NOT NULL AND array_length(e.media_urls, 1) > 0 THEN 1 END)::FLOAT / 
       NULLIF(COUNT(e.id), 0) as media_attachment_rate,
     
     -- Question attribute preferences (from answered questions)
     AVG(p.depth_level) as avg_preferred_depth,
     STDDEV(p.depth_level) as depth_variance,
     AVG(p.vulnerability_score) as avg_vulnerability_comfort,
     STDDEV(p.vulnerability_score) as vulnerability_variance,
     
     -- Category preferences
     jsonb_object_agg(
       p.category, 
       COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT dp.id), 0)
     ) FILTER (WHERE p.category IS NOT NULL) as category_engagement_rates,
     
     -- Time orientation preference
     AVG(CASE 
       WHEN p.time_orientation = 'past' THEN 1.0
       WHEN p.time_orientation = 'present' THEN 0.5
       WHEN p.time_orientation = 'future' THEN 0.0
       ELSE 0.5
     END) as time_orientation_score,
     
     -- Swipe preferences (CRITICAL: Early signal)
     (SELECT AVG(CASE WHEN qs.direction = 'yes' THEN 1.0 ELSE 0.0 END)
      FROM question_swipes qs
      JOIN prompts p2 ON qs.prompt_id = p2.id
      WHERE qs.group_id = g.id) as swipe_yes_rate,
     
     -- Swipe-based attribute preferences (before they answer!)
     (SELECT AVG(p2.depth_level)
      FROM question_swipes qs
      JOIN prompts p2 ON qs.prompt_id = p2.id
      WHERE qs.group_id = g.id AND qs.direction = 'yes') as swipe_preferred_depth,
     
     (SELECT AVG(p2.vulnerability_score)
      FROM question_swipes qs
      JOIN prompts p2 ON qs.prompt_id = p2.id
      WHERE qs.group_id = g.id AND qs.direction = 'yes') as swipe_preferred_vulnerability,
     
     -- Deck preferences (CRITICAL: Early signal)
     (SELECT jsonb_object_agg(
        d.id::TEXT,
        jsonb_build_object(
          'depth_level', dc.depth_level,
          'vulnerability_score', dc.vulnerability_score,
          'emotional_weight', dc.emotional_weight
        )
      )
      FROM group_active_decks gad
      JOIN decks d ON gad.deck_id = d.id
      LEFT JOIN deck_classifications dc ON dc.deck_id = d.id
      WHERE gad.group_id = g.id AND gad.is_active = true
     ) as active_deck_profiles,
     
     -- Response speed
     AVG(EXTRACT(EPOCH FROM (e.created_at - dp.date))) / 3600 as avg_hours_to_first_response,
     
     -- Comment engagement (CRITICAL: Shows discussion interest)
     (SELECT AVG(comment_count)
      FROM (
        SELECT e.id, COUNT(c.id) as comment_count
        FROM entries e
        JOIN daily_prompts dp ON e.prompt_id = dp.prompt_id AND dp.group_id = g.id
        LEFT JOIN comments c ON c.entry_id = e.id
        WHERE e.group_id = g.id
        GROUP BY e.id
      ) entry_comments
     ) as avg_comments_per_entry,
     
     (SELECT AVG(CASE WHEN comment_count > 0 THEN 1.0 ELSE 0.0 END)
      FROM (
        SELECT e.id, COUNT(c.id) as comment_count
        FROM entries e
        JOIN daily_prompts dp ON e.prompt_id = dp.prompt_id AND dp.group_id = g.id
        LEFT JOIN comments c ON c.entry_id = e.id
        WHERE e.group_id = g.id
        GROUP BY e.id
      ) entry_comments
     ) as entry_comment_rate,
     
     -- Conversation starter preference (questions that generate discussion)
     AVG(CASE WHEN p.is_conversation_starter = true THEN 1.0 ELSE 0.0 END) as conversation_starter_preference,
     
     -- Topic preferences (from answered questions)
     (SELECT jsonb_object_agg(
        topic,
        COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT dp.id), 0)
      )
      FROM daily_prompts dp
      JOIN prompts p ON dp.prompt_id = p.id
      JOIN entries e ON e.prompt_id = p.id AND e.group_id = g.id
      CROSS JOIN LATERAL unnest(p.topics) as topic
      WHERE dp.group_id = g.id
      GROUP BY topic
     ) as topic_engagement_rates,
     
     -- Mood preferences (from answered questions)
     (SELECT jsonb_object_agg(
        mood_tag,
        COUNT(DISTINCT e.id)::FLOAT / NULLIF(COUNT(DISTINCT dp.id), 0)
      )
      FROM daily_prompts dp
      JOIN prompts p ON dp.prompt_id = p.id
      JOIN entries e ON e.prompt_id = p.id AND e.group_id = g.id
      CROSS JOIN LATERAL unnest(p.mood_tags) as mood_tag
      WHERE dp.group_id = g.id
      GROUP BY mood_tag
     ) as mood_engagement_rates,
     
     -- Last engagement
     MAX(e.created_at) as last_engagement_date,
     MAX(dp.date) as last_prompt_date
     
   FROM groups g
   LEFT JOIN group_members gm ON gm.group_id = g.id
   LEFT JOIN daily_prompts dp ON dp.group_id = g.id
   LEFT JOIN entries e ON e.prompt_id = dp.prompt_id AND e.group_id = g.id
   LEFT JOIN prompts p ON p.id = dp.prompt_id
   GROUP BY g.id, g.type;
   ```

2. **Create `calculate_question_fit_score()` function**:
   - Scores questions 0-1 based on group profile
   - Considers: depth, vulnerability, category, time orientation, media affinity
   - Uses swipe data if available (early groups)
   - Uses deck data if available (early groups)
   - Falls back to global popularity for new groups

3. **Create `suggest_questions_for_group()` function**:
   - Returns top N questions with fit scores
   - Progressive introduction logic
   - Considers global popularity for new groups

**Testing**:
- Run profile assessment on test groups
- Verify scores make sense
- Compare suggestions to actual engagement
- Test with groups that have only swipe data (no answers yet)
- Test with groups that have only deck selections (no answers yet)

**Deliverable**: Functions that can assess profiles and score questions

---

### Phase 4: Automation & Integration Testing
**Goal**: Automate profile updates and test end-to-end flow

**Tasks**:
1. **Create refresh function**:
   ```sql
   CREATE OR REPLACE FUNCTION refresh_group_vibe_profiles()
   RETURNS void AS $$
   BEGIN
     REFRESH MATERIALIZED VIEW CONCURRENTLY group_vibe_profiles;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Create function to update global metrics** (already created in Phase 1):
   - Call daily after `schedule-daily-prompts` runs
   - Update `total_asked_count`, `total_answered_count`, etc.

3. **Create queue population function**:
   ```sql
   CREATE OR REPLACE FUNCTION populate_personalized_queue()
   RETURNS TABLE(group_id UUID, prompts_added INTEGER) AS $$
   -- (Implementation from previous discussion)
   $$ LANGUAGE plpgsql;
   ```

4. **Schedule automated jobs**:
   - Daily: Refresh profiles, update global metrics
   - Weekly: Populate personalized queue

**Testing**:
- Test refresh function on production-like data
- Verify queue population adds appropriate questions
- Test with various group profiles
- Monitor performance (query times, resource usage)
- Test edge cases (new groups, inactive groups, etc.)

**Deliverable**: Automated system ready for integration

---

### Phase 5: Integration with Daily Scheduling
**Goal**: Use personalization in daily prompt selection

**Tasks**:
1. **Update `schedule-daily-prompts/index.ts`**:
   - **Priority order** (must be maintained):
     1. Custom questions (highest priority)
     2. Birthday questions (user-specific)
     3. Deck questions (1 per active deck per week - existing logic must be preserved)
     4. Queued items (Featured, matches, etc.)
     5. **Personalized selection** (new - only if nothing scheduled yet)
     6. Fall back to existing selection logic if no personalized suggestions
   
   - After checking queue, custom questions, birthdays, **and deck logic**
   - If no prompt scheduled, use personalized selection
   - Fall back to existing logic if no suggestions

2. **Deck logic preservation**:
   - Ensure 1 question per active deck per week is still honored
   - Personalized selection only runs if deck quota not met
   - Deck questions contribute to profile (already tracked)

3. **Add logging**:
   - Log when personalized question is selected
   - Log fit score and reason
   - Track performance metrics
   - Log when personalization is skipped (due to deck/custom/birthday)

4. **Gradual rollout**:
   - Start with 10% of groups
   - Monitor engagement rates
   - Increase to 50%, then 100%

**Testing**:
- Test in staging environment
- Verify deck logic still works correctly (1 per active deck per week)
- Verify custom/birthday questions still prioritized
- Compare engagement rates (personalized vs non-personalized)
- Monitor for errors/edge cases
- A/B test if possible

**Deliverable**: Personalized daily prompts live in production (with all priority rules maintained)

---

### Phase 6: Model Training Questions Generation
**Goal**: Create a curated set of "model training questions" designed to optimize group profile building

**Tasks**:
1. **Review classified questions** (from Phase 2):
   - Analyze distribution across all classification dimensions
   - Identify gaps in coverage
   - Understand question patterns

2. **Design training question set**:
   - Generate 40 new questions covering:
     - **Depth levels**: 1-5 (8 questions each)
     - **Vulnerability scores**: 1-5 (8 questions each)
     - **Time orientations**: past, present, future, timeless (10 each)
     - **Focus types**: self, others, group, external (10 each)
     - **Emotional weights**: light, moderate, heavy (balanced distribution)
     - **Topics**: Diverse array covering common themes
     - **Mood tags**: Variety of tones and moods
     - **Conversation starters**: Mix of discussion-generating questions
   
   - Questions should be:
     - Well-distributed across all classification dimensions
     - Designed to quickly reveal group preferences
     - Cover edge cases and boundary conditions
     - Include questions that test different combinations of attributes

3. **Question format**:
   - Each question includes full classification
   - Marked as `is_default = false` and `is_training = true` (new flag)
   - Not scheduled in normal rotation
   - Used only for profile building/testing

4. **Create training question set**:
   ```sql
   -- Add is_training flag to prompts table
   ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_training BOOLEAN DEFAULT false;
   
   -- Insert 40 training questions with full classification
   -- (Questions will be provided by assistant after Phase 2 classification review)
   ```

**Testing**:
- Verify questions cover all dimensions
- Test questions with sample groups
- Validate classification accuracy
- Ensure questions are excluded from normal scheduling

**Deliverable**: 40 model training questions ready for profile optimization testing

---

## Early Signal Detection Strategy

### Swipe Data Integration
**How it works**:
- Groups swipe during onboarding (swipe-onboarding screen)
- Each swipe (Yes/No) is recorded in `question_swipes`
- Profile can be built immediately from swipe patterns:
  ```sql
  -- Example: Group swiped Yes on 5 questions with depth_level 4-5
  -- → Group prefers deep questions (even before answering any!)
  SELECT 
    AVG(p.depth_level) as preferred_depth,
    AVG(p.vulnerability_score) as preferred_vulnerability
  FROM question_swipes qs
  JOIN prompts p ON qs.prompt_id = p.id
  WHERE qs.group_id = 'xxx' AND qs.direction = 'yes';
  ```

**Profile building priority**:
1. **If group has < 5 answered questions**: Use swipe data primarily
2. **If group has 5-20 answered questions**: Blend swipe + answer data
3. **If group has > 20 answered questions**: Use answer data primarily, swipe as validation

### Deck Selection Integration
**How it works**:
- When group activates a deck, deck's classification contributes to profile
- Example: Group activates "Deep Reflections" deck (depth_level: 4, vulnerability: 4)
- → Immediately know group prefers deep, vulnerable content

**Profile building**:
```sql
-- Add deck attributes to group profile
SELECT 
  AVG(dc.depth_level) as deck_preferred_depth,
  AVG(dc.vulnerability_score) as deck_preferred_vulnerability
FROM group_active_decks gad
JOIN deck_classifications dc ON dc.deck_id = gad.deck_id
WHERE gad.group_id = 'xxx' AND gad.is_active = true;
```

**Combined early signal**:
- Swipe data + Deck selections = Profile on Day 1
- No need to wait weeks for answer data

---

## Global Question Metrics Usage

### Tracking
- `total_asked_count`: Incremented when question is scheduled
- `total_answered_count`: Incremented when entry is created
- `global_completion_rate`: Calculated ratio
- `popularity_score`: Weighted combination of metrics

### Usage in Personalization
1. **New groups**: Use popular questions (high `popularity_score`)
2. **Question scoring**: Factor in global popularity as tie-breaker
3. **Similar group matching**: Find groups with similar profiles, recommend their popular questions

### Implementation
```sql
-- Update metrics when question is scheduled
CREATE OR REPLACE FUNCTION increment_question_asked(p_prompt_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE prompts 
  SET 
    total_asked_count = total_asked_count + 1,
    last_asked_date = CURRENT_DATE
  WHERE id = p_prompt_id;
END;
$$ LANGUAGE plpgsql;

-- Update metrics when entry is created (trigger)
CREATE OR REPLACE FUNCTION update_question_answered()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE prompts 
  SET total_answered_count = total_answered_count + 1
  WHERE id = NEW.prompt_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_created_update_metrics
AFTER INSERT ON entries
FOR EACH ROW
EXECUTE FUNCTION update_question_answered();
```

---

## Testing Strategy

### Phase 1 Testing
- [ ] Verify schema changes don't break existing queries
- [ ] Test metric update functions
- [ ] Verify indexes improve performance

### Phase 2 Testing
- [ ] Spot-check 50 random questions for classification accuracy
- [ ] Verify deck classifications match deck themes
- [ ] Test classification updates don't break existing data

### Phase 3 Testing
- [ ] Run profile assessment on 10 test groups
- [ ] Verify scores are reasonable (0-1 range, make sense)
- [ ] Test with groups that have only swipe data
- [ ] Test with groups that have only deck selections
- [ ] Test with groups that have both swipe + answer data
- [ ] Compare suggestions to actual engagement (retrospective analysis)

### Phase 4 Testing
- [ ] Test refresh function performance (< 5 seconds)
- [ ] Test queue population doesn't add duplicates
- [ ] Test with edge cases (new groups, inactive groups, single-member groups)
- [ ] Load test with production-like data volumes

### Phase 5 Testing
- [ ] Test integration in staging environment
- [ ] Monitor error rates
- [ ] Compare engagement metrics (personalized vs control)
- [ ] Gradual rollout with monitoring

---

## Success Metrics

### Technical Metrics
- Profile refresh time < 5 seconds
- Question scoring function < 100ms per question
- No increase in daily scheduling time > 10%

### Engagement Metrics
- Completion rate improvement (target: +5-10%)
- Answer length improvement (groups getting questions they engage with more)
- Media attachment rate improvement (if applicable)

### User Experience Metrics
- Groups receiving questions they actually engage with
- Reduced "skip" or "ignore" behavior
- Faster profile building (from swipe/deck data)

---

## Rollout Plan

### Week 1-2: Phase 1 & 2
- Schema updates
- Question classification
- Testing

### Week 3: Phase 3
- Build assessment functions
- Test scoring logic
- Validate with test groups

### Week 4: Phase 4
- Automation setup
- Integration testing
- Performance optimization

### Week 5: Phase 5
- Gradual rollout (10% → 50% → 100%)
- Monitoring and adjustments
- Documentation

---

## Risks & Mitigations

### Risk: Classification inaccuracy
- **Mitigation**: Start with conservative classifications, iterate based on feedback

### Risk: Performance degradation
- **Mitigation**: Use materialized views, indexes, batch updates

### Risk: Over-personalization (filter bubble)
- **Mitigation**: Progressive introduction logic, exploration bonus

### Risk: New groups get poor suggestions
- **Mitigation**: Use global popularity + swipe/deck data for early groups

---

## Future Enhancements (Post-Launch)

1. **User-level personalization**: Within-group preferences
2. **Temporal patterns**: Best time to ask certain question types
3. **Seasonal adjustments**: Holiday-specific question recommendations
4. **ML enhancement**: Layer ML on top of deterministic base
5. **A/B testing framework**: Test different scoring algorithms

---

## Tag System Usage in Model Logic

### How Tags Work
- **Topics** and **Mood Tags** are TEXT[] arrays (free-form, but should follow conventions)
- **No dropdown required**: Tags can be free-form, but consistency improves matching
- **GIN indexes**: Enable efficient array queries (e.g., "find questions with topic 'family'")

### Tag Matching Logic
```sql
-- Example: Calculate topic overlap score
SELECT 
  p.id,
  -- Count matching topics between question and group preferences
  (
    SELECT COUNT(DISTINCT topic)
    FROM unnest(p.topics) as topic
    WHERE topic = ANY(
      SELECT jsonb_object_keys(v_profile.topic_engagement_rates)::TEXT
    )
  )::FLOAT / NULLIF(array_length(p.topics, 1), 0) as topic_match_score
FROM prompts p
WHERE p.topics && ARRAY['family', 'childhood']; -- Overlap operator
```

### Tag Scoring in Fit Score
- **Topic match**: `(matching_topics / total_topics) * avg_engagement_for_those_topics`
- **Mood match**: `(matching_moods / total_moods) * avg_engagement_for_those_moods`
- **Weight**: Topics (10%), Mood tags (5%) in overall fit score

### Tag Conventions (Recommended)
- **Topics**: Lowercase, singular/plural consistent (e.g., 'family', 'childhood', 'work', 'relationships')
- **Mood tags**: Lowercase, descriptive (e.g., 'nostalgic', 'funny', 'reflective', 'lighthearted')
- **Consistency**: Use same tags across similar questions for better matching

---

## Questions to Resolve

1. **Classification approach**: Assistant will help create script based on question export (Phase 2)
2. **Deck classification**: Calculate from questions in deck (average attributes)
3. **Profile refresh frequency**: Daily (after entries created)
4. **Rollout strategy**: Gradual (10% → 50% → 100%)
5. **Fallback behavior**: Use global popularity for new groups, existing logic if no suggestions
6. **Tag conventions**: Establish standard tag list or allow free-form? (Recommend: Standard list with free-form additions)

---

## Appendix: SQL Function Examples

### Complete `calculate_question_fit_score()` with early signals
```sql
CREATE OR REPLACE FUNCTION calculate_question_fit_score(
  p_prompt_id UUID,
  p_group_id UUID
) RETURNS FLOAT AS $$
DECLARE
  v_profile RECORD;
  v_prompt RECORD;
  v_score FLOAT := 0;
  v_answered_count INTEGER;
  v_swipe_data_exists BOOLEAN;
  v_deck_data_exists BOOLEAN;
BEGIN
  -- Get group profile
  SELECT * INTO v_profile FROM group_vibe_profiles WHERE group_id = p_group_id;
  
  -- Get prompt attributes
  SELECT * INTO v_prompt FROM prompts WHERE id = p_prompt_id;
  
  -- Check if group has answered questions
  SELECT COUNT(*) INTO v_answered_count
  FROM daily_prompts dp
  JOIN entries e ON e.prompt_id = dp.prompt_id AND e.group_id = p_group_id
  WHERE dp.group_id = p_group_id;
  
  -- Check if swipe data exists
  SELECT EXISTS(
    SELECT 1 FROM question_swipes WHERE group_id = p_group_id
  ) INTO v_swipe_data_exists;
  
  -- Check if deck data exists
  SELECT EXISTS(
    SELECT 1 FROM group_active_decks WHERE group_id = p_group_id AND is_active = true
  ) INTO v_deck_data_exists;
  
  -- NEW GROUP: Use global popularity + early signals
  IF v_profile IS NULL OR (v_answered_count < 5 AND NOT v_swipe_data_exists AND NOT v_deck_data_exists) THEN
    -- Use global popularity score
    RETURN COALESCE(v_prompt.popularity_score, 0.5);
  END IF;
  
  -- EARLY GROUP (swipe/deck data but few answers): Blend early signals + global
  IF v_answered_count < 5 AND (v_swipe_data_exists OR v_deck_data_exists) THEN
    -- Use swipe preferences if available
    IF v_swipe_data_exists AND v_profile.swipe_preferred_depth IS NOT NULL THEN
      v_score := v_score + (1.0 - ABS(v_prompt.depth_level - v_profile.swipe_preferred_depth) / 5.0) * 0.4;
      v_score := v_score + (1.0 - ABS(v_prompt.vulnerability_score - v_profile.swipe_preferred_vulnerability) / 5.0) * 0.3;
    END IF;
    
    -- Use deck preferences if available
    IF v_deck_data_exists AND v_profile.active_deck_profiles IS NOT NULL THEN
      -- Check if question matches deck vibe
      -- (Simplified - could be more sophisticated)
      v_score := v_score + 0.2;
    END IF;
    
    -- Add global popularity as tie-breaker
    v_score := v_score + COALESCE(v_prompt.popularity_score, 0.5) * 0.1;
    
    RETURN GREATEST(0, LEAST(1, v_score));
  END IF;
  
  -- ESTABLISHED GROUP: Use full profile (existing logic from previous discussion)
  -- ... (rest of scoring logic)
  
  RETURN GREATEST(0, LEAST(1, v_score));
END;
$$ LANGUAGE plpgsql;
```

---

**Document Version**: 1.0  
**Last Updated**: [Date]  
**Owner**: [Team/Person]  
**Status**: Draft

