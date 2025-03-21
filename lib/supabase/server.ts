import { createClient } from "@supabase/supabase-js"
import type { Database } from "../database.types"
import { createModuleLogger } from "../serverLogger"

const logger = createModuleLogger("supabase-server")

// Obtener las variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseServiceRoleKey) {
  logger.error("Missing Supabase environment variables for server client")
}

// Crear el cliente de Supabase con la clave de servicio
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})


export { createClient }
