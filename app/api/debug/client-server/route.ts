import { NextResponse } from "next/server"
import { appConfig } from "@/lib/config"
import { isAdminClientAvailable } from "@/lib/supabaseAdmin"

export async function GET() {
  // Verificar si estamos en el servidor
  const isServer = typeof window === "undefined"

  // Recopilar información sobre las variables de entorno
  const envInfo = {
    isServer,
    appConfig,
    supabaseAdminAvailable: isAdminClientAvailable ? isAdminClientAvailable() : "function not available",
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV,
    },
    supabaseEnv: {
      url: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10) + "...",
        length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
      },
      anonKey: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      },
      serviceKey: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      },
      publicServiceKey: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
        length: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      },
    },
  }

  return NextResponse.json(envInfo)
}

