"use client"

import { useEffect, useState, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice"
import { getEmployees } from "@/lib/redux/slices/employeeSlice"
import { getProducts } from "@/lib/redux/slices/productSlice"
import { getShifts, getActiveShifts } from "@/lib/redux/slices/shiftSlice"
import { getSales } from "@/lib/redux/slices/salesSlice"

export default function AdminDashboard() {
  const dispatch = useDispatch<AppDispatch>()
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)
  const { shifts, loading: shiftsLoading } = useSelector((state: RootState) => state.shifts)
  const { sales, loading: salesLoading } = useSelector((state: RootState) => state.sales)

  // Estados para ordenación en la tabla de Productos Principales
  const [sortColumn, setSortColumn] = useState<"salesCount" | "totalRevenue">("salesCount")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  // Estado para filtrar productos principales por negocio
  const [selectedBusinessForTopProducts, setSelectedBusinessForTopProducts] = useState<string>("")

  useEffect(() => {
    dispatch(fetchBusinesses())
    dispatch(getEmployees())
    dispatch(getProducts())
    dispatch(getShifts())
    dispatch(getActiveShifts()) // Obtener turnos activos
    dispatch(getSales())       // Cargar ventas
  }, [dispatch])

  // Calcular productos con stock bajo (solo para la alerta)
  const lowStockProducts = products.filter((product) => product.stock <= product.minStock).slice(0, 20)

  // Ordenar turnos activos por cantidad de ventas (campo shift.sales, si lo manejas)
  const activeShifts = shifts.filter((shift) => shift.active).sort((a, b) => b.sales - a.sales)

  // --------------------------------------------
  // LÓGICA PARA ACUMULAR PRODUCTOS MÁS VENDIDOS
  // --------------------------------------------
  const topProducts = useMemo(() => {
    // Mapa para acumular info: productId => { ...datos acumulados... }
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

    // Filtrar ventas si se selecciona un negocio
    const relevantSales = selectedBusinessForTopProducts
      ? sales.filter((sale) => sale.businessId === selectedBusinessForTopProducts)
      : sales

    // Recorrer las ventas y sus items para acumular
    for (const sale of relevantSales) {
      for (const item of sale.items) {
        // Buscar el producto en el store de products
        const prod = products.find((p) => p.id === item.productId)
        if (!prod) continue

        // Si no existe en el mapa, lo inicializamos
        if (!productMap.has(item.productId)) {
          productMap.set(item.productId, {
            productName: item.productName,
            businessId: prod.businessId,
            purchasePrice: prod.purchasePrice,
            sellingPrice: prod.sellingPrice,
            totalQuantity: 0,
            totalRevenue: 0,
          })
        }
        const data = productMap.get(item.productId)!
        data.totalQuantity += item.quantity
        data.totalRevenue += item.total
      }
    }

    // Convertir el mapa a array para poder ordenarlo
    let arr = Array.from(productMap.values())

    // Ordenar según la columna y dirección seleccionadas
    arr.sort((a, b) => {
      if (sortColumn === "salesCount") {
        return sortDirection === "asc" ? a.totalQuantity - b.totalQuantity : b.totalQuantity - a.totalQuantity
      } else if (sortColumn === "totalRevenue") {
        return sortDirection === "asc" ? a.totalRevenue - b.totalRevenue : b.totalRevenue - a.totalRevenue
      }
      return 0
    })

    // Tomar solo los 10 primeros
    const top10 = arr.slice(0, 10)

    // Debug en consola
    console.log("🔍 [AdminDashboard] topProducts calculados a partir de sales:", top10)
    return top10
  }, [sales, products, selectedBusinessForTopProducts, sortColumn, sortDirection])

  // --------------------------------------------
  // LÓGICA PARA NEGOCIOS CON SUS VENTAS
  // --------------------------------------------
  const calculateBusinessSales = () => {
    // Mapa para almacenar las ventas por negocio
    const businessSalesMap = new Map<
      string,
      {
        todaySales: number
        totalAmount: number
        paymentMethods: {
          [key: string]: number
        }
      }
    >()

    // Inicializar con los negocios existentes
    businesses.forEach((business) => {
      businessSalesMap.set(business.id, {
        todaySales: 0,
        totalAmount: 0,
        paymentMethods: {
          cash: 0,
          card: 0,
          transfer: 0,
          mercadopago: 0,
          rappi: 0,
        },
      })
    })

    // Procesar las ventas
    sales.forEach((sale) => {
      const businessData = businessSalesMap.get(sale.businessId)
      if (businessData) {
        // Verificar si la venta es de hoy
        const saleDate = new Date(sale.timestamp)
        const today = new Date()
        const isToday =
          saleDate.getDate() === today.getDate() &&
          saleDate.getMonth() === today.getMonth() &&
          saleDate.getFullYear() === today.getFullYear()

        if (isToday) {
          businessData.todaySales++
        }

        businessData.totalAmount += sale.total

        // Actualizar método de pago
        if (sale.paymentMethod in businessData.paymentMethods) {
          businessData.paymentMethods[sale.paymentMethod] += sale.total
        }
      }
    })

    // Retornar un array de negocios con sus stats
    return businesses.map((business) => {
      const data = businessSalesMap.get(business.id) || {
        todaySales: 0,
        totalAmount: 0,
        paymentMethods: {
          cash: 0,
          card: 0,
          transfer: 0,
          mercadopago: 0,
          rappi: 0,
        },
      }
      return {
        ...business,
        todaySales: data.todaySales,
        totalAmount: data.totalAmount,
        paymentMethods: data.paymentMethods,
      }
    })
  }

  const businessesWithSales = calculateBusinessSales()

  // --------------------------------------------
  // LÓGICA PARA TURNOS ACTIVOS (ejemplo)
  // --------------------------------------------
  const calculateShiftTotals = (shift: any) => {
    // Filtrar las ventas de este turno
    const shiftSales = sales.filter((sale) => sale.shiftId === shift.id)

    // Inicializar los métodos de pago
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

  // Verificar si está cargando
  const isLoading =
    businessesLoading || employeesLoading || productsLoading || shiftsLoading || salesLoading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Cargando datos del dashboard...</p>
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

  // Encabezado ordenable
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

  // --------------------------------------------
  // RENDER
  // --------------------------------------------
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Negocios */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Negocios</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {businessesWithSales.map((business) => (
            <div key={business.id} className="card">
              <h3 className="text-lg font-semibold mb-2">{business.name}</h3>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ventas de Hoy</p>
                  <p className="font-medium">{business.todaySales}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Monto Total</p>
                  <p className="font-medium">${business.totalAmount.toFixed(2)}</p>
                </div>
              </div>
              <div className="mb-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Ticket Promedio</p>
                <p className="font-medium">
                  {business.todaySales > 0
                    ? `$${(business.totalAmount / business.todaySales).toFixed(2)}`
                    : "0.00"}
                </p>
              </div>
              <div className="mt-3">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Métodos de Pago</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className={getPaymentMethodClass("cash")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Efectivo</p>
                    <p className="font-medium">${business.paymentMethods.cash.toFixed(2)}</p>
                  </div>
                  <div className={getPaymentMethodClass("card")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tarjetas</p>
                    <p className="font-medium">${business.paymentMethods.card.toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className={getPaymentMethodClass("mercadopago")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mercadopago</p>
                    <p className="font-medium">${business.paymentMethods.mercadopago.toFixed(2)}</p>
                  </div>
                  <div className={getPaymentMethodClass("rappi")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Rappi</p>
                    <p className="font-medium">${business.paymentMethods.rappi.toFixed(2)}</p>
                  </div>
                  <div className={getPaymentMethodClass("transfer")}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Transferencia</p>
                    <p className="font-medium">${business.paymentMethods.transfer.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas de Stock */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          {lowStockProducts.length > 0 && (
            <span className="bg-red-100 text-red-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">
              ¡Atención!
            </span>
          )}
          Alertas de Stock
        </h2>
        <div className={`card ${lowStockProducts.length > 0 ? "border-l-4 border-l-red-500" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Productos con Stock Bajo</h3>
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">
              {lowStockProducts.length} productos
            </span>
          </div>
          {lowStockProducts.length > 0 ? (
            <>
              <div className="table-container">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell">Producto</th>
                      <th className="table-header-cell">Negocio</th>
                      <th className="table-header-cell">Stock Actual</th>
                      <th className="table-header-cell">Stock Mínimo</th>
                      <th className="table-header-cell">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {lowStockProducts.map((product) => {
                      const business = businesses.find((b) => b.id === product.businessId)
                      const stockDifference = product.minStock - product.stock
                      const stockPercentage = (product.stock / product.minStock) * 100

                      return (
                        <tr key={product.id} className="table-row">
                          <td className="table-cell font-medium">{product.name}</td>
                          <td className="table-cell">{business?.name || "Desconocido"}</td>
                          <td className="table-cell text-red-600 dark:text-red-400 font-medium">
                            {product.stock}
                          </td>
                          <td className="table-cell">{product.minStock}</td>
                          <td className="table-cell">
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2 dark:bg-gray-700">
                                <div
                                  className="bg-red-600 h-2.5 rounded-full dark:bg-red-500"
                                  style={{ width: `${stockPercentage}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                Faltan {stockDifference}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>Acción requerida:</strong> Estos productos necesitan reabastecimiento inmediato para mantener
                  el inventario en niveles óptimos.
                </p>
              </div>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No hay productos con stock bajo en este momento.</p>
          )}
        </div>
      </div>

      {/* Productos Principales (ahora basados en la data de las ventas) */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Productos Principales</h2>
          {/* Select para filtrar por negocio */}
          <select
            className="input max-w-xs"
            value={selectedBusinessForTopProducts}
            onChange={(e) => setSelectedBusinessForTopProducts(e.target.value)}
          >
            <option value="">Todos los negocios</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
        </div>
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Producto</th>
                  <th className="table-header-cell">Negocio</th>
                  <SortableHeader column="salesCount" label="Cantidad Vendida" />
                  <SortableHeader column="totalRevenue" label="Ventas Recaudadas" />
                  <th className="table-header-cell">Margen de Ganancia</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {topProducts.map((item, idx) => {
                  const business = businesses.find((b) => b.id === item.businessId)
                  // Calcular margen de ganancia
                  let marginPercentage = 0
                  if (item.purchasePrice > 0) {
                    marginPercentage =
                      ((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100
                  }
                  return (
                    <tr key={idx} className="table-row">
                      <td className="table-cell font-medium">{item.productName}</td>
                      <td className="table-cell">{business?.name || "Desconocido"}</td>
                      <td className="table-cell">{item.totalQuantity}</td>
                      <td className="table-cell">${item.totalRevenue.toFixed(2)}</td>
                      <td className="table-cell">{marginPercentage.toFixed(2)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Turnos Activos */}
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
                      ${shiftTotals.totalSales.toFixed(2)}
                    </p>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Métodos de Pago</p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className={getPaymentMethodClass("cash")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Efectivo</p>
                        <p className="font-medium">${shiftTotals.paymentMethods.cash.toFixed(2)}</p>
                      </div>
                      <div className={getPaymentMethodClass("card")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tarjetas</p>
                        <p className="font-medium">${shiftTotals.paymentMethods.card.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className={getPaymentMethodClass("mercadopago")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Mercadopago</p>
                        <p className="font-medium">
                          ${shiftTotals.paymentMethods.mercadopago.toFixed(2)}
                        </p>
                      </div>
                      <div className={getPaymentMethodClass("rappi")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Rappi</p>
                        <p className="font-medium">${shiftTotals.paymentMethods.rappi.toFixed(2)}</p>
                      </div>
                      <div className={getPaymentMethodClass("transfer")}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Transferencia</p>
                        <p className="font-medium">
                          ${shiftTotals.paymentMethods.transfer.toFixed(2)}
                        </p>
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
