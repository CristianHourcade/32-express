import { NextResponse } from "next/server"
import { createModuleLogger } from "@/lib/serverLogger"

const logger = createModuleLogger("deployment-check-api")

export async function GET() {
  try {
    // Verificar si estamos en Vercel
    const isVercel = process.env.VERCEL === "1"

    // Obtener información del entorno de Vercel
    const vercelEnv = process.env.VERCEL_ENV || "development"
    const vercelRegion = process.env.VERCEL_REGION || "unknown"
    const vercelUrl = process.env.VERCEL_URL || "localhost"

    // Verificar configuración de caché
    const cacheHeaders = {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    }

    // Verificar tiempo de compilación
    const buildTime = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP || process.env.BUILD_TIMESTAMP || new Date().toISOString()

    // Calcular tiempo desde la compilación
    const buildDate = new Date(buildTime)
    const now = new Date()
    const diffMs = now.getTime() - buildDate.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    // Determinar estado de frescura de la compilación
    let freshness = "unknown"
    if (diffHours < 1) {
      freshness = "fresh" // Menos de 1 hora
    } else if (diffHours < 24) {
      freshness = "recent" // Menos de 24 horas
    } else {
      freshness = "stale" // Más de 24 horas
    }

    // Registrar verificación para depuración
    logger.info("Verificación de despliegue realizada", {
      isVercel,
      vercelEnv,
      vercelRegion,
      buildTime,
      freshness,
      timestamp: new Date().toISOString(),
    })

    // Devolver resultados de verificación
    return NextResponse.json(
      {
        isVercel,
        vercelEnv,
        vercelRegion,
        vercelUrl,
        buildTime,
        currentTime: now.toISOString(),
        timeSinceBuild: `${Math.round(diffHours * 10) / 10} horas`,
        freshness,
        cacheHeaders,
        nodeVersion: process.version,
      },
      { headers: cacheHeaders },
    )
  } catch (error) {
    logger.error("Error en verificación de despliegue", {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json({ error: "Error al realizar verificación de despliegue" }, { status: 500 })
  }
}

