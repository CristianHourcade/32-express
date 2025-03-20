import { createModuleLogger } from "@/lib/serverLogger"

// Mock data - in a real application, this would come from a database
const mockUsers: User[] = []

// Define user roles
export type UserRole = "admin" | "employee"

// Define the User type
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  businessId?: string
}

// Crear un logger específico para este módulo
const logger = createModuleLogger("mockAuth")

// Current user and auth token (for mock purposes)
let currentUser: User | null = null
let authToken: string | null = null

// Update the registerUser function to include better validation and error handling
export async function registerUser(userData: {
  email: string
  password: string
  name: string
  role?: "admin" | "employee"
  businessId?: string
}): Promise<{ user: User | null; error: string | null }> {
  try {
    logger.info("Registrando usuario", {
      email: userData.email,
      name: userData.name,
      role: userData.role || "employee",
    })

    // Validate required fields
    if (!userData.email || !userData.password || !userData.name) {
      logger.warn("Registration failed - missing required fields")
      return { user: null, error: "Todos los campos son obligatorios" }
    }

    // Verify if the user already exists
    const existingUser = mockUsers.find((user) => user.email === userData.email)
    if (existingUser) {
      logger.warn("Registration failed - email already registered")
      return { user: null, error: "El correo electrónico ya está registrado" }
    }

    // Create new user with a proper ID
    const newUser: User = {
      id: `user_${Date.now()}`,
      name: userData.name,
      email: userData.email,
      role: userData.role || "employee",
      businessId: userData.businessId,
    }

    // Add to the mock users list
    mockUsers.push(newUser)

    // Log successful registration
    logger.info("User registered successfully:", {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    })

    return { user: newUser, error: null }
  } catch (error) {
    logger.error("Error during registration:", error)
    if (error instanceof Error) {
      return { user: null, error: error.message }
    }
    return { user: null, error: "Error desconocido durante el registro" }
  }
}

// Add these console logs to the loginUser function
export async function loginUser(credentials: {
  email: string
  password: string
}): Promise<{ user: User | null; token: string | null; error: string | null }> {
  logger.info("Logging in user", credentials.email)

  try {
    // Find user by email
    const user = mockUsers.find((user) => user.email === credentials.email)

    if (!user) {
      logger.warn("User not found")
      return { user: null, token: null, error: "Credenciales inválidas" }
    }

    // In a real app, we would verify the password here
    // For mock purposes, we'll accept any password

    // Generate mock token
    const token = `mock_token_${Date.now()}`

    // Set current session
    currentUser = user
    authToken = token

    logger.info("Login successful", {
      name: user.name,
      role: user.role,
      businessId: user.businessId,
    })

    return { user, token, error: null }
  } catch (error) {
    logger.error("Login error", error)
    return {
      user: null,
      token: null,
      error: error instanceof Error ? error.message : "Error desconocido durante el inicio de sesión",
    }
  }
}

// Add the missing logoutUser function
export async function logoutUser(): Promise<{ error: string | null }> {
  logger.info("Logging out user", currentUser?.email || "none")

  try {
    // Clear current session
    const previousUser = currentUser
    currentUser = null
    authToken = null

    logger.info("Logout successful", {
      previousUser: previousUser
        ? {
            name: previousUser.name,
            role: previousUser.role,
          }
        : "none",
    })

    return { error: null }
  } catch (error) {
    logger.error("Logout error", error)
    return {
      error: error instanceof Error ? error.message : "Error desconocido durante el cierre de sesión",
    }
  }
}

// Add these console logs to the getCurrentUser function
export async function getCurrentUser(): Promise<{ user: User | null; error: string | null }> {
  logger.info("Getting current user", currentUser?.email || "none")

  try {
    if (currentUser) {
      logger.info("Current user found", {
        name: currentUser.name,
        role: currentUser.role,
        businessId: currentUser.businessId,
      })
    } else {
      logger.info("No current user")
    }

    return { user: currentUser, error: null }
  } catch (error) {
    logger.error("Get current user error", error)
    return {
      user: null,
      error: error instanceof Error ? error.message : "Error desconocido al obtener el usuario actual",
    }
  }
}

// Add the missing resetPassword function
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  logger.info("Resetting password for", email)

  try {
    // Check if user exists
    const user = mockUsers.find((user) => user.email === email)

    if (!user) {
      logger.warn("User not found for password reset")
      return { error: "No se encontró ninguna cuenta con ese correo electrónico" }
    }

    // In a real app, we would send an email here
    logger.info("Password reset email would be sent to", email)

    return { error: null }
  } catch (error) {
    logger.error("Password reset error", error)
    return {
      error: error instanceof Error ? error.message : "Error desconocido al solicitar restablecimiento de contraseña",
    }
  }
}

// Add the missing updatePassword function
export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  logger.info("Updating password")

  try {
    // Check if user is authenticated
    if (!currentUser) {
      logger.warn("No authenticated user for password update")
      return { error: "No hay un usuario autenticado" }
    }

    // In a real app, we would update the password in the database
    logger.info("Password updated successfully for", currentUser.email)

    return { error: null }
  } catch (error) {
    logger.error("Password update error", error)
    return {
      error: error instanceof Error ? error.message : "Error desconocido al actualizar la contraseña",
    }
  }
}

