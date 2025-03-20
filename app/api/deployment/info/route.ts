import { NextResponse } from "next/server"
import { createModuleLogger } from "@/lib/serverLogger"
import { getEnvironmentStatus } from "@/lib/config"

const logger = createModuleLogger("deployment-info-api")

export async function GET() {
  try {
    // Obtener marca de tiempo de compilación del entorno o generar tiempo actual
    const buildTimestamp =
      process.env.NEXT_PUBLIC_BUILD_TIMESTAMP || process.env.BUILD_TIMESTAMP || new Date().toISOString()

    // Obtener ID de compilación de Next.js si está disponible
    const buildId = process.env.NEXT_PUBLIC_BUILD_ID || process.env.BUILD_ID || `build-${Date.now()}`

    // Obtener información del entorno
    const envStatus = getEnvironmentStatus()

    // Obtener variables de entorno públicas
    const publicEnvVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "[REDACTADO]" : undefined,
      NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
      NEXT_PUBLIC_USE_MOCK_AUTH: process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    }

    // Obtener versiones de Node.js y Next.js
    const nodeVersion = process.version
    const nextVersion = process.env.NEXT_PUBLIC_VERSION || "Desconocido"

    // Obtener configuración de control de caché
    const cacheControl = "no-store, max-age=0"

    // Recopilar entorno cliente y servidor para comparación
    const clientEnv = {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
      USE_MOCK_AUTH: process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
      API_URL: process.env.NEXT_PUBLIC_API_URL,
    }

    const serverEnv = {
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      USE_MOCK_DATA: process.env.USE_MOCK_DATA || process.env.NEXT_PUBLIC_USE_MOCK_DATA,
      USE_MOCK_AUTH: process.env.USE_MOCK_AUTH || process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
      API_URL: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL,
    }

    // Registrar la solicitud para depuración
    logger.info("Información de despliegue solicitada", {
      buildId,
      environment: envStatus.environment,
      timestamp: new Date().toISOString(),
    })

    // Devolver la información de despliegue
    return NextResponse.json({
      buildTimestamp,
      buildId,
      environment: envStatus.environment,
      platform: envStatus.platform,
      nodeVersion,
      nextVersion,
      publicEnvVars,
      cacheControl,
      staticGeneration: false, // Estamos desactivando la generación estática
      clientEnv,
      serverEnv,
    })
  } catch (error) {
    logger.error("Error al obtener información de despliegue", {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json({ error: "Error al obtener información de despliegue" }, { status: 500 })
  }
}

