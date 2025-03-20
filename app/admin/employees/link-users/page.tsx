"use client"

import { useState, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getEmployees } from "@/lib/redux/slices/employeeSlice"
import { employeeService } from "@/services/supabase/employeeService"
import { AlertTriangle, CheckCircle, UserPlus } from "lucide-react"

export default function LinkUsersPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { employees, loading } = useSelector((state: RootState) => state.employees)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    dispatch(getEmployees())
  }, [dispatch])

  const handleLinkUser = async (employeeId: string, email: string) => {
    setIsProcessing(true)
    setMessage(null)

    try {
      // Buscar el usuario por email en Supabase Auth
      const { data: userData, error: userError } = await fetch("/api/admin/find-user-by-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      }).then((res) => res.json())

      if (userError) {
        setMessage({ type: "error", text: `Error al buscar usuario: ${userError.message}` })
        return
      }

      if (!userData || !userData.id) {
        setMessage({ type: "error", text: `No se encontró un usuario con el email ${email}` })
        return
      }

      // Vincular el usuario con el empleado
      await employeeService.linkUserToEmployee(employeeId, userData.id)

      setMessage({
        type: "success",
        text: `Usuario ${email} vinculado correctamente con el empleado`,
      })

      // Recargar la lista de empleados
      dispatch(getEmployees())
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Error al vincular usuario",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando empleados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vincular Usuarios con Empleados</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Esta herramienta te permite vincular usuarios existentes con registros de empleados.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500"
              : "bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500"
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {message.type === "success" ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
            </div>
            <div className="ml-3">
              <h3
                className={`text-sm font-medium ${
                  message.type === "success" ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
                }`}
              >
                {message.type === "success" ? "Éxito" : "Error"}
              </h3>
              <div
                className={`mt-1 text-sm ${
                  message.type === "success" ? "text-green-700 dark:text-green-200" : "text-red-700 dark:text-red-200"
                }`}
              >
                <p>{message.text}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Nombre
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Email
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Negocio
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Estado
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {employee.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {employee.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {employee.businessName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {employee.userId ? (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      Vinculado
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                      Sin vincular
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {!employee.userId && (
                    <button
                      onClick={() => handleLinkUser(employee.id, employee.email)}
                      disabled={isProcessing}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Vincular Usuario
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

