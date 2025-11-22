"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { supabase } from "@/lib/supabase";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

async function fetchAllPaginated(
  queryFn: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const pageSize = 1000;
  let page = 0;
  let allData: any[] = [];
  let done = false;
  while (!done) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryFn(from, to);
    if (error) break;
    if (data) {
      allData = allData.concat(data);
      if (data.length < pageSize) done = true;
      else page++;
    } else done = true;
  }
  return allData;
}

async function loadBusinesses() {
  const { data, error } = await supabase.from("businesses").select("*").order("name");
  if (error) return [];
  return data || [];
}

async function loadSales(businessIds: string[]) {
  return await fetchAllPaginated((from, to) =>
    supabase
      .from("sales")
      .select("*")
      .in("business_id", businessIds)
      .order("timestamp", { ascending: false })
      .range(from, to)
  );
}

async function loadShifts(businessIds: string[]) {
  return await fetchAllPaginated((from, to) =>
    supabase
      .from("shifts")
      .select("*")
      .in("business_id", businessIds)
      .order("start_time", { ascending: false })
      .range(from, to)
  );
}

async function loadEmployees(businessIds: string[]) {
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, business_id")
    .in("business_id", businessIds)
    .order("name", { ascending: true });
  if (error) return [];
  return data || [];
}

export default function StatisticsPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);
  const [selectedWeekday, setSelectedWeekday] = useState("");
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  );

  const weekdayOptions = [
    { value: "", label: "Todos los días" },
    { value: "1", label: "Lunes" },
    { value: "2", label: "Martes" },
    { value: "3", label: "Miércoles" },
    { value: "4", label: "Jueves" },
    { value: "5", label: "Viernes" },
    { value: "6", label: "Sábado" },
    { value: "0", label: "Domingo" },
  ];

  useEffect(() => {
    loadBusinesses().then(setBusinesses);
  }, []);

  useEffect(() => {
    if (!selectedBusinessIds.length) return;
    setLoading(true);
    Promise.all([
      loadSales(selectedBusinessIds),
      loadShifts(selectedBusinessIds),
      loadEmployees(selectedBusinessIds),
    ])
      .then(([sal, shi, emp]) => {
        setSales(sal);
        setShifts(shi);
        setEmployees(emp);
      })
      .finally(() => setLoading(false));
  }, [selectedBusinessIds]);

  const year = selectedMonth.getFullYear();
  const monthIndex = selectedMonth.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => new Date(year, monthIndex, i + 1));
  const isSameDate = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

  const filteredSales = sales.filter((s) => {
    const d = new Date(s.timestamp);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
  const filteredShifts = shifts.filter((sh) => {
    const d = new Date(sh.start_time);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });

  const salesByWeekday = filteredSales.filter(
    (s) => selectedWeekday === "" || new Date(s.timestamp).getDay() === Number(selectedWeekday)
  );
  const shiftsByWeekday = filteredShifts.filter(
    (sh) =>
      selectedWeekday === "" ||
      new Date(sh.start_time).getDay() === Number(selectedWeekday)
  );

  // Stats por día, con apertura por método
  const dailyStats = daysArray.map((day) => {
    const salesDay = filteredSales.filter((s) =>
      isSameDate(new Date(s.timestamp), day)
    );

    let efectivo = 0;
    let tarjeta = 0;
    let transferencia = 0;
    let total = 0;

    for (const s of salesDay) {
      const t = s.total || 0;
      const method = (s.payment_method || "").toString().toLowerCase();

      total += t;

      if (method === "cash") {
        efectivo += t;
      } else if (method === "card") {
        tarjeta += t;
      } else if (method === "transfer") {
        transferencia += t;
      }
    }

    return {
      date: day,
      efectivo,
      tarjeta,
      transferencia,
      totalSales: total,
      salesCount: salesDay.length,
    };
  });

  const displayedStats = dailyStats.filter(
    (ds) => selectedWeekday === "" || ds.date.getDay() === Number(selectedWeekday)
  );

  const totalSalesSum = displayedStats.reduce((a, c) => a + c.totalSales, 0);
  const totalEfectivo = displayedStats.reduce((a, c) => a + c.efectivo, 0);
  const totalTarjeta = displayedStats.reduce((a, c) => a + c.tarjeta, 0);
  const totalTransferencia = displayedStats.reduce((a, c) => a + c.transferencia, 0);

  const formatPrice = (n: number) =>
    n.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    setIsDark(html.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains("dark"));
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);
  const tickColor = !isDark ? "#020617" : "#e5e7eb";
  const chartContainerClass = "w-full h-[300px]";

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const data = hours.map((h) =>
      salesByWeekday.reduce(
        (a, c) => (new Date(c.timestamp).getHours() === h ? a + c.total : a),
        0
      )
    );
    return {
      labels: hours.map((h) => `${h}:00`),
      datasets: [
        {
          data,
          backgroundColor: "rgba(59,130,246,0.55)",
          borderColor: "rgba(37,99,235,1)",
          borderWidth: 1.5,
        },
      ],
    };
  }, [salesByWeekday]);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false as const,
    plugins: {
      legend: { display: false, labels: { color: tickColor } },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      x: {
        ticks: { color: tickColor },
        grid: { display: false },
      },
      y: {
        ticks: { color: tickColor },
        grid: { color: isDark ? "#1f2937" : "#e5e7eb" },
      },
    },
  };

  const ticketData = useMemo(
    () => ({
      labels: displayedStats.map((d) => d.date.getDate().toString()),
      datasets: [
        {
          data: displayedStats.map((d) =>
            d.salesCount > 0 ? d.totalSales / d.salesCount : 0
          ),
          backgroundColor: "rgba(16,185,129,0.2)",
          borderColor: "rgba(5,150,105,1)",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    }),
    [displayedStats]
  );

  const revenueEmpData = useMemo(() => {
    const map: Record<string, number[]> = {};
    shiftsByWeekday.forEach((sh) => {
      const sum = salesByWeekday
        .filter((s) => s.shift_id === sh.id)
        .reduce((a, c) => a + c.total, 0);
      map[sh.employee_id] = map[sh.employee_id] || [];
      map[sh.employee_id].push(sum);
    });
    return {
      labels: Object.keys(map).map(
        (id) => employees.find((e) => e.id === id)?.name || id
      ),
      datasets: [
        {
          data: Object.values(map).map((arr) =>
            arr.reduce((a, c) => a + c, 0) / arr.length
          ),
          backgroundColor: "rgba(129,140,248,0.7)",
          borderColor: "rgba(79,70,229,1)",
          borderWidth: 1,
        },
      ],
    };
  }, [shiftsByWeekday, salesByWeekday, employees]);

  const prev = () => setSelectedMonth(new Date(year, monthIndex - 1, 1));
  const next = () => {
    const n = new Date(year, monthIndex + 1, 1);
    if (n <= new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
      setSelectedMonth(n);
  };
  const nextDisabled =
    new Date(year, monthIndex + 1, 1) >
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  const toggleBusiness = (id: string) => {
    setSelectedBusinessIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const selectAllBusinesses = () => {
    setSelectedBusinessIds(businesses.map((b) => b.id));
  };

  const clearBusinesses = () => {
    setSelectedBusinessIds([]);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <header className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Estadísticas del Mes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ventas diarias, apertura por método de pago y rendimiento por turno.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
            {selectedMonth.toLocaleDateString("es-AR", {
              month: "long",
              year: "numeric",
            })}
          </span>
          {selectedBusinessIds.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              {selectedBusinessIds.length} negocio
              {selectedBusinessIds.length > 1 ? "s seleccionados" : " seleccionado"}
            </span>
          )}
        </div>
      </header>

      {/* FILTROS */}
      <div className="app-card p-4 md:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-start lg:justify-between">
          {/* Selección de negocios como chips */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="font-medium text-sm text-slate-700 dark:text-slate-200">
                Negocios (multi-selección)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllBusinesses}
                  className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  onClick={clearBusinesses}
                  className="text-xs px-2 py-1 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200"
                >
                  Limpiar
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
              {businesses.map((b) => {
                const selected = selectedBusinessIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBusiness(b.id)}
                    className={`px-3 py-1.5 rounded-full text-xs md:text-sm border transition shadow-sm ${
                      selected
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:border-blue-400"
                    }`}
                  >
                    {b.name}
                  </button>
                );
              })}
              {businesses.length === 0 && (
                <p className="text-xs text-slate-400">No hay negocios cargados.</p>
              )}
            </div>
          </div>

          {/* Mes + día semana */}
          <div className="flex flex-col gap-3 w-full lg:w-64">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Mes
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={prev}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={next}
                  disabled={nextDisabled}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Día de la semana
              </label>
              <div className="grid grid-cols-4 gap-1">
                {weekdayOptions.map((opt) => {
                  const selected = selectedWeekday === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedWeekday(opt.value)}
                      className={`px-2 py-1.5 text-[11px] rounded-full border transition ${
                        selected
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
                      }`}
                    >
                      {opt.label === "" ? "Todos" : opt.label[0]}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Tip: usá los filtros para comparar solo ciertos días.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMEN */}
      {selectedBusinessIds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Total Ventas
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">
              ${formatPrice(totalSalesSum)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-950/40">
            <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
              Efectivo
            </p>
            <p className="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-100">
              ${formatPrice(totalEfectivo)}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 shadow-sm dark:border-sky-700/50 dark:bg-sky-950/40">
            <p className="text-xs font-medium text-sky-700 uppercase tracking-wide">
              Tarjeta
            </p>
            <p className="mt-1 text-xl font-semibold text-sky-900 dark:text-sky-100">
              ${formatPrice(totalTarjeta)}
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 shadow-sm dark:border-indigo-700/50 dark:bg-indigo-950/40">
            <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide">
              Transferencia
            </p>
            <p className="mt-1 text-xl font-semibold text-indigo-900 dark:text-indigo-100">
              ${formatPrice(totalTransferencia)}
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10 text-slate-500">
          <p>Cargando estadísticas...</p>
        </div>
      )}

      {!loading && !selectedBusinessIds.length && (
        <div className="text-center py-10 text-slate-500">
          Seleccioná uno o más negocios para ver las estadísticas.
        </div>
      )}

      {!loading && selectedBusinessIds.length > 0 && (
        <>
          {/* TABLA PRINCIPAL */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Ventas diarias por método de pago
              </h2>
              <span className="text-[11px] text-slate-400">
                {displayedStats.length} días en el período
              </span>
            </div>
            <div className="overflow-x-auto max-h-[460px]">
              <table className="min-w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-50 to-blue-100 text-slate-700 text-xs uppercase tracking-wide dark:from-slate-800 dark:to-slate-900 dark:text-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-right">Efectivo</th>
                    <th className="px-4 py-2 text-right">Tarjeta</th>
                    <th className="px-4 py-2 text-right">Transferencia</th>
                    <th className="px-4 py-2 text-right">Total día</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {displayedStats.map((ds, i) => (
                    <tr
                      key={i}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition"
                    >
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-100">
                        {ds.date.toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2 text-right text-emerald-700 dark:text-emerald-300 font-medium">
                        ${formatPrice(ds.efectivo)}
                      </td>
                      <td className="px-4 py-2 text-right text-sky-700 dark:text-sky-300 font-medium">
                        ${formatPrice(ds.tarjeta)}
                      </td>
                      <td className="px-4 py-2 text-right text-indigo-700 dark:text-indigo-300 font-medium">
                        ${formatPrice(ds.transferencia)}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-900 dark:text-slate-50">
                        ${formatPrice(ds.totalSales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-900/80">
                  <tr>
                    <td className="px-4 py-3 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                      Totales
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-800 dark:text-emerald-200 font-semibold">
                      ${formatPrice(totalEfectivo)}
                    </td>
                    <td className="px-4 py-3 text-right text-sky-800 dark:text-sky-200 font-semibold">
                      ${formatPrice(totalTarjeta)}
                    </td>
                    <td className="px-4 py-3 text-right text-indigo-800 dark:text-indigo-200 font-semibold">
                      ${formatPrice(totalTransferencia)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-50">
                      ${formatPrice(totalSalesSum)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* TICKET PROMEDIO */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Ticket promedio por día
            </h2>
            <div className={chartContainerClass}>
              <Line data={ticketData} options={baseOptions} />
            </div>
          </div>

          {/* GRÁFICOS DE BARRA */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
                Ventas por hora del día
              </h3>
              <div className={chartContainerClass}>
                <Bar data={hourlyData} options={baseOptions} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
                Promedio de facturación por turno
              </h3>
              <div className={chartContainerClass}>
                <Bar
                  data={revenueEmpData}
                  options={{ ...baseOptions, indexAxis: "y" as const }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
