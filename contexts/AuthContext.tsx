"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useDispatch, useSelector } from "react-redux"
import type { RootState } from "@/lib/redux/store"
import { loginUser, logoutUser } from "@/lib/redux/slices/authSlice"
import { AuthService } from "@/services/auth/authService"

interface AuthContextType {
  isAuthenticated: boolean
  user: any | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Renombramos este componente para evitar conflictos
export const LegacyAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true)
  const dispatch = useDispatch()
  const router = useRouter()
  const { isAuthenticated, user, error } = useSelector((state: RootState) => state.auth)

  const checkAuth = async () => {
    try {
      setLoading(true)
      const currentUser = await AuthService.getCurrentUser()
      if (currentUser) {
        dispatch(loginUser({ user: currentUser }))
      } else {
        dispatch(logoutUser())
      }
    } catch (error) {
      console.error("Error checking authentication:", error)
      dispatch(logoutUser())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setLoading(true)
      const user = await AuthService.login(email, password)
      dispatch(loginUser({ user }))
      router.push("/admin/dashboard")
    } catch (error) {
      console.error("Login error:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      setLoading(true)
      await AuthService.logout()
      dispatch(logoutUser())
      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Mantenemos el hook para compatibilidad con el código existente
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

