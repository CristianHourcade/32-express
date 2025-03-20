"use client"

import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getActivity } from "@/lib/redux/slices/activitySlice" // Ahora usa el alias que apunta al servicio correcto
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice"
import { getEmployees } from "@/lib/redux/slices/employeeSlice"
import { Search, Calendar, Filter, User } from "lucide-react"
import { useMockData } from "@/lib/config" // Importar la configuración

export default function ActivityPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { activities, loading: activitiesLoading } = useSelector((state: RootState) => state.activity)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)

  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all")
  const [selectedUserRole, setSelectedUserRole] = useState<string>("all")
  const [selectedAction, setSelectedAction] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    // Log para depuración
    console.log("ActivityPage: Loading data, using mock data:", useMockData)

    dispatch(getActivity()) // Ahora esto debería funcionar con el alias
    dispatch(fetchBusinesses())
    dispatch(getEmployees())
  }, [dispatch])

  // Obtener acciones únicas de las actividades
  const actions = Array.from(new Set(activities.map((activity) => activity.action)))

  // Filtrar actividades según los filtros seleccionados
  const filteredActivities = activities.filter((activity) => {
    const matchesBusiness = selectedBusinessId === "all" || activity.businessId === selectedBusinessId
    const matchesUserRole = selectedUserRole === "all" || activity.userRole === selectedUserRole
    const matchesAction = selectedAction === "all" || activity.action === selectedAction
    const activityDate = new Date(activity.timestamp)
    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)
    endDate.setHours(23, 59, 59, 999) // Establecer al final del día
    const matchesDate = activityDate >= startDate && activityDate <= endDate

    const matchesSearch =
      searchQuery === "" ||
      activity.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.details.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesBusiness && matchesUserRole && matchesAction && matchesDate && matchesSearch
  })

  // Ordenar actividades por fecha (más recientes primero)
  const sortedActivities = [...filteredActivities].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const isLoading = activitiesLoading || businessesLoading || employeesLoading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Cargando datos de actividad...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-title">Registro de Actividad</h1>
        <p className="text-slate-600 dark:text-slate-400">Seguimiento de todas las acciones realizadas en el sistema</p>
      </div>

      {/* Filtros */}
      <div className="app-card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="businessFilter" className="label flex items-center gap-2">
              <Filter className="h-4 w-4" /> Negocio
            </label>
            <select
              id="businessFilter"
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="input"
            >
              <option value="all">Todos los Negocios</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="userRoleFilter" className="label flex items-center gap-2">
              <User className="h-4 w-4" /> Rol de Usuario
            </label>
            <select
              id="userRoleFilter"
              value={selectedUserRole}
              onChange={(e) => setSelectedUserRole(e.target.value)}
              className="input"
            >
              <option value="all">Todos los Roles</option>
              <option value="admin">Administrador</option>
              <option value="employee">Empleado</option>
            </select>
          </div>
          <div>
            <label htmlFor="actionFilter" className="label flex items-center gap-2">
              <Filter className="h-4 w-4" /> Acción
            </label>
            <select
              id="actionFilter"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="input"
            >
              <option value="all">Todas las Acciones</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="searchQuery" className="label flex items-center gap-2">
              <Search className="h-4 w-4" /> Buscar
            </label>
            <input
              id="searchQuery"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por usuario, acción o detalles..."
              className="input"
            />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Rango de Fechas:</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="input py-1 px-2 text-sm"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">a</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="input py-1 px-2 text-sm"
              />
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Mostrando {sortedActivities.length} actividades
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Actividades */}
      <div className="app-card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Fecha y Hora</th>
                <th className="table-header-cell">Usuario</th>
                <th className="table-header-cell">Rol</th>
                <th className="table-header-cell">Negocio</th>
                <th className="table-header-cell">Acción</th>
                <th className="table-header-cell">Detalles</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {sortedActivities.map((activity) => (
                <tr key={activity.id} className="table-row">
                  <td className="table-cell whitespace-nowrap">{new Date(activity.timestamp).toLocaleString()}</td>
                  <td className="table-cell font-medium">{activity.userName}</td>
                  <td className="table-cell">
                    <span className={`badge ${activity.userRole === "admin" ? "badge-info" : "badge-neutral"}`}>
                      {activity.userRole === "admin" ? "Administrador" : "Empleado"}
                    </span>
                  </td>
                  <td className="table-cell">{activity.businessName}</td>
                  <td className="table-cell">
                    <span className={`badge ${getActionBadgeClass(activity.action)}`}>
                      {translateAction(activity.action)}
                    </span>
                  </td>
                  <td className="table-cell">{activity.details}</td>
                </tr>
              ))}
              {sortedActivities.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-8">
                    No se encontraron actividades para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Función auxiliar para determinar la clase de badge según la acción
function getActionBadgeClass(action: string): string {
  switch (action.toLowerCase()) {
    case "login":
      return "badge-info"
    case "logout":
      return "badge-neutral"
    case "new sale":
      return "badge-success"
    case "add product":
    case "add expense":
      return "badge-info"
    case "delete product":
    case "delete expense":
      return "badge-danger"
    case "start shift":
      return "badge-success"
    case "end shift":
      return "badge-neutral"
    default:
      return "badge-info"
  }
}

// Función para traducir acciones al español
function translateAction(action: string): string {
  const translations: Record<string, string> = {
    login: "Inicio de sesión",
    logout: "Cierre de sesión",
    "new sale": "Nueva venta",
    "add product": "Agregar producto",
    "add expense": "Agregar gasto",
    "delete product": "Eliminar producto",
    "delete expense": "Eliminar gasto",
    "start shift": "Iniciar turno",
    "end shift": "Finalizar turno",
  }

  return translations[action] || action
}

