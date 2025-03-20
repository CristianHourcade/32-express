"use client"

import { useDispatch, useSelector } from "react-redux"
import { useRouter } from "next/navigation"
import type { RootState, AppDispatch } from "@/lib/redux/store"
import { loginUser, logoutUser, checkAuth as checkAuthAction } from "@/lib/redux/slices/authSlice"
import { AuthService } from "@/services/auth/authService"
import { useState } from "react"

export const useAuthRedux = () => {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { isAuthenticated, user, error } = useSelector((state: RootState) => state.auth)

  const checkAuth = async () => {
    try {
      setLoading(true)
      await dispatch(checkAuthAction())
    } catch (error) {
      console.error("Error checking authentication:", error)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      setLoading(true)
      const user = await AuthService.login(email, password)
      dispatch(loginUser({ user }))

      // Redirigir según el rol del usuario
      if (user.role === "admin") {
        router.push("/admin/dashboard")
      } else {
        router.push("/employee/dashboard")
      }
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

  return {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    checkAuth,
    error,
  }
}

