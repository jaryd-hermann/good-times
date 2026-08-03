import { useQuery } from "@tanstack/react-query"
import { supabase } from "../supabase"

/**
 * The signed-in user's public profile row.
 *
 * AuthProvider only exposes the auth user (id/email); name and avatar live in
 * `public.users`. Cached for 5 minutes — it changes rarely, and the v1 habit of
 * refetching the profile on every screen focus is part of why the old app felt
 * slow.
 */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["v2", "profile", userId ?? ""],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, avatar_url, birthday, onboarded_at")
        .eq("id", userId!)
        .maybeSingle()
      if (error) throw new Error(`useProfile: ${error.message}`)
      return data as {
        id: string
        name: string | null
        avatar_url: string | null
        birthday: string | null
        onboarded_at: string | null
      } | null
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  })
}
