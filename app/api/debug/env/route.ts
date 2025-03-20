import { NextResponse } from "next/server"

export async function GET() {
  // Verificar si estamos en el servidor
  const isServer = typeof window === "undefined"

  // Recopilar información sobre las variables de entorno
  const envInfo = {
    isServer,
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: {
      exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      value: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10) + "...",
      length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
    },
    supabaseAnonKey: {
      exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    },
    supabaseServiceKey: {
      exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    },
    allEnvKeys: Object.keys(process.env).filter(
      (key) =>
        key.includes("SUPABASE") || key.includes("NEXT_PUBLIC") || key.includes("DATABASE") || key.includes("VERCEL"),
    ),
  }

  return NextResponse.json(envInfo)
}

