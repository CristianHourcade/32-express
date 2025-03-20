"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getEmployees, editEmployee, removeEmployee, type Employee } from "@/lib/redux/slices/employeeSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice" // Changed from getBusinesses
import { Plus, Edit, Trash2, X, Eye, EyeOff, Info, AlertTriangle } from "lucide-react"
import { addEmployee as createEmployee } from "@/services/admin/employeeService"

export default function EmployeesPage() {
  const dispatch = useDispatch<AppDispatch>()
  const {
    employees,
    loading: employeesLoading,
    error: employeesError,
  } = useSelector((state: RootState) => state.employees)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    businessId: "",
    password: "", // Campo para la contraseña
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(getEmployees())
    dispatch(fetchBusinesses()) // Changed from getBusinesses
  }, [dispatch])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const openAddModal = () => {
    setCurrentEmployee(null)
    setFormData({
      name: "",
      email: "",
      businessId: businesses.length > 0 ? businesses[0].id : "",
      password: "",
    })
    setShowPassword(false)
    setSubmitError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (employee: Employee) => {
    setCurrentEmployee(employee)
    setFormData({
      name: employee.name,
      email: employee.email,
      businessId: employee.businessId,
      password: "", // No mostrar contraseña al editar
    })
    setShowPassword(false)
    setSubmitError(null)
    setIsModalOpen(true)
  }

  const openDeleteModal = (employee: Employee) => {
    setCurrentEmployee(employee)
    setIsDeleteModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (currentEmployee) {
        // Editar empleado existente
        await dispatch(
          editEmployee({
            ...currentEmployee,
            name: formData.name,
            email: formData.email,
            businessId: formData.businessId,
          }),
        ).unwrap()
      } else {
        // Crear nuevo empleado con autenticación
        if (!formData.password || formData.password.length < 6) {
          setSubmitError("La contraseña debe tener al menos 6 caracteres")
          setIsSubmitting(false)
          return
        }

        const resultAction = await dispatch(
          createEmployee({
            name: formData.name,
            email: formData.email,
            businessId: formData.businessId,
            password: formData.password, // Incluir la contraseña al crear
          }),
        )

        if (createEmployee.rejected.match(resultAction)) {
          throw new Error(resultAction.payload as string)
        }
      }

      setIsModalOpen(false)
      // Recargar la lista de empleados
      dispatch(getEmployees())
    } catch (error) {
      console.error("Error al guardar empleado:", error)
      setSubmitError(error instanceof Error ? error.message : "Error al guardar el empleado")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (currentEmployee) {
      setIsSubmitting(true)
      try {
        await dispatch(removeEmployee(currentEmployee.id)).unwrap()
        setIsDeleteModalOpen(false)
        // Recargar la lista de empleados
        dispatch(getEmployees())
      } catch (error) {
        console.error("Error al eliminar empleado:", error)
        setSubmitError(error instanceof Error ? error.message : "Error al eliminar el empleado")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const isLoading = employeesLoading || businessesLoading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando empleados...</p>
        </div>
      </div>
    )
  }

  // Verificar si el error está relacionado con la clave foránea
  const isForeignKeyError = employeesError && employeesError.includes("foreign key constraint")

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Empleados</h1>
        <button onClick={openAddModal} className="btn btn-primary flex items-center">
          <Plus className="w-5 h-5 mr-1" />
          Agregar Empleado
        </button>
      </div>

      {employeesError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Error al gestionar empleados</p>
              <p className="mt-1">{employeesError}</p>

              {isForeignKeyError && (
                <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/40 rounded">
                  <p className="font-medium">Problema de configuración detectado</p>
                  <p className="mt-1">
                    La tabla 'employees' requiere un user_id válido que debe existir en la tabla de usuarios de
                    autenticación.
                  </p>
                  <p className="mt-1">Soluciones posibles:</p>
                  <ul className="list-disc list-inside mt-1 ml-2">
                    <li>Modificar la estructura de la base de datos para permitir valores NULL en el campo user_id</li>
                    <li>Crear una función RPC en la base de datos para manejar la creación de empleados y usuarios</li>
                    <li>Contactar al administrador del sistema para resolver este problema</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Nombre</th>
                <th className="table-header-cell">Correo Electrónico</th>
                <th className="table-header-cell">Negocio</th>
                <th className="table-header-cell">Turno Actual</th>
                <th className="table-header-cell">Acciones</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {employees.map((employee) => {
                const business = businesses.find((b) => b.id === employee.businessId)
                return (
                  <tr key={employee.id} className="table-row">
                    <td className="table-cell font-medium">{employee.name}</td>
                    <td className="table-cell">{employee.email}</td>
                    <td className="table-cell">{business?.name || "Desconocido"}</td>
                    <td className="table-cell">
                      {employee.currentShift ? (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                          Activo
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-gray-700 dark:text-gray-300">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(employee)}
                          className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(employee)}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-cell text-center py-8">
                    No se encontraron empleados. ¡Agrega tu primer empleado!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Agregar/Editar Empleado */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                {currentEmployee ? "Editar Empleado" : "Agregar Nuevo Empleado"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                  {submitError}
                </div>
              )}

              <div>
                <label htmlFor="name" className="label">
                  Nombre
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="input"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="email" className="label">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="input"
                  disabled={isSubmitting || !!currentEmployee}
                />
                {currentEmployee && (
                  <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                    El correo electrónico no se puede modificar una vez creado.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="businessId" className="label">
                  Negocio
                </label>
                <select
                  id="businessId"
                  name="businessId"
                  value={formData.businessId}
                  onChange={handleInputChange}
                  required
                  className="input"
                  disabled={isSubmitting}
                >
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>
              {!currentEmployee && (
                <>
                  <div>
                    <label htmlFor="password" className="label">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className="input pr-10"
                        minLength={6}
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        disabled={isSubmitting}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      La contraseña debe tener al menos 6 caracteres.
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-900/20 dark:border-blue-800 flex items-start">
                    <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p>Se creará una cuenta de usuario para el empleado con el correo y contraseña proporcionados.</p>
                      <p className="mt-1">El empleado podrá iniciar sesión con estas credenciales.</p>
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {currentEmployee ? "Actualizando..." : "Creando..."}
                    </>
                  ) : currentEmployee ? (
                    "Actualizar Empleado"
                  ) : (
                    "Agregar Empleado"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Confirmar Eliminación</h2>
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 mb-4 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                  {submitError}
                </div>
              )}
              <p className="mb-6">
                ¿Estás seguro de que deseas eliminar al empleado "{currentEmployee?.name}"? Esta acción no se puede
                deshacer.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button onClick={handleDelete} className="btn btn-danger" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Eliminando...
                    </>
                  ) : (
                    "Eliminar"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

