import { NextResponse } from "next/server"
import { testSupabaseAdminConnection } from "@/lib/supabaseAdmin"

export async function GET() {
  const isBrowser = typeof window !== "undefined"

  // Información básica del entorno
  const envInfo = {
    nodeEnv: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV || "not-set",
    isBrowser,

    // Variables públicas (seguras para mostrar)
    publicVars: {
      NEXT_PUBLIC_SUPABASE_URL: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10) + "...",
        length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      },
      NEXT_PUBLIC_USE_MOCK_AUTH: {
        exists: !!process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
        value: process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
      },
      NEXT_PUBLIC_USE_MOCK_DATA: {
        exists: !!process.env.NEXT_PUBLIC_USE_MOCK_DATA,
        value: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
      },
    },

    // Variables privadas (solo mostrar si existen, no sus valores)
    privateVars: {
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      },
      DATABASE_URL: {
        exists: !!process.env.DATABASE_URL,
        length: process.env.DATABASE_URL?.length || 0,
      },
      PORT: {
        exists: !!process.env.PORT,
        value: process.env.PORT,
      },
    },
  }

  // Probar conexión a Supabase Admin
  const adminConnectionTest = await testSupabaseAdminConnection()

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: envInfo,
    supabaseAdminTest: adminConnectionTest,
  })
}

