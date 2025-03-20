"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSelector, useDispatch } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { checkAuth } from "@/lib/redux/slices/authSlice"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: "admin" | "employee"
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { isAuthenticated, user, loading } = useSelector((state: RootState) => state.auth)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuthentication = async () => {
      await dispatch(checkAuth())
      setIsChecking(false)
    }

    checkAuthentication()
  }, [dispatch])

  useEffect(() => {
    if (!isChecking && !loading) {
      if (!isAuthenticated) {
        router.push("/login")
      } else if (requiredRole && user?.role !== requiredRole) {
        // Redirigir según el rol del usuario
        if (user?.role === "admin") {
          router.push("/admin/dashboard")
        } else {
          router.push("/employee/dashboard")
        }
      }
    }
  }, [isAuthenticated, user, requiredRole, router, isChecking, loading])

  if (isChecking || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (requiredRole && user?.role !== requiredRole) {
    return null
  }

  return <>{children}</>
}

