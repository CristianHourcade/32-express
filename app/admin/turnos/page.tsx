"use client";

import type React from "react";
import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import { getShifts, type Shift } from "@/lib/redux/slices/shiftSlice";
import { getEmployees } from "@/lib/redux/slices/employeeSlice";
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice";
import { getSales } from "@/lib/redux/slices/salesSlice";
import { FileText, Search } from "lucide-react";

/* ───────── helpers de fecha ───────── */
function monthRange(offset = 0) {
  // hoy (hora local)
  const today = new Date();

  // inicio del mes en hora **local**
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1, 0, 0, 0, 0);

  // fin exclusivo (primer día del mes siguiente, hora local)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);

  return { start, end };
}

/* ───────── formatting ───────── */
const formatPrice = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ShiftsPage() {
  const dispatch = useDispatch<AppDispatch>();

  /* ─── redux state ─── */
  const { shifts, loading: shiftsLoading } = useSelector((s: RootState) => s.shifts);
  const { employees, loading: employeesLoading } = useSelector((s: RootState) => s.employees);
  const { businesses, loading: businessesLoading } = useSelector((s: RootState) => s.businesses);
  const { sales, loading: salesLoading } = useSelector((s: RootState) => s.sales);

  /* ─── local state ─── */
  const [selectedBusinessId, setSelectedBusinessId] = useState("all");
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  /* paginación por mes */
  const [monthOffset, setMonthOffset] = useState(0);
  const { start: monthStart, end: monthEnd } = useMemo(() => monthRange(monthOffset), [monthOffset]);
  const monthLabel = monthStart.toLocaleString("es-ES", { month: "long", year: "numeric" });

  /* ─── fetch ─── */
  useEffect(() => {
    // empleados/negocios se traen una sola vez
    if (!employees.length) dispatch(getEmployees());
    if (!businesses.length) dispatch(fetchBusinesses());
  }, [dispatch, employees.length, businesses.length]);

  useEffect(() => {
    /* cada vez que cambia el mes traemos turnos y ventas del rango */
    dispatch(
      getShifts({
        from: monthStart.toISOString(),
        to: monthEnd.toISOString(),
      })
    );
    dispatch(
      getSales({
        from: monthStart.toISOString(),
        to: monthEnd.toISOString(),
      })
    );
  }, [dispatch, monthStart, monthEnd]);

  /* ─── helpers ─── */
  const handleBusinessChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setSelectedBusinessId(e.target.value);

  const openDetailsModal = (shift: Shift) => {
    setSelectedShift(shift);
    setIsDetailsModalOpen(true);
  };

  const translatePaymentMethod = (m: string) =>
    ({ cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia", rappi: "Rappi" } as const)[
    m
    ] || m;

  const getPaymentMethodClass = (m: string) =>
  ({
    cash: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    card: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    transfer: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    rappi: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  }[m] || "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300");

  const isLoading = shiftsLoading || employeesLoading || businessesLoading || salesLoading;

  /* ─── filtros y ordenación ─── */
  const monthShifts = useMemo(
    () =>
      shifts.filter(
        (sh) =>
          new Date(sh.startTime) >= monthStart && new Date(sh.startTime) < monthEnd
      ),
    [shifts, monthStart, monthEnd]
  );
  const monthSales = useMemo(
    () =>
      sales.filter(
        (s) => new Date(s.timestamp) >= monthStart && new Date(s.timestamp) < monthEnd
      ),
    [sales, monthStart, monthEnd]
  );

  const filteredShifts =
    selectedBusinessId === "all"
      ? monthShifts
      : monthShifts.filter((sh) => sh.businessId === selectedBusinessId);

  const sortedShifts = [...filteredShifts].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  const getShiftSales = (shiftId: string) => monthSales.filter((s) => s.shiftId === shiftId);

  /* ─── loading splash ─── */
  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
        <p className="text-slate-600 dark:text-slate-400 uppercase">Cargando turnos…</p>
      </div>
    );

  /* ───────────────────────────────── RETURN ───────────────────────────────── */
  return (
    <div className="space-y-8">
      {/* header + selector mes */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Turnos</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Control de turnos y ventas por empleado
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* negocio */}
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

          {/* navegación por mes */}
          <div className="flex items-center gap-2">
            <button
              aria-label="Mes anterior"
              onClick={() => setMonthOffset((o) => o - 1)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              ◀
            </button>
            <span className="text-sm font-semibold capitalize">{monthLabel}</span>
            <button
              aria-label="Mes siguiente"
              onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
              disabled={monthOffset === 0}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              ▶
            </button>
          </div>
        </div>
      </header>

      {/* tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-700/70 sticky top-0 z-10 text-[11px] uppercase tracking-wide">
              <tr>
                {["Empleado", "Negocio", "Inicio", "Fin", "Estado", "Ventas", "Total", ""].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {sortedShifts.length ? (
                sortedShifts.map((sh) => {
                  const total = getShiftSales(sh.id).reduce((s, v) => s + v.total, 0);
                  return (
                    <tr
                      key={sh.id}
                      className="border-l-4 border-transparent hover:border-sky-500 even:bg-slate-50/60 dark:even:bg-slate-800/30"
                    >
                      <td className="px-4 py-2 font-medium whitespace-nowrap">
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
                    Sin turnos para este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* modal detalles */}
      {isDetailsModalOpen && selectedShift && (
        <DetailsModal
          shift={selectedShift}
          getShiftSales={getShiftSales}
          onClose={() => setIsDetailsModalOpen(false)}
          translatePaymentMethod={translatePaymentMethod}
          getPaymentMethodClass={getPaymentMethodClass}
          formatPrice={formatPrice}
        />
      )}
    </div>
  );
}

/* ───────── pequeño componente Info ───────── */
function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

/* ───────── modal extraído ───────── */
function DetailsModal({
  shift,
  getShiftSales,
  onClose,
  translatePaymentMethod,
  getPaymentMethodClass,
  formatPrice,
}: {
  shift: Shift;
  getShiftSales: (id: string) => any[];
  onClose: () => void;
  translatePaymentMethod: (m: string) => string;
  getPaymentMethodClass: (m: string) => string;
  formatPrice: (n: number) => string;
}) {
  /* fusionamos mercadopago en transfer */
  const totals = useMemo(() => {
    return getShiftSales(shift.id).reduce((acc, s) => {
      const k = s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod;
      acc[k] = (acc[k] || 0) + s.total;
      return acc;
    }, {} as Record<string, number>);
  }, [getShiftSales, shift.id]);

  const tiles = [
    { k: "cash", l: "Efectivo", cls: "bg-emerald" },
    { k: "card", l: "Tarjeta", cls: "bg-indigo" },
    { k: "transfer", l: "Transferencia", cls: "bg-purple" },
    { k: "rappi", l: "Rappi", cls: "bg-orange" },
  ];
  console.log(getShiftSales(shift.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 animate-scale-in">
        {/* header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold">Detalles del turno</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {shift.employeeName} — {shift.businessName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-slate-500 dark:text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* body */}
        <div className="px-6 py-6 space-y-8">
          {/* grid básico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Info label="Inicio" value={new Date(shift.startTime).toLocaleString()} />
            <Info
              label="Fin"
              value={
                shift.endTime ? new Date(shift.endTime).toLocaleString() : "Aún activo"
              }
            />
            <Info
              label="Estado"
              value={
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${shift.active
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                >
                  {shift.active ? "Activo" : "Completado"}
                </span>
              }
            />
            <Info label="Ventas" value={shift.sales} />
          </div>

          {/* totales */}
          <section>
            <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide">
              Métodos de pago
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tiles.map(({ k, l, cls }) => (
                <div key={k} className={`${cls}-100 dark:${cls}-900/40 rounded p-3`}>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">{l}</p>
                  <p className="font-medium">${formatPrice(totals[k] || 0)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ventas */}
          <section>
            <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide">
              Ventas del turno
            </h3>
            {getShiftSales(shift.id).length ? (
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
                    {getShiftSales(shift.id).map((s) => (
                      <tr
                        key={s.id}
                        className="even:bg-slate-50/60 dark:even:bg-slate-800/30"
                      >
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {new Date(s.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-1.5">
                          {s.items.map((it, i) => (
                            <div key={i}>
                              {it.quantity}× {it.productName} – $
                              {formatPrice(it.total)} -
                              <b>
                                [QTY: {it?.stock == 'null' ? 'NO' : it?.stock}]
                              </b>
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
              <p className="text-slate-600 dark:text-slate-400">Sin ventas registradas.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
