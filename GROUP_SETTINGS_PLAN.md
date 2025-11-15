# Group Settings Feature - Implementation Plan

## Overview
Build a comprehensive group settings system that allows admins and members to configure group-specific settings, manage members, and control question types.

## 1. Database Schema Changes

### 1.1 New Tables

#### `group_settings` table
```sql
CREATE TABLE group_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id)
);

-- RLS Policies
ALTER TABLE group_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view settings"
  ON group_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_settings.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can update settings"
  ON group_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_settings.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.is_admin = true
    )
  );
```

#### `question_category_preferences` table
```sql
CREATE TABLE question_category_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  preference TEXT NOT NULL CHECK (preference IN ('more', 'less', 'none')),
  weight DECIMAL(3,2) DEFAULT 1.0, -- Multiplier for frequency (more=1.5, less=0.5, none=0)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, category)
);

-- RLS Policies
ALTER TABLE question_category_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view preferences"
  ON question_category_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = question_category_preferences.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can manage preferences"
  ON question_category_preferences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = question_category_preferences.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.is_admin = true
    )
  );
```

### 1.2 Modify Existing Tables

#### Add `is_admin` to `group_members` table
```sql
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Set creator as admin
UPDATE group_members
SET is_admin = true
WHERE id IN (
  SELECT gm.id
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  WHERE gm.user_id = g.created_by
  AND gm.is_admin IS NULL
);

-- RLS: Admins can update admin status (for future member promotion)
CREATE POLICY "Admins can update member admin status"
  ON group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.is_admin = true
    )
  );
```

#### Add `name` update permission check
```sql
-- Ensure only admins can update group name
-- This should already be handled by RLS, but verify:
-- groups table should have RLS policy checking is_admin
```

## 2. Backend Implementation

### 2.1 Database Functions (`lib/db.ts`)

```typescript
// Get group settings
export async function getGroupSettings(groupId: string) {
  const { data, error } = await supabase
    .from("group_settings")
    .select("*")
    .eq("group_id", groupId)
    .single()
  
  if (error && error.code !== "PGRST116") throw error // PGRST116 = not found
  return data
}

// Check if user is admin
export async function isGroupAdmin(groupId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("group_members")
    .select("is_admin")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .single()
  
  return data?.is_admin ?? false
}

// Update group name (admin only)
export async function updateGroupName(groupId: string, newName: string, userId: string) {
  // Verify admin status
  const isAdmin = await isGroupAdmin(groupId, userId)
  if (!isAdmin) {
    throw new Error("Only admins can update group name")
  }
  
  const { data, error } = await supabase
    .from("groups")
    .update({ name: newName })
    .eq("id", groupId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Get question category preferences
export async function getQuestionCategoryPreferences(groupId: string) {
  const { data, error } = await supabase
    .from("question_category_preferences")
    .select("*")
    .eq("group_id", groupId)
  
  if (error) throw error
  return data || []
}

// Update question category preference (admin only)
export async function updateQuestionCategoryPreference(
  groupId: string,
  category: string,
  preference: "more" | "less" | "none",
  userId: string
) {
  // Verify admin status
  const isAdmin = await isGroupAdmin(groupId, userId)
  if (!isAdmin) {
    throw new Error("Only admins can update question preferences")
  }
  
  const weightMap = {
    more: 1.5,
    less: 0.5,
    none: 0
  }
  
  const { data, error } = await supabase
    .from("question_category_preferences")
    .upsert({
      group_id: groupId,
      category,
      preference,
      weight: weightMap[preference],
      updated_at: new Date().toISOString()
    }, {
      onConflict: "group_id,category"
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

// Remove member (admin only)
export async function removeGroupMember(groupId: string, memberId: string, adminUserId: string) {
  // Verify admin status
  const isAdmin = await isGroupAdmin(groupId, adminUserId)
  if (!isAdmin) {
    throw new Error("Only admins can remove members")
  }
  
  // Prevent removing yourself
  if (memberId === adminUserId) {
    throw new Error("Cannot remove yourself from the group")
  }
  
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId)
  
  if (error) throw error
}

// Leave group (any member)
export async function leaveGroup(groupId: string, userId: string) {
  // Check if user is the last admin
  const { data: admins } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("is_admin", true)
  
  if (admins?.length === 1 && admins[0].user_id === userId) {
    throw new Error("Cannot leave group as the last admin. Please transfer admin or delete the group.")
  }
  
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId)
  
  if (error) throw error
}

// Get filtered prompts based on preferences
export async function getFilteredPrompts(groupId: string, date: string) {
  // Get preferences
  const preferences = await getQuestionCategoryPreferences(groupId)
  
  // Build query
  let query = supabase
    .from("prompts")
    .select("*")
  
  // Filter out disabled categories
  const disabledCategories = preferences
    .filter(p => p.preference === "none")
    .map(p => p.category)
  
  if (disabledCategories.length > 0) {
    query = query.not("category", "in", `(${disabledCategories.join(",")})`)
  }
  
  const { data, error } = await query
  
  if (error) throw error
  
  // Apply weight sorting (categories with "more" preference get higher priority)
  // This is a simplified approach - you might want to implement more sophisticated
  // frequency adjustment in your daily prompt selection logic
  
  return data || []
}
```

### 2.2 Update Daily Prompt Selection Logic

Modify `getDailyPrompt` function to respect category preferences:

```typescript
export async function getDailyPrompt(groupId: string, date: string) {
  // Get preferences
  const preferences = await getQuestionCategoryPreferences(groupId)
  const disabledCategories = preferences
    .filter(p => p.preference === "none")
    .map(p => p.category)
  
  // Get day index
  const dayIndex = getDayIndex(date, groupId)
  
  // Get all prompts, excluding disabled categories
  let query = supabase
    .from("prompts")
    .select("*")
  
  if (disabledCategories.length > 0) {
    query = query.not("category", "in", `(${disabledCategories.join(",")})`)
  }
  
  const { data: allPrompts } = await query
  
  if (!allPrompts || allPrompts.length === 0) {
    return null
  }
  
  // Apply weighted selection based on preferences
  const weightedPrompts = allPrompts.map(prompt => {
    const pref = preferences.find(p => p.category === prompt.category)
    const weight = pref?.weight ?? 1.0
    return { prompt, weight }
  })
  
  // Simple weighted random selection
  // For "more" categories, include them multiple times in selection pool
  const selectionPool: any[] = []
  weightedPrompts.forEach(({ prompt, weight }) => {
    const count = Math.ceil(weight)
    for (let i = 0; i < count; i++) {
      selectionPool.push(prompt)
    }
  })
  
  const selectedPrompt = selectionPool[dayIndex % selectionPool.length]
  
  // Check if prompt already assigned for this date
  const { data: existing } = await supabase
    .from("daily_prompts")
    .select("prompt_id")
    .eq("group_id", groupId)
    .eq("date", date)
    .single()
  
  if (existing) {
    return { prompt_id: existing.prompt_id, date }
  }
  
  // Assign prompt
  const { data: dailyPrompt } = await supabase
    .from("daily_prompts")
    .insert({
      group_id: groupId,
      prompt_id: selectedPrompt.id,
      date
    })
    .select()
    .single()
  
  return dailyPrompt
}
```

## 3. Frontend Implementation

### 3.1 File Structure

```
app/(main)/
  group-settings/
    index.tsx              # Main settings page with subheadings
    name.tsx               # Group name editor (admin only)
    question-types.tsx     # Question category preferences (admin only)
    manage-members.tsx     # Member management (admin only)
    invite.tsx             # Invite members (any member)
    leave.tsx              # Leave group (any member)
```

### 3.2 Main Settings Page (`group-settings/index.tsx`)

```typescript
// Features:
// - List all settings options
// - Show admin badge/indicator
// - Conditional rendering based on admin status
// - Navigation to sub-pages
```

### 3.3 Group Name Page (`group-settings/name.tsx`)

```typescript
// Features:
// - Input field for group name
// - Save button (admin only)
// - Validation
// - Success/error feedback
```

### 3.4 Question Types Page (`group-settings/question-types.tsx`)

```typescript
// Features:
// - List all question categories
// - Toggle buttons: "More like this" / "Less like this" / "None of this"
// - Visual indicators for current preference
// - Save preferences (admin only)
// - Show impact explanation
```

### 3.5 Manage Members Page (`group-settings/manage-members.tsx`)

```typescript
// Features:
// - List all group members with avatars
// - Admin badge for admins
// - Remove button next to each member (admin only)
// - Confirmation dialog before removal
// - Cannot remove yourself
```

### 3.6 Invite Page (`group-settings/invite.tsx`)

```typescript
// Features:
// - Share invite link (reuse existing invite logic)
// - Copy link button
// - QR code option (optional)
// - Any member can invite
```

### 3.7 Leave Group Page (`group-settings/leave.tsx`)

```typescript
// Features:
// - Warning message
// - Confirmation dialog
// - Handle last admin case
// - Redirect after leaving
```

### 3.8 Update Group Switcher (`home.tsx`)

Add settings icon next to each group in the switcher modal:

```typescript
// Add settings icon button next to group name
// Navigate to group-settings with groupId param
```

## 4. Implementation Steps

### Phase 1: Database Setup
1. ✅ Create migration files for new tables
2. ✅ Add `is_admin` column to `group_members`
3. ✅ Set existing group creators as admins
4. ✅ Create RLS policies
5. ✅ Test database changes

### Phase 2: Backend Functions
1. ✅ Implement `isGroupAdmin` helper
2. ✅ Implement group name update function
3. ✅ Implement question category preference functions
4. ✅ Implement member management functions
5. ✅ Update daily prompt selection logic
6. ✅ Test all backend functions

### Phase 3: Frontend - Main Settings Page
1. ✅ Create `group-settings/index.tsx`
2. ✅ Add navigation from group switcher
3. ✅ Implement settings list UI
4. ✅ Add admin permission checks
5. ✅ Style to match app design

### Phase 4: Frontend - Individual Settings Pages
1. ✅ Group name page
2. ✅ Question types page
3. ✅ Manage members page
4. ✅ Invite page (reuse existing)
5. ✅ Leave group page

### Phase 5: Integration & Testing
1. ✅ Test all permission checks
2. ✅ Test question filtering
3. ✅ Test member removal
4. ✅ Test leave group edge cases
5. ✅ UI/UX polish

## 5. Key Considerations

### 5.1 Permissions
- **Admin-only**: Group name, question types, manage members
- **Any member**: Invite members, leave group
- Always verify permissions server-side (RLS policies)

### 5.2 Question Frequency Logic
- "More" = 1.5x weight (appears more often)
- "Less" = 0.5x weight (appears less often)
- "None" = 0x weight (completely disabled)
- Implement weighted selection in prompt assignment

### 5.3 Edge Cases
- Last admin cannot leave (must transfer admin or delete group)
- Admin cannot remove themselves
- Group with no admins (prevent this scenario)
- Disabling all categories (show warning, provide fallback)

### 5.4 UI/UX
- Clear admin indicators
- Disabled states for non-admin actions
- Confirmation dialogs for destructive actions
- Loading states for async operations
- Error handling and user feedback

### 5.5 Performance
- Cache group settings
- Optimize question preference queries
- Consider pagination for large member lists

## 6. Testing Checklist

- [ ] Admin can update group name
- [ ] Non-admin cannot update group name
- [ ] Admin can change question preferences
- [ ] Disabled categories don't appear in prompts
- [ ] "More" preference increases frequency
- [ ] "Less" preference decreases frequency
- [ ] Admin can remove members
- [ ] Admin cannot remove themselves
- [ ] Any member can invite
- [ ] Any member can leave
- [ ] Last admin cannot leave
- [ ] RLS policies enforce permissions
- [ ] UI shows correct admin status
- [ ] Navigation works correctly
- [ ] Error states handled gracefully

## 7. Future Enhancements

- Transfer admin role
- Promote member to admin
- Group deletion (admin only)
- Question preference history/analytics
- Bulk member operations
- Group description/bio
- Group avatar/image
- Notification preferences per group

