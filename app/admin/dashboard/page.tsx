"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Banknote, Building2, CalendarDays, CreditCard, Flame, Wallet } from "lucide-react";

/* ─────────────────────────────────────────────────────────
   FECHAS / RANGOS
   ───────────────────────────────────────────────────────── */
function threeMonthWindow(offset = 0) {
  const base = new Date();
  // mes "base" según el offset (igual que monthRange)
  const baseMonth = base.getMonth() + offset;
  const year = base.getFullYear();

  // 👉 Desde el primer día del MES ANTERIOR…
  const start = new Date(year, baseMonth - 1, 1, 0, 0, 0, 0);
  // 👉 …hasta el primer día del MES SIGUIENTE,
  //    con lo cual cubrís mes anterior + mes actual
  const end = new Date(year, baseMonth + 1, 1, 0, 0, 0, 0);

  return { start, end };
}


function last3MonthsRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0); // mes-2, día 1
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);   // inicio del próximo mes
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
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : n.toFixed(0);
const formatPrice = (n: number) => (n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtMoney = (n: number) => `$ ${formatPrice(n || 0)}`;
const fmtShortMoney = (n: number) => `$ ${formatNumberAbbrev(Math.max(0, Math.round(n || 0)))}`;
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
function savingTargetForMTD(mtdAmount: number, daysElapsedInMonth: number): number {
  const { mode, percent, fixedPerDay, hybridThreshold } = SAVING_CONFIG;
  if (mode === "percent") return mtdAmount * percent;
  if (mode === "fixed") return fixedPerDay * daysElapsedInMonth;
  const avgPerDay = daysElapsedInMonth > 0 ? mtdAmount / daysElapsedInMonth : 0;
  const extraPerDay = Math.max(0, avgPerDay - hybridThreshold) * percent;
  return daysElapsedInMonth * (fixedPerDay + extraPerDay);
}

/* ─────────────────────────────────────────────────────────
   UI HELPERS
   ───────────────────────────────────────────────────────── */
function SavingsPill({ label, value, titlePrefix = "Ahorro objetivo" }: { label: string; value: number; titlePrefix?: string }) {
  return (
    <span
      title={`${titlePrefix} — ${label}: ${fmtMoney(value)}`}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 px-2 py-0.5 text-[11px] leading-none text-slate-700 dark:text-slate-200 shadow-sm"
    >
      <span className="i-lucide-piggy-bank w-3.5 h-3.5 inline-block opacity-70" />
      <span className="font-medium">{label}:</span>
      <span className="font-semibold tabular-nums">{fmtShortMoney(value)}</span>
    </span>
  );
}
function StatCard({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm ${className}`}>
      <div className="text-[11px] text-slate-500 leading-none">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
function marginSemaforo(m: number) {
  if (m >= 40) return { pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", text: "🟢 Margen" };
  if (m >= 20) return { pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", text: "🟡 Margen" };
  return { pill: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", text: "🔴 Margen" };
}

/* ─────────────────────────────────────────────────────────
   MÉTODOS (UNIFICACIÓN)
   ───────────────────────────────────────────────────────── */
const UNIFIED_KEYS = ["cash", "card", "rappi", "consumo"] as const;
type UnifiedKey = (typeof UNIFIED_KEYS)[number];


const unifyPayments = (pm: Record<string, number> = {}) => {
  const cardTotal =
    (pm.card ?? 0) +
    (pm.transfer ?? 0) +     // sumamos transfer acá
    (pm.mercadopago ?? 0);  // y MP también

  return {
    cash: pm.cash ?? 0,
    card: cardTotal,
    rappi: pm.rappi ?? 0,
    consumo: pm.consumo ?? 0,
  };
};

const unifyExpenses = (em: Record<string, number> = {}) => {
  const cardTotal =
    (em.card ?? 0) +
    (em.transfer ?? 0) +     // gastos con method="transfer" van acá
    (em.mercadopago ?? 0);  // y los de MP también

  return {
    cash: em.cash ?? 0,
    card: cardTotal,
    rappi: em.rappi ?? 0,
    consumo: em.consumo ?? 0,
  };
};

const METHOD_META_UNI: Record<
  UnifiedKey,
  { label: string; short: string; barClass: string; dotClass: string }
> = {
  cash: { label: "Efectivo", short: "EF", barClass: "bg-emerald-500", dotClass: "bg-emerald-500" },
  card: { label: "Tarjeta / Transfer", short: "TJ/TR", barClass: "bg-indigo-500", dotClass: "bg-indigo-500" },
  rappi: { label: "Rappi", short: "RP", barClass: "bg-orange-500", dotClass: "bg-orange-500" },
  consumo: { label: "Consumo", short: "CI", barClass: "bg-slate-400", dotClass: "bg-slate-400" },
};

const METHOD_META: Record<"cash" | "card" | "transfer" | "mercadopago" | "rappi" | "consumo", { label: string; short: string; barClass: string; dotClass: string }> = {
  cash: { label: "Efectivo", short: "EF", barClass: "bg-emerald-500", dotClass: "bg-emerald-500" },
  card: { label: "Tarjeta", short: "TJ", barClass: "bg-indigo-500", dotClass: "bg-indigo-500" },
  rappi: { label: "Rappi", short: "RP", barClass: "bg-orange-500", dotClass: "bg-orange-500" },
  transfer: { label: "Transfer/MP", short: "TR", barClass: "bg-yellow-500", dotClass: "bg-yellow-500" },
  mercadopago: { label: "MP", short: "MP", barClass: "bg-sky-500", dotClass: "bg-sky-500" },
  consumo: { label: "Consumo", short: "CI", barClass: "bg-slate-400", dotClass: "bg-slate-400" },
};

/* ─────────────────────────────────────────────────────────
   FETCH PAGINADO
   ───────────────────────────────────────────────────────── */
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
    if (error) { console.error(error); break; }
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
  const { data, error } = await supabase.from("businesses").select("*").order("name");
  if (error) { console.error(error); return []; }
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
        .select(`
          sale_id,
          quantity,
          total,
          stock,
          product_id,
          product_master_id,
          promotion_id,
          products ( name ),
          products_master ( name ),
          promotion:promos ( name )
        `)
        .in("sale_id", batchIds)
    );
  }
  const results = await Promise.all(batches);
  return results.flatMap((r) => r.data || []);
};
const loadProducts = async (businessId: string) =>
  fetchAllPaginated((lo, hi) =>
    supabase.from("products").select("*").eq("business_id", businessId).range(lo, hi)
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
const loadShifts = async (businessId: string, from: Date, to: Date) =>
  fetchAllPaginated((lo, hi) =>
    supabase
      .from("shifts")
      .select("*")
      .eq("business_id", businessId)
      .gte("start_time", from.toISOString())
      .lt("start_time", to.toISOString())
      .order("start_time", { ascending: false })
      .range(lo, hi)
  );

/* ─────────────────────────────────────────────────────────
   CATEGORÍAS
   ───────────────────────────────────────────────────────── */
const categories = ["ALMACEN", "CIGARRILLOS", "GOLOSINAS", "BEBIDA", "CERVEZA", "FIAMBRES", "TABACO", "HUEVOS", "HIGIENE", "ALCOHOL", "PROMO", "SIN CATEGORIA", "BRECA"] as const;
function extractCategory(name: string) {
  const parts = (name || "").trim().split(" ");
  if (parts.length > 1 && categories.includes(parts[0].toUpperCase() as any))
    return { category: parts[0].toUpperCase(), baseName: parts.slice(1).join(" ") };
  return { category: null, baseName: name };
}

/* ─────────────────────────────────────────────────────────
   COMPONENTES UI (BusinessCard, ShiftCard, Modal)
   ───────────────────────────────────────────────────────── */
function BusinessCard({ b, open, onToggle }: { b: any; open: boolean; onToggle: () => void }) {
  const total = b.totalAmount ?? 0;
  const gastos = b.totalExpense ?? 0;
  const profit = total - gastos;
  const margin = total > 0 ? (profit / total) * 100 : 0;
  const tx = b.transactions ?? 0;
  const ticket = b.avgTicket ?? 0;

  const payments = unifyPayments(b.paymentMethods || {});
  const expensesByMethod = unifyExpenses(b.expensesByMethod || {});

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

  const profitColor = profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  const { pill, text } = marginSemaforo(margin);
  const saving: { today: number; yesterday: number; mtd: number } | undefined = b.savingTargets;

  function KPI({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
    return (
      <div className="min-w-[150px]">
        <div className="text-[11px] text-slate-500 leading-none">{label}</div>
        <div className={`mt-1 text-sm font-semibold tabular-nums whitespace-nowrap leading-tight ${className}`}>{value}</div>
      </div>
    );
  }

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
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{b.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            Ahorro: {savingModeLabel}
          </span>
          <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${pill}`}>{text} {margin.toFixed(1)}%</span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div className="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-2 items-end">
        <KPI label="Ventas" value={fmtMoney(total)} />
        <KPI label="Gastos" value={fmtMoney(gastos)} className="text-red-600 dark:text-red-400" />
        <KPI label="Profit" value={fmtMoney(profit)} className={profitColor} />
        <KPI label="Ticket" value={fmtMoney(ticket)} className="opacity-80" />
        <KPI label="N. Ventas" value={tx} className="opacity-80" />
        <KPI label="Rentab." value={`${margin.toFixed(1)}%`} className="opacity-80" />
      </div>

      {saving && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Ahorro objetivo</span>
          <SavingsPill label="Hoy" value={saving.today} />
          <SavingsPill label="Ayer" value={saving.yesterday} />
          <SavingsPill label="Mes" value={saving.mtd} />
        </div>
      )}

      <div className="mt-4">
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
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
        <div className="mt-2 flex flex-wrap gap-2">
          {segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <span key={`legend-${s.key}`} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                <span className={`inline-block w-2 h-2 rounded ${s.dotClass}`} />
                {s.short}: {fmtMoney(s.value)}
              </span>
            ))}
        </div>
      </div>

      {/* detalle (expand) */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} mt-3`}>
        <div className="overflow-hidden">
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3 mt-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-slate-500">
                  <tr>
                    <th className="text-left py-1">Método</th>
                    <th className="text-right py-1">Ventas</th>
                    <th className="text-right py-1">Gastos</th>
                    <th className="text-right py-1">Profit</th>
                    <th className="text-right py-1">% Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {UNIFIED_KEYS.map((k) => {
                    const payments = unifyPayments(b.paymentMethods || {});
                    const expensesBy = unifyExpenses(b.expensesByMethod || {});
                    const ventas = payments[k];
                    const egres = expensesBy[k];
                    const pft = ventas - egres;
                    const total = b.totalAmount ?? 0;
                    return (
                      <tr key={`row-${k}`} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="py-1">
                          <span className="inline-flex items-center gap-2">
                            <span className={`w-2 h-2 rounded ${METHOD_META_UNI[k].dotClass}`} />
                            {METHOD_META_UNI[k].label}
                          </span>
                        </td>
                        <td className="py-1 text-right tabular-nums">{fmtMoney(ventas)}</td>
                        <td className="py-1 text-right tabular-nums text-red-600 dark:text-red-400">{fmtMoney(egres)}</td>
                        <td className={`py-1 text-right tabular-nums ${pft >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{fmtMoney(pft)}</td>
                        <td className="py-1 text-right tabular-nums">{pct(ventas, total).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function ShiftCard({
  sh, empName, businessName, payments, total, avgHr, onOpenDetails, startTime,
}: {
  sh: any; empName: string; businessName: string;
  payments: Record<"cash" | "card" | "transfer" | "mercadopago" | "rappi" | "consumo", number>;
  total: number; avgHr: number; onOpenDetails: any; startTime: string;
}) {
  const unified = {
    cash: payments.cash ?? 0,
    card: payments.card ?? 0,
    transfer: (payments.transfer ?? 0) + (payments.mercadopago ?? 0),
    rappi: payments.rappi ?? 0,
    consumo: payments.consumo ?? 0,
  };

  const items = [
    { key: "cash", label: "Efectivo", icon: Banknote, value: unified.cash, dot: "bg-emerald-500", pill: "bg-emerald-50 dark:bg-emerald-900/30" },
    { key: "card", label: "Tarjeta", icon: CreditCard, value: unified.card, dot: "bg-indigo-500", pill: "bg-indigo-50 dark:bg-indigo-900/30" },
    { key: "transfer", label: "Transfer/MP", icon: Wallet, value: unified.transfer, dot: "bg-yellow-500", pill: "bg-yellow-50 dark:bg-yellow-900/30" },
    { key: "rappi", label: "Rappi", icon: Flame, value: unified.rappi, dot: "bg-orange-500", pill: "bg-orange-50 dark:bg-orange-900/30" },
    { key: "consumo", label: "Consumo", icon: Building2, value: unified.consumo, dot: "bg-slate-400", pill: "bg-slate-50 dark:bg-slate-800/40" },
  ] as const;

  const percent = (n: number) => (total > 0 ? Math.max(0, Math.min(100, (n / total) * 100)) : 0);
  const fmt = (n: number) => `$ ${formatPrice(n || 0)}`;
  const initials = (empName || "—").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  const started = new Date(startTime);
  const hours = Math.max(0, (Date.now() - started.getTime()) / 36e5);
  const hh = Math.floor(hours);
  const mm = Math.floor((hours - hh) * 60);

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all"
      onClick={onOpenDetails}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenDetails?.()}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-transparent to-emerald-50/40 dark:from-indigo-900/10 dark:to-emerald-900/10" />
      <div className="relative flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{empName || sh.employee_id}</h3>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Activo</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{businessName}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-slate-500">Iniciado</div>
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{started.toLocaleString()}</div>
        </div>
      </div>

      <div className="relative px-5 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
            <div className="text-[11px] text-slate-500">Ventas</div>
            <div className="mt-0.5 text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">{fmt(total)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
            <div className="text-[11px] text-slate-500">Prom. / hora</div>
            <div className="mt-0.5 text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{fmt(avgHr)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
            <div className="text-[11px] text-slate-500">Tiempo activo</div>
            <div className="mt-0.5 text-lg font-bold text-slate-800 dark:text-slate-200 tabular-nums">{hh}h {mm}m</div>
          </div>
        </div>
      </div>

      <div className="relative px-5">
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
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

        <div className="mt-3 grid grid-cols-2 gap-2 min-h-[92px]">
          {items.map((it) => {
            const visible = (it.value ?? 0) > 0;
            return (
              <div
                key={`chip-${it.key}`}
                className={`${it.pill} ${visible ? "" : "invisible"} rounded-xl px-3 py-2 flex items-center justify-between text-sm border border-slate-200/70 dark:border-slate-700/60`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded ${it.dot}`} />
                  <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200 leading-none">
                    <it.icon className="w-4 h-4 opacity-70" />
                    {it.label}
                  </span>
                </span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white min-w-[92px] text-right">
                  {fmt(it.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative mt-4 border-t border-slate-200 dark:border-slate-700 px-5 py-3 flex items-center justify-between text-xs">
        <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <CalendarDays className="w-4 h-4" />
          <span>Inicio: {started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>
    </div>
  );
}

function ShiftProductsModal({
  open, onClose, employee, business, startedAt, rows, loading, total,
}: {
  open: boolean; onClose: () => void; employee: string; business: string; startedAt: string;
  rows: Array<{ category: string; items: { name: string; qty: number; unit: number; total: number }[] }>;
  loading: boolean; total: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-9 00 shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Productos vendidos — {employee}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{business} · Inicio: {new Date(startedAt).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">Cerrar</button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="h-40 grid place-items-center text-slate-500">Cargando…</div>
          ) : !rows.length ? (
            <div className="h-40 grid place-items-center text-slate-500">No hay productos registrados en este turno.</div>
          ) : (
            <div className="max-h-[55vh] overflow-auto space-y-6">
              {rows.map((cat, i) => (
                <div key={i}>
                  <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">{cat.category}</h4>
                  <table className="w-full text-sm mb-2">
                    <thead className="text-[11px] text-slate-500">
                      <tr>
                        <th className="text-left py-1">Producto</th>
                        <th className="text-right py-1">Cant.</th>
                        <th className="text-right py-1">$ /u</th>
                        <th className="text-right py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.items.map((r, idx) => (
                        <tr key={idx} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="py-1">{r.name}</td>
                          <td className="py-1 text-right tabular-nums">{r.qty}</td>
                          <td className="py-1 text-right tabular-nums">$ {formatPrice(r.unit)}</td>
                          <td className="py-1 text-right tabular-nums font-semibold">$ {formatPrice(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 text-right">
                <span className="text-sm font-medium mr-2">Total ventas del turno</span>
                <span className="text-sm font-bold">$ {formatPrice(total)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   DASHBOARD
   ───────────────────────────────────────────────────────── */
type PM = "cash" | "card" | "transfer" | "mercadopago";
type GlobalBalance = {
  income: number; expense: number; balance: number;
  incomeBy: { cash: number; rest: number };
  expenseBy: { cash: number; rest: number };
  balanceBy: { cash: number; rest: number };
  loading: boolean;
};

type BusinessBalance = {
  businessId: string;
  businessName: string;

  income: number;
  expense: number;
  balance: number;

  incomeCash: number;
  incomeRest: number;
  expenseCash: number;
  expenseRest: number;
  balanceCash: number;
  balanceRest: number;

  // NUEVO
  bankTax: number;      // + (5% de incomeRest)
  bankTaxNeg: number;   // -bankTax
  balanceNet: number;   // balance + bankTaxNeg
};


const getGroupVal = (b: any) => b?.group ?? b?.group_id ?? b?.groupId ?? b?.grupo ?? null;
const isGroup1 = (b: any) => String(getGroupVal(b)).trim() === "1";

export default function AdminDashboard() {
  // Modal turnos
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftModalRows, setShiftModalRows] = useState<Array<{ name: string; qty: number; unit: number; total: number }>>([]);
  const [shiftModalLoading, setShiftModalLoading] = useState(false);
  const [shiftModalMeta, setShiftModalMeta] = useState<{ employee: string; business: string; startedAt: string; total: number }>({ employee: "", business: "", startedAt: "", total: 0 });

  const [perBusinessBalance, setPerBusinessBalance] = useState<BusinessBalance[]>([]);

  const [monthOffset, setMonthOffset] = useState(0);
  const { start: monthStart, end: monthEnd } = useMemo(() => monthRange(monthOffset), [monthOffset]);
  const [allExpanded, setAllExpanded] = useState(false);

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [directSales, setDirectSales] = useState<any[]>([]);
  const [directSalesLoading, setDirectSalesLoading] = useState(false);
  const [selectedBusinessForTop, setSelectedBusinessForTop] = useState("");
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbProductsLoading, setDbProductsLoading] = useState(false);
  const [daysFilter, setDaysFilter] = useState(7);
  const [itemsLimit, setItemsLimit] = useState(20);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<"salesCount" | "totalRevenue">("salesCount");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  // --- NUEVO estado para la ventana 3M
  const [sales3m, setSales3m] = useState<any[]>([]);
  const [expenses3m, setExpenses3m] = useState<any[]>([]);
  const [loading3m, setLoading3m] = useState(false);
  const groupBusinessIds = useMemo(
    () => businesses.filter((b: any) => isGroup1(b)).map((b: any) => b.id),
    [businesses]
  );

  const [globalBalance, setGlobalBalance] = useState<GlobalBalance>({
    income: 0, expense: 0, balance: 0,
    incomeBy: { cash: 0, rest: 0 },
    expenseBy: { cash: 0, rest: 0 },
    balanceBy: { cash: 0, rest: 0 },
    loading: true,
  });

  /* ───────── 3 MESES: Balance por negocio (con EF / RESTO) + cálculo global 3M ───────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!businesses.length) return;
      setLoading3m(true);

      const ids = businesses.filter(isGroup1).map((b: any) => b.id);
      if (!ids.length) {
        if (mounted) { setSales3m([]); setExpenses3m([]); setLoading3m(false); }
        return;
      }

      // ⚠️ Usamos el MISMO rango y la MISMA función que en las cards
      const { start, end } = threeMonthWindow(monthOffset);

      // Ventas: mismo loader (paginado, select("*"), filtros correctos)
      const salesBatches = await Promise.all(ids.map((id) => loadSales(id, start, end)));
      const salesData = salesBatches.flat();

      // Gastos: mantenemos tu loader paginado también
      const expenseBatches = await Promise.all(ids.map((id) => loadExpenses(id, start, end)));
      const expenseData = expenseBatches.flat();

      if (!mounted) return;
      setSales3m(salesData);
      setExpenses3m(expenseData);
      setLoading3m(false);
    })();
    return () => { mounted = false; };
  }, [businesses, monthOffset]);


  const { perBiz3m, global3m } = useMemo(() => {
    const groupBusinesses = businesses.filter(isGroup1);
    const bizMap = new Map<string, {
      name: string;
      incomeCash: number; incomeRest: number;
      expenseCash: number; expenseRest: number;
    }>();
    for (const b of groupBusinesses) {
      bizMap.set(b.id, { name: b.name, incomeCash: 0, incomeRest: 0, expenseCash: 0, expenseRest: 0 });
    }

    let income = 0, expense = 0, incomeCash = 0, expenseCash = 0;

    for (const s of sales3m) {
      const id = s.business_id as string;
      if (!bizMap.has(id)) continue;
      const t = Number(
        (s as any).total ??
        (s as any).total_amount ??
        (s as any).amount ??
        0
      );
      income += t;
      if (String(s?.payment_method) === "cash") {
        incomeCash += t; bizMap.get(id)!.incomeCash += t;
      } else {
        bizMap.get(id)!.incomeRest += t;
      }
    }
    for (const e of expenses3m) {
      const id = e.business_id as string;
      if (!bizMap.has(id)) continue;
      const a = Number(e?.amount ?? 0);
      expense += a;
      if (String(e?.method) === "cash") {
        expenseCash += a; bizMap.get(id)!.expenseCash += a;
      } else {
        bizMap.get(id)!.expenseRest += a;
      }
    }

    let perBiz = Array.from(bizMap.entries()).map(([businessId, v]) => {
      const balance = income - expense;
      const bankTax = v.incomeRest * 0.05;
      const bankTaxNeg = -bankTax;
      const balanceNet = balance + bankTaxNeg;

      return {
        businessId,
        businessName: v.name,
        income,
        expense,
        balance,
        incomeCash: v.incomeCash,
        incomeRest: v.incomeRest,
        expenseCash: v.expenseCash,
        expenseRest: v.expenseRest,
        balanceCash: v.incomeCash - v.expenseCash,
        balanceRest: v.incomeRest - v.expenseRest,

        bankTax,
        bankTaxNeg,
        balanceNet,
      };

    });

    // fallback filas en cero si no hubo movimientos
    if (perBiz.length === 0 && groupBusinesses.length > 0) {
      perBiz = groupBusinesses.map((b: any) => ({
        businessId: b.id, businessName: b.name,
        income: 0, expense: 0, balance: 0,
        incomeCash: 0, incomeRest: 0, expenseCash: 0, expenseRest: 0,
        balanceCash: 0, balanceRest: 0,
        bankTax: 0,
        bankTaxNeg: 0,
        balanceNet: 0,
      }));
    }

    perBiz.sort((a, b) => b.balance - a.balance);

    const incomeRest = Math.max(0, income - incomeCash);
    const expenseRest = Math.max(0, expense - expenseCash);

    return {
      perBiz3m: perBiz,
      global3m: {
        income,
        expense,
        balance: income - expense,
        incomeBy: { cash: incomeCash, rest: incomeRest },
        expenseBy: { cash: expenseCash, rest: expenseRest },
        balanceBy: { cash: incomeCash - expenseCash, rest: incomeRest - expenseRest },
      },
    };
  }, [businesses, sales3m, expenses3m]);
  /* ───────── Empleados (estático) ───────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) console.error(error);
      else if (mounted) setEmployees(data ?? []);
    })();
    return () => { mounted = false; };
  }, []);

  const rows3m = perBiz3m;

  /* ───────── Carga de mes seleccionado (cards de negocios) ───────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoading(true);

        // 1) Negocios
        const biz = await loadBusinesses();
        if (!mounted) return;
        setBusinesses(biz);

        const ids = biz.map((b: any) => b.id);
        if (!ids.length) {
          if (!mounted) return;
          setSales([]); setExpenses([]); setShifts([]); setIsLoading(false);
          return;
        }

        // 2) Ventas & Gastos del MES seleccionado para las cards
        const [salesBatches, expenseBatches] = await Promise.all([
          Promise.all(ids.map((id) => loadSales(id, monthStart, monthEnd))),
          Promise.all(ids.map((id) => loadExpenses(id, monthStart, monthEnd))),
        ]);
        if (!mounted) return;
        setSales(salesBatches.flat());
        setExpenses(expenseBatches.flat());

        // 3) Turnos activos
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
    return () => { mounted = false; };
  }, [monthStart, monthEnd]);

  /* ───────── Ventas + productos del negocio seleccionado (Top) ───────── */
  useEffect(() => {
    if (!selectedBusinessForTop) return;
    let mounted = true;
    (async () => {
      setDirectSalesLoading(true);
      const s = await loadSales(selectedBusinessForTop, monthStart, monthEnd);
      if (!mounted) return;
      const saleIds = s.map((x: any) => x.id);
      const items = await loadSaleItemsPorSaleIds(saleIds);
      if (!mounted) return;

      const salesConItems = s.map((sale: any) => ({
        ...sale,
        sale_items: items.filter((it) => it.sale_id === sale.id),
      }));

      setDirectSales(salesConItems);
      setDirectSalesLoading(false);
    })();
    return () => { mounted = false; };
  }, [selectedBusinessForTop, monthStart, monthEnd]);

  useEffect(() => {
    if (!selectedBusinessForTop) { setDbProducts([]); return; }
    let mounted = true;
    (async () => {
      setDbProductsLoading(true);
      const prods = await loadProducts(selectedBusinessForTop);
      if (mounted) { setDbProducts(prods); setDbProductsLoading(false); }
    })();
    return () => { mounted = false; };
  }, [selectedBusinessForTop]);

  /* ───────── GLOBAL HISTÓRICO (se mantiene para las cards de arriba) ───────── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setGlobalBalance((g) => ({ ...g, loading: true }));
        const [allSales, allExpenses] = await Promise.all([
          fetchAllPaginated((lo, hi) =>
            supabase.from("sales").select("total,payment_method").order("timestamp", { ascending: false }).range(lo, hi)
          ),
          fetchAllPaginated((lo, hi) =>
            supabase.from("expenses").select("amount,method").order("date", { ascending: false }).range(lo, hi)
          ),
        ]);
        if (!mounted) return;

        let income = 0, expense = 0, incomeCash = 0, expenseCash = 0;
        for (const s of allSales) {
          const t = Number(s?.total ?? 0);
          income += t;
          if (String(s?.payment_method) === "cash") incomeCash += t;
        }
        for (const e of allExpenses) {
          const a = Number(e?.amount ?? 0);
          expense += a;
          if (String(e?.method) === "cash") expenseCash += a;
        }
        const incomeRest = Math.max(0, income - incomeCash);
        const expenseRest = Math.max(0, expense - expenseCash);
        const balance = income - expense;

        setGlobalBalance({
          income,
          expense,
          balance,
          incomeBy: { cash: incomeCash, rest: incomeRest },
          expenseBy: { cash: expenseCash, rest: expenseRest },
          balanceBy: { cash: incomeCash - expenseCash, rest: incomeRest - expenseRest },
          loading: false,
        });
      } catch (err) {
        console.error(err);
        if (mounted) setGlobalBalance((g) => ({ ...g, loading: false }));
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ------- Shift modal open -------
  const openShiftProducts = async (sh: any) => {
    setShiftModalOpen(true);
    setShiftModalLoading(true);

    const emp = employees.find((e) => e.id === sh.employee_id);
    const empName = emp?.name || sh.employee_id;
    const businessName = sh.business_name;
    const startedAt = sh.start_time;

    const turnSales = sales.filter((s) => s.shift_id === sh.id);
    const totalTurn = turnSales.reduce((a, s) => a + (s.total ?? 0), 0);
    const saleIds = turnSales.map((s) => s.id);
    const items = saleIds.length ? await loadSaleItemsPorSaleIds(saleIds) : [];

    type Row = { name: string; qty: number; unit: number; total: number };
    const grouped = new Map<string, Row[]>();

    for (const it of items) {
      const name = it?.promotion?.name ?? it?.products?.name ?? it?.products_master?.name ?? "—";
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

    setShiftModalMeta({ employee: empName, business: businessName, startedAt, total: totalTurn });
    setShiftModalRows(rows as any);
    setShiftModalLoading(false);
  };

  // ------- Top productos (memo) -------
  const topProducts = useMemo(() => {
    if (!directSales.length) return [];
    const now = Date.now();
    const recent = directSales.filter((s) => (now - new Date(s.timestamp).getTime()) / 86400000 <= daysFilter);

    const map = new Map<
      string,
      { productName: string; businessId: string; stock: number | null; totalQuantity: number; unitPrice: number; totalRevenue: number }
    >();

    for (const sale of recent) {
      sale.sale_items?.forEach((it: any) => {
        const prod = dbProducts.find((p) => p.id === it.product_id);
        if (!prod) return;
        const key = `${it.product_id}-${prod.business_id}`;
        if (!map.has(key)) {
          map.set(key, {
            productName: it.products?.name || "Sin nombre",
            businessId: prod.business_id,
            stock: prod.stock ?? prod.current_stock ?? prod.quantity ?? null,
            unitPrice: prod.selling_price,
            totalQuantity: 0,
            totalRevenue: 0,
          });
        }
        const entry = map.get(key)!;
        entry.totalQuantity += it.quantity;
        entry.totalRevenue += it.total;
      });
    }

    let arr = [...map.values()];
    if (selectedCategories.length) {
      arr = arr.filter((p) => {
        const { category } = extractCategory(p.productName);
        return category ? selectedCategories.includes(category) : selectedCategories.includes("SIN CATEGORIA");
      });
    }
    arr.sort((a, b) => {
      const diff = sortColumn === "salesCount" ? a.totalQuantity - b.totalQuantity : a.totalRevenue - b.totalRevenue;
      return sortDirection === "asc" ? diff : -diff;
    });
    return arr.slice(0, itemsLimit);
  }, [directSales, dbProducts, daysFilter, selectedCategories, sortColumn, sortDirection, itemsLimit]);

  // ------- Métricas mensuales por negocio -------
  const businessesWithMonthlyData = useMemo(() => {
    const msPerDay = 86_400_000;
    const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

    const { start: todayStart, end: todayEnd } = dayBounds(0);
    const { start: yStart, end: yEnd } = dayBounds(-1);
    const todayISOStart = todayStart.toISOString();
    const todayISOEnd = todayEnd.toISOString();
    const yISOStart = yStart.toISOString();
    const yISOEnd = yEnd.toISOString();

    const now = new Date();
    const inSelectedMonth = now >= monthStart && now < monthEnd;
    const elapsedMillis = Math.max(0, Math.min(now.getTime(), monthEnd.getTime()) - monthStart.getTime());
    const daysElapsedInMonth = inSelectedMonth
      ? now.getDate()
      : Math.min(daysInMonth(monthStart), Math.max(1, Math.floor(elapsedMillis / msPerDay)));

    type PM2 = "cash" | "card" | "transfer" | "mercadopago" | "rappi" | "consumo";
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
        tx: 0, amount: 0, expense: 0,
        payments: { cash: 0, card: 0, transfer: 0, mercadopago: 0, rappi: 0, consumo: 0 },
        expensesByMethod: { cash: 0, card: 0, transfer: 0, mercadopago: 0, rappi: 0, consumo: 0 },
        todayAmount: 0, yesterdayAmount: 0,
      });
    }

    for (const s of sales) {
      const d = base.get(s.business_id);
      if (!d) continue;
      d.tx++;
      d.amount += s.total;
      if (s.payment_method in d.payments) d.payments[s.payment_method as PM2] += s.total;

      const ts: string = s.timestamp;
      if (ts >= todayISOStart && ts < todayISOEnd) d.todayAmount += s.total;
      if (ts >= yISOStart && ts < yISOEnd) d.yesterdayAmount += s.total;
    }

    for (const e of expenses) {
      const d = base.get(e.business_id);
      if (!d) continue;
      d.expense += e.amount;
      if (e.method && e.method in d.expensesByMethod) d.expensesByMethod[e.method as PM2] += e.amount;
    }

    return businesses.map((b) => {
      const d = base.get(b.id)!;
      const mtdAmount = d.amount;
      const savingToday = savingTargetForDayAmount(d.todayAmount);
      const savingYesterday = savingTargetForDayAmount(d.yesterdayAmount);
      const savingMonthToDay = savingTargetForMTD(mtdAmount, daysElapsedInMonth);

      return {
        ...b,
        transactions: d.tx,
        totalAmount: d.amount,
        totalExpense: d.expense,
        profit: d.amount - d.expense,
        avgTicket: d.tx ? d.amount / d.tx : 0,
        paymentMethods: d.payments,
        expensesByMethod: d.expensesByMethod,
        todayAmount: d.todayAmount,
        yesterdayAmount: d.yesterdayAmount,
        savingTargets: { today: savingToday, yesterday: savingYesterday, mtd: savingMonthToDay },
      };
    });
  }, [businesses, sales, expenses, monthStart, monthEnd]);

  const calcShiftTotals = (sh: any) => {
    const ss = sales.filter((s) => s.shift_id === sh.id);
    const pm = { cash: 0, card: 0, transfer: 0, mercadopago: 0, rappi: 0, consumo: 0 } as Record<any, number>;
    ss.forEach((s) => { if (s.payment_method in pm) (pm as any)[s.payment_method] += s.total; });
    const total = Object.values(pm).reduce((a: number, n: any) => a + (n as number), 0);
    return { payments: pm as any, total };
  };

  const activeShifts = useMemo(
    () => shifts.filter((sh: any) => !sh.end_time).sort((a: any, b: any) => calcShiftTotals(b).total - calcShiftTotals(a).total),
    [shifts, sales]
  );

  const monthLabel = useMemo(
    () => monthStart.toLocaleString("es-ES", { month: "long", year: "numeric" }),
    [monthStart]
  );

  /* ───────────── RENDER ───────────── */
  const totalIncome3M_Cash = rows3m.reduce((a, x) => a + x.incomeCash, 0);
  const totalIncome3M_Rest = rows3m.reduce((a, x) => a + x.incomeRest, 0);
  const totalExpense3M_Cash = rows3m.reduce((a, x) => a + x.expenseCash, 0);
  const totalExpense3M_Rest = rows3m.reduce((a, x) => a + x.expenseRest, 0);
  const totalBalance3M_Cash = rows3m.reduce((a, x) => a + x.balanceCash, 0);
  const totalBalance3M_Rest = rows3m.reduce((a, x) => a + x.balanceRest, 0);
  const totalBalance3M = totalBalance3M_Cash + totalBalance3M_Rest;
  const totalBankTax3M = rows3m.reduce((a, x) => a + (x.bankTax ?? 0), 0);
  const totalBankTax3M_Neg = -totalBankTax3M;
  const totalBalance3M_Net = totalBalance3M + totalBankTax3M_Neg;

  return (
    <div className="space-y-6 p-4">
      {/* ===== BALANCE GLOBAL (card superior) ===== */}
      <section>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-800 dark:text-white">BALANCE KIOSKO 32</h1>
            {loading3m && (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Calculando…</span>
            )}

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Ingresos" value={fmtMoney(global3m.income)} />
            <StatCard label="Egresos" value={<span className="text-red-600 dark:text-red-400">{fmtMoney(global3m.expense)}</span>} />
            <StatCard label="Balance" value={<span className={global3m.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{fmtMoney(global3m.balance)}</span>} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* ===== Balance por negocio (grupo 1 · últimos 3 meses) con EF/RESTO ===== */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 md:col-span-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold mb-2">Balance por negocio</div>
                {global3m.loading && (
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Calculando…</span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] text-slate-500">
                    <tr>
                      <th className="text-left py-1">Negocio</th>
                      <th className="text-right py-1">BANCO</th>
                      <th className="text-right py-1">IMP. (−)</th>
                      <th className="text-right py-1">BANCO NETO</th> {/* NUEVO */}
                      <th className="text-right py-1">EFECTIVO</th>

                    </tr>
                  </thead>
                  <tbody>
                    {rows3m.map((r) => {
                      const bancoNeto = (r.balanceRest ?? 0) + (r.bankTaxNeg ?? 0);

                      return (
                        <tr key={r.businessId} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="py-1">{r.businessName}</td>



                          <td className={`py-1 text-right tabular-nums ${r.balanceRest >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {fmtMoney(r.balanceRest)}
                          </td>

                          <td className="py-1 text-right tabular-nums text-red-600 dark:text-red-400">
                            {fmtMoney(r.bankTaxNeg)}
                          </td>

                          <td className={`py-1 text-right tabular-nums ${bancoNeto >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {fmtMoney(bancoNeto)}
                          </td>
                          <td className={`py-1 text-right tabular-nums ${r.balanceCash >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {fmtMoney(r.balanceCash)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 dark:border-slate-600">
                      <td className="py-2 font-semibold">Total grupo</td>


                      <td className={`py-2 text-right tabular-nums font-semibold ${totalBalance3M_Rest >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {fmtMoney(totalBalance3M_Rest)}
                      </td>

                      <td className="py-2 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">
                        {fmtMoney(totalBankTax3M_Neg)}
                      </td>
                      <td className={`py-2 text-right tabular-nums font-semibold ${totalBalance3M_Cash >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {fmtMoney(totalBalance3M_Cash)}
                      </td>

                      <td className={`py-2 text-right tabular-nums font-semibold ${(totalBalance3M_Rest + totalBankTax3M_Neg) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {fmtMoney(totalBalance3M_Rest + totalBankTax3M_Neg)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== NEGOCIOS (cards) ===== */}
      <section className="mt-8">
        <header className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-8 00 dark:text-white">Resumen financiero</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Ventas, gastos y rentabilidad de cada sucursal este mes.</p>
            </div>
            <div className="items-center gap-2">
              <button aria-label="Mes anterior" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors" onClick={() => setMonthOffset((o) => o - 1)} disabled={isLoading}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {monthLabel}
              </span>
              <button aria-label="Mes siguiente" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors" onClick={() => setMonthOffset((o) => o + 1)} disabled={isLoading}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {Array.from({ length: 3 }).map((_, i) => (<div key={i} className="h-48 rounded-2xl bg-slate-200/60 dark:bg-slate-700/30 animate-pulse" />))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {businessesWithMonthlyData.map((b: any) => (
              <BusinessCard key={b.id} b={b} open={allExpanded} onToggle={() => setAllExpanded((v) => !v)} />
            ))}
          </div>
        )}
      </section>

      {/* ===== TURNOS ACTIVOS ===== */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Turnos activos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeShifts.map((sh) => {
            const { payments, total } = calcShiftTotals(sh);
            const emp = employees.find((e) => e.id === sh.employee_id);
            const hours = (Date.now() - new Date(sh.start_time).getTime()) / 36e5;
            const avgHr = hours > 0 ? total / hours : 0;
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
                onOpenDetails={() => openShiftProducts(sh)}
              />
            );
          })}
          {!activeShifts.length && (
            <div className="col-span-full text-center py-10 rounded-xl bg-slate-100/50 dark:bg-slate-800/40">
              <p className="text-slate-500 dark:text-slate-400">No hay turnos activos.</p>
            </div>
          )}
        </div>
      </section>

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
