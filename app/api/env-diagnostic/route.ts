import { NextResponse } from "next/server"

export async function GET() {
  // Detector seguro de entorno cliente/servidor
  const isBrowser = typeof window !== "undefined"

  // Variables de entorno del cliente
  const clientEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true",
    NEXT_PUBLIC_USE_MOCK_AUTH: process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true",
  }

  // Variables de entorno del servidor
  const serverEnv = isBrowser
    ? { unavailableInBrowser: true }
    : {
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      }

  // Identificar problemas
  const issues = []

  if (!clientEnv.NEXT_PUBLIC_SUPABASE_URL) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL is missing")
  }

  if (!clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing")
  }

  if (!isBrowser && !serverEnv.hasServiceKey) {
    issues.push("SUPABASE_SERVICE_ROLE_KEY is missing on the server")
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    clientEnv: {
      hasSupabaseUrl: !!clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      usingMockData: clientEnv.NEXT_PUBLIC_USE_MOCK_DATA,
      usingMockAuth: clientEnv.NEXT_PUBLIC_USE_MOCK_AUTH,
    },
    serverEnv,
    issues,
  })
}

