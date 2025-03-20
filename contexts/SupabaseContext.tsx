"use client"

import { createContext, useContext, type ReactNode } from "react"
import { getSupabaseClient } from "@/lib/supabase"

// Create a context for the Supabase client
const SupabaseContext = createContext(getSupabaseClient())

// Provider component
export function SupabaseProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient()
  return <SupabaseContext.Provider value={supabase}>{children}</SupabaseContext.Provider>
}

// Hook to use the Supabase client
export function useSupabase() {
  return useContext(SupabaseContext)
}

