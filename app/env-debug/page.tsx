"use client"

import { useState, useEffect } from "react"

export default function EnvDebugPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/env-diagnostic")
        const result = await res.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="min-h-screen p-8 bg-slate-50 dark:bg-slate-900">
      <h1 className="text-3xl font-bold mb-6 text-sky-600 dark:text-sky-400">Diagnóstico de Variables de Entorno</h1>

      {loading ? (
        <p>Cargando...</p>
      ) : error ? (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 rounded">
          <p className="text-red-700 dark:text-red-400">Error: {error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Información General</h2>
            <p>
              <strong>Timestamp:</strong> {data.timestamp}
            </p>
            <p>
              <strong>Environment:</strong> {data.environment}
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Variables de Cliente</h2>
            <ul className="space-y-2">
              <li>
                NEXT_PUBLIC_SUPABASE_URL:{" "}
                {data.clientEnv.hasSupabaseUrl ? (
                  <span className="text-green-600 dark:text-green-400">✅ Configurado</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">❌ Faltante</span>
                )}
              </li>
              <li>
                NEXT_PUBLIC_SUPABASE_ANON_KEY:{" "}
                {data.clientEnv.hasSupabaseAnonKey ? (
                  <span className="text-green-600 dark:text-green-400">✅ Configurado</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">❌ Faltante</span>
                )}
              </li>
              <li>Using Mock Data: {data.clientEnv.usingMockData ? "Sí" : "No"}</li>
              <li>Using Mock Auth: {data.clientEnv.usingMockAuth ? "Sí" : "No"}</li>
            </ul>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Variables de Servidor</h2>
            {data.serverEnv.unavailableInBrowser ? (
              <p>Las variables de servidor no están disponibles en el navegador.</p>
            ) : (
              <ul className="space-y-2">
                <li>
                  SUPABASE_SERVICE_ROLE_KEY:{" "}
                  {data.serverEnv.hasServiceKey ? (
                    <span className="text-green-600 dark:text-green-400">✅ Configurado</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">❌ Faltante</span>
                  )}
                </li>
                <li>
                  DATABASE_URL:{" "}
                  {data.serverEnv.hasDatabaseUrl ? (
                    <span className="text-green-600 dark:text-green-400">✅ Configurado</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">❌ Faltante</span>
                  )}
                </li>
              </ul>
            )}
          </div>

          {data.issues.length > 0 && (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 rounded">
              <h2 className="text-xl font-semibold mb-3">Problemas Detectados</h2>
              <ul className="list-disc pl-5 space-y-1">
                {data.issues.map((issue: string, index: number) => (
                  <li key={index} className="text-red-700 dark:text-red-400">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Pasos para Solucionar</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Verifica que las variables de entorno estén configuradas en el panel de Vercel</li>
              <li>Asegúrate de que los nombres sean exactos (sensibles a mayúsculas/minúsculas)</li>
              <li>Las variables de cliente deben tener el prefijo NEXT_PUBLIC_</li>
              <li>Fuerza una reconstrucción completa en Vercel (limpia la caché)</li>
              <li>Verifica la consola del navegador para mensajes de error detallados</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

