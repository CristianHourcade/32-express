import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { clientEnv } from "./env"

// Get environment variables from our centralized handler
const supabaseUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Log warning if environment variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase client environment variables are missing:",
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL is missing" : "",
    !supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing" : "",
  )
}

// Create Supabase client with fallbacks to prevent runtime errors
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder-url.supabase.co",
  supabaseAnonKey || "placeholder-key",
)

// Helper function to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey
}

