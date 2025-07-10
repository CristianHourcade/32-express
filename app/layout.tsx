import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ReduxProvider } from "@/lib/redux/provider"
import AuthProvider from "@/components/AuthProvider"
import { Montserrat } from "next/font/google";

const inter = Inter({ subsets: ["latin"] })

// Generar información de compilación
const buildTimestamp = new Date().toISOString()
const buildId = `build-${Date.now()}`

export const metadata: Metadata = {
  title: "32 Express - Sistema de Gestión",
  description: "Sistema de gestión para múltiples negocios",
  // Añadir metadatos de compilación
  other: {
    "build-timestamp": buildTimestamp,
    "build-id": buildId,
    environment: process.env.NODE_ENV || "development",
  },
}

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-montserrat",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={montserrat.variable}>
      {/* Build Info: ${buildTimestamp} */}
      <body className={inter.className}>
        <ReduxProvider>
          <AuthProvider>{children}</AuthProvider>
        </ReduxProvider>
      </body>
    </html>
  )
}

