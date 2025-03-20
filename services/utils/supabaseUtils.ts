import { supabase } from "@/lib/supabase"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Verifica si una tabla existe en la base de datos
 */
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_name", tableName)
      .eq("table_schema", "public")

    if (error) {
      console.error(`Error checking if table ${tableName} exists:`, error)
      return false
    }

    return data && data.length > 0
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error)
    return false
  }
}

/**
 * Verifica si la base de datos está configurada correctamente
 */
export async function isDatabaseConfigured(): Promise<boolean> {
  const requiredTables = [
    "businesses",
    "users",
    "employees",
    "products",
    "shifts",
    "sales",
    "sale_items",
    "expenses",
    "activities",
  ]

  for (const table of requiredTables) {
    const exists = await tableExists(table)
    if (!exists) {
      console.error(`Required table ${table} does not exist`)
      return false
    }
  }

  return true
}

/**
 * Verifica si hay datos de ejemplo en la base de datos
 */
export async function hasSampleData(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("businesses").select("count")

    if (error) {
      console.error("Error checking for sample data:", error)
      return false
    }

    return data && data.length > 0
  } catch (error) {
    console.error("Error checking for sample data:", error)
    return false
  }
}

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ""

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

