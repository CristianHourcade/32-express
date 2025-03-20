"use client"

import { useState, useEffect } from "react"
import { checkEnvironmentVariables } from "@/lib/envCheck"
import { isSupabaseConfigured, isSupabaseServiceConfigured } from "@/lib/config"

export default function DiagnosticTool() {
  const [isVisible, setIsVisible] = useState(false)
  const [diagnosticData, setDiagnosticData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runDiagnostics = async () => {
    setIsLoading(true)
    try {
      // Recopilar información de diagnóstico
      const envVars = checkEnvironmentVariables()

      const data = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        browser: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          online: navigator.onLine,
          cookiesEnabled: navigator.cookieEnabled,
        },
        nextPublicVars: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅" : "❌",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅" : "❌",
          NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ? "✅" : "❌",
          NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
          NEXT_PUBLIC_USE_MOCK_AUTH: process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
          NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        },
        supabaseConfig: {
          isConfigured: isSupabaseConfigured(),
          isServiceConfigured: isSupabaseServiceConfigured(),
        },
        envVars,
      }

      setDiagnosticData(data)

      // Opcionalmente, enviar datos de diagnóstico al servidor
      try {
        await fetch("/api/diagnostics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        })
      } catch (e) {
        console.error("Error enviando diagnóstico:", e)
      }
    } catch (error) {
      console.error("Error ejecutando diagnóstico:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Activar diagnóstico automáticamente en producción con problemas
  useEffect(() => {
    const hasError =
      window.location.search.includes("diagnostic=true") || localStorage.getItem("app_error_occurred") === "true"

    if (hasError) {
      setIsVisible(true)
      runDiagnostics()
    }

    // Escuchar errores no capturados
    const handleError = () => {
      localStorage.setItem("app_error_occurred", "true")
    }

    window.addEventListener("error", handleError)
    return () => window.removeEventListener("error", handleError)
  }, [])

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg z-50"
        title="Abrir herramienta de diagnóstico"
      >
        🔧
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Herramienta de Diagnóstico</h2>
          <button onClick={() => setIsVisible(false)} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="p-4">
          <button
            onClick={runDiagnostics}
            disabled={isLoading}
            className="mb-4 bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {isLoading ? "Ejecutando..." : "Ejecutar Diagnóstico"}
          </button>

          {diagnosticData && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Resultados del Diagnóstico</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(diagnosticData, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Instrucciones</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Ejecuta el diagnóstico para recopilar información sobre el entorno.</li>
              <li>Verifica que todas las variables de entorno necesarias estén configuradas.</li>
              <li>Comprueba la conexión con Supabase.</li>
              <li>Si el problema persiste, comparte los resultados del diagnóstico con el equipo de desarrollo.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

