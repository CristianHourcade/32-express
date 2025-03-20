export function checkEnvironmentVariables() {
  // Lista de variables de entorno a verificar
  const variables = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_USE_MOCK_DATA",
    "NEXT_PUBLIC_USE_MOCK_AUTH",
    "NEXT_PUBLIC_API_URL",
  ]

  console.log("🔍 Verificando variables de entorno:")

  const results: Record<string, boolean> = {}

  variables.forEach((variable) => {
    const exists = !!process.env[variable]
    results[variable] = exists
    console.log(`  - ${variable}: ${exists ? "✅ Configurada" : "❌ No configurada"}`)
  })

  return results
}

// Ejecutar verificación automáticamente en desarrollo
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  console.log("🧪 Entorno de desarrollo detectado, verificando variables...")
  checkEnvironmentVariables()
}

