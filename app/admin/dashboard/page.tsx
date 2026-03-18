"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Banknote,
  Building2,
  CalendarDays,
  CreditCard,
  Flame,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  BarChart2,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   FECHAS / RANGOS
   ───────────────────────────────────────────────────────── */
function threeMonthWindow(offset = 0) {
  const base = new Date();
  const baseMonth = base.getMonth() + offset;
  const year = base.getFullYear();
  const start = new Date(year, baseMonth - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, baseMonth + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

function dayBounds(offsetDays = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays + 1, 0, 0, 0, 0);
  return { start, end };
}

function monthRange(offset = 0) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

/* ─────────────────────────────────────────────────────────
   FORMATO / UTILS
   ───────────────────────────────────────────────────────── */
const formatNumberAbbrev = (n: number) =>
  n >= 1e6
    ? (n / 1e6).toFixed(1) + "M"
    : n >= 1e3
    ? (n / 1e3).toFixed(1) + "k"
    : n.toFixed(0);
const formatPrice = (n: number) =>
  (n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtMoney = (n: number) => `$ ${formatPrice(n || 0)}`;
const fmtShortMoney = (n: number) =>
  `$ ${formatNumberAbbrev(Math.max(0, Math.round(n || 0)))}`;
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/* ─────────────────────────────────────────────────────────
   AHORRO (CONFIG)
   ───────────────────────────────────────────────────────── */
const SAVING_CONFIG = {
  mode: "percent" as "percent" | "fixed" | "hybrid",
  percent: 0.45,
  fixedPerDay: 180_000,
  hybridThreshold: 330_000,
};

function savingTargetForDayAmount(amount: number): number {
  const { mode, percent, fixedPerDay, hybridThreshold } = SAVING_CONFIG;
  if (mode === "percent") return amount * percent;
  if (mode === "fixed") return fixedPerDay;
  const extra = Math.max(0, amount - hybridThreshold) * percent;
  return fixedPerDay + extra;
}

function savingTargetForMTD(
  mtdAmount: number,
  daysElapsedInMonth: number
): number {
  const { mode, percent, fixedPerDay, hybridThreshold } = SAVING_CONFIG;
  if (mode === "percent") return mtdAmount * percent;
  if (mode === "fixed") return fixedPerDay * daysElapsedInMonth;
  const avgPerDay =
    daysElapsedInMonth > 0 ? mtdAmount / daysElapsedInMonth : 0;
  const extraPerDay = Math.max(0, avgPerDay - hybridThreshold) * percent;
  return daysElapsedInMonth * (fixedPerDay + extraPerDay);
}

/* ─────────────────────────────────────────────────────────
   MÉTODOS (UNIFICACIÓN)
   ───────────────────────────────────────────────────────── */
const UNIFIED_KEYS = ["cash", "card", "rappi", "consumo"] as const;
type UnifiedKey = (typeof UNIFIED_KEYS)[number];

const unifyPayments = (pm: Record<string, number> = {}) => ({
  cash: pm.cash ?? 0,
  card: (pm.card ?? 0) + (pm.transfer ?? 0) + (pm.mercadopago ?? 0),
  rappi: pm.rappi ?? 0,
  consumo: pm.consumo ?? 0,
});

const unifyExpenses = (em: Record<string, number> = {}) => ({
  cash: em.cash ?? 0,
  card: (em.card ?? 0) + (em.transfer ?? 0) + (em.mercadopago ?? 0),
  rappi: em.rappi ?? 0,
  consumo: em.consumo ?? 0,
});

const METHOD_META_UNI: Record<
  UnifiedKey,
  { label: string; short: string; barClass: string; dotClass: string }
> = {
  cash: {
    label: "Efectivo",
    short: "EF",
    barClass: "bg-emerald-500",
    dotClass: "bg-emerald-500",
  },
  card: {
    label: "Tarjeta / Transfer",
    short: "TJ/TR",
    barClass: "bg-indigo-500",
    dotClass: "bg-indigo-500",
  },
  rappi: {
    label: "Rappi",
    short: "RP",
    barClass: "bg-orange-500",
    dotClass: "bg-orange-500",
  },
  consumo: {
    label: "Consumo",
    short: "CI",
    barClass: "bg-slate-400",
    dotClass: "bg-slate-400",
  },
};

/* ─────────────────────────────────────────────────────────
   FETCH PAGINADO
   ───────────────────────────────────────────────────────── */
async function fetchAllPaginated(
  queryFn: (
    from: number,
    to: number
  ) => Promise<{ data: any[] | null; error: any }>
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

/* ─────────────────────────────────────────────────────────
   QUERIES
   ───────────────────────────────────────────────────────── */
const loadBusinesses = async () => {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("name");
  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
};

const loadSales = async (businessId: string, from: Date, to: Date) =>
  fetchAllPaginated((lo, hi) =>
    supabase
      .from("sales")
      .select("*")
      .eq("business_id", businessId)
      .gte("timestamp", from.toISOString())
      .lt("timestamp", to.toISOString())
      .order("timestamp", { ascending: false })
      .range(lo, hi)
  );

const loadSaleItemsPorSaleIds = async (saleIds: string[]) => {
  if (!saleIds.length) return [];
  const pageSize = 1000;
  const batches = [];
  for (let i = 0; i < saleIds.length; i += pageSize) {
    const batchIds = saleIds.slice(i, i + pageSize);
    batches.push(
      supabase
        .from("sale_items")
        .select(
          `
          sale_id, quantity, total, stock, product_id, product_master_id, promotion_id,
          products ( name ), products_master ( name ), promotion:promos ( name )
        `
        )
        .in("sale_id", batchIds)
    );
  }
  const results = await Promise.all(batches);
  return results.flatMap((r) => r.data || []);
};

const loadProducts = async (businessId: string) =>
  fetchAllPaginated((lo, hi) =>
    supabase
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .range(lo, hi)
  );

const loadExpenses = async (businessId: string, from: Date, to: Date) =>
  fetchAllPaginated((lo, hi) =>
    supabase
      .from("expenses")
      .select("*")
      .eq("business_id", businessId)
      .gte("date", from.toISOString())
      .lt("date", to.toISOString())
      .order("date", { ascending: false })
      .range(lo, hi)
  );

/* ─────────────────────────────────────────────────────────
   CATEGORÍAS
   ───────────────────────────────────────────────────────── */
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
] as const;

function extractCategory(name: string) {
  const parts = (name || "").trim().split(" ");
  if (
    parts.length > 1 &&
    categories.includes(parts[0].toUpperCase() as any)
  )
    return {
      category: parts[0].toUpperCase(),
      baseName: parts.slice(1).join(" "),
    };
  return { category: null, baseName: name };
}

/* ─────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────── */
function marginSemaforo(m: number) {
  if (m >= 40)
    return {
      pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      dot: "bg-emerald-500",
    };
  if (m >= 20)
    return {
      pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      dot: "bg-amber-500",
    };
  return {
    pill: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    dot: "bg-red-500",
  };
}

/* ─────────────────────────────────────────────────────────
   BUSINESS CARD (rediseñada, mobile-first)
   ───────────────────────────────────────────────────────── */
function BusinessCard({
  b,
  open,
  onToggle,
}: {
  b: any;
  open: boolean;
  onToggle: () => void;
}) {
  const total = b.totalAmount ?? 0;
  const gastos = b.totalExpense ?? 0;
  const profit = total - gastos;
  const margin = total > 0 ? (profit / total) * 100 : 0;
  const tx = b.transactions ?? 0;
  const ticket = b.avgTicket ?? 0;
  const dailyAvg = b.dailyAvg ?? 0;

  const payments = useMemo(() => unifyPayments(b.paymentMethods || {}), [b]);
  const expensesByMethod = useMemo(
    () => unifyExpenses(b.expensesByMethod || {}),
    [b]
  );

  const segments = useMemo(
    () =>
      (UNIFIED_KEYS as UnifiedKey[]).map((k) => ({
        key: k,
        value: payments[k],
        pct: clamp(pct(payments[k], total)),
        ...METHOD_META_UNI[k],
      })),
    [payments, total]
  );

  const { pill, dot } = marginSemaforo(margin);
  const saving: { today: number; yesterday: number; mtd: number } | undefined =
    b.savingTargets;

  const savingModeLabel = useMemo(() => {
    return SAVING_CONFIG.mode === "percent"
      ? `${(SAVING_CONFIG.percent * 100).toFixed(0)}%`
      : SAVING_CONFIG.mode === "fixed"
      ? `$ ${formatPrice(SAVING_CONFIG.fixedPerDay)}/día`
      : "Híbrido";
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && onToggle()
      }
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {b.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full ${pill}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {margin.toFixed(1)}%
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* KPIs principales — 2 col en mobile, 3 en tablet */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-slate-100 dark:bg-slate-800 border-t border-b border-slate-100 dark:border-slate-800">
        {[
          {
            label: "Ventas",
            value: fmtMoney(total),
            color: "text-slate-900 dark:text-white",
          },
          {
            label: "Gastos",
            value: fmtMoney(gastos),
            color: "text-red-600 dark:text-red-400",
          },
          {
            label: "Profit",
            value: fmtMoney(profit),
            color:
              profit >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
          },
          {
            label: "Ticket prom.",
            value: fmtMoney(ticket),
            color: "text-slate-700 dark:text-slate-300",
          },
          {
            label: "N° ventas",
            value: tx.toString(),
            color: "text-slate-700 dark:text-slate-300",
          },
          {
            label: "Prom. diario",
            value: fmtShortMoney(dailyAvg),
            color: "text-indigo-600 dark:text-indigo-400",
            icon: <BarChart2 className="w-3 h-3 inline mr-0.5 opacity-70" />,
          },
        ].map(({ label, value, color, icon }) => (
          <div
            key={label}
            className="bg-white dark:bg-slate-900 px-3 py-2.5"
          >
            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 leading-none mb-1">
              {label}
            </div>
            <div className={`text-sm font-bold tabular-nums ${color}`}>
              {icon}
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Ahorro objetivo */}
      {saving && (
        <div className="px-4 py-2.5 flex flex-wrap items-center gap-1.5 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Ahorro ({savingModeLabel})
          </span>
          {[
            { label: "Hoy", value: saving.today },
            { label: "Ayer", value: saving.yesterday },
            { label: "Mes", value: saving.mtd },
          ].map(({ label, value }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-200"
            >
              <span className="font-medium">{label}:</span>
              <span className="font-bold tabular-nums">
                {fmtShortMoney(value)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Barra de métodos de pago */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {segments.map(
            (s) =>
              s.pct > 0 && (
                <div
                  key={s.key}
                  className={`${s.barClass} h-full`}
                  style={{ width: `${s.pct}%` }}
                  title={`${s.label}: ${fmtMoney(s.value)} (${s.pct.toFixed(0)}%)`}
                />
              )
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 pb-3">
          {segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <span
                key={`legend-${s.key}`}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full ${s.dotClass}`}
                />
                <span className="text-slate-600 dark:text-slate-300">
                  {s.short}:
                </span>
                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {fmtMoney(s.value)}
                </span>
              </span>
            ))}
        </div>
      </div>

      {/* Detalle expandible */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">
                    Método
                  </th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">
                    Ventas
                  </th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">
                    Gastos
                  </th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">
                    Profit
                  </th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">
                    Part.
                  </th>
                </tr>
              </thead>
              <tbody>
                {UNIFIED_KEYS.map((k) => {
                  const ventas = payments[k];
                  const egres = expensesByMethod[k];
                  const pft = ventas - egres;
                  return (
                    <tr
                      key={`row-${k}`}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${METHOD_META_UNI[k].dotClass}`}
                          />
                          <span className="text-slate-700 dark:text-slate-300">
                            {METHOD_META_UNI[k].label}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                        {fmtMoney(ventas)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">
                        {fmtMoney(egres)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-semibold ${
                          pft >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {fmtMoney(pft)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                        {pct(ventas, total).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SHIFT CARD (rediseñada, con indicador vs promedio diario)
   ───────────────────────────────────────────────────────── */
function ShiftCard({
  sh,
  empName,
  businessName,
  payments,
  total,
  avgHr,
  onOpenDetails,
  startTime,
  dailyAvg,
}: {
  sh: any;
  empName: string;
  businessName: string;
  payments: Record<
    "cash" | "card" | "transfer" | "mercadopago" | "rappi" | "consumo",
    number
  >;
  total: number;
  avgHr: number;
  onOpenDetails: any;
  startTime: string;
  dailyAvg: number;
}) {
  const unified = {
    cash: payments.cash ?? 0,
    card: payments.card ?? 0,
    transfer: (payments.transfer ?? 0) + (payments.mercadopago ?? 0),
    rappi: payments.rappi ?? 0,
    consumo: payments.consumo ?? 0,
  };

  const items = [
    {
      key: "cash",
      label: "Efectivo",
      icon: Banknote,
      value: unified.cash,
      dot: "bg-emerald-500",
      pill: "bg-emerald-50 dark:bg-emerald-900/30",
    },
    {
      key: "card",
      label: "Tarjeta",
      icon: CreditCard,
      value: unified.card,
      dot: "bg-indigo-500",
      pill: "bg-indigo-50 dark:bg-indigo-900/30",
    },
    {
      key: "transfer",
      label: "Transfer/MP",
      icon: Wallet,
      value: unified.transfer,
      dot: "bg-yellow-500",
      pill: "bg-yellow-50 dark:bg-yellow-900/30",
    },
    {
      key: "rappi",
      label: "Rappi",
      icon: Flame,
      value: unified.rappi,
      dot: "bg-orange-500",
      pill: "bg-orange-50 dark:bg-orange-900/30",
    },
    {
      key: "consumo",
      label: "Consumo",
      icon: Building2,
      value: unified.consumo,
      dot: "bg-slate-400",
      pill: "bg-slate-50 dark:bg-slate-800/40",
    },
  ] as const;

  const percent = (n: number) =>
    total > 0 ? Math.max(0, Math.min(100, (n / total) * 100)) : 0;
  const fmt = (n: number) => `$ ${formatPrice(n || 0)}`;
  const initials = (empName || "—")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const started = new Date(startTime);
  const hours = Math.max(0, (Date.now() - started.getTime()) / 36e5);
  const hh = Math.floor(hours);
  const mm = Math.floor((hours - hh) * 60);

  // Indicador vs promedio diario del negocio
  const vsAvg = dailyAvg > 0 ? ((total - dailyAvg) / dailyAvg) * 100 : null;
  const isAbove = vsAvg !== null && vsAvg >= 0;
  const isNeutral = vsAvg === null || Math.abs(vsAvg) < 2;

  const vsAvgConfig = isNeutral
    ? {
        label: "Sin referencia",
        icon: Minus,
        bg: "bg-slate-100 dark:bg-slate-800",
        text: "text-slate-500 dark:text-slate-400",
        iconColor: "text-slate-400",
      }
    : isAbove
    ? {
        label: `+${vsAvg!.toFixed(1)}% vs prom. diario`,
        icon: TrendingUp,
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        text: "text-emerald-700 dark:text-emerald-400",
        iconColor: "text-emerald-600 dark:text-emerald-400",
      }
    : {
        label: `${vsAvg!.toFixed(1)}% vs prom. diario`,
        icon: TrendingDown,
        bg: "bg-red-50 dark:bg-red-900/20",
        text: "text-red-700 dark:text-red-400",
        iconColor: "text-red-600 dark:text-red-400",
      };

  const VsIcon = vsAvgConfig.icon;

  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
      onClick={onOpenDetails}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenDetails?.()}
      role="button"
      tabIndex={0}
    >
      {/* Header: avatar + nombre + tiempo activo */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-sm shrink-0">
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{empName || sh.employee_id}</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                ACTIVO
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{businessName}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Tiempo activo</div>
          <div className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{hh}h {mm}m</div>
        </div>
      </div>

      {/* KPIs: ventas grande + prom/hora */}
      <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800">
        <div className="bg-white dark:bg-slate-900 px-5 py-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Ventas del turno</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(total)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 px-5 py-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Promedio / hora</div>
          <div className="text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{fmt(avgHr)}</div>
        </div>
      </div>

      {/* Barra de métodos de pago */}
      <div className="px-5 pt-4">
        <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {items.map(
            (it) =>
              it.value > 0 && (
                <div
                  key={it.key}
                  className={`${it.dot} h-full`}
                  style={{ width: `${percent(it.value)}%` }}
                  title={`${it.label}: ${fmt(it.value)} (${percent(it.value).toFixed(0)}%)`}
                />
              )
          )}
        </div>
      </div>

      {/* Chips de métodos */}
      <div className="px-5 pt-3 pb-4 flex flex-wrap gap-2">
        {items
          .filter((it) => it.value > 0)
          .map((it) => (
            <div
              key={`chip-${it.key}`}
              className={`${it.pill} rounded-xl px-3 py-2 flex items-center gap-2 border border-slate-200/70 dark:border-slate-700/60`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${it.dot}`} />
              <it.icon className="w-3.5 h-3.5 opacity-60 text-slate-600 dark:text-slate-300 shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-300">{it.label}</span>
              <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">{fmt(it.value)}</span>
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-2.5 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Inicio: {started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span>·</span>
        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
        <span>{started.toLocaleDateString()}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SHIFT PRODUCTS MODAL
   ───────────────────────────────────────────────────────── */
function ShiftProductsModal({
  open,
  onClose,
  employee,
  business,
  startedAt,
  rows,
  loading,
  total,
}: {
  open: boolean;
  onClose: () => void;
  employee: string;
  business: string;
  startedAt: string;
  rows: Array<{
    category: string;
    items: { name: string; qty: number; unit: number; total: number }[];
  }>;
  loading: boolean;
  total: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {employee}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {business} · Inicio:{" "}
              {new Date(startedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="h-40 grid place-items-center text-slate-500">
              Cargando…
            </div>
          ) : !rows.length ? (
            <div className="h-40 grid place-items-center text-slate-500">
              No hay productos registrados.
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto space-y-5">
              {rows.map((cat, i) => (
                <div key={i}>
                  <h4 className="font-semibold text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">
                    {cat.category}
                  </h4>
                  <table className="w-full text-sm">
                    <thead className="text-[11px] text-slate-400">
                      <tr>
                        <th className="text-left py-1">Producto</th>
                        <th className="text-right py-1">Cant.</th>
                        <th className="text-right py-1">$/u</th>
                        <th className="text-right py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.items.map((r, idx) => (
                        <tr
                          key={idx}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-1.5 text-slate-800 dark:text-slate-100">
                            {r.name}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                            {r.qty}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                            $ {formatPrice(r.unit)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-semibold text-slate-900 dark:text-white">
                            $ {formatPrice(r.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Total del turno
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  $ {formatPrice(total)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   UTILS
   ───────────────────────────────────────────────────────── */
const getGroupVal = (b: any) =>
  b?.group ?? b?.group_id ?? b?.groupId ?? b?.grupo ?? null;
const isGroup1 = (b: any) => String(getGroupVal(b)).trim() === "1";

/* ─────────────────────────────────────────────────────────
   DASHBOARD PRINCIPAL
   ───────────────────────────────────────────────────────── */
export default function AdminDashboard() {
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftModalRows, setShiftModalRows] = useState<
    Array<{ name: string; qty: number; unit: number; total: number }>
  >([]);
  const [shiftModalLoading, setShiftModalLoading] = useState(false);
  const [shiftModalMeta, setShiftModalMeta] = useState<{
    employee: string;
    business: string;
    startedAt: string;
    total: number;
  }>({ employee: "", business: "", startedAt: "", total: 0 });

  const [monthOffset, setMonthOffset] = useState(0);
  const { start: monthStart, end: monthEnd } = useMemo(
    () => monthRange(monthOffset),
    [monthOffset]
  );
  const [allExpanded, setAllExpanded] = useState(false);

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [sales3m, setSales3m] = useState<any[]>([]);
  const [expenses3m, setExpenses3m] = useState<any[]>([]);

  /* ─── Empleados ─── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("name");
      if (error) console.error(error);
      else if (mounted) setEmployees(data ?? []);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ─── 3 meses ─── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!businesses.length) return;
      const ids = businesses.filter(isGroup1).map((b: any) => b.id);
      if (!ids.length) return;
      const { start, end } = threeMonthWindow(monthOffset);
      const [salesBatches, expenseBatches] = await Promise.all([
        Promise.all(ids.map((id) => loadSales(id, start, end))),
        Promise.all(ids.map((id) => loadExpenses(id, start, end))),
      ]);
      if (!mounted) return;
      setSales3m(salesBatches.flat());
      setExpenses3m(expenseBatches.flat());
    })();
    return () => {
      mounted = false;
    };
  }, [businesses, monthOffset]);

  /* ─── Mes seleccionado ─── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoading(true);
        const biz = await loadBusinesses();
        if (!mounted) return;
        setBusinesses(biz);
        const ids = biz.map((b: any) => b.id);
        if (!ids.length) {
          if (mounted) setIsLoading(false);
          return;
        }
        const [salesBatches, expenseBatches] = await Promise.all([
          Promise.all(ids.map((id) => loadSales(id, monthStart, monthEnd))),
          Promise.all(
            ids.map((id) => loadExpenses(id, monthStart, monthEnd))
          ),
        ]);
        if (!mounted) return;
        setSales(salesBatches.flat());
        setExpenses(expenseBatches.flat());
        const { data: active, error: shErr } = await supabase
          .from("shifts")
          .select("*")
          .is("end_time", null)
          .in("business_id", ids)
          .order("start_time", { ascending: false });
        if (shErr) console.error(shErr);
        if (!mounted) return;
        setShifts(active ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [monthStart, monthEnd]);

  /* ─── Shift modal ─── */
  const openShiftProducts = async (sh: any) => {
    setShiftModalOpen(true);
    setShiftModalLoading(true);
    const emp = employees.find((e) => e.id === sh.employee_id);
    const empName = emp?.name || sh.employee_id;
    const turnSales = sales.filter((s) => s.shift_id === sh.id);
    const totalTurn = turnSales.reduce((a, s) => a + (s.total ?? 0), 0);
    const saleIds = turnSales.map((s) => s.id);
    const items = saleIds.length ? await loadSaleItemsPorSaleIds(saleIds) : [];
    type Row = { name: string; qty: number; unit: number; total: number };
    const grouped = new Map<string, Row[]>();
    for (const it of items) {
      const name =
        it?.promotion?.name ??
        it?.products?.name ??
        it?.products_master?.name ??
        "—";
      const { category } = extractCategory(name);
      const cat = category || "SIN CATEGORIA";
      const qty = Number(it?.quantity ?? 0);
      const tot = Number(it?.total ?? 0);
      const unit = qty > 0 ? tot / qty : 0;
      const list = grouped.get(cat) || [];
      const found = list.find((x) => x.name === name);
      if (found) {
        found.qty += qty;
        found.total += tot;
        found.unit = found.qty > 0 ? found.total / found.qty : 0;
      } else {
        list.push({ name, qty, unit, total: tot });
      }
      grouped.set(cat, list);
    }
    const rows = Array.from(grouped.entries())
      .map(([category, items]) => ({
        category,
        items: items.sort((a, b) => b.qty - a.qty),
      }))
      .sort((a, b) => {
        const qa = a.items.reduce((s, r) => s + r.qty, 0);
        const qb = b.items.reduce((s, r) => s + r.qty, 0);
        return qb - qa;
      });
    setShiftModalMeta({
      employee: empName,
      business: sh.business_name,
      startedAt: sh.start_time,
      total: totalTurn,
    });
    setShiftModalRows(rows as any);
    setShiftModalLoading(false);
  };

  /* ─── Métricas mensuales por negocio ─── */
  const businessesWithMonthlyData = useMemo(() => {
    const msPerDay = 86_400_000;
    const daysInMonth = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

    const { start: todayStart, end: todayEnd } = dayBounds(0);
    const { start: yStart, end: yEnd } = dayBounds(-1);
    const todayISOStart = todayStart.toISOString();
    const todayISOEnd = todayEnd.toISOString();
    const yISOStart = yStart.toISOString();
    const yISOEnd = yEnd.toISOString();

    const now = new Date();
    const inSelectedMonth = now >= monthStart && now < monthEnd;
    const elapsedMillis = Math.max(
      0,
      Math.min(now.getTime(), monthEnd.getTime()) - monthStart.getTime()
    );
    const daysElapsedInMonth = inSelectedMonth
      ? now.getDate()
      : Math.min(
          daysInMonth(monthStart),
          Math.max(1, Math.floor(elapsedMillis / msPerDay))
        );

    type PM2 =
      | "cash"
      | "card"
      | "transfer"
      | "mercadopago"
      | "rappi"
      | "consumo";
    const base = new Map<
      string,
      {
        tx: number;
        amount: number;
        expense: number;
        payments: Record<PM2, number>;
        expensesByMethod: Record<PM2, number>;
        todayAmount: number;
        yesterdayAmount: number;
      }
    >();

    for (const b of businesses) {
      base.set(b.id, {
        tx: 0,
        amount: 0,
        expense: 0,
        payments: {
          cash: 0,
          card: 0,
          transfer: 0,
          mercadopago: 0,
          rappi: 0,
          consumo: 0,
        },
        expensesByMethod: {
          cash: 0,
          card: 0,
          transfer: 0,
          mercadopago: 0,
          rappi: 0,
          consumo: 0,
        },
        todayAmount: 0,
        yesterdayAmount: 0,
      });
    }

    for (const s of sales) {
      const d = base.get(s.business_id);
      if (!d) continue;
      d.tx++;
      d.amount += s.total;
      if (s.payment_method in d.payments)
        d.payments[s.payment_method as PM2] += s.total;
      const ts: string = s.timestamp;
      if (ts >= todayISOStart && ts < todayISOEnd) d.todayAmount += s.total;
      if (ts >= yISOStart && ts < yISOEnd) d.yesterdayAmount += s.total;
    }

    for (const e of expenses) {
      const d = base.get(e.business_id);
      if (!d) continue;
      d.expense += e.amount;
      if (e.method && e.method in d.expensesByMethod)
        d.expensesByMethod[e.method as PM2] += e.amount;
    }

    return businesses.map((b) => {
      const d = base.get(b.id)!;
      const mtdAmount = d.amount;
      const dailyAvg =
        daysElapsedInMonth > 0 ? mtdAmount / daysElapsedInMonth : 0;
      const savingToday = savingTargetForDayAmount(d.todayAmount);
      const savingYesterday = savingTargetForDayAmount(d.yesterdayAmount);
      const savingMonthToDay = savingTargetForMTD(
        mtdAmount,
        daysElapsedInMonth
      );
      return {
        ...b,
        transactions: d.tx,
        totalAmount: d.amount,
        totalExpense: d.expense,
        profit: d.amount - d.expense,
        avgTicket: d.tx ? d.amount / d.tx : 0,
        dailyAvg,
        paymentMethods: d.payments,
        expensesByMethod: d.expensesByMethod,
        todayAmount: d.todayAmount,
        yesterdayAmount: d.yesterdayAmount,
        savingTargets: {
          today: savingToday,
          yesterday: savingYesterday,
          mtd: savingMonthToDay,
        },
      };
    });
  }, [businesses, sales, expenses, monthStart, monthEnd]);

  /* ─── Mapa dailyAvg por negocio para los turnos ─── */
  const dailyAvgByBusiness = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of businessesWithMonthlyData) {
      map.set(b.id, b.dailyAvg ?? 0);
    }
    return map;
  }, [businessesWithMonthlyData]);

  const calcShiftTotals = (sh: any) => {
    const ss = sales.filter((s) => s.shift_id === sh.id);
    const pm = {
      cash: 0,
      card: 0,
      transfer: 0,
      mercadopago: 0,
      rappi: 0,
      consumo: 0,
    } as Record<any, number>;
    ss.forEach((s) => {
      if (s.payment_method in pm) (pm as any)[s.payment_method] += s.total;
    });
    const total = Object.values(pm).reduce(
      (a: number, n: any) => a + (n as number),
      0
    );
    return { payments: pm as any, total };
  };

  const activeShifts = useMemo(
    () =>
      shifts
        .filter((sh: any) => !sh.end_time)
        .sort(
          (a: any, b: any) =>
            calcShiftTotals(b).total - calcShiftTotals(a).total
        ),
    [shifts, sales]
  );

  const monthLabel = useMemo(
    () =>
      monthStart.toLocaleString("es-ES", { month: "long", year: "numeric" }),
    [monthStart]
  );

  /* ─── RENDER ─── */
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
      {/* ══ HEADER ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Resumen financiero
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Ventas, gastos y rentabilidad por sucursal
          </p>
        </div>

        {/* Selector de mes */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            aria-label="Mes anterior"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors border border-slate-200 dark:border-slate-700"
            onClick={() => setMonthOffset((o) => o - 1)}
            disabled={isLoading}
          >
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 capitalize">
            {monthLabel}
          </span>
          <button
            aria-label="Mes siguiente"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors border border-slate-200 dark:border-slate-700"
            onClick={() => setMonthOffset((o) => o + 1)}
            disabled={isLoading}
          >
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {/* ══ CARDS DE NEGOCIOS ══ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">
            Sucursales
          </h2>
          <button
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            onClick={() => setAllExpanded((v) => !v)}
          >
            {allExpanded ? "Colapsar todo" : "Expandir todo"}
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {businessesWithMonthlyData.map((b: any) => (
              <BusinessCard
                key={b.id}
                b={b}
                open={allExpanded}
                onToggle={() => setAllExpanded((v) => !v)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ══ TURNOS ACTIVOS ══ */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">
            Turnos activos
          </h2>
          {activeShifts.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              {activeShifts.length}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {activeShifts.map((sh) => {
            const { payments, total } = calcShiftTotals(sh);
            const emp = employees.find((e) => e.id === sh.employee_id);
            const hours =
              (Date.now() - new Date(sh.start_time).getTime()) / 36e5;
            const avgHr = hours > 0 ? total / hours : 0;
            const dailyAvg = dailyAvgByBusiness.get(sh.business_id) ?? 0;
            return (
              <ShiftCard
                key={sh.id}
                sh={sh}
                empName={emp?.name || sh.employee_id}
                businessName={sh.business_name}
                payments={payments}
                total={total}
                avgHr={avgHr}
                startTime={sh.start_time}
                dailyAvg={dailyAvg}
                onOpenDetails={() => openShiftProducts(sh)}
              />
            );
          })}
          {!activeShifts.length && (
            <div className="col-span-full text-center py-12 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-slate-400 dark:text-slate-500 text-sm">
                No hay turnos activos en este momento
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ══ MODAL ══ */}
      <ShiftProductsModal
        open={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        employee={shiftModalMeta.employee}
        business={shiftModalMeta.business}
        startedAt={shiftModalMeta.startedAt}
        rows={shiftModalRows as any}
        loading={shiftModalLoading}
        total={shiftModalMeta.total}
      />
    </div>
  );
}