export function getEnvironmentInfo() {
  const isServer = typeof window === "undefined"
  const runtime = isServer ? "server" : "client"

  // Variables seguras para mostrar (no incluir valores completos de claves)
  const safeEnvInfo = {
    runtime,
    timestamp: new Date().toISOString(),
    nextPublicVars: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "not-set",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "not-set",
      NEXT_PUBLIC_USE_MOCK_AUTH: process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
      NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ? "set" : "not-set",
    },
    // Solo incluir información sobre variables del servidor si estamos en el servidor
    serverVars: isServer
      ? {
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "not-set",
          DATABASE_URL: process.env.DATABASE_URL ? "set" : "not-set",
          PORT: process.env.PORT,
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL,
          VERCEL_ENV: process.env.VERCEL_ENV,
        }
      : {
          message: "Server variables not available in browser",
        },
    // Información sobre el entorno
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
  }

  return safeEnvInfo
}

