# Unseen Activity Count Feature Implementation

## Overview
Display a count of new entries (answers) in other groups since the user's last visit to that group. This appears as "X new answers" next to group names in the group switcher dropdown on `app/(main)/home.tsx`.

## Feature Requirements

### When to Show the Count
- **Only show for groups that are NOT the current group** - The current group is always considered "seen"
- **Only show if there are new entries** - If count is 0, show nothing
- **Only show if user has multiple groups** - If user only has one group, don't show anything
- **Count only entries by OTHER users** - Don't count the current user's own entries

### What Counts as "New"
- Entries created by other group members (not the current user)
- Entries created AFTER the last visit timestamp for that group
- If no timestamp exists, count ALL entries by others (user has never visited that group)

### When to Clear the Count
- When the user switches to that group (visits it)
- The timestamp is set when the user explicitly switches groups, not on initial app load

## Implementation Details

### 1. AsyncStorage Timestamp Tracking

Use AsyncStorage to track when a user last visited each group:
- Key format: `group_visited_${groupId}`
- Value: ISO timestamp string (e.g., `"2024-01-15T10:30:00.000Z"`)
- Only set when user **explicitly switches** to a group, not on initial load

### 2. React Query for Unseen Status

Create a query that fetches unseen status for all groups:

```typescript
const { data: groupUnseenStatus = {} } = useQuery({
  queryKey: ["groupUnseenStatus", groups.map((g) => g.id).join(","), userId, currentGroupId],
  queryFn: async () => {
    if (groups.length === 0 || !userId) return {}
    const status: Record<string, { hasNew: boolean; newCount: number }> = {}
    
    for (const group of groups) {
      // Current group is always "seen" - no count
      if (group.id === currentGroupId) {
        status[group.id] = { hasNew: false, newCount: 0 }
        continue
      }
      
      // Get last visit time for this group
      const lastVisitStr = await AsyncStorage.getItem(`group_visited_${group.id}`)
      const lastVisit = lastVisitStr ? new Date(lastVisitStr) : null

      if (!lastVisit) {
        // No last visit - count all entries by others
        const { count, error } = await supabase
          .from("entries")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id)
          .neq("user_id", userId)
        
        if (error) {
          status[group.id] = { hasNew: false, newCount: 0 }
        } else {
          status[group.id] = { hasNew: (count || 0) > 0, newCount: count || 0 }
        }
      } else {
        // Count entries by others since last visit
        // Use a small buffer (subtract 1 second) to account for timing issues
        const lastVisitWithBuffer = new Date(lastVisit.getTime() - 1000)
        
        const { count, error } = await supabase
          .from("entries")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id)
          .neq("user_id", userId)
          .gt("created_at", lastVisitWithBuffer.toISOString())
        
        if (error) {
          status[group.id] = { hasNew: false, newCount: 0 }
        } else {
          status[group.id] = { hasNew: (count || 0) > 0, newCount: count || 0 }
        }
      }
    }
    
    return status
  },
  enabled: groups.length > 0 && !!userId,
  refetchOnMount: true, // Always refetch when component mounts
  refetchOnWindowFocus: true, // Refetch when window comes into focus
  staleTime: 0, // Always consider data stale to ensure fresh counts
  refetchInterval: 30000, // Poll every 30 seconds to check for new entries
})
```

### 3. Setting Visit Timestamps

**CRITICAL**: Only set timestamps when user **explicitly switches** groups, NOT on initial load.

```typescript
// Track previous group ID to detect actual switches
const visitedGroupRef = useRef<string | undefined>(undefined)

// Mark current group as visited when it becomes active
useEffect(() => {
  if (currentGroupId) {
    // Only set timestamp if this is an actual group switch (not initial load)
    if (visitedGroupRef.current !== undefined && visitedGroupRef.current !== currentGroupId) {
      // User switched from one group to another
      AsyncStorage.setItem(`group_visited_${currentGroupId}`, new Date().toISOString())
    }
    // Update ref for next comparison
    visitedGroupRef.current = currentGroupId
  }
}, [currentGroupId])
```

**Also set timestamp in the group switcher handler:**

```typescript
async function handleSelectGroup(groupId: string) {
  if (groupId !== currentGroupId) {
    // ... existing group switch logic ...
    
    // Mark group as visited when user switches to it
    await AsyncStorage.setItem(`group_visited_${groupId}`, new Date().toISOString())
    
    // ... rest of switch logic ...
  }
  setGroupPickerVisible(false)
}
```

### 4. Display in Group Switcher

In the group switcher dropdown, conditionally render the count:

```typescript
{groups.map((group) => (
  <View key={group.id} style={styles.groupRowContainer}>
    <TouchableOpacity
      style={[
        styles.groupRow,
        group.id === currentGroupId && styles.groupRowActive,
        styles.groupRowFlex,
      ]}
      onPress={() => handleSelectGroup(group.id)}
    >
      <View style={styles.groupRowContent}>
        <Text style={styles.groupRowText}>{group.name}</Text>
        {/* Only show count for non-current groups with multiple groups */}
        {groups.length > 1 && 
         group.id !== currentGroupId && 
         groupUnseenStatus[group.id]?.hasNew && 
         groupUnseenStatus[group.id]?.newCount > 0 && (
          <Text style={styles.newAnswersText}>
            {groupUnseenStatus[group.id].newCount} new {groupUnseenStatus[group.id].newCount === 1 ? "answer" : "answers"}
          </Text>
        )}
      </View>
    </TouchableOpacity>
    {/* ... settings button ... */}
  </View>
))}
```

### 5. Styles

Add style for the new answers text:

```typescript
newAnswersText: {
  ...typography.body,
  color: colors.gray[400],
  fontSize: 14,
  marginLeft: spacing.sm,
  marginRight: spacing.md, // Extra padding between text and end of button
},
```

### 6. Query Invalidation

Invalidate the query when screen comes into focus to ensure fresh counts:

```typescript
useFocusEffect(
  useCallback(() => {
    // ... other focus logic ...
    
    // Invalidate and refetch unseen status when screen comes into focus
    queryClient.invalidateQueries({ queryKey: ["groupUnseenStatus"] })
  }, [queryClient])
)
```

## Key Implementation Points

### 1. Timestamp Management
- **DO**: Set timestamp when user explicitly switches groups
- **DON'T**: Set timestamp on initial app load or when screen comes into focus
- **DO**: Use a ref to track previous group ID to detect actual switches

### 2. Query Configuration
- Use `refetchOnMount: true` to always get fresh data
- Use `refetchOnWindowFocus: true` to update when app comes to foreground
- Use `staleTime: 0` to always consider data stale
- Use `refetchInterval: 30000` to poll every 30 seconds
- Include `currentGroupId` in query key so it refetches when group changes

### 3. Counting Logic
- Always exclude current user's entries (`.neq("user_id", userId)`)
- Use a 1-second buffer when comparing timestamps to account for timing edge cases
- If no timestamp exists, count all entries by others (user never visited)

### 4. Display Logic
- Only show for groups that are NOT the current group
- Only show if `hasNew` is true AND `newCount > 0`
- Only show if user has multiple groups (`groups.length > 1`)
- Use proper pluralization ("answer" vs "answers")

### 5. Edge Cases to Handle
- **User has never visited a group**: Count all entries by others
- **User switches groups quickly**: Timestamp should update immediately
- **Multiple groups with new entries**: Show count for each group
- **User is in Group A, new entries posted in Group A**: Don't show count (current group is always "seen")
- **User switches to Group A, then back to Group B**: Group A's timestamp should be set, Group B should show count if there are new entries

## Testing Checklist

- [ ] Count appears for groups with new entries (not current group)
- [ ] Count does NOT appear for current group
- [ ] Count does NOT appear if user only has one group
- [ ] Count clears when user switches to that group
- [ ] Count updates when new entries are posted (within 30 seconds)
- [ ] Count persists across app restarts
- [ ] Count shows correct number (1 vs multiple)
- [ ] Pluralization works correctly ("answer" vs "answers")
- [ ] Timestamp is NOT set on initial app load
- [ ] Timestamp IS set when user switches groups
- [ ] Count works correctly if user has never visited a group
- [ ] Count updates when screen comes into focus
- [ ] Multiple groups can show counts simultaneously

## Database Query Details

The Supabase query structure:
```sql
SELECT COUNT(*) 
FROM entries 
WHERE group_id = {groupId}
  AND user_id != {currentUserId}
  AND created_at > {lastVisitTimestamp}
```

Key points:
- Uses `count: "exact"` with `head: true` for efficient counting
- Filters by `group_id` to get entries for specific group
- Excludes current user with `.neq("user_id", userId)`
- Uses `.gt("created_at", timestamp)` to get entries after last visit
- Includes 1-second buffer to handle timing edge cases



