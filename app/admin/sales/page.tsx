"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getSales, clearSalesCache, type Sale } from "@/lib/redux/slices/salesSlice"
import { getProducts } from "@/lib/redux/slices/productSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice" // Changed from getBusinesses
import { getEmployees } from "@/lib/redux/slices/employeeSlice"
import { Search, FileText, RefreshCw } from "lucide-react"

export default function SalesPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { sales, loading: salesLoading, lastFetched } = useSelector((state: RootState) => state.sales)
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)

  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all")
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  })

  // Cargar datos al montar el componente
  useEffect(() => {
    console.log("🔍 SalesPage: Loading data...")
    loadData()
  }, [dispatch])

  // Función para cargar todos los datos
  const loadData = () => {
    dispatch(getSales())
    dispatch(getProducts())
    dispatch(fetchBusinesses())
    dispatch(getEmployees())
  }

  // Función para recargar los datos de ventas
  const refreshSales = () => {
    console.log("🔍 SalesPage: Manually refreshing sales data...")
    dispatch(clearSalesCache())
    dispatch(getSales())
  }

  // Log sales data for debugging
  useEffect(() => {
    console.log("🔍 SalesPage: Sales data loaded:", sales.length, "sales")
    if (sales.length > 0) {
      console.log("🔍 SalesPage: First few sales:", sales.slice(0, 3))
    } else {
      console.log("🔍 SalesPage: No sales data available")
    }
  }, [sales])

  const handleBusinessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBusinessId(e.target.value)
  }

  const openDetailsModal = (sale: Sale) => {
    setSelectedSale(sale)
    setIsDetailsModalOpen(true)
  }

  const filteredSales = sales.filter((sale) => {
    const matchesBusiness = selectedBusinessId === "all" || sale.businessId === selectedBusinessId
    const saleDate = new Date(sale.timestamp)
    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)
    endDate.setHours(23, 59, 59, 999) // Establecer al final del día
    const matchesDate = saleDate >= startDate && saleDate <= endDate

    // Búsqueda por texto
    const matchesSearch =
      searchTerm === "" ||
      sale.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.items.some((item) => item.productName.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesBusiness && matchesDate && matchesSearch
  })

  // Calcular el total de ventas filtradas
  const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0)

  const isLoading = salesLoading || businessesLoading || productsLoading || employeesLoading

  // Función para traducir el método de pago
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Cargando datos de ventas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="app-title">Ventas</h1>
        <button onClick={refreshSales} className="btn btn-primary flex items-center gap-2" disabled={salesLoading}>
          <RefreshCw className={`w-4 h-4 ${salesLoading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {lastFetched && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Última actualización: {new Date(lastFetched).toLocaleString()}
        </p>
      )}

      <div className="app-card">
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

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Rango de Fechas:</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="input py-1 px-2 text-sm"
              />
              <span className="self-center">a</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="input py-1 px-2 text-sm"
              />
              <button
                onClick={() =>
                  setDateRange({
                    start: "2000-01-01",
                    end: new Date().toISOString().split("T")[0],
                  })
                }
                className="btn btn-secondary py-1 px-3 text-sm"
                title="Mostrar todas las ventas históricas"
              >
                Ver historial completo
              </button>
            </div>
          </div>

          <div className="relative max-w-xs">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <input
              type="text"
              className="input pl-10"
              placeholder="Buscar ventas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-between items-center mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-slate-600 dark:text-slate-400">
            <span className="font-medium">Total de ventas mostradas:</span> {filteredSales.length}{" "}
            {filteredSales.length === 1 ? "venta" : "ventas"}
          </div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">${totalSalesAmount.toFixed(2)}</div>
        </div>

        {sales.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400 mb-4">No se encontraron ventas en la base de datos.</p>
            <button onClick={refreshSales} className="btn btn-primary flex items-center gap-2 mx-auto">
              <RefreshCw className="w-4 h-4" />
              Intentar cargar nuevamente
            </button>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400">
              No se encontraron ventas para los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Negocio</th>
                  <th className="table-header-cell">Empleado</th>
                  <th className="table-header-cell">Fecha y Hora</th>
                  <th className="table-header-cell">Artículos</th>
                  <th className="table-header-cell">Total</th>
                  <th className="table-header-cell">Método de Pago</th>
                  <th className="table-header-cell">Acciones</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="table-row">
                    <td className="table-cell">{sale.businessName}</td>
                    <td className="table-cell">{sale.employeeName}</td>
                    <td className="table-cell">{new Date(sale.timestamp).toLocaleString()}</td>
                    <td className="table-cell">{sale.items.length} artículos</td>
                    <td className="table-cell font-medium">${sale.total.toFixed(2)}</td>
                    <td className="table-cell">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getPaymentMethodClass(sale.paymentMethod)}`}
                      >
                        {translatePaymentMethod(sale.paymentMethod)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => openDetailsModal(sale)}
                        className="p-1 text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                        aria-label="Ver detalles"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalles de Venta */}
      {isDetailsModalOpen && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">Detalles de Venta</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {new Date(selectedSale.timestamp).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Negocio</p>
                  <p className="font-medium">{selectedSale.businessName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Empleado</p>
                  <p className="font-medium">{selectedSale.employeeName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Método de Pago</p>
                  <p className="font-medium">{translatePaymentMethod(selectedSale.paymentMethod)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
                  <p className="font-medium">${selectedSale.total.toFixed(2)}</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-3">Artículos</h3>
              <div className="table-container">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell">Producto</th>
                      <th className="table-header-cell">Cantidad</th>
                      <th className="table-header-cell">Precio</th>
                      <th className="table-header-cell">Total</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {selectedSale.items.map((item, index) => (
                      <tr key={index} className="table-row">
                        <td className="table-cell font-medium">{item.productName}</td>
                        <td className="table-cell">{item.quantity}</td>
                        <td className="table-cell">${item.price.toFixed(2)}</td>
                        <td className="table-cell">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-700">
                      <td colSpan={3} className="px-6 py-3 text-right font-medium">
                        Total:
                      </td>
                      <td className="px-6 py-3 font-medium">${selectedSale.total.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

