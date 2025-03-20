"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice" // Changed from getBusinesses
import { getSales } from "@/lib/redux/slices/salesSlice"
import { getExpenses } from "@/lib/redux/slices/expensesSlice"
import { Calendar, ChevronDown, ChevronUp, DollarSign, TrendingDown, TrendingUp } from "lucide-react"

type DateRange = {
  start: Date
  end: Date
  label: string
}

type BusinessCashFlow = {
  businessId: string
  businessName: string
  sales: number
  salesCount: number
  expenses: number
  expensesCount: number
  netTotal: number
  paymentMethods: {
    cash: number
    card: number
    transfer: number
    mercadopago: number
    rappi: number
  }
}

export default function CashFlowPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { sales, loading: salesLoading } = useSelector((state: RootState) => state.sales)
  const { expenses, loading: expensesLoading } = useSelector((state: RootState) => state.expenses)

  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all")
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(),
    label: "Mes Actual",
  })
  const [customDateRange, setCustomDateRange] = useState<{
    start: string
    end: string
  }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  })
  const [expandedBusinessId, setExpandedBusinessId] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchBusinesses()) // Changed from getBusinesses
    dispatch(getSales())
    dispatch(getExpenses())
  }, [dispatch])

  // Rangos de fechas predefinidos
  const dateRanges: DateRange[] = [
    {
      label: "Mes Actual",
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      end: new Date(),
    },
    {
      label: "Mes Anterior",
      start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      end: new Date(new Date().getFullYear(), new Date().getMonth(), 0),
    },
    {
      label: "Últimos 3 Meses",
      start: new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1),
      end: new Date(),
    },
    {
      label: "Año hasta la Fecha",
      start: new Date(new Date().getFullYear(), 0, 1),
      end: new Date(),
    },
    {
      label: "Rango Personalizado",
      start: new Date(customDateRange.start),
      end: new Date(customDateRange.end),
    },
  ]

  // Manejar selección de rango de fechas
  const handleDateRangeChange = (range: DateRange) => {
    setSelectedDateRange(range)
  }

  // Manejar cambios en el rango de fechas personalizado
  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>, type: "start" | "end") => {
    const newRange = {
      ...customDateRange,
      [type]: e.target.value,
    }
    setCustomDateRange(newRange)

    if (selectedDateRange.label === "Rango Personalizado") {
      setSelectedDateRange({
        ...selectedDateRange,
        start: new Date(newRange.start),
        end: new Date(newRange.end),
      })
    }
  }

  // Filtrar ventas y gastos según el rango de fechas y negocio seleccionados
  const filteredSales = sales
    .map((sale) => {
      // Modificar los métodos de pago para incluir Mercadopago y Rappi
      // Esto es solo para demostración, en una aplicación real estos datos vendrían de la base de datos
      const paymentMethod = (() => {
        // Asignar aleatoriamente algunos pagos a Mercadopago y Rappi para demostración
        const random = Math.random()
        if (random < 0.2) return "mercadopago"
        if (random < 0.3) return "rappi"
        return sale.paymentMethod
      })()

      return {
        ...sale,
        paymentMethod,
      }
    })
    .filter((sale) => {
      const saleDate = new Date(sale.timestamp)
      const matchesDate = saleDate >= selectedDateRange.start && saleDate <= selectedDateRange.end
      const matchesBusiness = selectedBusinessId === "all" || sale.businessId === selectedBusinessId
      return matchesDate && matchesBusiness
    })

  const filteredExpenses = expenses.filter((expense) => {
    const expenseDate = new Date(expense.date)
    const matchesDate = expenseDate >= selectedDateRange.start && expenseDate <= selectedDateRange.end
    const matchesBusiness = selectedBusinessId === "all" || expense.businessId === selectedBusinessId
    return matchesDate && matchesBusiness
  })

  // Calcular flujo de caja para cada negocio
  const calculateBusinessCashFlow = (): BusinessCashFlow[] => {
    const businessCashFlows: { [key: string]: BusinessCashFlow } = {}

    // Inicializar flujo de caja para cada negocio
    businesses.forEach((business) => {
      businessCashFlows[business.id] = {
        businessId: business.id,
        businessName: business.name,
        sales: 0,
        salesCount: 0,
        expenses: 0,
        expensesCount: 0,
        netTotal: 0,
        paymentMethods: {
          cash: 0,
          card: 0,
          transfer: 0,
          mercadopago: 0,
          rappi: 0,
        },
      }
    })

    // Agregar datos de ventas
    filteredSales.forEach((sale) => {
      if (businessCashFlows[sale.businessId]) {
        businessCashFlows[sale.businessId].sales += sale.total
        businessCashFlows[sale.businessId].salesCount += 1

        // Incrementar el método de pago correspondiente
        if (sale.paymentMethod === "cash") {
          businessCashFlows[sale.businessId].paymentMethods.cash += sale.total
        } else if (sale.paymentMethod === "card") {
          businessCashFlows[sale.businessId].paymentMethods.card += sale.total
        } else if (sale.paymentMethod === "transfer") {
          businessCashFlows[sale.businessId].paymentMethods.transfer += sale.total
        } else if (sale.paymentMethod === "mercadopago") {
          businessCashFlows[sale.businessId].paymentMethods.mercadopago += sale.total
        } else if (sale.paymentMethod === "rappi") {
          businessCashFlows[sale.businessId].paymentMethods.rappi += sale.total
        }
      }
    })

    // Agregar datos de gastos
    filteredExpenses.forEach((expense) => {
      if (businessCashFlows[expense.businessId]) {
        businessCashFlows[expense.businessId].expenses += expense.amount
        businessCashFlows[businessCashFlows[expense.businessId].businessId].expensesCount += 1
      }
    })

    // Calcular total neto
    Object.values(businessCashFlows).forEach((flow) => {
      flow.netTotal = flow.sales - flow.expenses
    })

    // Filtrar por negocio seleccionado si es necesario
    if (selectedBusinessId !== "all") {
      return Object.values(businessCashFlows).filter((flow) => flow.businessId === selectedBusinessId)
    }

    return Object.values(businessCashFlows)
  }

  const businessCashFlows = calculateBusinessCashFlow()

  // Calcular totales
  const totalSales = businessCashFlows.reduce((sum, flow) => sum + flow.sales, 0)
  const totalExpenses = businessCashFlows.reduce((sum, flow) => sum + flow.expenses, 0)
  const totalNet = totalSales - totalExpenses
  const totalPaymentMethods = {
    cash: businessCashFlows.reduce((sum, flow) => sum + flow.paymentMethods.cash, 0),
    card: businessCashFlows.reduce((sum, flow) => sum + flow.paymentMethods.card, 0),
    transfer: businessCashFlows.reduce((sum, flow) => sum + flow.paymentMethods.transfer, 0),
    mercadopago: businessCashFlows.reduce((sum, flow) => sum + flow.paymentMethods.mercadopago, 0),
    rappi: businessCashFlows.reduce((sum, flow) => sum + flow.paymentMethods.rappi, 0),
  }

  const toggleBusinessExpand = (businessId: string) => {
    if (expandedBusinessId === businessId) {
      setExpandedBusinessId(null)
    } else {
      setExpandedBusinessId(businessId)
    }
  }

  const isLoading = businessesLoading || salesLoading || expensesLoading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Cargando datos de flujo de caja...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-title">Flujo de Caja</h1>
        <p className="text-slate-600 dark:text-slate-400">Monitorea el flujo de caja de todos los negocios</p>
      </div>

      {/* Filtros */}
      <div className="app-card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="businessFilter" className="label">
              Negocio
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
          <div className="flex-1">
            <label htmlFor="dateRangeFilter" className="label">
              Rango de Fechas
            </label>
            <select
              id="dateRangeFilter"
              value={selectedDateRange.label}
              onChange={(e) => {
                const selected = dateRanges.find((range) => range.label === e.target.value)
                if (selected) {
                  handleDateRangeChange(selected)
                }
              }}
              className="input"
            >
              {dateRanges.map((range) => (
                <option key={range.label} value={range.label}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
          {selectedDateRange.label === "Rango Personalizado" && (
            <div className="flex-1">
              <label className="label flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Rango Personalizado
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => handleCustomDateChange(e, "start")}
                  className="input"
                />
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => handleCustomDateChange(e, "end")}
                  className="input"
                />
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Mostrando datos desde <span className="font-medium">{selectedDateRange.start.toLocaleDateString()}</span>{" "}
            hasta <span className="font-medium">{selectedDateRange.end.toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="app-stat-card">
          <div className="flex justify-between items-start">
            <div>
              <p className="app-stat-title">Ventas Totales</p>
              <p className="app-stat-value text-green-600 dark:text-green-400">${totalSales.toFixed(2)}</p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="app-stat-description">{filteredSales.length} transacciones</p>
        </div>

        <div className="app-stat-card">
          <div className="flex justify-between items-start">
            <div>
              <p className="app-stat-title">Gastos Totales</p>
              <p className="app-stat-value text-red-600 dark:text-red-400">${totalExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
              <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="app-stat-description">{filteredExpenses.length} transacciones</p>
        </div>

        <div className="app-stat-card">
          <div className="flex justify-between items-start">
            <div>
              <p className="app-stat-title">Total Neto</p>
              <p
                className={`app-stat-value ${
                  totalNet >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                ${totalNet.toFixed(2)}
              </p>
            </div>
            <div
              className={`p-3 rounded-full ${
                totalNet >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
              }`}
            >
              <DollarSign
                className={`h-6 w-6 ${
                  totalNet >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              />
            </div>
          </div>
          <p className="app-stat-description">{totalNet >= 0 ? "Ganancia" : "Pérdida"} para el período seleccionado</p>
        </div>
      </div>

      {/* Desglose de Métodos de Pago */}
      <div className="app-card">
        <h2 className="app-subtitle mb-4">Desglose por Métodos de Pago</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="payment-method-card payment-method-cash">
            <p className="text-sm text-slate-600 dark:text-slate-400">Efectivo</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${totalPaymentMethods.cash.toFixed(2)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.cash / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
          <div className="payment-method-card payment-method-card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Tarjetas</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              ${totalPaymentMethods.card.toFixed(2)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.card / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
          <div className="payment-method-card payment-method-transfer">
            <p className="text-sm text-slate-600 dark:text-slate-400">Transferencia</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              ${totalPaymentMethods.transfer.toFixed(2)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.transfer / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
          <div className="payment-method-card payment-method-mercadopago">
            <p className="text-sm text-slate-600 dark:text-slate-400">Mercadopago</p>
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              ${totalPaymentMethods.mercadopago.toFixed(2)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.mercadopago / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
          <div className="payment-method-card payment-method-rappi">
            <p className="text-sm text-slate-600 dark:text-slate-400">Rappi</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              ${totalPaymentMethods.rappi.toFixed(2)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.rappi / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de Flujo de Caja por Negocio */}
      <div className="app-card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Negocio</th>
                <th className="table-header-cell">Ventas</th>
                <th className="table-header-cell">Gastos</th>
                <th className="table-header-cell">Total Neto</th>
                <th className="table-header-cell">Detalles</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {businessCashFlows.map((flow) => (
                <React.Fragment key={flow.businessId}>
                  <tr className="table-row">
                    <td className="table-cell font-medium">{flow.businessName}</td>
                    <td className="table-cell text-green-600 dark:text-green-400">
                      ${flow.sales.toFixed(2)}
                      <div className="text-xs text-slate-500 dark:text-slate-400">{flow.salesCount} transacciones</div>
                    </td>
                    <td className="table-cell text-red-600 dark:text-red-400">
                      ${flow.expenses.toFixed(2)}
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {flow.expensesCount} transacciones
                      </div>
                    </td>
                    <td
                      className={`table-cell font-medium ${
                        flow.netTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      ${flow.netTotal.toFixed(2)}
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => toggleBusinessExpand(flow.businessId)}
                        className="btn btn-secondary flex items-center text-xs py-1"
                      >
                        {expandedBusinessId === flow.businessId ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" /> Ocultar Detalles
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" /> Mostrar Detalles
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                  {expandedBusinessId === flow.businessId && (
                    <tr>
                      <td colSpan={5} className="p-0 border-b border-slate-200 dark:border-slate-700">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4">
                          <h3 className="text-sm font-semibold mb-2">Desglose por Métodos de Pago</h3>
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm">
                              <p className="text-xs text-slate-500 dark:text-slate-400">Efectivo</p>
                              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                                ${flow.paymentMethods.cash.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                {((flow.paymentMethods.cash / flow.sales) * 100 || 0).toFixed(1)}% de ventas
                              </p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm">
                              <p className="text-xs text-slate-500 dark:text-slate-400">Tarjetas</p>
                              <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                                ${flow.paymentMethods.card.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                {((flow.paymentMethods.card / flow.sales) * 100 || 0).toFixed(1)}% de ventas
                              </p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm">
                              <p className="text-xs text-slate-500 dark:text-slate-400">Transferencia</p>
                              <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                                ${flow.paymentMethods.transfer.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                {((flow.paymentMethods.transfer / flow.sales) * 100 || 0).toFixed(1)}% de ventas
                              </p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm">
                              <p className="text-xs text-slate-500 dark:text-slate-400">Mercadopago</p>
                              <p className="text-lg font-semibold text-sky-600 dark:text-sky-400">
                                ${flow.paymentMethods.mercadopago.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                {((flow.paymentMethods.mercadopago / flow.sales) * 100 || 0).toFixed(1)}% de ventas
                              </p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm">
                              <p className="text-xs text-slate-500 dark:text-slate-400">Rappi</p>
                              <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                                ${flow.paymentMethods.rappi.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                {((flow.paymentMethods.rappi / flow.sales) * 100 || 0).toFixed(1)}% de ventas
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h3 className="text-sm font-semibold mb-2">Ventas Recientes</h3>
                              {filteredSales
                                .filter((sale) => sale.businessId === flow.businessId)
                                .slice(0, 3)
                                .map((sale) => (
                                  <div
                                    key={sale.id}
                                    className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm mb-2"
                                  >
                                    <div className="flex justify-between">
                                      <p className="text-sm font-medium">
                                        {new Date(sale.timestamp).toLocaleDateString()}
                                      </p>
                                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                        ${sale.total.toFixed(2)}
                                      </p>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {sale.items.length} artículos - {sale.employeeName}
                                    </p>
                                  </div>
                                ))}
                              {filteredSales.filter((sale) => sale.businessId === flow.businessId).length === 0 && (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  No hay ventas en este período
                                </p>
                              )}
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold mb-2">Gastos Recientes</h3>
                              {filteredExpenses
                                .filter((expense) => expense.businessId === flow.businessId)
                                .slice(0, 3)
                                .map((expense) => (
                                  <div
                                    key={expense.id}
                                    className="bg-white dark:bg-slate-800 p-3 rounded-md shadow-sm mb-2"
                                  >
                                    <div className="flex justify-between">
                                      <p className="text-sm font-medium">
                                        {new Date(expense.date).toLocaleDateString()}
                                      </p>
                                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                        ${expense.amount.toFixed(2)}
                                      </p>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {expense.category} - {expense.description.substring(0, 30)}
                                      {expense.description.length > 30 ? "..." : ""}
                                    </p>
                                  </div>
                                ))}
                              {filteredExpenses.filter((expense) => expense.businessId === flow.businessId).length ===
                                0 && (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  No hay gastos en este período
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {businessCashFlows.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-cell text-center py-8">
                    No se encontraron datos de flujo de caja para los filtros seleccionados.
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

