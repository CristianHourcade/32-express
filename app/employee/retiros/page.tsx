"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Store } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

type ShiftRow = {
  id: string;
  startTime: string;
  endTime: string | null;
  startCash: number;
  endCash: number | null;
  employeeId: string;
  businessId: string;
  employeeName: string;
  businessName: string;
  status: boolean; // ✅ bool de verificación
};

type SaleRow = {
  id: string;
  timestamp: string;
  total: number;
  paymentMethod: string;
  shiftId: string;
};

export default function ShiftsSummaryPage() {
  /* ─── state local ─── */
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasFetchedData, setHasFetchedData] = useState<boolean>(false);
  const [dateRangeType, setDateRangeType] = useState<"month" | number>("month");
  const [shiftLimit, setShiftLimit] = useState<10 | 20>(10); // ✅ 10 o 20 últimos turnos
  const [updatingId, setUpdatingId] = useState<string | null>(null); // ✅ para deshabilitar botón mientras actualiza

  const { start: dateStart, end: dateEnd } = useMemo(
    () => computeDateRange(dateRangeType),
    [dateRangeType]
  );

  /* ─── fetch básicos (empleados + negocios) ─── */
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const [{ data: emp, error: empErr }, { data: biz, error: bizErr }] = await Promise.all([
        supabase.from("employees").select("*").order("name"),
        supabase.from("businesses").select("*").order("name"),
      ]);

      if (empErr) console.error(empErr);
      if (bizErr) console.error(bizErr);

      setEmployees(emp ?? []);
      setBusinesses(biz ?? []);
      setIsLoading(false);
    })();
  }, []);

  /* ─── helpers de fetch de turnos y ventas ─── */
  async function fetchShifts(from: Date, to: Date, limit: number) {
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("business_id", selectedBusinessId)
      .gte("start_time", from.toISOString())
      .lt("start_time", to.toISOString())
      .order("start_time", { ascending: false })
      .range(0, limit - 1); // ✅ solo los últimos N

    if (error) {
      console.error(error);
      return [];
    }
    return data ?? [];
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
          shift_id
        `)
        .eq("shift_id", shiftId);

      if (error) {
        console.error(`Error con shift ${shiftId}:`, error);
        continue;
      }

      allSales.push(...(data ?? []));
    }
    return allSales;
  }

  /* ─── efecto principal: cuando cambia negocio / rango / límite ─── */
  useEffect(() => {
    if (selectedBusinessId === "all") {
      setShifts([]);
      setSales([]);
      setHasFetchedData(false);
      return;
    }

    (async () => {
      setIsLoading(true);

      const shRaw = await fetchShifts(dateStart, dateEnd, shiftLimit);
      const saRaw = await fetchSalesByShift(shRaw.map((s: any) => s.id));

      const shiftsFixed: ShiftRow[] = shRaw.map((r: any) => ({
        id: r.id,
        startTime: r.start_time,
        endTime: r.end_time,
        startCash: r.start_cash ?? 0,
        endCash: r.end_cash ?? null,
        employeeId: r.employee_id,
        businessId: r.business_id,
        employeeName: employees.find((e) => e.id === r.employee_id)?.name ?? "—",
        businessName: businesses.find((b) => b.id === r.business_id)?.name ?? "—",
        status: !!r.status, // ✅ bool
      }));

      const salesFixed: SaleRow[] = saRaw.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp,
        total: r.total ?? 0,
        paymentMethod: r.payment_method,
        shiftId: r.shift_id,
      }));

      setShifts(shiftsFixed);
      setSales(salesFixed);
      setIsLoading(false);
      setHasFetchedData(true);
    })();
  }, [selectedBusinessId, dateStart, dateEnd, shiftLimit, employees, businesses]);

  /* ─── helpers de cálculo ─── */
  const getShiftSales = (shiftId: string) => sales.filter((s) => s.shiftId === shiftId);

  const sortedShifts = useMemo(
    () =>
      [...shifts].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ),
    [shifts]
  );

  /* ─── toggle de status ─── */
  const handleToggleStatus = async (shiftId: string, current: boolean) => {
    try {
      setUpdatingId(shiftId);
      const { error } = await supabase
        .from("shifts")
        .update({ status: !current })
        .eq("id", shiftId);

      if (error) {
        console.error(error);
        return;
      }

      setShifts((prev) =>
        prev.map((sh) =>
          sh.id === shiftId ? { ...sh, status: !current } : sh
        )
      );
    } finally {
      setUpdatingId(null);
    }
  };

  /* ─── UI ─── */

  if (isLoading && !hasFetchedData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
        <p className="text-slate-600 dark:text-slate-400 uppercase">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white dark:bg-slate-800 px-5 py-4 shadow-md ring-1 ring-slate-200 dark:ring-slate-700">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Turnos (resumen)</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Vista simple de turnos con monto guardado por empleado.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-end">
          {/* Rango de fechas */}
          <div className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <select
              value={dateRangeType}
              onChange={(e) =>
                setDateRangeType(e.target.value === "month" ? "month" : parseInt(e.target.value))
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

          {/* Cantidad de turnos (10 / 20) */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Mostrar</span>
            <select
              value={shiftLimit}
              onChange={(e) => setShiftLimit(Number(e.target.value) as 10 | 20)}
              className="text-sm bg-transparent border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={10}>Últimos 10 turnos</option>
              <option value={20}>Últimos 20 turnos</option>
            </select>
          </div>

          {/* Selector de negocio */}
          <div className="flex items-center gap-1">
            <Store className="h-4 w-4 text-slate-400" />
            <select
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="text-sm bg-transparent border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Elegí un negocio</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* TABLA SIMPLE */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
        {selectedBusinessId === "all" ? (
          <div className="py-10 text-center text-slate-500 dark:text-slate-400">
            Elegí un negocio para ver los turnos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/70 text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-600">
                <tr>
                  {["Empleado", "Fecha y hora", "Monto guardado", "Verificación"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasFetchedData && sortedShifts.length ? (
                  sortedShifts.map((sh) => {
                    const shiftSales = getShiftSales(sh.id);

                    const paymentsByMethod = shiftSales.reduce(
                      (acc, s) => {
                        const method = s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod;
                        acc[method] = (acc[method] || 0) + s.total;
                        return acc;
                      },
                      {} as Record<string, number>
                    );

                    const efectivoVentas = paymentsByMethod["cash"] || 0;
                    const startCash = sh.startCash ?? 0;
                    const endCash = sh.endCash ?? 0;
                    const montoGuardado = efectivoVentas + startCash - endCash;

                    return (
                      <tr
                        key={sh.id}
                        className="group border-l-4 border-transparent hover:border-sky-500 even:bg-slate-50 dark:even:bg-slate-800/40 transition-all duration-200"
                      >
                        {/* Empleado */}
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                          {sh.employeeName}
                        </td>

                        {/* Fecha y hora */}
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {new Date(sh.startTime).toLocaleString()}
                        </td>

                        {/* Monto guardado */}
                        <td className="px-4 py-3 font-semibold text-sky-700 dark:text-sky-400">
                          ${formatPrice(montoGuardado)}
                        </td>

                        {/* Verificación + botón */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                sh.status
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              }`}
                            >
                              {sh.status ? "Verificado" : "Pendiente"}
                            </span>
                            <button
                              onClick={() => handleToggleStatus(sh.id, sh.status)}
                              disabled={updatingId === sh.id}
                              className="text-xs px-2 py-1 rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                            >
                              {sh.status ? "Marcar pendiente" : "Marcar verificado"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 text-center text-slate-500 dark:text-slate-400"
                    >
                      Sin turnos en el rango seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
