"use client"

import { useEffect, useState, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getProducts } from "@/lib/redux/slices/productSlice"
import { getSales } from "@/lib/redux/slices/salesSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice"
import { getShifts, beginShift, finishShift } from "@/lib/redux/slices/shiftSlice"
import { getEmployees } from "@/lib/redux/slices/employeeSlice"
import { Clock, DollarSign, ShoppingCart, Package, AlertTriangle, Building } from "lucide-react"
import Link from "next/link"
import { createModuleLogger } from "@/lib/clientLogger"

const logger = createModuleLogger("employeeDashboard")

export default function EmployeeDashboard() {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)
  const { sales, loading: salesLoading } = useSelector((state: RootState) => state.sales)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { shifts, loading: shiftsLoading } = useSelector((state: RootState) => state.shifts)
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)

  const [isStartingShift, setIsStartingShift] = useState(false)
  const [isEndingShift, setIsEndingShift] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  // Log de acceso a la ruta
  useEffect(() => {
    logger.info("Acceso al dashboard de empleado", {
      timestamp: new Date().toISOString(),
      userId: user?.id,
      userRole: user?.role,
      userEmail: user?.email,
      userBusinessId: user?.businessId || "No asignado",
    })
  }, [user])

  useEffect(() => {
    logger.info("Iniciando carga de datos para el dashboard")
    dispatch(getSales())
    dispatch(getProducts())
    dispatch(fetchBusinesses())
    dispatch(getShifts())
    dispatch(getEmployees())
  }, [dispatch])

  // Usar directamente el businessId del usuario
  const businessId = user?.businessId

  // Log de datos cargados
  useEffect(() => {
    if (!employeesLoading && !shiftsLoading && !businessesLoading && !productsLoading && !salesLoading) {
      logger.info("Datos cargados para el dashboard", {
        employeesCount: employees.length,
        shiftsCount: shifts.length,
        businessesCount: businesses.length,
        businessesCount: businesses.length,
        productsCount: products.length,
        salesCount: sales.length,
      })
    }
  }, [
    employees,
    shifts,
    businesses,
    products,
    sales,
    employeesLoading,
    shiftsLoading,
    businessesLoading,
    productsLoading,
    salesLoading,
  ])

  // Encontrar el empleado correspondiente al usuario actual
  const currentEmployee = useMemo(() => {
    if (!user) {
      logger.warn("No hay usuario autenticado para buscar empleado")
      return null
    }

    logger.info("Buscando empleado para el usuario actual", {
      userId: user.id,
      userEmail: user.email,
    })

    // Buscar el empleado por el ID de usuario (auth_id)
    const empById = employees.find((emp) => emp.userId === user.id)

    // Si no se encuentra por ID, intentar buscar por email como fallback
    // Hacemos la comparación insensible a mayúsculas/minúsculas
    const empByEmail = !empById ? employees.find((emp) => emp.email.toLowerCase() === user.email.toLowerCase()) : null

    const result = empById || empByEmail

    logger.info("Resultado de búsqueda de empleado", {
      buscandoPorId: user.id,
      encontradoPorId: !!empById,
      buscandoPorEmail: user.email,
      buscandoPorEmailLowerCase: user.email.toLowerCase(),
      encontradoPorEmail: !!empByEmail,
      resultadoFinal: result ? `${result.name} (${result.id})` : "No encontrado",
    })

    if (!result) {
      logger.warn("No se encontró registro de empleado para el usuario", {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        userBusinessId: user.businessId || "No asignado",
      })
    }

    return result
  }, [employees, user])

  // Filter data based on the employee's business
  const businessProducts = useMemo(
    () => products.filter((product) => product.businessId === businessId),
    [products, businessId],
  )

  const employeeSales = useMemo(() => {
    if (!currentEmployee) return []
    return sales.filter((sale) => sale.employeeId === currentEmployee.id)
  }, [sales, currentEmployee])

  const employeeShifts = useMemo(() => {
    if (!currentEmployee) return []
    return shifts.filter((shift) => shift.employeeId === currentEmployee.id)
  }, [shifts, currentEmployee])

  const currentBusiness = useMemo(
    () => businesses.find((business) => business.id === businessId),
    [businesses, businessId],
  )

  // Get low stock products
  const lowStockProducts = useMemo(
    () => businessProducts.filter((product) => product.stock <= product.minStock),
    [businessProducts],
  )

  // Get active shift
  const activeShift = useMemo(() => employeeShifts.find((shift) => shift.active), [employeeShifts])

  // Get sales for active shift
  const activeShiftSales = useMemo(
    () => (activeShift ? sales.filter((sale) => sale.shiftId === activeShift.id) : []),
    [sales, activeShift],
  )

  // Calculate today's sales
  const today = new Date().toDateString()

  // Calculate today's sales outside the component
  const todayDate = new Date().toDateString()

  // Memoize values that depend on today
  const todaySales = useMemo(() => {
    return employeeSales.filter((sale) => new Date(sale.timestamp).toDateString() === todayDate)
  }, [employeeSales, todayDate])

  const todaySalesCount = todaySales.length
  const todaySalesTotal = useMemo(() => todaySales.reduce((sum, sale) => sum + sale.total, 0), [todaySales])

  // Calculate payment method breakdown for active shift
  const paymentMethodBreakdown = useMemo(() => {
    const breakdown = {
      cash: 0,
      card: 0,
      transfer: 0,
      mercadopago: 0,
      rappi: 0,
    }

    if (activeShift) {
      activeShiftSales.forEach((sale) => {
        breakdown[sale.paymentMethod] += sale.total
      })
    }

    return breakdown
  }, [activeShiftSales, activeShift])

  const handleStartShift = async () => {
    if (!user?.id) {
      const errorMsg = "No se puede iniciar turno: usuario no identificado"
      logger.error(errorMsg)
      setError(errorMsg)
      return
    }

    if (!businessId) {
      const errorMsg =
        "No se puede iniciar turno: no tienes un negocio asignado. Por favor, contacta a un administrador."
      logger.error(errorMsg, { userId: user.id })
      setError(errorMsg)
      return
    }

    if (!currentEmployee) {
      const errorMsg =
        "No se puede iniciar turno: no se encontró tu registro de empleado. Por favor, contacta a un administrador."
      logger.error(errorMsg, {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        userBusinessId: businessId,
      })
      setError(errorMsg)
      return
    }

    setError(null)
    setIsStartingShift(true)
    try {
      logger.info("Iniciando turno", {
        employeeId: currentEmployee.id,
        businessId,
        userId: user.id,
      })

      const result = await dispatch(beginShift({ employeeId: currentEmployee.id, businessId })).unwrap()

      logger.info("Turno iniciado con éxito", {
        shiftId: result.id,
        employeeId: currentEmployee.id,
        businessId,
      })

      // Refresh shifts data
      dispatch(getShifts())
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al iniciar turno"
      logger.error("Error al iniciar turno", {
        error: errorMsg,
        employeeId: currentEmployee.id,
        businessId,
      })
      setError(errorMsg)
    } finally {
      setIsStartingShift(false)
    }
  }

  const handleEndShift = async () => {
    if (!activeShift) return

    setIsEndingShift(true)
    try {
      logger.info("Finalizando turno", { shiftId: activeShift.id })

      await dispatch(finishShift(activeShift.id))

      logger.info("Turno finalizado con éxito", { shiftId: activeShift.id })

      // Refresh shifts data
      dispatch(getShifts())
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al finalizar turno"
      logger.error("Error al finalizar turno", {
        error: errorMsg,
        shiftId: activeShift.id,
      })
      setError(errorMsg)
    } finally {
      setIsEndingShift(false)
    }
  }

  const isLoading = productsLoading || salesLoading || shiftsLoading || businessesLoading || employeesLoading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando datos del dashboard...</p>
        </div>
      </div>
    )
  }

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)
  }

  // Helper function to translate payment method
  const translatePaymentMethod = (method: string) => {
    const translations = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
      mercadopago: "MercadoPago",
      rappi: "Rappi",
    }
    return translations[method] || method
  }

  // Helper function to get payment method class
  const getPaymentMethodClass = (method: string) => {
    const classes = {
      cash: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      card: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      transfer: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      mercadopago: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300",
      rappi: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    }
    return classes[method] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Empleado</h1>
          <p className="text-gray-600 dark:text-gray-400">Bienvenido, {user?.name}!</p>
        </div>
        <div className="mt-4 md:mt-0 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">Negocio Asignado</p>
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-500" />
            <p className="font-medium">
              {currentBusiness?.name || <span className="text-amber-600">No asignado</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
              <div className="mt-1 text-sm text-red-700 dark:text-red-200">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No business assigned warning */}
      {!businessId && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">Atención</h3>
              <div className="mt-1 text-sm text-amber-700 dark:text-amber-200">
                <p>
                  No tienes un negocio asignado. Por favor, contacta a un administrador para que te asigne a un negocio.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No employee record warning */}
      {!currentEmployee && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">Atención</h3>
              <div className="mt-1 text-sm text-amber-700 dark:text-amber-200">
                <p>
                  No se encontró tu registro de empleado. Por favor, contacta a un administrador para resolver este
                  problema.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Status Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-full ${
                activeShift ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-700/30"
              }`}
            >
              <Clock
                className={`h-6 w-6 ${
                  activeShift ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"
                }`}
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Estado del Turno</h2>
              <p
                className={`${activeShift ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}
              >
                {activeShift ? "Turno Activo" : "Sin Turno Activo"}
              </p>
              {activeShift && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Iniciado: {new Date(activeShift.startTime).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div>
            {activeShift ? (
              <button onClick={handleEndShift} disabled={isEndingShift} className="btn btn-danger">
                {isEndingShift ? "Finalizando..." : "Finalizar Turno"}
              </button>
            ) : (
              <button
                onClick={handleStartShift}
                disabled={isStartingShift || !businessId || !currentEmployee}
                className={`btn ${!businessId || !currentEmployee ? "btn-disabled" : "btn-success"}`}
                title={
                  !businessId
                    ? "Necesitas tener un negocio asignado para iniciar un turno"
                    : !currentEmployee
                      ? "No se encontró tu registro de empleado"
                      : ""
                }
              >
                {isStartingShift ? "Iniciando..." : "Iniciar Turno"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/employee/products"
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Productos</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ver y gestionar inventario</p>
            </div>
          </div>
        </Link>

        <Link
          href="/employee/new-sale"
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
              <ShoppingCart className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Nueva Venta</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Registrar una nueva venta</p>
            </div>
          </div>
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Ventas de Hoy</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {todaySalesCount} ventas - {formatCurrency(todaySalesTotal)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">Alerta de Stock Bajo</h3>
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-200">
                <p>
                  Hay {lowStockProducts.length} productos con stock por debajo del mínimo requerido.
                  <Link href="/employee/products" className="ml-2 font-medium underline">
                    Ver productos
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Shift Sales */}
      {activeShift && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Ventas del Turno Actual</h2>
            <div className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              Total:{" "}
              <span className="font-semibold">
                {formatCurrency(activeShiftSales.reduce((sum, sale) => sum + sale.total, 0))}
              </span>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Efectivo</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(paymentMethodBreakdown.cash)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Tarjeta</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(paymentMethodBreakdown.card)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Transferencia</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(paymentMethodBreakdown.transfer)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">MercadoPago</p>
              <p className="text-xl font-bold text-sky-600 dark:text-sky-400">
                {formatCurrency(paymentMethodBreakdown.mercadopago)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Rappi</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(paymentMethodBreakdown.rappi)}
              </p>
            </div>
          </div>

          {/* Sales List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold">Listado de Ventas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Hora
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Productos
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Método de Pago
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {activeShiftSales.length > 0 ? (
                    activeShiftSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(sale.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="space-y-1">
                            {sale.items.map((item, index) => (
                              <div key={index} className="text-xs">
                                {item.quantity}x {item.productName} - {formatCurrency(item.total)}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getPaymentMethodClass(sale.paymentMethod)}`}
                          >
                            {translatePaymentMethod(sale.paymentMethod)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(sale.total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No hay ventas registradas en este turno.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

