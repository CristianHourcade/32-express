"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, XCircle } from "lucide-react"

export default function EnvDebugPage() {
  const [clientEnv, setClientEnv] = useState<Record<string, any>>({})
  const [serverEnv, setServerEnv] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Recopilar variables de entorno del cliente
    setClientEnv({
      NEXT_PUBLIC_SUPABASE_URL: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10) + "...",
        length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      },
      // Las variables del servidor no deberían estar disponibles en el cliente
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      },
    })

    // Obtener variables de entorno del servidor
    fetch("/api/debug/env")
      .then((res) => res.json())
      .then((data) => {
        setServerEnv(data)
        setLoading(false)
      })
      .catch((err) => {
        setError("Error al obtener variables de entorno del servidor: " + err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Diagnóstico de Variables de Entorno</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Variables de Entorno (Cliente)</CardTitle>
            <CardDescription>Variables disponibles en el navegador</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.entries(clientEnv).map(([key, info]: [string, any]) => (
              <div key={key} className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm">{key}</span>
                  {info.exists ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" /> Disponible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      <XCircle className="h-3 w-3 mr-1" /> No disponible
                    </Badge>
                  )}
                </div>
                {info.exists && (
                  <div className="text-xs text-gray-500">
                    Longitud: {info.length} caracteres
                    {info.value && <div>Valor: {info.value}</div>}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variables de Entorno (Servidor)</CardTitle>
            <CardDescription>Variables disponibles en el servidor</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Cargando...</div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="font-semibold mb-2">Información del entorno:</div>
                  <div className="text-sm">
                    <div>Entorno: {serverEnv.nodeEnv}</div>
                    <div>Es servidor: {serverEnv.isServer ? "Sí" : "No"}</div>
                  </div>
                </div>

                <div className="font-semibold mb-2">Variables de Supabase:</div>
                {serverEnv.supabaseUrl && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm">NEXT_PUBLIC_SUPABASE_URL</span>
                      {serverEnv.supabaseUrl.exists ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" /> Disponible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <XCircle className="h-3 w-3 mr-1" /> No disponible
                        </Badge>
                      )}
                    </div>
                    {serverEnv.supabaseUrl.exists && (
                      <div className="text-xs text-gray-500">
                        Longitud: {serverEnv.supabaseUrl.length} caracteres
                        {serverEnv.supabaseUrl.value && <div>Valor: {serverEnv.supabaseUrl.value}</div>}
                      </div>
                    )}
                  </div>
                )}

                {serverEnv.supabaseServiceKey && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm">SUPABASE_SERVICE_ROLE_KEY</span>
                      {serverEnv.supabaseServiceKey.exists ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" /> Disponible
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <XCircle className="h-3 w-3 mr-1" /> No disponible
                        </Badge>
                      )}
                    </div>
                    {serverEnv.supabaseServiceKey.exists && (
                      <div className="text-xs text-gray-500">
                        Longitud: {serverEnv.supabaseServiceKey.length} caracteres
                      </div>
                    )}
                  </div>
                )}

                {serverEnv.allEnvKeys && (
                  <div className="mt-4">
                    <div className="font-semibold mb-2">Todas las variables relevantes:</div>
                    <div className="text-xs font-mono bg-gray-100 p-2 rounded max-h-40 overflow-y-auto">
                      {serverEnv.allEnvKeys.map((key: string) => (
                        <div key={key}>{key}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Button onClick={() => window.location.reload()}>Actualizar diagnóstico</Button>
      </div>
    </div>
  )
}

