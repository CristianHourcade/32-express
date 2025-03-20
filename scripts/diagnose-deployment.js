const https = require("https")
const http = require("http")

// Obtener URL de producción de los argumentos o usar valor predeterminado
const productionUrl = process.argv[2] || "https://your-app.vercel.app"

console.log(`🔍 Diagnosticando despliegue en: ${productionUrl}`)

// Función para realizar solicitud HTTP/HTTPS
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http

    const req = protocol.get(url, options, (res) => {
      let data = ""

      res.on("data", (chunk) => {
        data += chunk
      })

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        })
      })
    })

    req.on("error", (error) => {
      reject(error)
    })

    req.end()
  })
}

// Verificar encabezados de caché
async function checkCacheHeaders(url) {
  try {
    console.log(`\n📋 Verificando encabezados de caché en: ${url}`)
    const response = await makeRequest(url)

    console.log(`  Status: ${response.statusCode}`)
    console.log("  Encabezados de caché:")

    const cacheHeaders = [
      "cache-control",
      "etag",
      "last-modified",
      "age",
      "expires",
      "pragma",
      "x-vercel-cache",
      "cdn-cache-control",
      "vercel-cdn-cache-control",
    ]

    cacheHeaders.forEach((header) => {
      if (response.headers[header]) {
        console.log(`    ${header}: ${response.headers[header]}`)
      }
    })

    // Analizar encabezados de caché
    if (response.headers["cache-control"] && response.headers["cache-control"].includes("no-store")) {
      console.log("  ✅ Encabezados de caché configurados correctamente para evitar caché")
    } else {
      console.log("  ⚠️ Los encabezados de caché podrían permitir almacenamiento en caché")
    }

    return response
  } catch (error) {
    console.error(`  ❌ Error al verificar encabezados: ${error.message}`)
    return null
  }
}

// Verificar información de compilación
async function checkBuildInfo(url) {
  try {
    console.log(`\n📦 Verificando información de compilación en: ${url}/api/build-info`)
    const response = await makeRequest(`${url}/api/build-info`)

    if (response.statusCode !== 200) {
      console.log(`  ❌ Error: Status ${response.statusCode}`)
      return null
    }

    const buildInfo = JSON.parse(response.data)
    console.log("  Información de compilación:")
    console.log(`    Marca de tiempo: ${buildInfo.buildTimestamp}`)
    console.log(`    ID de compilación: ${buildInfo.buildId}`)
    console.log(`    Entorno: ${buildInfo.environment}`)
    console.log(`    Versión de Node: ${buildInfo.nodeVersion}`)

    // Verificar frescura de la compilación
    const buildDate = new Date(buildInfo.buildTimestamp)
    const now = new Date()
    const diffHours = (now - buildDate) / (1000 * 60 * 60)

    if (diffHours < 1) {
      console.log(`  ✅ Compilación reciente (${Math.round(diffHours * 60)} minutos)`)
    } else if (diffHours < 24) {
      console.log(`  ⚠️ Compilación de hoy (${Math.round(diffHours)} horas)`)
    } else {
      console.log(`  ❌ Compilación antigua (${Math.round(diffHours / 24)} días)`)
    }

    return buildInfo
  } catch (error) {
    console.error(`  ❌ Error al verificar información de compilación: ${error.message}`)
    console.log("  ⚠️ Asegúrese de que la API /api/build-info esté implementada")
    return null
  }
}

// Verificar información de despliegue
async function checkDeploymentInfo(url) {
  try {
    console.log(`\n🚀 Verificando información de despliegue en: ${url}/api/deployment/info`)
    const response = await makeRequest(`${url}/api/deployment/info`)

    if (response.statusCode !== 200) {
      console.log(`  ❌ Error: Status ${response.statusCode}`)
      return null
    }

    const deployInfo = JSON.parse(response.data)
    console.log("  Información de despliegue:")
    console.log(`    Entorno: ${deployInfo.environment}`)
    console.log(`    Plataforma: ${deployInfo.platform}`)
    console.log(`    Control de caché: ${deployInfo.cacheControl}`)

    // Verificar variables de entorno
    console.log("  Variables de entorno públicas:")
    for (const [key, value] of Object.entries(deployInfo.publicEnvVars)) {
      if (value) {
        console.log(`    ✅ ${key}: Configurado`)
      } else {
        console.log(`    ❌ ${key}: No configurado`)
      }
    }

    // Verificar consistencia de entorno cliente/servidor
    console.log("  Consistencia de entorno cliente/servidor:")
    let mismatches = 0

    for (const key in deployInfo.clientEnv) {
      if (deployInfo.clientEnv[key] !== deployInfo.serverEnv[key]) {
        console.log(`    ❌ Discrepancia en ${key}:`)
        console.log(`      Cliente: ${deployInfo.clientEnv[key]}`)
        console.log(`      Servidor: ${deployInfo.serverEnv[key]}`)
        mismatches++
      }
    }

    if (mismatches === 0) {
      console.log("    ✅ Entornos cliente y servidor coinciden")
    }

    return deployInfo
  } catch (error) {
    console.error(`  ❌ Error al verificar información de despliegue: ${error.message}`)
    console.log("  ⚠️ Asegúrese de que la API /api/deployment/info esté implementada")
    return null
  }
}

// Verificar estado de despliegue
async function checkDeploymentStatus(url) {
  try {
    console.log(`\n🔄 Verificando estado de despliegue en: ${url}/api/deployment/check`)
    const response = await makeRequest(`${url}/api/deployment/check`)

    if (response.statusCode !== 200) {
      console.log(`  ❌ Error: Status ${response.statusCode}`)
      return null
    }

    const statusInfo = JSON.parse(response.data)
    console.log("  Estado de despliegue:")
    console.log(`    Es Vercel: ${statusInfo.isVercel ? "Sí" : "No"}`)
    console.log(`    Entorno Vercel: ${statusInfo.vercelEnv}`)
    console.log(`    Región Vercel: ${statusInfo.vercelRegion}`)
    console.log(`    Tiempo desde compilación: ${statusInfo.timeSinceBuild}`)
    console.log(`    Frescura: ${statusInfo.freshness}`)

    // Evaluar frescura
    if (statusInfo.freshness === "fresh") {
      console.log("  ✅ Despliegue reciente")
    } else if (statusInfo.freshness === "recent") {
      console.log("  ⚠️ Despliegue de hoy, pero no reciente")
    } else {
      console.log("  ❌ Despliegue antiguo")
    }

    return statusInfo
  } catch (error) {
    console.error(`  ❌ Error al verificar estado de despliegue: ${error.message}`)
    console.log("  ⚠️ Asegúrese de que la API /api/deployment/check esté implementada")
    return null
  }
}

// Ejecutar todas las verificaciones
async function runAllChecks() {
  try {
    await checkCacheHeaders(productionUrl)
    await checkBuildInfo(productionUrl)
    await checkDeploymentInfo(productionUrl)
    await checkDeploymentStatus(productionUrl)

    console.log("\n📝 Recomendaciones:")
    console.log("  1. Si los encabezados de caché no están configurados correctamente:")
    console.log("     - Actualice next.config.mjs para incluir encabezados de caché adecuados")
    console.log("     - Cree o actualice vercel.json para configurar encabezados de caché")

    console.log("  2. Si la compilación es antigua:")
    console.log('     - Realice un nuevo despliegue con "Redeploy without cache" en Vercel')
    console.log("     - Verifique que no haya errores en los logs de compilación")

    console.log("  3. Si hay discrepancias en las variables de entorno:")
    console.log("     - Verifique la configuración de variables de entorno en Vercel")
    console.log("     - Asegúrese de que las variables NEXT_PUBLIC_ estén configuradas correctamente")

    console.log("  4. Para futuros despliegues:")
    console.log("     - Use generateBuildId en next.config.mjs para evitar problemas de caché")
    console.log("     - Configure correctamente los encabezados de caché")
    console.log("     - Verifique los logs de compilación después de cada despliegue")
    console.log("     - Considere implementar un pipeline de CI/CD para despliegues más confiables")
  } catch (error) {
    console.error(`❌ Error al ejecutar verificaciones: ${error.message}`)
  }
}

// Ejecutar diagnóstico
runAllChecks()

