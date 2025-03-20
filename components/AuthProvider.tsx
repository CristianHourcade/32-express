"use client"

import type React from "react"

import { useEffect } from "react"
import { useDispatch } from "react-redux"
import type { AppDispatch } from "@/lib/redux/store"
import { checkAuth } from "@/lib/redux/slices/authSlice"

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    // Verificar el estado de autenticación al cargar la aplicación
    dispatch(checkAuth())
  }, [dispatch])

  return <>{children}</>
}

