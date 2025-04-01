"use client"

import React, { useEffect, useState } from "react"
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
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  })
  const [expandedBusinessId, setExpandedBusinessId] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchBusinesses())
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
    const newRange = { ...customDateRange, [type]: e.target.value }
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
  const filteredSales = sales.filter((sale) => {
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

  // Función para formatear precios (ej.: 10,000.00)
  const formatPrice = (num: number): string => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Calcular flujo de caja para cada negocio
  const calculateBusinessCashFlow = (): BusinessCashFlow[] => {
    const flows: { [key: string]: BusinessCashFlow } = {}
    // Inicializar para cada negocio de la lista
    businesses.forEach((business) => {
      flows[business.id] = {
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
      if (flows[sale.businessId]) {
        flows[sale.businessId].sales += sale.total
        flows[sale.businessId].salesCount += 1

        // Sumar según el método de pago
        if (sale.paymentMethod in flows[sale.businessId].paymentMethods) {
          flows[sale.businessId].paymentMethods[sale.paymentMethod] += sale.total
        }
      }
    })

    // Agregar datos de gastos
    filteredExpenses.forEach((expense) => {
      if (flows[expense.businessId]) {
        flows[expense.businessId].expenses += expense.amount
        flows[expense.businessId].expensesCount += 1
      }
    })

    // Calcular total neto para cada negocio
    Object.values(flows).forEach((flow) => {
      flow.netTotal = flow.sales - flow.expenses
    })

    // Si se ha filtrado por negocio, devolver solo ese flujo
    if (selectedBusinessId !== "all") {
      return Object.values(flows).filter((flow) => flow.businessId === selectedBusinessId)
    }
    return Object.values(flows)
  }

  const businessCashFlows = calculateBusinessCashFlow()

  // Calcular totales globales
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
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Cargando datos de flujo de caja...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="app-title">Flujo de Caja</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Monitorea el flujo de caja de todos los negocios
        </p>
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
            Mostrando datos desde{" "}
            <span className="font-medium">
              {selectedDateRange.start.toLocaleDateString()}
            </span>{" "}
            hasta{" "}
            <span className="font-medium">
              {selectedDateRange.end.toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <div className="app-stat-card">
          <div className="flex justify-between items-start">
            <div>
              <p className="app-stat-title">Ventas Totales</p>
              <p className="app-stat-value text-green-600 dark:text-green-400">
                ${formatPrice(totalSales)}
              </p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="app-stat-description">{filteredSales.length} transacciones</p>
        </div>
      </div>

      {/* Desglose de Métodos de Pago */}
      <div className="app-card">
        <h2 className="app-subtitle mb-4">Desglose por Métodos de Pago</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="payment-method-card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Efectivo</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${formatPrice(totalPaymentMethods.cash)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.cash / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
          <div className="payment-method-card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Tarjetas</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              ${formatPrice(totalPaymentMethods.card)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.card / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
          <div className="payment-method-card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Transferencia</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              ${formatPrice(totalPaymentMethods.transfer)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.transfer / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
          <div className="payment-method-card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Mercadopago</p>
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              ${formatPrice(totalPaymentMethods.mercadopago)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.mercadopago / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
          <div className="payment-method-card">
            <p className="text-sm text-slate-600 dark:text-slate-400">Rappi</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              ${formatPrice(totalPaymentMethods.rappi)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {((totalPaymentMethods.rappi / totalSales) * 100 || 0).toFixed(1)}% del total
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
