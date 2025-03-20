export const BUILD_TIMESTAMP = new Date().toISOString()

// Generar un ID de compilación único que incluye la marca de tiempo
export const BUILD_ID = `build-${Date.now()}`

// Seguimiento de la versión de Node.js
export const NODE_VERSION = process.version

// Seguimiento del entorno
export const ENVIRONMENT = process.env.NODE_ENV || "development"
export const IS_PRODUCTION = process.env.NODE_ENV === "production"
export const IS_VERCEL = process.env.VERCEL === "1"

// Función para obtener toda la información de compilación
export function getBuildInfo() {
  return {
    buildTimestamp: BUILD_TIMESTAMP,
    buildId: BUILD_ID,
    nodeVersion: NODE_VERSION,
    environment: ENVIRONMENT,
    isProduction: IS_PRODUCTION,
    isVercel: IS_VERCEL,
    // Añadir cualquier otra información de compilación relevante aquí
  }
}

// Registrar información de compilación al inicio (solo del lado del servidor)
if (typeof window === "undefined") {
  console.log("🏗️ Información de Compilación:")
  console.log(`🏗️ Marca de Tiempo de Compilación: ${BUILD_TIMESTAMP}`)
  console.log(`🏗️ ID de Compilación: ${BUILD_ID}`)
  console.log(`🏗️ Versión de Node: ${NODE_VERSION}`)
  console.log(`🏗️ Entorno: ${ENVIRONMENT}`)
  console.log(`🏗️ Es Producción: ${IS_PRODUCTION}`)
  console.log(`🏗️ Es Vercel: ${IS_VERCEL}`)
}

