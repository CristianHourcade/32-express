const isBrowser = typeof window !== "undefined"

// Variables de entorno del cliente (seguras para exponer)
export const clientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true",
  NEXT_PUBLIC_USE_MOCK_AUTH: process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true",
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "",
}

// Variables de entorno del servidor (nunca expuestas al cliente)
export const serverEnv = isBrowser
  ? // Valores vacíos en el cliente
    {
      SUPABASE_SERVICE_ROLE_KEY: "",
      DATABASE_URL: "",
      PORT: "",
    }
  : // Valores reales en el servidor
    {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      DATABASE_URL: process.env.DATABASE_URL || "",
      PORT: process.env.PORT || "",
    }

// Verificador de estado de variables de entorno
export function getEnvStatus() {
  return {
    client: {
      hasSupabaseUrl: !!clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      usingMockData: clientEnv.NEXT_PUBLIC_USE_MOCK_DATA,
      usingMockAuth: clientEnv.NEXT_PUBLIC_USE_MOCK_AUTH,
    },
    server: isBrowser
      ? { unavailableInBrowser: true }
      : {
          hasServiceKey: !!serverEnv.SUPABASE_SERVICE_ROLE_KEY,
          hasDatabaseUrl: !!serverEnv.DATABASE_URL,
        },
    runtime: {
      isServer: !isBrowser,
      nodeEnv: process.env.NODE_ENV || "development",
    },
  }
}

