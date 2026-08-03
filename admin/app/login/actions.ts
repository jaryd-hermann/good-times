"use server"

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isEmailAllowed } from "@/lib/auth"

const fail = (msg: string): never => {
  redirect(`/login?error=${encodeURIComponent(msg)}`)
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim()
  const password = String(formData.get("password") || "")

  if (!email || !password) fail("Enter your email and password.")
  if (!isEmailAllowed(email)) fail("This email is not authorized.")

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  // Double-check the authenticated identity against the allowlist before we let
  // the session stand.
  if (error || !isEmailAllowed(data.user?.email)) {
    if (data?.user) await supabase.auth.signOut()
    fail("Invalid email or password.")
  }

  redirect("/")
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}
