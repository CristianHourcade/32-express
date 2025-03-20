"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react"

export default function DiagnosticsPage() {
  const [clientEnv, setClientEnv] = useState<Record<string, any>>({})
  const [serverData, setServerData] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDiagnostics = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/diagnostics")
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`)
      }
      const data = await res.json()
      setServerData(data)
    } catch (err) {
      setError("Error al obtener diagnóstico del servidor: " + err.message)
    } finally {
      setLoading(false)
    }
  }

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
      NEXT_PUBLIC_USE_MOCK_AUTH: {
        exists: !!process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
        value: process.env.NEXT_PUBLIC_USE_MOCK_AUTH,
      },
      NEXT_PUBLIC_USE_MOCK_DATA: {
        exists: !!process.env.NEXT_PUBLIC_USE_MOCK_DATA,
        value: process.env.NEXT_PUBLIC_USE_MOCK_DATA,
      },
      // Las variables del servidor no deberían estar disponibles en el cliente
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      },
    })

    fetchDiagnostics()
  }, [])

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Diagnóstico del Sistema</h1>
        <Button onClick={fetchDiagnostics} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
            ) : !serverData ? (
              <div className="text-center py-4 text-red-500">No se pudo obtener información del servidor</div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="font-semibold mb-2">Información del entorno:</div>
                  <div className="text-sm">
                    <div>Entorno: {serverData.environment?.nodeEnv}</div>
                    <div>Es Vercel: {serverData.environment?.isVercel ? "Sí" : "No"}</div>
                    <div>Entorno Vercel: {serverData.environment?.vercelEnv}</div>
                  </div>
                </div>

                <div className="font-semibold mb-2">Variables públicas:</div>
                {serverData.environment?.publicVars &&
                  Object.entries(serverData.environment.publicVars).map(([key, info]: [string, any]) => (
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

                <div className="font-semibold mb-2">Variables privadas:</div>
                {serverData.environment?.privateVars &&
                  Object.entries(serverData.environment.privateVars).map(([key, info]: [string, any]) => (
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prueba de Conexión a Supabase Admin</CardTitle>
          <CardDescription>Verifica si el cliente admin de Supabase está funcionando correctamente</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Cargando...</div>
          ) : !serverData?.supabaseAdminTest ? (
            <div className="text-center py-4 text-red-500">No se pudo realizar la prueba</div>
          ) : (
            <div>
              <div className="flex items-center mb-4">
                <span className="font-semibold mr-2">Estado:</span>
                {serverData.supabaseAdminTest.success ? (
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" /> Conexión exitosa
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-300">
                    <XCircle className="h-3 w-3 mr-1" /> Error de conexión
                  </Badge>
                )}
              </div>

              {serverData.supabaseAdminTest.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error de conexión</AlertTitle>
                  <AlertDescription>{serverData.supabaseAdminTest.error}</AlertDescription>
                </Alert>
              )}

              <div className="text-sm">
                <div>Entorno: {serverData.supabaseAdminTest.environment}</div>
                {serverData.supabaseAdminTest.hasUrl !== undefined && (
                  <div>URL disponible: {serverData.supabaseAdminTest.hasUrl ? "Sí" : "No"}</div>
                )}
                {serverData.supabaseAdminTest.hasServiceKey !== undefined && (
                  <div>Clave de servicio disponible: {serverData.supabaseAdminTest.hasServiceKey ? "Sí" : "No"}</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

