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
import { supabase } from "@/lib/supabase";
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
  const pageSize = 999;
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
  async function fetchShifts(from: Date, to: Date) {
    return fetchAllPaginated((lo, hi) =>
      supabase
        .from("shifts")
        .select("*")
        .eq("business_id", selectedBusinessId)   // ← ESTA LÍNEA
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
              products (
                name
              )
            )
          `)
        .gte("timestamp", from.toISOString())
        .lt("timestamp", to.toISOString())
        .range(lo, hi)
    );
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
  /* ─── redux state ─── */
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedData, setHasFetchedData] = useState(false);

  /* ─── local state ─── */
  const [selectedBusinessId, setSelectedBusinessId] = useState("all");
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [hasSelectedBusiness, setHasSelectedBusiness] = useState(false);

  /* paginación por mes */
  const [monthOffset, setMonthOffset] = useState(0);
  const { start: monthStart, end: monthEnd } = useMemo(() => monthRange(monthOffset), [monthOffset]);
  const monthLabel = monthStart.toLocaleString("es-ES", { month: "long", year: "numeric" });
  const [search, setSearch] = useState("");   // 🔍 producto buscado

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
      const [sh, sa] = await Promise.all([
        fetchShifts(monthStart, monthEnd),
        fetchSales(monthStart, monthEnd),
      ]);
      const shiftsFixed = sh.map(r => ({
        ...r,
        startTime: r.start_time,
        endTime: r.end_time,
        startCash: r.start_cash ?? 0,
        endCash: r.end_cash ?? null,
        employeeName: employees.find(e => e.id === r.employee_id)?.name ?? "—",
        businessName: businesses.find(b => b.id === r.business_id)?.name ?? "—",
      }))

      const salesFixed = sa.map(r => ({
        ...r,
        shiftId: r.shift_id,
        paymentMethod: r.payment_method,
        items: r.sale_items.map(it => ({
          quantity: it.quantity,
          total: it.total,
          stock: it.stock,
          productName: it.products?.name ?? "—",
        })),
      }));

      // ⬇️ usa estas
      setShifts(shiftsFixed);
      setSales(salesFixed);
      setIsLoading(false);
      setHasFetchedData(true); // <--- acá
    })();
  }, [hasSelectedBusiness, selectedBusinessId, monthStart, monthEnd]);

  const handleBusinessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBusinessId(e.target.value);
    setHasSelectedBusiness(true);
  };


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


  /* ─── filtros y ordenación ─── */
  const monthSales = useMemo(
    () =>
      sales.filter(
        (s) => new Date(s.timestamp) >= monthStart && new Date(s.timestamp) < monthEnd
      ),
    [sales, monthStart, monthEnd]
  );


  const sortedShifts = shifts

  const getShiftSales = (shiftId: string) => monthSales.filter((s) => s.shiftId === shiftId);
  const filteredShifts = useMemo(() => {
    if (!search.trim()) return sortedShifts;        // sin texto → todo igual
    const term = search.toLowerCase().trim();
    return sortedShifts.filter((sh) =>
      getShiftSales(sh.id).some((sale) =>
        sale.items.some((it: any) =>
          (it.productName ?? "").toLowerCase().includes(term)
        )
      )
    );
  }, [sortedShifts, search, monthSales]);

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
          <input
            type="search"
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full px-3 py-1.5 text-xs border bg-white dark:bg-slate-800
             shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[180px]"
          />

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
              {hasFetchedData && sortedShifts.length ? (
                filteredShifts.map((sh) => {
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
                          {!sh.endTime ? "Activo" : "Completado"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {getShiftSales(sh.id).length}
                      </td>
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
              value={shift.endTime ? new Date(shift.endTime).toLocaleString() : "Aún activo"}
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
            <Info label="Caja Inicial" value={`$${formatPrice(shift.startCash || 0)}`} />
            <Info
              label="Caja Final"
              value={
                shift.endCash != null
                  ? `$${formatPrice(shift.endCash)}`
                  : "$0.00"
              }
            />
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
