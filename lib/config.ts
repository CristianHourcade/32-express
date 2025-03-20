export const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true"

// Determine if mock authentication should be used
export const useMockAuth = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true"

// API URL with fallback
export const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

// Supabase configuration with proper error handling
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || "",
  isConfigured: () => {
    return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  },
  hasServiceKey: () => {
    return !!process.env.SUPABASE_SERVICE_ROLE_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  },
}

// Function to check if we're in a production environment
export const isProduction = process.env.NODE_ENV === "production"
export const isVercel = process.env.VERCEL === "1"

// Configuration log for debugging
if (typeof window !== "undefined") {
  console.log("🔧 App Configuration:")
  console.log(`🔧 Environment: ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}`)
  console.log(`🔧 Platform: ${isVercel ? "VERCEL" : "OTHER"}`)
  console.log(`🔧 Using Mock Data: ${useMockData}`)
  console.log(`🔧 Using Mock Auth: ${useMockAuth}`)
  console.log(`🔧 Supabase Configured: ${supabaseConfig.isConfigured() ? "YES" : "NO"}`)
  console.log(`🔧 Has Service Key: ${supabaseConfig.hasServiceKey() ? "YES" : "NO"}`)
}

// Function to get environment status for diagnostics
export function getEnvironmentStatus() {
  return {
    environment: isProduction ? "production" : "development",
    platform: isVercel ? "vercel" : "other",
    mockData: useMockData,
    mockAuth: useMockAuth,
    supabase: {
      configured: supabaseConfig.isConfigured(),
      hasServiceKey: supabaseConfig.hasServiceKey(),
    },
  }
}

