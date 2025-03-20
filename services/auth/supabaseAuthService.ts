import { supabase } from "@/lib/supabase"
import type { User } from "@/lib/redux/slices/authSlice"
import { createModuleLogger } from "@/lib/serverLogger"

// Crear un logger específico para este módulo
const logger = createModuleLogger("supabaseAuth")

export async function registerUser(userData: {
  email: string
  password: string
  name: string
  role?: "admin" | "employee"
  businessId?: string
}): Promise<{ user: User | null; error: string | null }> {
  try {
    // Registrar usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          name: userData.name,
          role: userData.role || "employee",
          businessId: userData.businessId || null,
        },
      },
    })

    if (authError) throw new Error(authError.message)

    // Si el registro fue exitoso, crear el usuario en nuestra tabla personalizada
    if (authData.user) {
      const { error: dbError } = await supabase.from("users").insert({
        auth_id: authData.user.id,
        name: userData.name,
        email: userData.email,
        role: userData.role || "employee",
        business_id: userData.businessId || null,
      })

      if (dbError) {
        logger.error("Error al insertar usuario en la base de datos", { error: dbError })
        throw new Error(dbError.message)
      }

      // Si el registro fue exitoso pero necesita verificación de correo
      if (!authData.user.confirmed_at) {
        return {
          user: null,
          error: "Por favor, verifica tu correo electrónico para completar el registro.",
        }
      }

      // Si el registro fue exitoso y no necesita verificación
      const user: User = {
        id: authData.user.id,
        name: userData.name,
        email: authData.user.email || userData.email,
        role: userData.role || "employee",
        businessId: userData.businessId,
      }
      return { user, error: null }
    }

    return { user: null, error: "Error desconocido durante el registro" }
  } catch (error) {
    if (error instanceof Error) {
      return { user: null, error: error.message }
    }
    return { user: null, error: "Error desconocido durante el registro" }
  }
}

// Update the loginUser function to add more logging
export async function loginUser(credentials: {
  email: string
  password: string
}): Promise<{ user: User | null; token: string | null; error: string | null }> {
  try {
    logger.info("Intento de inicio de sesión", { email: credentials.email })

    // Iniciar sesión con Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    })

    if (error) {
      logger.error("Login error from Supabase", error)
      throw new Error(error.message)
    }

    logger.info("Supabase auth successful", {
      userId: data.user?.id.substring(0, 8) + "...",
      hasSession: !!data.session,
    })

    if (data.user && data.session) {
      // Obtener datos de usuario de nuestra tabla personalizada
      logger.info("Fetching user data from users table")
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", data.user.id)
        .single()

      if (userError) {
        logger.error("Error fetching user data", userError)
        if (userError.code !== "PGRST116") {
          throw new Error(userError.message)
        }
        logger.info("User not found in users table, will create")
      } else {
        logger.info("User found in users table", {
          name: userData.name,
          role: userData.role,
        })
      }

      // Si el usuario no existe en nuestra tabla, crearlo
      if (userError && userError.code === "PGRST116") {
        const userMetadata = data.user.user_metadata
        logger.info("Creating new user in users table", {
          metadata: userMetadata,
        })

        // Extraer businessId de los metadatos, asegurando que accedemos correctamente
        const businessId = userMetadata.businessId || userMetadata.business_id || null

        logger.info("Business ID from metadata", {
          businessId,
          rawMetadata: JSON.stringify(userMetadata),
        })

        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert({
            auth_id: data.user.id,
            name: userMetadata.name || data.user.email?.split("@")[0] || "Usuario",
            email: data.user.email || credentials.email,
            role: userMetadata.role || "employee",
            business_id: businessId,
          })
          .select()
          .single()

        if (insertError) {
          logger.error("Error creating user in users table", insertError)
          throw new Error(insertError.message)
        }

        logger.info("New user created successfully", {
          name: newUser.name,
          role: newUser.role,
          businessId: newUser.business_id,
        })

        if (newUser) {
          const user: User = {
            id: data.user.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            businessId: newUser.business_id,
          }

          logger.info("Login successful with new user")
          return {
            user,
            token: data.session.access_token,
            error: null,
          }
        }
      }

      // Si el usuario existe en nuestra tabla
      if (userData) {
        const user: User = {
          id: data.user.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          businessId: userData.business_id,
        }

        logger.info("Login successful with existing user", {
          name: user.name,
          role: user.role,
          businessId: user.businessId,
        })

        return {
          user,
          token: data.session.access_token,
          error: null,
        }
      }
    }

    logger.warn("Login failed - no user or session")
    return {
      user: null,
      token: null,
      error: "No se pudo iniciar sesión",
    }
  } catch (error) {
    logger.error("Login exception", error)
    if (error instanceof Error) {
      return {
        user: null,
        token: null,
        error: error.message,
      }
    }
    return {
      user: null,
      token: null,
      error: "Error desconocido durante el inicio de sesión",
    }
  }
}

export async function logoutUser(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
    return { error: null }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Error desconocido durante el cierre de sesión" }
  }
}

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) throw new Error(error.message)

    return { error: null }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Error desconocido al solicitar restablecimiento de contraseña" }
  }
}

export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw new Error(error.message)

    return { error: null }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Error desconocido al actualizar la contraseña" }
  }
}

// Update the getCurrentUser function to add more logging
export async function getCurrentUser(): Promise<{
  user: User | null
  error: string | null
}> {
  try {
    logger.info("Getting current user")
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError) {
      logger.error("Error getting auth user", authError)
      throw new Error(authError.message)
    }

    if (!authData.user) {
      logger.info("No authenticated user found")
      return { user: null, error: null }
    }

    logger.info("Auth user found", {
      id: authData.user.id.substring(0, 8) + "...",
      email: authData.user.email,
    })

    // Obtener datos de usuario de nuestra tabla personalizada
    logger.info("Fetching user data from users table")
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authData.user.id)
      .single()

    if (userError) {
      logger.error("Error fetching user data", userError)
      if (userError.code !== "PGRST116") {
        throw new Error(userError.message)
      }
      logger.info("User not found in users table, will create")
    } else {
      logger.info("User found in users table", {
        name: userData.name,
        role: userData.role,
      })
    }

    // Si el usuario no existe en nuestra tabla, crearlo
    if (userError && userError.code === "PGRST116") {
      const userMetadata = authData.user.user_metadata
      logger.info("Creating new user in users table", {
        metadata: userMetadata,
      })

      // Extraer businessId de los metadatos, asegurando que accedemos correctamente
      const businessId = userMetadata.businessId || userMetadata.business_id || null

      logger.info("Business ID from metadata", {
        businessId,
        rawMetadata: JSON.stringify(userMetadata),
      })

      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          auth_id: authData.user.id,
          name: userMetadata.name || authData.user.email?.split("@")[0] || "Usuario",
          email: authData.user.email || "",
          role: userMetadata.role || "employee",
          business_id: businessId,
        })
        .select()
        .single()

      if (insertError) {
        logger.error("Error creating user in users table", insertError)
        throw new Error(insertError.message)
      }

      logger.info("New user created successfully", {
        name: newUser.name,
        role: newUser.role,
        businessId: newUser.business_id,
      })

      if (newUser) {
        const user: User = {
          id: authData.user.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          businessId: newUser.business_id,
        }

        return { user, error: null }
      }
    }

    // Si el usuario existe en nuestra tabla
    if (userData) {
      // Actualizar el auth_id si es necesario
      if (!userData.auth_id || userData.auth_id !== authData.user.id) {
        logger.info("Updating auth_id in users table")
        await supabase.from("users").update({ auth_id: authData.user.id }).eq("id", userData.id)
      }

      const user: User = {
        id: authData.user.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        businessId: userData.business_id,
      }

      logger.info("Current user retrieved successfully", {
        name: user.name,
        role: user.role,
        businessId: user.businessId,
      })

      return { user, error: null }
    }

    logger.warn("No user data found")
    return { user: null, error: null }
  } catch (error) {
    logger.error("GetCurrentUser exception", error)
    if (error instanceof Error) {
      return { user: null, error: error.message }
    }
    return { user: null, error: "Error desconocido al obtener el usuario actual" }
  }
}

