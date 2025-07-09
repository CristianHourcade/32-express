import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Verificar variables de entorno críticas
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasSupabaseAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  // Registrar información sobre las variables de entorno
  console.log("[middleware] Environment variables check:", {
    url: request.nextUrl.pathname,
    hasSupabaseUrl,
    hasSupabaseAnonKey,
    hasServiceKey,
    nodeEnv: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV || "not-set",
  })

  return NextResponse.next()
}

// Configurar el middleware para ejecutarse en todas las rutas
export const config = {
  matcher: [
    // Aplica a todas las rutas excepto /_next/*, /favicon.ico, /public/* y /api/*
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
}


