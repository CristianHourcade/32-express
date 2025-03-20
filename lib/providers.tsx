"use client"

import { store } from "@/lib/redux/store"
import { Provider as ReduxProvider } from "react-redux"
import { ThemeProvider } from "@/components/theme-provider"
import type React from "react"

// Creamos un componente separado para cada proveedor
// Esto ayuda a aislar los problemas y evitar conflictos

export function ReduxProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ReduxProvider store={store}>{children}</ReduxProvider>
}

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  )
}

// Componente principal que combina todos los proveedores
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProviderWrapper>
      <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
    </ReduxProviderWrapper>
  )
}

