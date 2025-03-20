"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle, XCircle, ArrowLeft } from "lucide-react"

export default function DiagnoseEmployeePage() {
  const [employeeId, setEmployeeId] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDiagnose = async () => {
    if (!employeeId) {
      setError("Por favor ingrese un ID de empleado")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/diagnose-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ employeeId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al diagnosticar empleado")
      }

      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="mr-4" onClick={() => router.push("/admin/employees")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Empleados
        </Button>
        <h1 className="text-2xl font-bold">Diagnóstico de Empleados</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Herramienta de Diagnóstico</CardTitle>
          <CardDescription>
            Ingrese el ID del empleado para diagnosticar problemas con la cuenta de usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="ID del empleado"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleDiagnose} disabled={loading}>
              {loading ? "Diagnosticando..." : "Diagnosticar"}
            </Button>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-300 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {results && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Diagnóstico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center">
                    {results.diagnosis.hasUserId ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div className="ml-2">
                    <p className="font-medium">User ID asignado</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {results.diagnosis.hasUserId
                        ? `ID: ${results.employee.user_id}`
                        : "El empleado no tiene un user_id asignado"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center">
                    {results.diagnosis.userExists ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div className="ml-2">
                    <p className="font-medium">Usuario en tabla users</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {results.diagnosis.userExists
                        ? `Nombre: ${results.userData.name}, Email: ${results.userData.email}`
                        : "No existe un registro en la tabla users"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center">
                    {results.diagnosis.authUserExists ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div className="ml-2">
                    <p className="font-medium">Usuario en auth.users</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {results.diagnosis.authUserExists
                        ? `Email: ${results.authUserData.email}`
                        : "No existe un usuario en el sistema de autenticación"}
                    </p>
                  </div>
                </div>

                {results.diagnosis.issues.length > 0 && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md dark:bg-amber-900/20 dark:border-amber-800">
                    <h3 className="font-medium text-amber-800 dark:text-amber-300 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Problemas detectados
                    </h3>
                    <ul className="mt-2 space-y-1 list-disc list-inside text-sm text-amber-700 dark:text-amber-300">
                      {results.diagnosis.issues.map((issue: string, index: number) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

