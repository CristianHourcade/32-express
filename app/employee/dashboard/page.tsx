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
import { supabase } from "@/lib/supabase";
import LoadingSpinner from "@/components/LoadingSpinner"
import RankingCard from "./card"
export interface ShiftPayload {
  employeeId: string;
  businessId: string;
  start_cash: number;
}

export interface EndShiftPayload {
  shiftId: string;
  end_cash: number;
}
interface SaleItem {
  quantity: number
  total: number
  stock: number | null
  product_id: string
  products: { name: string }
}

interface Sale {
  id: string
  shift_id: string
  timestamp: string
  total: number
  payment_method: string
  sale_items: SaleItem[]
}

/* ========= FETCH HELPERS ========= */
async function fetchAllPaginated(
  queryFn: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const pageSize = 1000;
  let page = 0;
  let acc: any[] = [];
  for (; ;) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryFn(from, to);
    if (error) {
      console.error(error);
      break;
    }
    if (!data?.length) break;
    acc = acc.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return acc;
}
const loadSalesPaginated = async (businessId: string, from: Date, to: Date) =>
  fetchAllPaginated((lo, hi) =>
    supabase
      .from("sales")
      .select("*")
      .eq("business_id", businessId)
      .gte("timestamp", from.toISOString())
      .lt("timestamp", to.toISOString())
      .range(lo, hi)
  );
export async function startShift({ employeeId, businessId, start_cash }: ShiftPayload) {
  const { data, error } = await supabase
    .from("shifts")
    .insert([{ employee_id: employeeId, business_id: businessId, start_cash }])
    .select()            // para devolver el registro insertado
    .single();

  if (error) throw error;
  return data;
}

export async function endShift({ shiftId, end_cash }: EndShiftPayload) {
  const { data, error } = await supabase
    .from("shifts")
    .update({ end_cash, end_time: new Date().toISOString() })
    .eq("id", shiftId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
const logger = createModuleLogger("employeeDashboard")

export default function EmployeeDashboard() {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)
  const [activeSales, setActiveSales] = useState<Sale[]>([])
  const [loadingSales, setLoadingSales] = useState(false)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)
  const [shifts, setShifts] = useState<any>([])
  const [loadingShifts, setLoadingShifts] = useState(false)
  const { employees, loading: employeesLoading } = useSelector((state: RootState) => state.employees)
  const [showStartShiftModal, setShowStartShiftModal] = useState(false)
  const [startCashInput, setStartCashInput] = useState("")
  const [showEndShiftModal, setShowEndShiftModal] = useState(false)
  const [endCashInput, setEndCashInput] = useState("")
  const [isStartingShift, setIsStartingShift] = useState(false)
  const [isEndingShift, setIsEndingShift] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [activePromos, setActivePromos] = useState<any[]>([])

  useEffect(() => {
    const fetchPromos = async () => {
      const { data: promosRaw, error: promosError } = await supabase
        .from("promos")
        .select("*, promo_items (product_id, quantity)")
        .eq("is_active", true);

      if (promosError) {
        console.error("Error al cargar promociones:", promosError)
        return;
      }

      setActivePromos(promosRaw || [])
    }

    fetchPromos()
  }, [])

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
    dispatch(getProducts())
    dispatch(fetchBusinesses())
    dispatch(getEmployees())
  }, [dispatch])

  // Usar directamente el businessId del usuario
  const businessId = user?.businessId

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

  const fetchShifts = async () => {
    if (!currentEmployee) return
    setLoadingShifts(true)
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("employee_id", currentEmployee.id)  // filtra solo tu empleado
      .order("start_time", { ascending: false })
    setLoadingShifts(false)

    if (error) {
      console.error("Error al cargar shifts:", error)
      return
    }
    setShifts(data)
  }
  useEffect(() => {
    fetchShifts()
  }, [currentEmployee])
  // Filter data based on the employee's business
  const businessProducts = useMemo(
    () => products.filter((product) => product.businessId === businessId),
    [products, businessId],
  )

  const employeeSales = useMemo(() => {
    if (!currentEmployee) return []
    return activeSales.filter((sale) => sale.employeeId === currentEmployee.id)
  }, [activeSales, currentEmployee])

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

  function esDelMesActual(fecha: Date) {
    const ahora = new Date()
    return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear()
  }

  function calcularMinutosTarde(shifts: any[]) {
    return shifts.reduce((total, shift) => {
      const start = new Date(shift.start_time)

      if (!esDelMesActual(start)) return total

      const esperado = new Date(start)
      esperado.setHours(10, 0, 0, 0)

      const diferenciaMin = (start.getTime() - esperado.getTime()) / 60000
      return diferenciaMin > 0 ? total + diferenciaMin : total
    }, 0)
  }
  function calcularMinutosTardeTurnoActual(turno: any) {
    if (!turno) return 0

    const start = new Date(turno.start_time)
    const esperado = new Date(start)
    esperado.setHours(10, 0, 0, 0)

    const diferenciaMin = (start.getTime() - esperado.getTime()) / 60000
    return diferenciaMin > 0 ? Math.round(diferenciaMin) : 0
  }


  // Get active shift
  const activeShift = shifts.find(s => !s.end_time)
  const totalMinutosTarde = useMemo(() => calcularMinutosTarde(shifts), [shifts])
  const minutosTardeTurnoActual = useMemo(() => calcularMinutosTardeTurnoActual(activeShift), [activeShift])

  // Get sales for active shift
  const activeShiftSales = useMemo(() => {
    if (!activeShift) return [];
    return activeSales
      .filter(sale => sale.shift_id === activeShift.id)          // usar shift_id
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activeSales, activeShift]);
  useEffect(() => {
    if (!activeShift) {
      setActiveSales([])
      return
    }

    const fetchActiveShiftSales = async () => {
      setLoadingSales(true)
      const { data, error } = await supabase
        .from("sales")
        .select(`
    id,
    shift_id,
    timestamp,
    total,
    payment_method,
    sale_items (
      quantity,
      total,
      stock,
      product_master_id,
      product_id,
      promotion_id,
      promotion:promos!promotion_id (
        name
      ),
      products_master:products_master!product_master_id (
        name
      ),
      products:products!product_id (
        name
      )
    )
  `)
        .eq("shift_id", activeShift.id)
        .order("timestamp", { ascending: false });



      setLoadingSales(false)
      if (error) {
        console.error("Error cargando ventas del turno activo:", error)
        return
      }
      setActiveSales(data || [])
    }

    fetchActiveShiftSales()
  }, [activeShift])
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
    const bd: Record<string, number> = { cash: 0, card: 0, transfer: 0, mercadopago: 0, rappi: 0 }
    activeSales.forEach(s => {
      bd[s.payment_method] = (bd[s.payment_method] || 0) + s.total
    })
    return bd
  }, [activeSales])

  const handleStartShift = async (startCash: number) => {
    if (!user?.id) return
    if (!businessId) return
    if (!currentEmployee) return

    setError(null)
    setIsStartingShift(true)
    try {
      logger.info("Iniciando turno", {
        employeeId: currentEmployee.id,
        businessId,
        userId: user.id,
      })

      const result = await startShift({
        employeeId: currentEmployee.id,
        businessId,
        start_cash: startCash,
      })

      logger.info("Turno iniciado con éxito", {
        shiftId: result.id,
        employeeId: currentEmployee.id,
        businessId,
      })

      await fetchShifts()

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al iniciar turno"
      logger.error("Error al iniciar turno", { error: errorMsg })
      setError(errorMsg)
    } finally {
      setIsStartingShift(false)
    }
  }

  const [selectedMethod, setSelectedMethod] = useState('Todos');

  const handleEndShift = async (endCash: number) => {
    if (!activeShift) return

    setIsEndingShift(true)
    try {
      logger.info("Finalizando turno", { shiftId: activeShift.id })

      await endShift({
        shiftId: activeShift.id,
        end_cash: endCash,
      })

      logger.info("Turno finalizado con éxito", { shiftId: activeShift.id })

      await fetchShifts()

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al finalizar turno"
      logger.error("Error al finalizar turno", { error: errorMsg })
      setError(errorMsg)
    } finally {
      setIsEndingShift(false)
    }
  }


  const [monthlySales, setMonthlySales] = useState<Sale[]>([])
  useEffect(() => {
    const fetchMonthlySales = async () => {
      if (!businesses.length) return;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      let allSales: Sale[] = [];

      for (const business of businesses) {
        const data = await loadSalesPaginated(business.id, startOfMonth, endOfMonth);
        allSales.push(...(data as Sale[]));
      }

      setMonthlySales(allSales);
    };

    fetchMonthlySales();
  }, [businesses]);

  const businessRanking = useMemo(() => {
    const rankingMap = new Map<string, number>()

    monthlySales.forEach(sale => {
      const businessId = sale.business_id
      if (!businessId) return
      rankingMap.set(businessId, (rankingMap.get(businessId) || 0) + Number(sale.total))
    })


    const sorted = [...rankingMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([businessId]) => businesses.find(b => b.id === businessId))
      .filter((b): b is { id: string; name: string } => !!b)

    return sorted
  }, [monthlySales, businesses])

  const [isMobileDevice, setIsMobileDevice] = useState(false);
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera
    const isMobile = /android|iphone|ipad|mobile/i.test(userAgent)
    setIsMobileDevice(isMobile)
  }, [])


  const isLoading = productsLoading || loadingSales || loadingShifts || businessesLoading || employeesLoading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <LoadingSpinner />
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
    <div className="space-y-12">

      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-300 mb-1">Panel de Empleado</h1>
          <p className="text-gray-700 dark:text-gray-400 text-lg">¡Hola, {user?.name}!</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ⏱️ Llegadas tarde este mes: <strong>{Math.round(totalMinutosTarde)} min</strong>
          </p>
          {activeShift && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              Hoy llegaste <strong>{minutosTardeTurnoActual} minutos tarde</strong>
            </p>
          )}
        </div>
        <div className="mt-4 md:mt-0 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">📍 Negocio Asignado</p>
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-indigo-500" />
            <p className="font-semibold text-gray-800 dark:text-white">
              {currentBusiness?.name || <span className="text-amber-600">No asignado</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Ranking */}
      {businessRanking.length > 0 && (
        <RankingCard
          businesses={businesses}
          currentBusinessId={currentBusiness?.id}
          monthlySales={monthlySales}
        />
      )}

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

      {/* Estado del Turno */}
      <div className="bg-gradient-to-r from-white to-indigo-50 dark:from-gray-800 dark:to-indigo-900 rounded-2xl shadow-md p-6 border border-indigo-100 dark:border-indigo-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-full transition-all duration-300 ${activeShift ? "bg-green-200 dark:bg-green-900/30" : "bg-gray-200 dark:bg-gray-700/30"}`}
            >
              <Clock
                className={`h-7 w-7 ${activeShift ? "text-green-700 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold">Estado del Turno</h2>
              <p
                className={`text-sm ${activeShift ? "text-green-700 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}
              >
                {activeShift ? "✅ Turno Activo" : "⏸️ Sin Turno Activo"}
              </p>
              {activeShift && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Iniciado: {new Date(activeShift.start_time).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div>
            {activeShift ? (
              <button onClick={() => setShowEndShiftModal(true)} disabled={isEndingShift} className="btn btn-danger">
                {isEndingShift ? "Finalizando..." : "Finalizar Turno"}
              </button>
            ) : (
              <button
                onClick={() => setShowStartShiftModal(true)}
                disabled={isStartingShift || !businessId || !currentEmployee || isMobileDevice}
                className={`btn ${!businessId || !currentEmployee || isMobileDevice ? "btn-disabled" : "btn-success"}`}
                title={
                  !businessId
                    ? "Necesitás tener un negocio asignado"
                    : !currentEmployee
                      ? "No se encontró tu registro de empleado"
                      : isMobileDevice
                        ? "No podés iniciar turno desde el celular"
                        : ""
                }
              >
                {isStartingShift ? "Iniciando..." : "Iniciar Turno"}
              </button>

            )}
          </div>
        </div>
      </div>

      {/* Active Shift Sales */}
      {activeShift && (
        <div className="space-y-4 mb-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">📊 Ventas del Turno Actual</h2>
            <div className="text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 px-3 py-1 rounded-full shadow">
              Total: <span className="font-semibold">{formatCurrency(activeShiftSales.reduce((sum, sale) => sum + sale.total, 0))}</span>
            </div>
          </div>
          {/* Payment Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {['Todos', 'Efectivo', 'Tarjeta', 'Transferencia', 'Rappi'].map((method) => (
              <button
                key={method}
                onClick={() => setSelectedMethod(method)}
                className={`text-sm px-3 py-1 rounded-full font-medium border transition-all shadow-sm ${selectedMethod === method
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-indigo-100 dark:hover:bg-gray-600'
                  }`}
              >
                {method}
              </button>
            ))}
          </div>
          {/* Payment Method Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-green-200 dark:border-green-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Efectivo</p>
              <p className="text-2xl font-extrabold text-green-600 dark:text-green-400">
                {formatCurrency(paymentMethodBreakdown.cash)}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Tarjeta</p>
              <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                {formatCurrency(paymentMethodBreakdown.card)}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-purple-200 dark:border-purple-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Transferencia</p>
              <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                {formatCurrency(paymentMethodBreakdown.transfer)}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-orange-200 dark:border-orange-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Rappi</p>
              <p className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">
                {formatCurrency(paymentMethodBreakdown.rappi)}
              </p>
            </div>
          </div>

          {/* Sales List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-700">
              <h3 className="font-semibold text-indigo-800 dark:text-indigo-300">📋 Listado de Ventas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Productos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Método de Pago
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {(selectedMethod === 'Todos'
                    ? activeShiftSales
                    : activeShiftSales.filter((sale) => translatePaymentMethod(sale.payment_method) === selectedMethod)
                  ).map((sale) => (
                    <tr key={sale.id} className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(sale.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <ul className="space-y-1">
                          {sale.sale_items.map((item, i) => {
                            const isPromo = !!item.promotion?.name;

                            const name = item.promotion?.name ?? item.products_master?.name ?? item.products?.name ?? "–";

                            return (
                              <li key={i} className="text-xs flex items-center gap-2">
                                {isPromo && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                    PROMO
                                  </span>
                                )}
                                <span>{item.quantity}× {name} – {formatCurrency(item.total)}</span>
                              </li>
                            );
                          })}
                        </ul>


                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getPaymentMethodClass(sale.paymentMethod)}`}>
                          {translatePaymentMethod(sale.payment_method)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(sale.total)}
                      </td>
                    </tr>
                  ))}
                  {activeShiftSales.length === 0 && (
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
          {/* Sale list end */}
        </div>
      )}
      {showStartShiftModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">¿Con cuánto abrís la caja?</h2>
            <input
              type="number"
              inputMode="decimal"
              className="input w-full mb-4"
              placeholder="$0.00"
              value={startCashInput}
              onChange={(e) => setStartCashInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="btn"
                onClick={() => {
                  setShowStartShiftModal(false)
                  setStartCashInput("")
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-success"
                onClick={() => {
                  setShowStartShiftModal(false)
                  handleStartShift(parseFloat(startCashInput) || 0)
                  setStartCashInput("")
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {showEndShiftModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">¿Con cuánto cerrás la caja?</h2>
            <input
              type="number"
              inputMode="decimal"
              className="input w-full mb-4"
              placeholder="$0.00"
              value={endCashInput}
              onChange={(e) => setEndCashInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="btn"
                onClick={() => {
                  setShowEndShiftModal(false)
                  setEndCashInput("")
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setShowEndShiftModal(false)
                  handleEndShift(parseFloat(endCashInput) || 0)
                  setEndCashInput("")
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

