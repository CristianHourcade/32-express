"use client"

import { useEffect, useState, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice"
import { getEmployees } from "@/lib/redux/slices/employeeSlice"
import { getProducts } from "@/lib/redux/slices/productSlice"
import { getShifts, getActiveShifts } from "@/lib/redux/slices/shiftSlice"
import { getSales } from "@/lib/redux/slices/salesSlice"
import { getExpenses } from "@/lib/redux/slices/expensesSlice"
import { supabase } from "@/lib/supabase"

export default function AdminDashboard() {
  const dispatch = useDispatch<AppDispatch>()
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)
  const { shifts, loading: shiftsLoading } = useSelector((state: RootState) => state.shifts)
  const { sales, loading: salesLoading } = useSelector((state: RootState) => state.sales)
  const { expenses, loading: expensesLoading } = useSelector((state: RootState) => state.expenses)

  // Estado para la petición directa a la DB (Top Productos)
  const [directSales, setDirectSales] = useState<any[]>([])
  const [directSalesLoading, setDirectSalesLoading] = useState<boolean>(false)
  // Estado para filtrar productos principales por negocio
  const [selectedBusinessForTopProducts, setSelectedBusinessForTopProducts] = useState<string>("")
  // Estado para los productos traídos directamente desde la BD según el negocio seleccionado
  const [dbProducts, setDbProducts] = useState<any[]>([])
  const [dbProductsLoading, setDbProductsLoading] = useState<boolean>(false)
  // Estado para el filtro de fechas (días)
  const [daysFilter, setDaysFilter] = useState<number>(7)

  // Petición para obtener directSales para el negocio seleccionado
  useEffect(() => {
    const fetchDirectSales = async () => {
      if (!selectedBusinessForTopProducts) return

      setDirectSalesLoading(true)
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items (
            *,
            products(name)
          )
        `)
        .eq("business_id", selectedBusinessForTopProducts)
        .order("timestamp", { ascending: false })

      if (error) {
        console.error("Error fetching direct sales:", error)
      } else {
        setDirectSales(data || [])
      }
      setDirectSalesLoading(false)
    }
    fetchDirectSales()
  }, [selectedBusinessForTopProducts])

  // Petición para obtener los productos de la BD filtrados por el negocio seleccionado
  useEffect(() => {
    const fetchProductsForBusiness = async () => {
      if (!selectedBusinessForTopProducts) {
        setDbProducts([])
        return
      }
      setDbProductsLoading(true)
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", selectedBusinessForTopProducts)

      if (error) {
        console.error("Error fetching products:", error)
        setDbProducts([])
      } else {
        setDbProducts(data || [])
      }
      setDbProductsLoading(false)
    }
    fetchProductsForBusiness()
  }, [selectedBusinessForTopProducts])

  useEffect(() => {
    dispatch(fetchBusinesses())
    dispatch(getEmployees())
    dispatch(getProducts())
    dispatch(getShifts())
    dispatch(getActiveShifts())
    dispatch(getSales())
    dispatch(getExpenses())
  }, [dispatch])

  // Función para formatear números de precio (ej.: 100,000.00)
  const formatPrice = (num: number): string => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Obtener el nombre del mes actual en español (ej.: "Abril")
  const currentMonthName = new Date().toLocaleString("es-ES", { month: "long" })
  const monthHeader = `Negocios – Mes ${currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)}`

  // Estados para ordenación en la tabla de Top Productos
  const [sortColumn, setSortColumn] = useState<"salesCount" | "totalRevenue">("salesCount")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")

  // Arreglo de turnos activos, asegurando que shifts sea un array
  const activeShifts = Array.isArray(shifts)
    ? shifts.filter((shift) => shift.active).sort((a, b) => b.sales - a.sales)
    : []

  // ---------------------------------------------------
  // TOP PRODUCTOS: Se agrupan los items usando directSales, dbProducts y el filtro de fechas
  // ---------------------------------------------------
  const topProducts = useMemo(() => {
    // Filtrar las ventas según el rango de días seleccionado
    const now = new Date()
    const filteredSales = directSales.filter((sale) => {
      const saleDate = new Date(sale.timestamp)
      const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24)
      return diffDays <= daysFilter
    })

    const productMap = new Map<
      string,
      {
        productName: string
        businessId: string
        purchasePrice: number
        sellingPrice: number
        totalQuantity: number
        totalRevenue: number
      }
    >()

    // Agrupar los items usando las ventas filtradas
    for (const sale of filteredSales) {
      if (!sale.sale_items) continue
      for (const item of sale.sale_items) {
        // Buscamos el producto en los productos traídos desde la BD para el negocio seleccionado
        const prod = dbProducts.find((p) => p.id === item.product_id)
        if (!prod) continue

        const key = `${item.product_id}-${prod.businessId}`
        if (!productMap.has(key)) {
          productMap.set(key, {
            productName: item.products?.name || "Producto desconocido",
            businessId: prod.businessId,
            purchasePrice: prod.purchasePrice,
            sellingPrice: prod.sellingPrice,
            totalQuantity: 0,
            totalRevenue: 0,
          })
        }
        const data = productMap.get(key)!
        data.totalQuantity += item.quantity
        data.totalRevenue += item.total
      }
    }

    let arr = Array.from(productMap.values())
    arr.sort((a, b) => {
      if (sortColumn === "salesCount") {
        return sortDirection === "asc"
          ? a.totalQuantity - b.totalQuantity
          : b.totalQuantity - a.totalQuantity
      } else if (sortColumn === "totalRevenue") {
        return sortDirection === "asc"
          ? a.totalRevenue - b.totalRevenue
          : b.totalRevenue - a.totalRevenue
      }
      return 0
    })

    return arr.slice(0, 15)
  }, [directSales, dbProducts, sortColumn, sortDirection, daysFilter])

  // ---------------------------------------------------
  // NEGOCIOS CON DATOS DEL MES (Ventas, Gastos, Profit, etc.)
  // ---------------------------------------------------
  const calculateBusinessMonthlyData = () => {
    const businessDataMap = new Map<
      string,
      {
        transactions: number
        totalAmount: number
        totalExpense: number
        profit: number
        paymentMethods: {
          cash: number
          card: number
          transfer: number
          mercadopago: number
          rappi: number
        }
      }
    >()

    // Inicializamos para cada negocio
    businesses.forEach((business) => {
      businessDataMap.set(business.id, {
        transactions: 0,
        totalAmount: 0,
        totalExpense: 0,
        profit: 0,
        paymentMethods: {
          cash: 0,
          card: 0,
          transfer: 0,
          mercadopago: 0,
          rappi: 0,
        },
      })
    })

    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    // Procesar ventas del mes actual
    sales.forEach((sale) => {
      const saleDate = new Date(sale.timestamp)
      if (saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear) {
        const businessData = businessDataMap.get(sale.businessId)
        if (businessData) {
          businessData.transactions += 1
          businessData.totalAmount += sale.total
          if (sale.paymentMethod in businessData.paymentMethods) {
            businessData.paymentMethods[sale.paymentMethod] += sale.total
          }
        }
      }
    })

    // Procesar gastos del mes actual
    expenses.forEach((expense) => {
      const expenseDate = new Date(expense.date)
      if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
        const businessData = businessDataMap.get(expense.businessId)
        if (businessData) {
          businessData.totalExpense += expense.amount
        }
      }
    })

    // Calcular profit y retornar datos para cada negocio
    return businesses.map((business) => {
      const data = businessDataMap.get(business.id) || {
        transactions: 0,
        totalAmount: 0,
        totalExpense: 0,
        profit: 0,
        paymentMethods: {
          cash: 0,
          card: 0,
          transfer: 0,
          mercadopago: 0,
          rappi: 0,
        },
      }
      data.profit = data.totalAmount - data.totalExpense
      return {
        ...business,
        transactions: data.transactions,
        totalAmount: data.totalAmount,
        totalExpense: data.totalExpense,
        profit: data.profit,
        avgTicket: data.transactions > 0 ? data.totalAmount / data.transactions : 0,
        paymentMethods: data.paymentMethods,
      }
    })
  }

  const businessesWithMonthlyData = calculateBusinessMonthlyData()

  // ---------------------------------------------------
  // TURNOS ACTIVOS
  // ---------------------------------------------------
  const calculateShiftTotals = (shift: any) => {
    const shiftSales = sales.filter((sale) => sale.shiftId === shift.id)
    const paymentMethods = {
      cash: 0,
      card: 0,
      transfer: 0,
      mercadopago: 0,
      rappi: 0,
    }
    shiftSales.forEach((sale) => {
      if (sale.paymentMethod in paymentMethods) {
        paymentMethods[sale.paymentMethod] += sale.total
      }
    })
    const totalSales = Object.values(paymentMethods).reduce((sum, val) => sum + val, 0)
    return { paymentMethods, totalSales }
  }

  const isLoading =
    businessesLoading ||
    employeesLoading ||
    productsLoading ||
    shiftsLoading ||
    salesLoading ||
    expensesLoading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Cargando datos del dashboard...
          </p>
        </div>
      </div>
    )
  }

  // Funciones de apoyo para estilos / traducciones
  const translatePaymentMethod = (method: string) => {
    const translations = {
      cash: "Efectivo",
      card: "Tarjetas",
      transfer: "Transferencia",
      mercadopago: "Mercadopago",
      rappi: "Rappi",
    }
    return translations[method] || method
  }

  const getPaymentMethodClass = (method: string) => {
    const classes = {
      cash: "bg-green-100 dark:bg-green-900 p-2 rounded",
      card: "bg-blue-100 dark:bg-blue-900 p-2 rounded",
      transfer: "bg-purple-100 dark:bg-purple-900 p-2 rounded",
      mercadopago: "bg-sky-100 dark:bg-sky-900 p-2 rounded",
      rappi: "bg-orange-100 dark:bg-orange-900 p-2 rounded",
    }
    return classes[method] || "bg-gray-100 dark:bg-gray-700 p-2 rounded"
  }

  // Encabezado ordenable para la tabla de Top Productos
  const SortableHeader = ({
    column,
    label,
  }: {
    column: "salesCount" | "totalRevenue"
    label: string
  }) => (
    <th
      className="table-header-cell cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
      onClick={() => {
        if (sortColumn === column) {
          setSortDirection(sortDirection === "asc" ? "desc" : "asc")
        } else {
          setSortColumn(column)
          setSortDirection("desc")
        }
      }}
    >
      <div className="flex items-center">
        {label}
        {sortColumn === column && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
      </div>
    </th>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Sección de Negocios */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{monthHeader}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {businessesWithMonthlyData.map((business) => (
            <div key={business.id} className="card">
              <h3 className="text-lg font-semibold mb-2">{business.name}</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ventas del Mes</p>
                  <p className="font-medium">{business.transactions}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Monto del Mes</p>
                  <p className="font-medium">${formatPrice(business.totalAmount)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Gasto del Mes</p>
                  <p className="font-medium">${formatPrice(business.totalExpense)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Profit del Mes</p>
                  <p className="font-medium">${formatPrice(business.profit)}</p>
                </div>
              </div>
              <div className="mb-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Ticket Promedio del Mes</p>
                <p className="font-medium">
                  {business.transactions > 0
                    ? `$${formatPrice(business.avgTicket)}`
                    : "0.00"}
                </p>
              </div>
              <div className="mt-3">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Métodos de Pago</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className={getPaymentMethodClass("cash")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Efectivo</p>
                    <p className="font-medium">${formatPrice(business.paymentMethods.cash)}</p>
                  </div>
                  <div className={getPaymentMethodClass("card")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tarjetas</p>
                    <p className="font-medium">${formatPrice(business.paymentMethods.card)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className={getPaymentMethodClass("mercadopago")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mercadopago</p>
                    <p className="font-medium">${formatPrice(business.paymentMethods.mercadopago)}</p>
                  </div>
                  <div className={getPaymentMethodClass("rappi")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Rappi</p>
                    <p className="font-medium">${formatPrice(business.paymentMethods.rappi)}</p>
                  </div>
                  <div className={getPaymentMethodClass("transfer")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Transferencia</p>
                    <p className="font-medium">${formatPrice(business.paymentMethods.transfer)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sección Top Productos */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Productos Principales</h2>
          <div className="flex items-center gap-4">
            <select
              className="input max-w-xs"
              value={selectedBusinessForTopProducts}
              onChange={(e) => {
                setSelectedBusinessForTopProducts(e.target.value)
                // Reiniciamos directSales al cambiar la selección si es necesario
                setDirectSales([])
              }}
            >
              <option value="">Selecciona un negocio</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
            {/* Selector para filtro de fechas */}
            <select
              className="input max-w-xs"
              value={daysFilter}
              onChange={(e) => setDaysFilter(Number(e.target.value))}
            >
              <option value={3}>Últimos 3 días</option>
              <option value={7}>Últimos 7 días</option>
              <option value={14}>Últimos 14 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
          </div>
        </div>
        {selectedBusinessForTopProducts === "" ? (
          <p className="text-gray-500 dark:text-gray-400">
            Por favor, selecciona un negocio para ver los productos principales.
          </p>
        ) : directSalesLoading || dbProductsLoading ? (
          <div className="flex justify-center items-center h-32">
            <p>Cargando productos...</p>
          </div>
        ) : (
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Producto</th>
                    <th className="table-header-cell">Negocio</th>
                    <SortableHeader column="salesCount" label="Unidades Vendidas" />
                    <SortableHeader column="totalRevenue" label="Monto Facturado" />
                  </tr>
                </thead>
                <tbody className="table-body">
                  {topProducts.map((item, idx) => {
                    const business = businesses.find((b) => b.id === item.businessId)
                    return (
                      <tr key={idx} className="table-row">
                        <td className="table-cell font-medium">{item.productName}</td>
                        <td className="table-cell">{business?.name || "Desconocido"}</td>
                        <td className="table-cell">{item.totalQuantity}</td>
                        <td className="table-cell">${formatPrice(item.totalRevenue)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Sección Turnos Activos */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Turnos Activos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeShifts.map((shift) => {
            const shiftTotals = calculateShiftTotals(shift)
            return (
              <div key={shift.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{shift.employeeName}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{shift.businessName}</p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                    Activo
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Iniciado</p>
                    <p className="font-medium">{new Date(shift.startTime).toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ventas</p>
                    <p className="font-medium">{shift.sales}</p>
                  </div>
                  <div className="flex justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
                    <p className="text-sm font-semibold">Venta Total</p>
                    <p className="font-bold text-green-600 dark:text-green-400">
                      ${formatPrice(shiftTotals.totalSales)}
                    </p>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Métodos de Pago</p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className={getPaymentMethodClass("cash")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Efectivo</p>
                        <p className="font-medium">${formatPrice(shiftTotals.paymentMethods.cash)}</p>
                      </div>
                      <div className={getPaymentMethodClass("card")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tarjetas</p>
                        <p className="font-medium">${formatPrice(shiftTotals.paymentMethods.card)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className={getPaymentMethodClass("mercadopago")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Mercadopago</p>
                        <p className="font-medium">${formatPrice(shiftTotals.paymentMethods.mercadopago)}</p>
                      </div>
                      <div className={getPaymentMethodClass("rappi")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Rappi</p>
                        <p className="font-medium">${formatPrice(shiftTotals.paymentMethods.rappi)}</p>
                      </div>
                      <div className={getPaymentMethodClass("transfer")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Transferencia</p>
                        <p className="font-medium">${formatPrice(shiftTotals.paymentMethods.transfer)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {activeShifts.length === 0 && (
            <div className="col-span-full">
              <p className="text-gray-500 dark:text-gray-400">No hay turnos activos en este momento.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
