"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getShifts, type Shift } from "@/lib/redux/slices/shiftSlice"
import { getEmployees } from "@/lib/redux/slices/employeeSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice"
import { getSales } from "@/lib/redux/slices/salesSlice"
import { FileText, Search } from "lucide-react"

export default function ShiftsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { shifts, loading: shiftsLoading } = useSelector((state: RootState) => state.shifts)
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { sales, loading: salesLoading } = useSelector((state: RootState) => state.sales)

  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all")
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)

  useEffect(() => {
    dispatch(getShifts())
    dispatch(getEmployees())
    dispatch(fetchBusinesses())
    dispatch(getSales())
  }, [dispatch])

  const handleBusinessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBusinessId(e.target.value)
  }

  const openDetailsModal = (shift: Shift) => {
    setSelectedShift(shift)
    setIsDetailsModalOpen(true)
  }

  const filteredShifts =
    selectedBusinessId === "all"
      ? shifts
      : shifts.filter((shift) => shift.businessId === selectedBusinessId)

  // Ordenar turnos por hora de inicio (más recientes primero)
  const sortedShifts = [...filteredShifts].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )

  // Función para obtener las ventas de un turno específico
  const getShiftSales = (shiftId: string) => {
    return sales.filter((sale) => sale.shiftId === shiftId)
  }

  // Función para traducir los métodos de pago
  const translatePaymentMethod = (method: string) => {
    const translations: Record<string, string> = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
      mercadopago: "Mercadopago",
      rappi: "Rappi",
    }
    return translations[method] || method
  }

  // Función para obtener la clase CSS del método de pago
  const getPaymentMethodClass = (method: string) => {
    const classes: Record<string, string> = {
      cash: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      card: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      transfer: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      mercadopago: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300",
      rappi: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    }
    return classes[method] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
  }

  // Función para formatear precios
  const formatPrice = (num: number): string => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const isLoading = shiftsLoading || employeesLoading || businessesLoading || salesLoading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Cargando datos de turnos...
          </p>
        </div>
      </div>
    )
  }

  // Dentro del modal, recalculamos los totales por método de pago para el turno seleccionado
  let paymentTotals: Record<string, number> = {}
  if (selectedShift) {
    const shiftSales = getShiftSales(selectedShift.id)
    paymentTotals = shiftSales.reduce((acc, sale) => {
      const method = sale.paymentMethod
      acc[method] = (acc[method] || 0) + sale.total
      return acc
    }, {} as Record<string, number>)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Turnos</h1>

      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div className="flex items-center">
            <label htmlFor="businessFilter" className="mr-2 text-sm font-medium">
              Filtrar por Negocio:
            </label>
            <select
              id="businessFilter"
              value={selectedBusinessId}
              onChange={handleBusinessChange}
              className="input max-w-xs"
            >
              <option value="all">Todos los Negocios</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative max-w-xs">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
            <input
              type="text"
              className="input pl-10"
              placeholder="Buscar turnos..."
            />
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Empleado</th>
                <th className="table-header-cell">Negocio</th>
                <th className="table-header-cell">Hora de Inicio</th>
                <th className="table-header-cell">Hora de Fin</th>
                <th className="table-header-cell">Estado</th>
                <th className="table-header-cell">Ventas</th>
                <th className="table-header-cell">Total</th>
                <th className="table-header-cell">Acciones</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {sortedShifts.map((shift) => {
                const shiftSales = getShiftSales(shift.id)
                const totalAmount = shiftSales.reduce((sum, sale) => sum + sale.total, 0)
                return (
                  <tr key={shift.id} className="table-row">
                    <td className="table-cell font-medium">{shift.employeeName}</td>
                    <td className="table-cell">{shift.businessName}</td>
                    <td className="table-cell">{new Date(shift.startTime).toLocaleString()}</td>
                    <td className="table-cell">
                      {shift.endTime ? new Date(shift.endTime).toLocaleString() : "-"}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          shift.active
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {shift.active ? "Activo" : "Completado"}
                      </span>
                    </td>
                    <td className="table-cell">{shift.sales}</td>
                    <td className="table-cell font-medium">
                      ${formatPrice(totalAmount || 0)}
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => openDetailsModal(shift)}
                        className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {sortedShifts.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8">
                    No se encontraron turnos para el filtro seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalles del Turno */}
      {isDetailsModalOpen && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">Detalles del Turno</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedShift.employeeName} - {selectedShift.businessName}
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Hora de Inicio
                  </p>
                  <p className="font-medium">
                    {new Date(selectedShift.startTime).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Hora de Fin
                  </p>
                  <p className="font-medium">
                    {selectedShift.endTime
                      ? new Date(selectedShift.endTime).toLocaleString()
                      : "Aún activo"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Estado</p>
                  <p className="font-medium">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedShift.active
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {selectedShift.active ? "Activo" : "Completado"}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total de Ventas
                  </p>
                  <p className="font-medium">{selectedShift.sales}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Métodos de Pago</h3>
                <div className="grid grid-cols-5 gap-4">
                  <div className="bg-green-100 dark:bg-green-900 p-3 rounded">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Efectivo
                    </p>
                    <p className="font-medium">
                      ${formatPrice(paymentTotals["cash"] || 0)}
                    </p>
                  </div>
                  <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Tarjeta
                    </p>
                    <p className="font-medium">
                      ${formatPrice(paymentTotals["card"] || 0)}
                    </p>
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Transferencia
                    </p>
                    <p className="font-medium">
                      ${formatPrice(paymentTotals["transfer"] || 0)}
                    </p>
                  </div>
                  <div className="bg-sky-100 dark:bg-sky-900 p-3 rounded">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Mercadopago
                    </p>
                    <p className="font-medium">
                      ${formatPrice(paymentTotals["mercadopago"] || 0)}
                    </p>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Rappi
                    </p>
                    <p className="font-medium">
                      ${formatPrice(paymentTotals["rappi"] || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-3">
                Ventas Durante Este Turno
              </h3>
              {getShiftSales(selectedShift.id).length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead className="table-header">
                      <tr>
                        <th className="table-header-cell">Hora</th>
                        <th className="table-header-cell">Productos</th>
                        <th className="table-header-cell">Método de Pago</th>
                        <th className="table-header-cell">Total</th>
                      </tr>
                    </thead>
                    <tbody className="table-body">
                      {getShiftSales(selectedShift.id).map((sale) => (
                        <tr key={sale.id} className="table-row">
                          <td className="table-cell">
                            {new Date(sale.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="table-cell">
                            <div className="space-y-1">
                              {sale.items.map((item, index) => (
                                <div key={index} className="text-xs">
                                  {item.quantity}x {item.productName} - $
                                  {formatPrice(item.total)}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="table-cell">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${getPaymentMethodClass(
                                sale.paymentMethod
                              )}`}
                            >
                              {translatePaymentMethod(sale.paymentMethod)}
                            </span>
                          </td>
                          <td className="table-cell font-medium">
                            ${formatPrice(sale.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  No hay ventas registradas durante este turno.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
