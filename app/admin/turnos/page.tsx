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
  function monthRange(offset = 0) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1, 0, 0, 0);
    const end   = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0);
    return { start, end };
  }
  const [monthOffset, setMonthOffset] = useState(0);
const { start: monthStart, end: monthEnd } = monthRange(monthOffset);
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

  /* ═════════ START RETURN UI ═════════ */
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Turnos</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Control de turnos y ventas por empleado
          </p>
        </div>

        <div className="flex gap-3">
          <select
            value={selectedBusinessId}
            onChange={handleBusinessChange}
            className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos los negocios</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* search aún sin lógica */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              disabled
              placeholder="Buscar…"
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full pl-9 pr-3 py-1.5 text-xs shadow-sm cursor-not-allowed"
            />
          </div>
        </div>
      </header>

      {/* ───────── Tabla ───────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-700/70 backdrop-blur sticky top-0 z-10 text-[11px] uppercase tracking-wide">
              <tr>
                {[
                  "Empleado",
                  "Negocio",
                  "Inicio",
                  "Fin",
                  "Estado",
                  "Ventas",
                  "Total",
                  " ",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedShifts.length ? (
                sortedShifts.map((sh) => {
                  const shiftSales = getShiftSales(sh.id);
                  const total = shiftSales.reduce((s, v) => s + v.total, 0);
                  return (
                    <tr
                      key={sh.id}
                      className="border-l-4 border-transparent hover:border-sky-500 even:bg-slate-50/60 dark:even:bg-slate-800/30"
                    >
                      <td className="px-4 py-2 whitespace-nowrap font-medium">
                        {sh.employeeName}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{sh.businessName}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {new Date(sh.startTime).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {sh.endTime ? new Date(sh.endTime).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${sh.active
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                            }`}
                        >
                          {sh.active ? "Activo" : "Completado"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">{sh.sales}</td>
                      <td className="px-4 py-2 font-semibold text-emerald-600 dark:text-emerald-400">
                        ${formatPrice(total)}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => openDetailsModal(sh)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <FileText className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    No se encontraron turnos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───────── Modal detalles ───────── */}
      {isDetailsModalOpen && selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 animate-scale-in">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-semibold">Detalles del turno</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedShift.employeeName} — {selectedShift.businessName}
                </p>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>

            {/* Body */}
            <div className="px-6 py-6 space-y-8">
              {/* Info grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Info label="Inicio" value={new Date(selectedShift.startTime).toLocaleString()} />
                <Info
                  label="Fin"
                  value={
                    selectedShift.endTime
                      ? new Date(selectedShift.endTime).toLocaleString()
                      : "Aún activo"
                  }
                />
                <Info
                  label="Estado"
                  value={
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${selectedShift.active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                    >
                      {selectedShift.active ? "Activo" : "Completado"}
                    </span>
                  }
                />
                <Info label="Ventas" value={selectedShift.sales} />
              </div>

              {/* Métodos de pago (fusión transfer + MP) */}
              {(() => {
                const shiftSales = getShiftSales(selectedShift.id);
                const totals = shiftSales.reduce(
                  (acc, s) => {
                    const k =
                      s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod;
                    acc[k] = (acc[k] || 0) + s.total;
                    return acc;
                  },
                  {} as Record<string, number>
                );

                type Tile = { key: string; label: string; cls: string };
                const tiles: Tile[] = [
                  { key: "cash", label: "Efectivo", cls: "bg-emerald" },
                  { key: "card", label: "Tarjeta", cls: "bg-indigo" },
                  { key: "transfer", label: "Transferencia", cls: "bg-purple dark:bg-emerald" },
                  { key: "rappi", label: "Rappi", cls: "bg-orange" },
                ];

                return (
                  <section>
                    <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide">
                      Métodos de pago
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {tiles.map(({ key, label, cls }) => (
                        <div
                          key={key}
                          className={`${cls}-100 dark:${cls}-900/40 rounded p-3`}
                        >
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {label}
                          </p>
                          <p className="font-medium">
                            ${formatPrice(totals[key] || 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })()}

              {/* Ventas tabla */}
              <section>
                <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide">
                  Ventas del turno
                </h3>
                {getShiftSales(selectedShift.id).length ? (
                  <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-700/70">
                        <tr>
                          {["Hora", "Detalle", "Método", "Total"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getShiftSales(selectedShift.id).map((s) => (
                          <tr key={s.id} className="even:bg-slate-50/60 dark:even:bg-slate-800/30">
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              {new Date(s.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-3 py-1.5">
                              {s.items.map((it, i) => (
                                <div key={i}>
                                  {it.quantity}× {it.productName} – $
                                  {formatPrice(it.total)}
                                </div>
                              ))}
                            </td>
                            <td className="px-3 py-1.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${getPaymentMethodClass(
                                  s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod
                                )}`}
                              >
                                {translatePaymentMethod(
                                  s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 font-medium">
                              ${formatPrice(s.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-600 dark:text-slate-400">
                    Sin ventas registradas.
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* Helper componente */
  function Info({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    );
  }
  /* ═════════ END RETURN UI ═════════ */

}
