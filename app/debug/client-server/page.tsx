"use client"

import { useEffect, useState } from "react"

export default function ClientServerDebugPage() {
  const [serverData, setServerData] = useState<any>(null)
  const [clientData, setClientData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Recopilar datos del cliente
    setClientData({
      isServer: false,
      supabaseEnv: {
        url: {
          exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          value: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10) + "...",
          length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
        },
        anonKey: {
          exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
        },
        serviceKey: {
          exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
        },
        publicServiceKey: {
          exists: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
          length: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.length || 0,
        },
      },
    })

    // Obtener datos del servidor
    const fetchServerData = async () => {
      try {
        const res = await fetch("/api/debug/client-server")
        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`)
        }
        const data = await res.json()
        setServerData(data)
      } catch (err) {
        setError("Error al obtener datos del servidor: " + err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchServerData()
  }, [])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Diagnóstico Cliente vs Servidor</h1>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <h2 className="text-xl font-semibold mb-2">Cliente (Navegador)</h2>
          {clientData ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">{JSON.stringify(clientData, null, 2)}</pre>
          ) : (
            <p>Cargando datos del cliente...</p>
          )}
        </div>

        <div className="border rounded p-4">
          <h2 className="text-xl font-semibold mb-2">Servidor</h2>
          {loading ? (
            <p>Cargando datos del servidor...</p>
          ) : serverData ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">{JSON.stringify(serverData, null, 2)}</pre>
          ) : (
            <p>No se pudieron obtener datos del servidor</p>
          )}
        </div>
      </div>
    </div>
  )
}

