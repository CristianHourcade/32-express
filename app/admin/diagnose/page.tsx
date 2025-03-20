"use client"

import { useState } from "react"
import { createModuleLogger } from "@/lib/clientLogger"

const logger = createModuleLogger("adminDiagnose")

export default function DiagnosePage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null)
  const [fixLoading, setFixLoading] = useState(false)
  const [fixResult, setFixResult] = useState<any>(null)

  const handleDiagnose = async () => {
    if (!email) return

    setLoading(true)
    setDiagnosisResult(null)
    setFixResult(null)

    try {
      logger.info("Iniciando diagnóstico", { email })

      const response = await fetch(`/api/admin/diagnose-employee?email=${encodeURIComponent(email)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error en el diagnóstico")
      }

      logger.info("Diagnóstico completado", {
        email,
        hasProblems: data.problems.length > 0,
        problemsCount: data.problems.length,
      })

      setDiagnosisResult(data)
    } catch (error) {
      logger.error("Error en diagnóstico", {
        email,
        error: error instanceof Error ? error.message : String(error),
      })
      setDiagnosisResult({ error: error instanceof Error ? error.message : "Error desconocido" })
    } finally {
      setLoading(false)
    }
  }

  const handleFixUserIdLink = async () => {
    if (!diagnosisResult || !email) return

    setFixLoading(true)
    setFixResult(null)

    try {
      logger.info("Iniciando corrección de vinculación", { email })

      const response = await fetch("/api/admin/diagnose-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          action: "fix-user-id",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error en la corrección")
      }

      logger.info("Corrección completada exitosamente", { email })

      setFixResult(data)
      // Actualizar el diagnóstico después de la corrección
      handleDiagnose()
    } catch (error) {
      logger.error("Error en corrección", {
        email,
        error: error instanceof Error ? error.message : String(error),
      })
      setFixResult({ error: error instanceof Error ? error.message : "Error desconocido" })
    } finally {
      setFixLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6">Diagnóstico de Empleados</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Buscar Empleado</h2>

        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email del empleado"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleDiagnose}
            disabled={!email || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "Diagnosticando..." : "Diagnosticar"}
          </button>
        </div>
      </div>

      {diagnosisResult && !diagnosisResult.error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Resultado del Diagnóstico</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
              <h3 className="font-medium mb-2">Usuario de Autenticación</h3>
              {diagnosisResult.authUser ? (
                <div>
                  <p>
                    <strong>ID:</strong> {diagnosisResult.authUser.id}
                  </p>
                  <p>
                    <strong>Email:</strong> {diagnosisResult.authUser.email}
                  </p>
                  <p>
                    <strong>Creado:</strong> {new Date(diagnosisResult.authUser.createdAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-red-600 dark:text-red-400">No encontrado</p>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
              <h3 className="font-medium mb-2">Registro en Tabla Users</h3>
              {diagnosisResult.userRecord ? (
                <div>
                  <p>
                    <strong>ID:</strong> {diagnosisResult.userRecord.id}
                  </p>
                  <p>
                    <strong>Auth ID:</strong> {diagnosisResult.userRecord.auth_id}
                  </p>
                  <p>
                    <strong>Rol:</strong> {diagnosisResult.userRecord.role}
                  </p>
                  <p>
                    <strong>Business ID:</strong> {diagnosisResult.userRecord.business_id || "No asignado"}
                  </p>
                </div>
              ) : (
                <p className="text-red-600 dark:text-red-400">No encontrado</p>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
              <h3 className="font-medium mb-2">Registro en Tabla Employees</h3>
              {diagnosisResult.employeeRecord ? (
                <div>
                  <p>
                    <strong>ID:</strong> {diagnosisResult.employeeRecord.id}
                  </p>
                  <p>
                    <strong>Nombre:</strong> {diagnosisResult.employeeRecord.name}
                  </p>
                  <p>
                    <strong>User ID:</strong> {diagnosisResult.employeeRecord.user_id || "No asignado"}
                  </p>
                  <p>
                    <strong>Business ID:</strong> {diagnosisResult.employeeRecord.business_id || "No asignado"}
                  </p>
                </div>
              ) : (
                <p className="text-red-600 dark:text-red-400">No encontrado</p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-medium mb-2">Problemas Detectados</h3>
            {diagnosisResult.problems.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1">
                {diagnosisResult.problems.map((problem: string, index: number) => (
                  <li key={index} className="text-red-600 dark:text-red-400">
                    {problem}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-green-600 dark:text-green-400">No se detectaron problemas</p>
            )}
          </div>

          {diagnosisResult.problems.includes(
            "El user_id del empleado no coincide con el ID del usuario de autenticación",
          ) || diagnosisResult.problems.includes("El registro de empleado no tiene un user_id asignado") ? (
            <div>
              <button
                onClick={handleFixUserIdLink}
                disabled={fixLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                {fixLoading ? "Corrigiendo..." : "Corregir Vinculación"}
              </button>

              {fixResult && (
                <div className="mt-4">
                  {fixResult.error ? (
                    <p className="text-red-600 dark:text-red-400">{fixResult.error}</p>
                  ) : (
                    <p className="text-green-600 dark:text-green-400">{fixResult.message}</p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {diagnosisResult && diagnosisResult.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md">
          <p className="text-red-600 dark:text-red-400">{diagnosisResult.error}</p>
        </div>
      )}
    </div>
  )
}

