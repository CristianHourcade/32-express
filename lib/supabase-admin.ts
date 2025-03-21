import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// Detector seguro de entorno cliente/servidor
const isBrowser = typeof window !== "undefined"

// Obtener variables de entorno con valores predeterminados seguros
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

// CAMBIO TEMPORAL: Usar NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY en lugar de SUPABASE_SERVICE_ROLE_KEY
// NOTA: Esto no es seguro y debe cambiarse en el futuro
const supabaseServiceKey =
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Verificar si las variables de entorno están disponibles
const hasUrl = !!supabaseUrl
const hasServiceKey = !!supabaseServiceKey

// Registrar información de configuración (solo en el servidor)
if (!isBrowser) {
    console.info("[supabaseAdmin] Initializing Supabase Admin client", {
        url: supabaseUrl,
    })

    console.info("[supabaseAdmin] Configuración de Supabase Admin", {
        hasUrl,
        hasServiceKey,
        urlLength: supabaseUrl.length,
        keyLength: supabaseServiceKey.length,
        isServer: !isBrowser,
        nodeEnv: process.env.NODE_ENV,
        // Registrar qué variable se está usando (para diagnóstico)
        usingPublicKey: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    })
}

// Registrar advertencia si faltan variables de entorno
if (!hasUrl || !hasServiceKey) {
    console.error("[supabaseAdmin] Missing environment variables", {
        hasUrl,
        hasServiceKey,
    })
}

// Crear cliente admin de Supabase con manejo de errores
let supabaseAdmin = null
try {
    // Crear cliente si tenemos URL y clave de servicio (en cualquier entorno como solución temporal)
    if (hasUrl && hasServiceKey) {
        supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey)

        // Advertencia de seguridad si estamos usando la clave pública
        if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
            console.warn(
                "[supabaseAdmin] ADVERTENCIA DE SEGURIDAD: Usando NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY. " +
                "Esto expone tu clave de servicio al cliente y no es seguro. " +
                "Por favor, configura SUPABASE_SERVICE_ROLE_KEY en Vercel lo antes posible.",
            )
        }
    }
} catch (error) {
    console.error("[supabaseAdmin] Error creando cliente Supabase Admin", {
        error,
    })
}

// Función segura para operaciones admin
export async function withAdmin<T>(
    operation: (client: ReturnType<typeof createClient<Database>>) => Promise<T>,
    fallback?: T,
): Promise<T> {
    // Verificar si el cliente admin está configurado
    if (!supabaseAdmin) {
        console.error("[supabaseAdmin] Error: Cliente admin no inicializado. " + "Verifica las variables de entorno.")
        if (fallback !== undefined) {
            return fallback
        }
        throw new Error(
            "Supabase admin client is not properly configured. " +
            "Missing environment variables: " +
            (!hasUrl ? "NEXT_PUBLIC_SUPABASE_URL " : "") +
            (!hasServiceKey ? "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY" : ""),
        )
    }

    // Ejecutar operación con cliente admin
    try {
        return await operation(supabaseAdmin)
    } catch (error) {
        console.error("[supabaseAdmin] Error executing admin operation", { error })
        if (fallback !== undefined) {
            return fallback
        }
        throw error
    }
}

// Exportar el cliente admin (con precaución)
export { supabaseAdmin }

