"use client";

import type React from "react";
import { useEffect, useState, useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FileText, SearchIcon, Store } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Shift } from "@/lib/redux/slices/shiftSlice";

// helpers/case.ts
export const toCamel = <T extends Record<string, any>>(row: T) =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      v,
    ]),
  ) as any;

async function fetchAllPaginated(
  queryFn: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const pageSize = 1000;
  let page = 0;
  let acc: any[] = [];
  for (;;) {
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

/* ───────── helpers de fecha ───────── */
function computeDateRange(type: "month" | number) {
  const now = new Date();
  if (type === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  } else {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - type);
    return { start, end };
  }
}

/* ───────── formatting ───────── */
const formatPrice = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ShiftsPage() {
  async function fetchShifts(from: Date, to: Date) {
    return fetchAllPaginated((lo, hi) =>
      supabase
        .from("shifts")
        .select("*")
        .eq("business_id", selectedBusinessId) // ← usa negocio seleccionado
        .gte("start_time", from.toISOString())
        .lt("start_time", to.toISOString())
        .order("start_time", { ascending: false })
        .range(lo, hi)
    );
  }

  async function fetchSales(from: Date, to: Date) {
    return fetchAllPaginated((lo, hi) =>
      supabase
        .from("sales")
        .select(`
            id,
            timestamp,
            total,
            payment_method,
            shift_id,
            sale_items (
              quantity,
              total,
              stock,
              product_id,
              product_master_id,
              products (
                name
              ),
              products_master (
                name
              )
              promotion:promos (
                name
              )
            )
          `)
        .gte("timestamp", from.toISOString())
        .lt("timestamp", to.toISOString())
        .range(lo, hi)
    );
  }

  async function fetchSalesByShift(shiftIds: string[]) {
    const allSales: any[] = [];
    for (const shiftId of shiftIds) {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          timestamp,
          total,
          payment_method,
          shift_id,
         sale_items (
          quantity,
          total,
          stock,
          product_id,
          product_master_id,
          promotion_id,
          promotion:promos (
            name
          ),
          products (
            name
          ),
          products_master (
            name
          )
        )
        `)
        .eq("shift_id", shiftId);

      if (error) {
        console.error(`Error con shift ${shiftId}:`, error);
        continue; // evitamos que caiga todo
      }

      allSales.push(...(data ?? []));
    }

    return allSales;
  }

  async function fetchEmployees() {
    const { data, error } = await supabase.from("employees").select("*").order("name");
    if (error) {
      console.error(error);
      return [];
    }
    return data ?? [];
  }

  async function fetchBusinesses() {
    const { data, error } = await supabase.from("businesses").select("*").order("name");
    if (error) {
      console.error(error);
      return [];
    }
    return data ?? [];
  }

  /* ─── state ─── */
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedData, setHasFetchedData] = useState(false);
  const [dateRangeType, setDateRangeType] = useState<"month" | number>("month");

  /* ─── local state ─── */
  const [selectedBusinessId, setSelectedBusinessId] = useState("all");
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [hasSelectedBusiness, setHasSelectedBusiness] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null); // ✅ para status

  /* paginación por mes */
  const [monthOffset, setMonthOffset] = useState(0);
  const { start: dateStart, end: dateEnd } = useMemo(
    () => computeDateRange(dateRangeType),
    [dateRangeType]
  );
  const monthLabel = dateStart.toLocaleString("es-ES", { month: "long", year: "numeric" });
  const [search, setSearch] = useState(""); // 🔍 producto buscado

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const [emp, biz] = await Promise.all([fetchEmployees(), fetchBusinesses()]);
      setEmployees(emp);
      setBusinesses(biz);
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!hasSelectedBusiness || selectedBusinessId === "all") return;

    (async () => {
      setIsLoading(true);

      // Primero obtenemos los turnos
      const sh = await fetchShifts(dateStart, dateEnd);

      // Después traemos ventas para cada turno individualmente
      const sa = await fetchSalesByShift(sh.map((s: any) => s.id));

      const shiftsFixed = sh.map((r: any) => ({
        ...r,
        startTime: r.start_time,
        endTime: r.end_time,
        startCash: r.start_cash ?? 0,
        endCash: r.end_cash ?? null,
        employeeName: employees.find((e) => e.id === r.employee_id)?.name ?? "—",
        businessName: businesses.find((b) => b.id === r.business_id)?.name ?? "—",
        status: !!r.status, // ✅ bool verificación
      }));

      const salesFixed = sa.map((r: any) => ({
        ...r,
        shiftId: r.shift_id,
        paymentMethod: r.payment_method === "mercadopago" ? "transfer" : r.payment_method,
        items: r.sale_items.map((it: any) => ({
          quantity: it.quantity,
          total: it.total,
          stock: it.stock,
          isPromo: !!it.promotion,
          name: it.promotion?.name ?? it.products?.name ?? it.products_master?.name ?? "—",
        })),
      }));

      setShifts(shiftsFixed as any);
      setSales(salesFixed);
      setIsLoading(false);
      setHasFetchedData(true);
    })();
  }, [hasSelectedBusiness, selectedBusinessId, dateStart, dateEnd, employees, businesses]);

  const handleBusinessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBusinessId(e.target.value);
    setHasSelectedBusiness(true);
  };

  const openDetailsModal = (shift: Shift) => {
    setSelectedShift(shift);
    setIsDetailsModalOpen(true);
  };

  const translatePaymentMethod = (m: string) =>
    ({ cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia", rappi: "Rappi" } as const)[m] ||
    m;

  const getPaymentMethodClass = (m: string) =>
    ({
      cash: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
      card: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
      transfer: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
      rappi: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    }[m] || "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300");

  /* ─── filtros y ordenación ─── */
  const monthSales = useMemo(
    () =>
      sales.filter(
        (s) => new Date(s.timestamp) >= dateStart && new Date(s.timestamp) < dateEnd
      ),
    [sales, dateStart, dateEnd]
  );

  const sortedShifts = shifts;

  const getShiftSales = (shiftId: string) =>
    monthSales.filter((s) => s.shiftId === shiftId);

  const filteredShifts = useMemo(() => {
    if (!search.trim()) return sortedShifts; // sin texto → todo igual
    const term = search.toLowerCase().trim();
    return sortedShifts.filter((sh: any) =>
      getShiftSales(sh.id).some((sale: any) =>
        sale.items.some(
          (it: any) => (it.name ?? "").toLowerCase().includes(term) // 🔧 uso name que sí existe
        )
      )
    );
  }, [sortedShifts, search, monthSales]);

  /* ─── toggle de status ─── */
  const handleToggleStatus = async (shiftId: string, current?: boolean) => {
    const next = !current;
    try {
      setUpdatingId(shiftId);
      const { error } = await supabase
        .from("shifts")
        .update({ status: next })
        .eq("id", shiftId);

      if (error) {
        console.error(error);
        return;
      }

      setShifts((prev) =>
        prev.map((sh: any) =>
          sh.id === shiftId ? { ...sh, status: next } : sh
        )
      );
    } finally {
      setUpdatingId(null);
    }
  };

  /* ─── loading splash ─── */
  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
        <p className="text-slate-600 dark:text-slate-400 uppercase">
          Cargando turnos…
        </p>
      </div>
    );

  /* ───────────────────────────────── RETURN ───────────────────────────────── */
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white dark:bg-slate-800 px-5 py-4 shadow-md ring-1 ring-slate-200 dark:ring-slate-700">
        {/* Título + descripción */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turnos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Control y seguimiento de ventas por empleado
          </p>
        </div>

        {/* Controles */}
        <div className="flex flex-wrap gap-3 items-center justify-end">
          {/* Selector de fechas */}
          <div className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <select
              value={dateRangeType}
              onChange={(e) =>
                setDateRangeType(
                  e.target.value === "month" ? "month" : parseInt(e.target.value)
                )
              }
              className="text-sm bg-transparent border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="month">Este mes</option>
              <option value="7">Últimos 7 días</option>
              <option value="14">Últimos 14 días</option>
              <option value="21">Últimos 21 días</option>
              <option value="30">Últimos 30 días</option>
            </select>
          </div>

          {/* Selector de negocio */}
          <div className="flex items-center gap-1">
            <Store className="h-4 w-4 text-slate-400" />
            <select
              value={selectedBusinessId}
              onChange={handleBusinessChange}
              className="text-sm bg-transparent border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos los negocios</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Buscador */}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              className="pl-8 pr-3 py-1.5 text-sm rounded-full border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Navegación por mes (visual, hoy no modifica la query) */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonthOffset((o) => o - 1)}
              className="p-1.5 rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium capitalize px-2">
              {monthLabel}
            </span>
            <button
              onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
              disabled={monthOffset === 0}
              className="p-1.5 rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/70 sticky top-0 z-10 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-600">
              <tr>
                {[
                  "Empleado",
                  "Inicio",
                  "Estado",
                  "Ventas",
                  "Total",
                  "Métodos",
                  "Guardado estimado",
                  "Verificación",
                  "Caja",
                  "",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {hasFetchedData && sortedShifts.length ? (
                filteredShifts.map((sh: any) => {
                  const shiftSales = getShiftSales(sh.id);
                  const total = shiftSales.reduce(
                    (s: number, v: any) => s + v.total,
                    0
                  );

                  const paymentsByMethod = shiftSales.reduce(
                    (acc: Record<string, number>, s: any) => {
                      const method =
                        s.paymentMethod === "mercadopago"
                          ? "transfer"
                          : s.paymentMethod;
                      acc[method] = (acc[method] || 0) + s.total;
                      return acc;
                    },
                    {} as Record<string, number>
                  );

                  const efectivoVentas = paymentsByMethod["cash"] || 0;
                  const montoGuardado =
                    efectivoVentas + (sh.startCash || 0) - (sh.endCash || 0);
                  const verified = !!sh.status;

                  return (
                    <tr
                      key={sh.id}
                      className="group border-l-4 border-transparent hover:border-sky-500 even:bg-slate-50 dark:even:bg-slate-800/40 transition-all duration-200"
                    >
                      {/* Empleado */}
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                        {sh.employeeName}
                      </td>

                      {/* Inicio */}
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {new Date(sh.startTime).toLocaleString()}
                      </td>

                      {/* Estado (activo/completado) */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide shadow-sm ${
                            sh.active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {sh.active ? "Activo" : "Completado"}
                        </span>
                      </td>

                      {/* Cantidad de ventas */}
                      <td className="px-4 py-3 text-center text-slate-800 dark:text-slate-200">
                        {shiftSales.length}
                      </td>

                      {/* Total vendido */}
                      <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                        ${formatPrice(total)}
                      </td>

                      {/* Métodos de pago */}
                      <td className="px-4 py-3 text-xs space-y-1">
                        {Object.entries(paymentsByMethod).map(
                          ([k, amount]) => (
                            <div
                              key={k}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${getPaymentMethodClass(
                                k
                              )}`}
                            >
                              {translatePaymentMethod(k)}: $
                              {formatPrice(amount)}
                            </div>
                          )
                        )}
                      </td>

                      {/* Guardado */}
                      <td className="px-4 py-3 font-semibold text-sky-700 dark:text-sky-400">
                        ${formatPrice(montoGuardado)}
                      </td>

                      {/* Verificación */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              verified
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            }`}
                          >
                            {verified ? "Verificado" : "Pendiente"}
                          </span>
                          <button
                            onClick={() =>
                              handleToggleStatus(sh.id, verified)
                            }
                            disabled={updatingId === sh.id}
                            className="text-xs px-2 py-1 rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                          >
                            {verified
                              ? "Marcar pendiente"
                              : "Marcar verificado"}
                          </button>
                        </div>
                      </td>

                      {/* Caja */}
                      <td className="px-4 py-3 text-xs leading-5 text-slate-700 dark:text-slate-300">
                        <div>
                          Apertura:{" "}
                          <span className="font-medium">
                            ${formatPrice(sh.startCash || 0)}
                          </span>
                        </div>
                        <div>
                          Cierre:{" "}
                          <span className="font-medium">
                            {sh.endCash != null
                              ? `$${formatPrice(sh.endCash)}`
                              : "—"}
                          </span>
                        </div>
                      </td>

                      {/* Botón detalle */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openDetailsModal(sh)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition"
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
                    colSpan={10}
                    className="py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    Sin turnos para este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!hasFetchedData && !isLoading && (
        <p className="text-center text-slate-500 dark:text-slate-400 mt-12">
          Elegí un negocio para ver los turnos.
        </p>
      )}

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
  const totals = useMemo(() => {
    return getShiftSales((shift as any).id).reduce((acc: any, s: any) => {
      const k = s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod;
      acc[k] = (acc[k] || 0) + s.total;
      return acc;
    }, {} as Record<string, number>);
  }, [getShiftSales, shift]);

  const productSummary = useMemo(() => {
    const categories = [
      "ALMACEN",
      "CIGARRILLOS",
      "GOLOSINAS",
      "BEBIDA",
      "CERVEZA",
      "FIAMBRES",
      "TABACO",
      "HUEVOS",
      "HIGIENE",
      "ALCOHOL",
      "PROMO",
      "SIN CATEGORIA",
      "BRECA",
    ];

    const grouped = new Map<string, { name: string; qty: number }[]>();

    for (const sale of getShiftSales((shift as any).id)) {
      for (const it of sale.items || []) {
        const name: string = it?.name ?? "—";
        const parts = name.split(" ");
        const first = parts[0]?.toUpperCase();
        const category = categories.includes(first) ? first : "SIN CATEGORIA";

        const list = grouped.get(category) || [];
        const existing = list.find((p) => p.name === name);

        if (existing) {
          existing.qty += Number(it?.quantity || 0);
        } else {
          list.push({ name, qty: Number(it?.quantity || 0) });
        }

        grouped.set(category, list);
      }
    }

    return Array.from(grouped.entries())
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => b.qty - a.qty),
      }))
      .sort((a, b) => {
        const qa = a.items.reduce((sum, i) => sum + i.qty, 0);
        const qb = b.items.reduce((sum, i) => sum + i.qty, 0);
        return qb - qa;
      });
  }, [getShiftSales, shift]);

  const tiles = [
    { k: "cash", l: "Efectivo", cls: "bg-emerald" },
    { k: "card", l: "Tarjeta", cls: "bg-indigo" },
    { k: "transfer", l: "Transferencia", cls: "bg-purple" },
    { k: "rappi", l: "Rappi", cls: "bg-orange" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800/80 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 animate-scale-in">
        {/* header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold">Detalles del turno</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {(shift as any).employeeName} — {(shift as any).businessName}
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
            <Info
              label="Inicio"
              value={new Date((shift as any).startTime).toLocaleString()}
            />
            <Info
              label="Fin"
              value={
                (shift as any).endTime
                  ? new Date((shift as any).endTime).toLocaleString()
                  : "Aún activo"
              }
            />
            <Info
              label="Estado"
              value={
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    (shift as any).active
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {(shift as any).active ? "Activo" : "Completado"}
                </span>
              }
            />
            <Info
              label="Verificación"
              value={
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    (shift as any).status
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {(shift as any).status ? "Verificado" : "Pendiente"}
                </span>
              }
            />
            <Info
              label="Ventas"
              value={getShiftSales((shift as any).id).length}
            />
            <Info
              label="Caja Inicial"
              value={`$${formatPrice((shift as any).startCash || 0)}`}
            />
            <Info
              label="Caja Final"
              value={
                (shift as any).endCash != null
                  ? `$${formatPrice((shift as any).endCash)}`
                  : "$0.00"
              }
            />
          </div>

          {/* totales por método */}
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

          {/* resumen productos */}
          <section>
            <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide">
              Productos vendidos (por categoría)
            </h3>

            {productSummary.length ? (
              <div className="max-h-[55vh] overflow-auto space-y-6 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 p-3">
                {productSummary.map((cat) => (
                  <div key={cat.category}>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">
                      {cat.category}
                    </h4>
                    <table className="w-full text-sm mb-4">
                      <thead className="text-[11px] text-slate-500">
                        <tr>
                          <th className="text-left py-1">Producto</th>
                          <th className="text-right py-1">Cant.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.items.map((r, idx) => (
                          <tr
                            key={idx}
                            className="border-t border-slate-200 dark:border-slate-700"
                          >
                            <td className="py-1">{r.name}</td>
                            <td className="py-1 text-right">{r.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 dark:text-slate-400">
                Sin productos en este turno.
              </p>
            )}
          </section>

          {/* detalle de ventas */}
          <section>
            <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide">
              Ventas del turno
            </h3>
            {getShiftSales((shift as any).id).length ? (
              <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-700">
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead className="bg-slate-100 text-[11px] text-slate-500 uppercase tracking-wide border-y border-slate-200">
                    <tr>
                      {["Hora", "Detalle", "Método", "Total"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getShiftSales((shift as any).id).map((s: any) => (
                      <tr key={s.id} className="group transition">
                        {/* Hora */}
                        <td className="relative px-4 py-3 whitespace-nowrap font-semibold text-slate-700 bg-white align-top group-hover:before:content-[''] group-hover:before:absolute group-hover:before:inset-y-0 group-hover:before:left-0 group-hover:before:w-1 group-hover:before:bg-sky-500 ">
                          {new Date(s.timestamp).toLocaleTimeString()}
                        </td>

                        {/* Detalle */}
                        <td className="px-4 py-3 bg-white align-top text-slate-700 space-y-1">
                          {s.items.map((it: any, i: number) => (
                            <div key={i}>
                              <span className="font-medium">
                                {it.quantity}× {it.name}
                                {it.isPromo && (
                                  <span className="ml-1 text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 px-1.5 py-0.5 rounded-full">
                                    PROMO
                                  </span>
                                )}
                              </span>{" "}
                              <span className="text-xs text-slate-500">
                                – ${formatPrice(it.total)} [Stock:{" "}
                                {it?.stock === "null" ? "NO" : it?.stock}]
                              </span>
                            </div>
                          ))}
                        </td>

                        {/* Método */}
                        <td className="px-4 py-3 bg-white align-top whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${getPaymentMethodClass(
                              s.paymentMethod === "mercadopago"
                                ? "transfer"
                                : s.paymentMethod
                            )}`}
                          >
                            {translatePaymentMethod(
                              s.paymentMethod === "mercadopago"
                                ? "transfer"
                                : s.paymentMethod
                            )}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3 bg-white align-top font-bold text-right text-slate-800 whitespace-nowrap">
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
  );
}
