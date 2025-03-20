import {
  registerUser as mockRegisterUser,
  loginUser as mockLoginUser,
  logoutUser as mockLogoutUser,
  resetPassword as mockResetPassword,
  updatePassword as mockUpdatePassword,
  getCurrentUser as mockGetCurrentUser,
} from "./mockAuthService"

// Import Supabase authentication services
import {
  registerUser as supabaseRegisterUser,
  logoutUser as supabaseLogoutUser,
  resetPassword as supabaseResetPassword,
  updatePassword as supabaseUpdatePassword,
} from "./supabaseAuthService"

// Determine whether to use mock or Supabase authentication
const useMockAuth = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === "true"

// Log which authentication service is being used
console.log(`🔐 Auth Service: Using ${useMockAuth ? "MOCK" : "SUPABASE"} authentication`)
console.log(`🔐 NEXT_PUBLIC_USE_MOCK_AUTH = "${process.env.NEXT_PUBLIC_USE_MOCK_AUTH}"`)
console.log(`🔐 NEXT_PUBLIC_SUPABASE_URL = "${process.env.NEXT_PUBLIC_SUPABASE_URL}"`)

// If using Supabase auth, export the original functions for reference
export { supabaseRegisterUser, supabaseLogoutUser, supabaseResetPassword, supabaseUpdatePassword }

import { createModuleLogger } from "@/lib/serverLogger"
import { supabase } from "@/lib/supabase"
import type { User } from "@/lib/redux/slices/authSlice"

const logger = createModuleLogger("authService")

async function supabaseLoginUser({ email, password }: { email: string; password: string }) {
  try {
    logger.info("Intento de inicio de sesión", { email })

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      logger.error("Error en inicio de sesión", {
        email,
        error: error.message,
        errorCode: error.code,
      })
      return { error: error.message }
    }

    if (!data.user) {
      logger.error("Inicio de sesión sin usuario retornado", { email })
      return { error: "No se pudo obtener la información del usuario" }
    }

    // Obtener datos adicionales del usuario desde la tabla users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", data.user.id)
      .single()

    if (userError) {
      logger.error("Error obteniendo datos de usuario desde tabla users", {
        userId: data.user.id,
        error: userError.message,
      })
    }

    // Mapear los datos del usuario
    const user: User = {
      id: data.user.id,
      name: userData?.name || data.user.user_metadata?.name || email.split("@")[0],
      email: data.user.email || email,
      role: userData?.role || data.user.user_metadata?.role || "employee",
      businessId: userData?.business_id || data.user.user_metadata?.businessId,
    }

    logger.info("Inicio de sesión exitoso", {
      userId: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId || "No asignado",
      hasUserData: !!userData,
    })

    return {
      user,
      token: data.session?.access_token || null,
    }
  } catch (error) {
    logger.error("Error inesperado en inicio de sesión", {
      email,
      error: error instanceof Error ? error.message : String(error),
    })
    return { error: "Error inesperado durante el inicio de sesión" }
  }
}

async function supabaseGetCurrentUser() {
  try {
    logger.info("Verificando usuario actual")

    const { data, error } = await supabase.auth.getSession()

    if (error) {
      logger.error("Error obteniendo sesión actual", { error: error.message })
      return { error: error.message }
    }

    if (!data.session || !data.session.user) {
      logger.info("No hay sesión activa")
      return { user: null }
    }

    const authUser = data.session.user

    // Obtener datos adicionales del usuario desde la tabla users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authUser.id)
      .single()

    if (userError && userError.code !== "PGRST116") {
      logger.error("Error obteniendo datos de usuario desde tabla users", {
        userId: authUser.id,
        error: userError.message,
      })
    }

    // Mapear los datos del usuario
    const user: User = {
      id: authUser.id,
      name: userData?.name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Usuario",
      email: authUser.email || "sin-email",
      role: userData?.role || authUser.user_metadata?.role || "employee",
      businessId: userData?.business_id || authUser.user_metadata?.businessId,
    }

    logger.info("Usuario actual verificado", {
      userId: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId || "No asignado",
      hasUserData: !!userData,
    })

    return { user }
  } catch (error) {
    logger.error("Error inesperado verificando usuario actual", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { error: "Error verificando la autenticación del usuario" }
  }
}

// Export the appropriate functions based on the configuration
export const registerUser = useMockAuth ? mockRegisterUser : supabaseRegisterUser
export const loginUser = useMockAuth ? mockLoginUser : supabaseLoginUser
export const logoutUser = useMockAuth ? mockLogoutUser : supabaseLogoutUser
export const resetPassword = useMockAuth ? mockResetPassword : supabaseResetPassword
export const updatePassword = useMockAuth ? mockUpdatePassword : supabaseUpdatePassword
export const getCurrentUser = useMockAuth ? mockGetCurrentUser : supabaseGetCurrentUser

// Exportar un objeto AuthService para compatibilidad
export const AuthService = {
  login: async (email: string, password: string) => {
    const response = await loginUser({ email, password })
    if (response.error) {
      throw new Error(response.error)
    }
    return response.user
  },
  logout: async () => {
    return await logoutUser()
  },
  getCurrentUser: async () => {
    const response = await getCurrentUser()
    return response.user
  },
  register: async (userData: any) => {
    return await registerUser(userData)
  },
  resetPassword: async (email: string) => {
    return await resetPassword(email)
  },
  updatePassword: async (newPassword: string) => {
    return await updatePassword(newPassword)
  },
}

