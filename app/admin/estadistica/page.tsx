"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, BarChart2, Clock, Users, ShoppingCart, Banknote, CreditCard, Wallet, Zap, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
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
  Filler,
} from "chart.js";
import { supabase } from "@/lib/supabase";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler
);

/* ─────────────────────────────────────────────────────────
   FETCH
   ───────────────────────────────────────────────────────── */
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
    if (error) break;
    if (!data?.length) break;
    acc = acc.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return acc;
}

async function loadBusinesses() {
  const { data } = await supabase.from("businesses").select("*").order("name");
  return data || [];
}

async function loadSales(businessIds: string[], from: Date, to: Date) {
  return fetchAllPaginated((lo, hi) =>
    supabase.from("sales").select("*")
      .in("business_id", businessIds)
      .gte("timestamp", from.toISOString())
      .lt("timestamp", to.toISOString())
      .order("timestamp", { ascending: false })
      .range(lo, hi)
  );
}

async function loadShifts(businessIds: string[], from: Date, to: Date) {
  return fetchAllPaginated((lo, hi) =>
    supabase.from("shifts").select("*")
      .in("business_id", businessIds)
      .gte("start_time", from.toISOString())
      .lt("start_time", to.toISOString())
      .order("start_time", { ascending: false })
      .range(lo, hi)
  );
}

async function loadEmployees(businessIds: string[]) {
  const { data } = await supabase.from("employees").select("id, name, business_id")
    .in("business_id", businessIds).order("name");
  return data || [];
}

/* ─────────────────────────────────────────────────────────
   FORMAT
   ───────────────────────────────────────────────────────── */
const fmt = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDec = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtM = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000 ? `$${(n / 1_000).toFixed(1)}k` : `$${fmt(n)}`;

/* ─────────────────────────────────────────────────────────
   KPI CARD
   ───────────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, color = "slate",
  trend, trendLabel,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: string;
  trend?: number; trendLabel?: string;
}) {
  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    slate:   { bg: "bg-slate-100 dark:bg-slate-800",   icon: "text-slate-500",   text: "text-slate-800 dark:text-slate-100" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: "text-emerald-600 dark:text-emerald-400", text: "text-emerald-700 dark:text-emerald-300" },
    indigo:  { bg: "bg-indigo-50 dark:bg-indigo-900/20",   icon: "text-indigo-600 dark:text-indigo-400",   text: "text-indigo-700 dark:text-indigo-300" },
    amber:   { bg: "bg-amber-50 dark:bg-amber-900/20",     icon: "text-amber-600 dark:text-amber-400",     text: "text-amber-700 dark:text-amber-300" },
    violet:  { bg: "bg-violet-50 dark:bg-violet-900/20",   icon: "text-violet-600 dark:text-violet-400",   text: "text-violet-700 dark:text-violet-300" },
    sky:     { bg: "bg-sky-50 dark:bg-sky-900/20",         icon: "text-sky-600 dark:text-sky-400",         text: "text-sky-700 dark:text-sky-300" },
    rose:    { bg: "bg-rose-50 dark:bg-rose-900/20",       icon: "text-rose-600 dark:text-rose-400",       text: "text-rose-700 dark:text-rose-300" },
  };
  const c = colorMap[color] ?? colorMap.slate;
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 rounded-xl ${c.bg} grid place-items-center shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${c.icon}`} style={{ width: 18, height: 18 }} />
        </div>
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            isPositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
            isNegative ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
            "bg-slate-100 text-slate-500 dark:bg-slate-800"
          }`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> :
             isNegative ? <ArrowDownRight className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium mb-0.5">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${c.text}`}>{value}</div>
        {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
        {trendLabel && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{trendLabel}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SECTION HEADER
   ───────────────────────────────────────────────────────── */
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   CHART WRAPPER
   ───────────────────────────────────────────────────────── */
function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-4">
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
      <div className="h-[260px]">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   WEEKDAY SELECTOR
   ───────────────────────────────────────────────────────── */
const WEEKDAYS = [
  { v: "", l: "Todos" },
  { v: "1", l: "Lun" },
  { v: "2", l: "Mar" },
  { v: "3", l: "Mié" },
  { v: "4", l: "Jue" },
  { v: "5", l: "Vie" },
  { v: "6", l: "Sáb" },
  { v: "0", l: "Dom" },
];

/* ─────────────────────────────────────────────────────────
   MAIN
   ───────────────────────────────────────────────────────── */
export default function StatisticsPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [salesPrev, setSalesPrev] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);
  const [selectedWeekday, setSelectedWeekday] = useState("");
  const [isDark, setIsDark] = useState(false);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  );

  const year = selectedMonth.getFullYear();
  const monthIndex = selectedMonth.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 1);
  const prevMonthStart = new Date(year, monthIndex - 1, 1);
  const prevMonthEnd = new Date(year, monthIndex, 1);

  /* dark mode observer */
  useEffect(() => {
    const html = document.documentElement;
    setIsDark(html.classList.contains("dark"));
    const obs = new MutationObserver(() => setIsDark(html.classList.contains("dark")));
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => { loadBusinesses().then(setBusinesses); }, []);

  useEffect(() => {
    if (!selectedBusinessIds.length) return;
    setLoading(true);
    Promise.all([
      loadSales(selectedBusinessIds, monthStart, monthEnd),
      loadSales(selectedBusinessIds, prevMonthStart, prevMonthEnd),
      loadShifts(selectedBusinessIds, monthStart, monthEnd),
      loadEmployees(selectedBusinessIds),
    ]).then(([sal, salPrev, shi, emp]) => {
      setSales(sal);
      setSalesPrev(salPrev);
      setShifts(shi);
      setEmployees(emp);
    }).finally(() => setLoading(false));
  }, [selectedBusinessIds, selectedMonth]);

  /* ─── derived ─── */
  const filteredSales = useMemo(() =>
    sales.filter((s) => selectedWeekday === "" || new Date(s.timestamp).getDay() === Number(selectedWeekday)),
    [sales, selectedWeekday]
  );

  const filteredShifts = useMemo(() =>
    shifts.filter((sh) => selectedWeekday === "" || new Date(sh.start_time).getDay() === Number(selectedWeekday)),
    [shifts, selectedWeekday]
  );

  const daysArray = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) => new Date(year, monthIndex, i + 1)),
    [year, monthIndex, daysInMonth]
  );

  /* ─── KPIs ─── */
  const kpis = useMemo(() => {
    const total = filteredSales.reduce((s, v) => s + (v.total || 0), 0);
    const prevTotal = salesPrev.reduce((s, v) => s + (v.total || 0), 0);
    const count = filteredSales.length;
    const prevCount = salesPrev.length;
    const ticket = count > 0 ? total / count : 0;
    const prevTicket = prevCount > 0 ? prevTotal / prevCount : 0;

    const payByMethod = filteredSales.reduce((acc: Record<string, number>, s) => {
      const m = s.payment_method || "other";
      acc[m] = (acc[m] || 0) + (s.total || 0);
      return acc;
    }, {});

    const efectivo = payByMethod["cash"] || 0;
    const tarjeta = payByMethod["card"] || 0;
    const transfer = (payByMethod["transfer"] || 0) + (payByMethod["mercadopago"] || 0);
    const rappi = payByMethod["rappi"] || 0;

    // días con ventas (días activos)
    const activeDays = new Set(filteredSales.map((s) => new Date(s.timestamp).toDateString())).size;
    const dailyAvg = activeDays > 0 ? total / activeDays : 0;
    const prevDays = new Set(salesPrev.map((s) => new Date(s.timestamp).toDateString())).size;
    const prevDailyAvg = prevDays > 0 ? prevTotal / prevDays : 0;

    // hora pico
    const hourTotals: Record<number, number> = {};
    filteredSales.forEach((s) => {
      const h = new Date(s.timestamp).getHours();
      hourTotals[h] = (hourTotals[h] || 0) + (s.total || 0);
    });
    const peakHour = Object.entries(hourTotals).sort(([, a], [, b]) => b - a)[0]?.[0];

    // mejor día de la semana
    const dayTotals: Record<number, number> = {};
    filteredSales.forEach((s) => {
      const d = new Date(s.timestamp).getDay();
      dayTotals[d] = (dayTotals[d] || 0) + (s.total || 0);
    });
    const bestDayNum = Object.entries(dayTotals).sort(([, a], [, b]) => b - a)[0]?.[0];
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const bestDay = bestDayNum !== undefined ? dayNames[Number(bestDayNum)] : "—";

    // turnos
    const completedShifts = filteredShifts.filter((sh) => sh.end_time);
    const avgShiftRevenue = completedShifts.length > 0
      ? completedShifts.reduce((s, sh) => {
          const shiftTotal = filteredSales.filter((sa) => sa.shift_id === sh.id).reduce((a, v) => a + v.total, 0);
          return s + shiftTotal;
        }, 0) / completedShifts.length
      : 0;

    const trendTotal = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    const trendTicket = prevTicket > 0 ? ((ticket - prevTicket) / prevTicket) * 100 : 0;
    const trendDaily = prevDailyAvg > 0 ? ((dailyAvg - prevDailyAvg) / prevDailyAvg) * 100 : 0;
    const trendCount = prevCount > 0 ? ((count - prevCount) / prevCount) * 100 : 0;

    return {
      total, count, ticket, efectivo, tarjeta, transfer, rappi,
      dailyAvg, activeDays, peakHour, bestDay, avgShiftRevenue,
      trendTotal, trendTicket, trendDaily, trendCount,
    };
  }, [filteredSales, salesPrev, filteredShifts]);

  /* ─── daily stats ─── */
  const dailyStats = useMemo(() =>
    daysArray.map((day) => {
      const ds = filteredSales.filter((s) => {
        const d = new Date(s.timestamp);
        return d.toDateString() === day.toDateString();
      });
      let efectivo = 0, tarjeta = 0, transferencia = 0, total = 0;
      for (const s of ds) {
        const t = s.total || 0;
        total += t;
        const m = (s.payment_method || "").toLowerCase();
        if (m === "cash") efectivo += t;
        else if (m === "card") tarjeta += t;
        else if (m === "transfer" || m === "mercadopago") transferencia += t;
      }
      return { date: day, efectivo, tarjeta, transferencia, totalSales: total, salesCount: ds.length };
    }),
    [daysArray, filteredSales]
  );

  const displayedStats = useMemo(() =>
    dailyStats.filter((ds) => selectedWeekday === "" || ds.date.getDay() === Number(selectedWeekday)),
    [dailyStats, selectedWeekday]
  );

  /* ─── chart colors ─── */
  const tick = isDark ? "#94a3b8" : "#64748b";
  const grid = isDark ? "#1e293b" : "#f1f5f9";

  const baseOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: isDark ? "#1e293b" : "#fff",
        titleColor: isDark ? "#e2e8f0" : "#1e293b",
        bodyColor: isDark ? "#94a3b8" : "#64748b",
        borderColor: isDark ? "#334155" : "#e2e8f0",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: any) => ` $${fmt(ctx.parsed.y ?? ctx.parsed.x ?? 0)}`,
        },
      },
    },
    scales: {
      x: { ticks: { color: tick, font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { color: tick, font: { size: 11 }, callback: (v: any) => fmtM(v) }, grid: { color: grid } },
    },
  }), [isDark, tick, grid]);

  /* ─── chart data ─── */
  const stackedBarData = useMemo(() => ({
    labels: displayedStats.map((d) => d.date.getDate().toString()),
    datasets: [
      {
        label: "Efectivo",
        data: displayedStats.map((d) => d.efectivo),
        backgroundColor: "#10b981",
        borderRadius: 4,
      },
      {
        label: "Tarjeta",
        data: displayedStats.map((d) => d.tarjeta),
        backgroundColor: "#6366f1",
        borderRadius: 4,
      },
      {
        label: "Transfer/MP",
        data: displayedStats.map((d) => d.transferencia),
        backgroundColor: "#8b5cf6",
        borderRadius: 4,
      },
    ],
  }), [displayedStats]);

  const stackedOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: {
        display: true,
        labels: { color: tick, font: { size: 11 }, boxWidth: 12, boxHeight: 12, borderRadius: 4 },
      },
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: $${fmt(ctx.parsed.y || 0)}`,
        },
      },
    },
    scales: {
      ...baseOptions.scales,
      x: { ...baseOptions.scales.x, stacked: true },
      y: { ...baseOptions.scales.y, stacked: true },
    },
  }), [baseOptions, tick]);

  const ticketData = useMemo(() => ({
    labels: displayedStats.map((d) => d.date.getDate().toString()),
    datasets: [{
      data: displayedStats.map((d) => d.salesCount > 0 ? d.totalSales / d.salesCount : 0),
      borderColor: "#6366f1",
      backgroundColor: "rgba(99,102,241,0.08)",
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: "#6366f1",
      fill: true,
    }],
  }), [displayedStats]);

  const countData = useMemo(() => ({
    labels: displayedStats.map((d) => d.date.getDate().toString()),
    datasets: [{
      data: displayedStats.map((d) => d.salesCount),
      borderColor: "#10b981",
      backgroundColor: "rgba(16,185,129,0.08)",
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: "#10b981",
      fill: true,
    }],
  }), [displayedStats]);

  const countOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: { label: (ctx: any) => ` ${fmt(ctx.parsed.y)} ventas` },
      },
    },
    scales: {
      ...baseOptions.scales,
      y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, callback: (v: any) => String(Math.round(v)) } },
    },
  }), [baseOptions]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const counts = hours.map((h) =>
      filteredSales.filter((s) => new Date(s.timestamp).getHours() === h).length
    );
    const amounts = hours.map((h) =>
      filteredSales.filter((s) => new Date(s.timestamp).getHours() === h)
        .reduce((a, s) => a + (s.total || 0), 0)
    );
    return {
      labels: hours.map((h) => `${String(h).padStart(2, "0")}h`),
      datasets: [
        {
          label: "Ventas $",
          data: amounts,
          backgroundColor: "rgba(99,102,241,0.7)",
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "Cantidad",
          data: counts,
          backgroundColor: "rgba(16,185,129,0.5)",
          borderRadius: 4,
          yAxisID: "y1",
        },
      ],
    };
  }, [filteredSales]);

  const hourlyOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: {
        display: true,
        labels: { color: tick, font: { size: 11 }, boxWidth: 12, boxHeight: 12 },
      },
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (ctx: any) =>
            ctx.datasetIndex === 0
              ? ` $${fmt(ctx.parsed.y)}`
              : ` ${ctx.parsed.y} ventas`,
        },
      },
    },
    scales: {
      ...baseOptions.scales,
      y: { ...baseOptions.scales.y, position: "left" as const },
      y1: {
        position: "right" as const,
        ticks: { color: tick, font: { size: 11 } },
        grid: { display: false },
      },
    },
  }), [baseOptions, tick]);

  const weekdayData = useMemo(() => {
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const totals = Array(7).fill(0);
    const counts = Array(7).fill(0);
    sales.forEach((s) => {
      const d = new Date(s.timestamp).getDay();
      totals[d] += s.total || 0;
      counts[d]++;
    });
    return {
      labels: dayNames,
      datasets: [{
        label: "Prom. de ventas",
        data: dayNames.map((_, i) => counts[i] > 0 ? totals[i] / counts[i] : 0),
        backgroundColor: [
          "rgba(99,102,241,0.7)","rgba(99,102,241,0.7)","rgba(99,102,241,0.7)",
          "rgba(99,102,241,0.7)","rgba(99,102,241,0.7)","rgba(16,185,129,0.7)",
          "rgba(245,158,11,0.7)",
        ],
        borderRadius: 6,
      }],
    };
  }, [sales]);

  const empData = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredShifts.forEach((sh) => {
      const shiftSales = filteredSales.filter((s) => s.shift_id === sh.id);
      const sum = shiftSales.reduce((a, s) => a + (s.total || 0), 0);
      if (!map[sh.employee_id]) map[sh.employee_id] = { total: 0, count: 0 };
      map[sh.employee_id].total += sum;
      map[sh.employee_id].count++;
    });
    const sorted = Object.entries(map)
      .map(([id, v]) => ({ name: employees.find((e) => e.id === id)?.name || id, avg: v.count > 0 ? v.total / v.count : 0, total: v.total }))
      .sort((a, b) => b.total - a.total);
    return {
      labels: sorted.map((e) => e.name),
      datasets: [{
        label: "Total facturado",
        data: sorted.map((e) => e.total),
        backgroundColor: "rgba(99,102,241,0.7)",
        borderRadius: 6,
      }],
    };
  }, [filteredShifts, filteredSales, employees]);

  const empOptions = useMemo(() => ({
    ...baseOptions,
    indexAxis: "y" as const,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: { label: (ctx: any) => ` $${fmt(ctx.parsed.x || 0)}` },
      },
    },
    scales: {
      x: { ...baseOptions.scales.y, position: "bottom" as const },
      y: { ...baseOptions.scales.x, position: "left" as const },
    },
  }), [baseOptions]);

  /* ─── nav ─── */
  const prevMonth = () => setSelectedMonth(new Date(year, monthIndex - 1, 1));
  const nextMonth = () => {
    const n = new Date(year, monthIndex + 1, 1);
    if (n <= new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
      setSelectedMonth(n);
  };
  const nextDisabled = new Date(year, monthIndex + 1, 1) >
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  const toggleBusiness = (id: string) =>
    setSelectedBusinessIds((p) => p.includes(id) ? p.filter((b) => b !== id) : [...p, id]);

  const monthLabel = selectedMonth.toLocaleString("es-AR", { month: "long", year: "numeric" });

  const hasData = !loading && selectedBusinessIds.length > 0;

  /* ─── render ─── */
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

      {/* ══ HEADER ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Estadísticas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Ventas, métodos de pago y rendimiento por turno
          </p>
        </div>
        {selectedBusinessIds.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 self-start sm:self-auto capitalize">
            <BarChart2 className="w-3.5 h-3.5" />
            {monthLabel}
          </span>
        )}
      </div>

      {/* ══ FILTROS ══ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-5 shadow-sm space-y-5">
        {/* Negocios */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Negocios</label>
            <div className="flex gap-2">
              <button onClick={() => setSelectedBusinessIds(businesses.map((b) => b.id))}
                className="text-xs px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors">
                Todos
              </button>
              <button onClick={() => setSelectedBusinessIds([])}
                className="text-xs px-2.5 py-1 rounded-full border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors">
                Limpiar
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {businesses.map((b) => {
              const sel = selectedBusinessIds.includes(b.id);
              return (
                <button key={b.id} onClick={() => toggleBusiness(b.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    sel
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mes + día */}
        <div className="flex flex-col sm:flex-row gap-5 border-t border-slate-100 dark:border-slate-800 pt-4">
          {/* Nav mes */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">Mes</label>
            <div className="flex items-center gap-1 ml-2">
              <button onClick={prevMonth}
                className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
              <span className="px-3 text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize whitespace-nowrap">
                {monthLabel}
              </span>
              <button onClick={nextMonth} disabled={nextDisabled}
                className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>

          {/* Día de la semana */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">Día</label>
            <div className="flex flex-wrap gap-1.5 ml-2">
              {WEEKDAYS.map(({ v, l }) => (
                <button key={v} onClick={() => setSelectedWeekday(v)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    selectedWeekday === v
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ ESTADO VACÍO ══ */}
      {!selectedBusinessIds.length && (
        <div className="flex flex-col items-center justify-center h-52 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 gap-3">
          <BarChart2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">Seleccioná uno o más negocios para ver estadísticas</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center h-52 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Cargando estadísticas…</p>
        </div>
      )}

      {hasData && (
        <>
          {/* ══ KPIs PRINCIPALES ══ */}
          <section>
            <SectionHeader title="Resumen del período" sub="Comparado con el mes anterior" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <KpiCard label="Ventas totales" value={fmtM(kpis.total)} icon={TrendingUp} color="indigo"
                trend={kpis.trendTotal} trendLabel="vs mes anterior" />
              <KpiCard label="N° de ventas" value={fmt(kpis.count)} icon={ShoppingCart} color="emerald"
                trend={kpis.trendCount} trendLabel="vs mes anterior" />
              <KpiCard label="Ticket promedio" value={fmtM(kpis.ticket)} icon={BarChart2} color="violet"
                trend={kpis.trendTicket} trendLabel="vs mes anterior" />
              <KpiCard label="Promedio diario" value={fmtM(kpis.dailyAvg)} icon={Calendar} color="sky"
                trend={kpis.trendDaily} trendLabel="vs mes anterior" />
            </div>
          </section>

          {/* ══ KPIs SECUNDARIOS ══ */}
          <section>
            <SectionHeader title="Métodos y operaciones" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <KpiCard label="Efectivo" value={fmtM(kpis.efectivo)} sub={`${kpis.total > 0 ? ((kpis.efectivo / kpis.total) * 100).toFixed(1) : 0}% del total`} icon={Banknote} color="emerald" />
              <KpiCard label="Tarjeta" value={fmtM(kpis.tarjeta)} sub={`${kpis.total > 0 ? ((kpis.tarjeta / kpis.total) * 100).toFixed(1) : 0}% del total`} icon={CreditCard} color="indigo" />
              <KpiCard label="Transfer / MP" value={fmtM(kpis.transfer)} sub={`${kpis.total > 0 ? ((kpis.transfer / kpis.total) * 100).toFixed(1) : 0}% del total`} icon={Wallet} color="violet" />
              <KpiCard label="Rappi" value={fmtM(kpis.rappi)} sub={`${kpis.total > 0 ? ((kpis.rappi / kpis.total) * 100).toFixed(1) : 0}% del total`} icon={Zap} color="amber" />
              <KpiCard label="Días con ventas" value={String(kpis.activeDays)} sub={`de ${daysInMonth} días del mes`} icon={Calendar} color="slate" />
              <KpiCard label="Hora pico" value={kpis.peakHour !== undefined ? `${kpis.peakHour}:00 hs` : "—"} sub="mayor facturación" icon={Clock} color="rose" />
              <KpiCard label="Mejor día" value={kpis.bestDay} sub="mayor facturación" icon={TrendingUp} color="emerald" />
              <KpiCard label="Prom. por turno" value={fmtM(kpis.avgShiftRevenue)} sub="turnos completados" icon={Users} color="sky" />
            </div>
          </section>

          {/* ══ VENTAS POR MÉTODO (stacked) ══ */}
          <section>
            <SectionHeader title="Ventas diarias por método de pago" sub="Desglose de efectivo, tarjeta y transferencia" />
            <ChartCard title="Composición diaria" sub="Apilado por método de pago">
              <Bar
                data={stackedBarData}
                options={{ ...stackedOptions, scales: { ...stackedOptions.scales, x: { ...stackedOptions.scales.x, stacked: true }, y: { ...stackedOptions.scales.y, stacked: true } } }}
              />
            </ChartCard>
          </section>

          {/* ══ TABLA DIARIA ══ */}
          <section>
            <SectionHeader title="Detalle diario" sub={`${displayedStats.length} días en el período`} />
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[380px]">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                    <tr>
                      {["Fecha", "Efectivo", "Tarjeta", "Transfer/MP", "Ventas #", "Total día"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedStats.map((ds, i) => (
                      <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${ds.totalSales === 0 ? "opacity-40" : ""}`}>
                        <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">
                          {ds.date.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">${fmt(ds.efectivo)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">${fmt(ds.tarjeta)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-violet-600 dark:text-violet-400 font-semibold">${fmt(ds.transferencia)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300 text-center">{ds.salesCount}</td>
                        <td className="px-4 py-2.5 tabular-nums font-bold text-slate-900 dark:text-white">${fmt(ds.totalSales)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <tr>
                      <td className="px-4 py-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Totales</td>
                      <td className="px-4 py-3 tabular-nums font-bold text-emerald-700 dark:text-emerald-300">${fmt(displayedStats.reduce((s, d) => s + d.efectivo, 0))}</td>
                      <td className="px-4 py-3 tabular-nums font-bold text-indigo-700 dark:text-indigo-300">${fmt(displayedStats.reduce((s, d) => s + d.tarjeta, 0))}</td>
                      <td className="px-4 py-3 tabular-nums font-bold text-violet-700 dark:text-violet-300">${fmt(displayedStats.reduce((s, d) => s + d.transferencia, 0))}</td>
                      <td className="px-4 py-3 tabular-nums font-bold text-slate-700 dark:text-slate-200 text-center">{displayedStats.reduce((s, d) => s + d.salesCount, 0)}</td>
                      <td className="px-4 py-3 tabular-nums font-bold text-slate-900 dark:text-white">${fmt(displayedStats.reduce((s, d) => s + d.totalSales, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>

          {/* ══ GRÁFICOS ANALÍTICOS ══ */}
          <section>
            <SectionHeader title="Análisis de comportamiento" sub="Patrones de ventas por hora, día y empleado" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Ticket promedio por día" sub="Tendencia del valor promedio de venta">
                <Line data={ticketData} options={baseOptions} />
              </ChartCard>
              <ChartCard title="Cantidad de ventas por día" sub="Volumen de transacciones diarias">
                <Line data={countData} options={countOptions} />
              </ChartCard>
              <ChartCard title="Facturación por hora del día" sub="Monto y cantidad de ventas por franja horaria">
                <Bar data={hourlyData} options={hourlyOptions} />
              </ChartCard>
              <ChartCard title="Promedio por día de la semana" sub="Cuáles días rinden más en el período">
                <Bar data={weekdayData} options={baseOptions} />
              </ChartCard>
            </div>
          </section>

          {/* ══ EMPLEADOS ══ */}
          {employees.length > 0 && (
            <section>
              <SectionHeader title="Facturación por empleado" sub="Total generado en turnos del período" />
              <ChartCard title="Ranking de empleados" sub="Total facturado por empleado en el período">
                <Bar data={empData} options={empOptions} />
              </ChartCard>
            </section>
          )}
        </>
      )}
    </div>
  );
}