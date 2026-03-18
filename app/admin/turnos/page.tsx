"use client";
 
import type React from "react";
import { useEffect, useState, useMemo } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  SearchIcon,
  Store,
  Download,
  CheckSquare,
  Square,
  X,
  Package,
  Clock,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Shift } from "@/lib/redux/slices/shiftSlice";
 
/* ─────────────────────────────────────────────────────────
   HELPERS
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
    if (error) { console.error(error); break; }
    if (!data?.length) break;
    acc = acc.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return acc;
}
 
function computeDateRange(type: "month" | "custom" | number, customFrom?: string, customTo?: string) {
  const now = new Date();
  if (type === "month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }
  if (type === "custom" && customFrom && customTo) {
    const start = new Date(customFrom + "T00:00:00");
    const end = new Date(customTo + "T23:59:59");
    return { start, end };
  }
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (type as number));
  return { start, end };
}
 
const formatPrice = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
 
const fmtMoney = (n: number) => `$ ${formatPrice(n)}`;
 
const translatePaymentMethod = (m: string) =>
  ({ cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia", rappi: "Rappi", mercadopago: "Transferencia" } as any)[m] ?? m;
 
const getPaymentMethodClass = (m: string) =>
  ({
    cash: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    card: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    transfer: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    rappi: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  } as any)[m] ?? "bg-slate-100 text-slate-700";
 
const CATEGORIES = [
  "ALMACEN","CIGARRILLOS","GOLOSINAS","BEBIDA","CERVEZA",
  "FIAMBRES","TABACO","HUEVOS","HIGIENE","ALCOHOL","PROMO","BRECA",
];
 
function getCategory(name: string) {
  const first = (name || "").trim().split(" ")[0]?.toUpperCase();
  return CATEGORIES.includes(first) ? first : "SIN CATEGORIA";
}
 
/* ─────────────────────────────────────────────────────────
   EXPORT CSV
   ───────────────────────────────────────────────────────── */
function downloadCSV(rows: { category: string; name: string; qty: number; total: number }[], label: string) {
  const header = "Categoría,Producto,Cantidad,Total\n";
  const body = rows
    .map((r) => `"${r.category}","${r.name}",${r.qty},${r.total}`)
    .join("\n");
  const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reposicion_${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
 
/* ─────────────────────────────────────────────────────────
   SUMMARY BAR (flotante al seleccionar)
   ───────────────────────────────────────────────────────── */
function SelectionBar({
  count,
  totalVentas,
  totalGuardado,
  onClear,
  onExport,
  onViewProducts,
}: {
  count: number;
  totalVentas: number;
  totalGuardado: number;
  onClear: () => void;
  onExport: () => void;
  onViewProducts: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl">
      <div className="flex items-center gap-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl px-5 py-3.5 shadow-2xl">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold grid place-items-center">
            {count}
          </span>
          <span className="text-sm font-medium opacity-80">turnos</span>
        </div>
        <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm">
            <span className="opacity-60 text-xs">Ventas</span>{" "}
            <span className="font-bold tabular-nums">{fmtMoney(totalVentas)}</span>
          </span>
          <span className="text-sm">
            <span className="opacity-60 text-xs">Guardado ef.</span>{" "}
            <span className="font-bold tabular-nums text-emerald-400 dark:text-emerald-600">{fmtMoney(totalGuardado)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onViewProducts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            Productos
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={onClear}
            className="p-1.5 rounded-xl hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
          >
            <X className="w-4 h-4 opacity-60" />
          </button>
        </div>
      </div>
    </div>
  );
}
 
/* ─────────────────────────────────────────────────────────
   MODAL PRODUCTOS SELECCIONADOS
   ───────────────────────────────────────────────────────── */
function ProductsModal({
  open,
  onClose,
  rows,
  label,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  rows: { category: string; name: string; qty: number; total: number }[];
  label: string;
  onExport: () => void;
}) {
  if (!open) return null;
 
  const byCategory = rows.reduce((acc: Record<string, typeof rows>, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});
 
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalAmount = rows.reduce((s, r) => s + r.total, 0);
 
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
        {/* header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Lista de reposición</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label} · {totalQty} unidades · {fmtMoney(totalAmount)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar CSV
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
 
        {/* body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {Object.entries(byCategory)
            .sort(([, a], [, b]) => b.reduce((s, r) => s + r.qty, 0) - a.reduce((s, r) => s + r.qty, 0))
            .map(([cat, items]) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{cat}</h4>
                  <span className="text-xs text-slate-400">{items.reduce((s, r) => s + r.qty, 0)} u.</span>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {items.map((r, i) => (
                        <tr
                          key={i}
                          className="border-t border-slate-100 dark:border-slate-800 first:border-0"
                        >
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{r.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span className="inline-flex items-center justify-center w-8 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-xs">
                              {r.qty}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400 text-xs">
                            {fmtMoney(r.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
 
/* ─────────────────────────────────────────────────────────
   DETAILS MODAL
   ───────────────────────────────────────────────────────── */
function DetailsModal({
  shift,
  getShiftSales,
  onClose,
}: {
  shift: any;
  getShiftSales: (id: string) => any[];
  onClose: () => void;
}) {
  const shiftSales = getShiftSales(shift.id);
 
  const totals = useMemo(() =>
    shiftSales.reduce((acc: Record<string, number>, s: any) => {
      const k = s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod;
      acc[k] = (acc[k] || 0) + s.total;
      return acc;
    }, {}),
    [shiftSales]
  );
 
  const productSummary = useMemo(() => {
    const grouped = new Map<string, { name: string; qty: number; total: number }[]>();
    for (const sale of shiftSales) {
      for (const it of sale.items || []) {
        const name: string = it?.name ?? "—";
        const cat = getCategory(name);
        const list = grouped.get(cat) || [];
        const existing = list.find((p) => p.name === name);
        if (existing) {
          existing.qty += Number(it?.quantity || 0);
          existing.total += Number(it?.total || 0);
        } else {
          list.push({ name, qty: Number(it?.quantity || 0), total: Number(it?.total || 0) });
        }
        grouped.set(cat, list);
      }
    }
    return Array.from(grouped.entries())
      .map(([category, items]) => ({ category, items: items.sort((a, b) => b.qty - a.qty) }))
      .sort((a, b) => b.items.reduce((s, i) => s + i.qty, 0) - a.items.reduce((s, i) => s + i.qty, 0));
  }, [shiftSales]);
 
  const total = shiftSales.reduce((s: number, v: any) => s + v.total, 0);
 
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
        {/* header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Detalle del turno</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {shift.employeeName} · {shift.businessName}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
 
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">
          {/* Info básica */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Inicio", value: new Date(shift.startTime).toLocaleString() },
              { label: "Fin", value: shift.endTime ? new Date(shift.endTime).toLocaleString() : "Activo" },
              { label: "N° ventas", value: shiftSales.length },
              { label: "Total", value: fmtMoney(total) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{label}</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}</div>
              </div>
            ))}
          </div>
 
          {/* Métodos */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Métodos de pago</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(totals).map(([k, v]) => (
                <span key={k} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${getPaymentMethodClass(k)}`}>
                  {translatePaymentMethod(k)}: {fmtMoney(v as number)}
                </span>
              ))}
            </div>
          </div>
 
          {/* Productos por categoría */}
          {productSummary.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Productos vendidos</h4>
              <div className="space-y-4">
                {productSummary.map((cat) => (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{cat.category}</span>
                      <span className="text-xs text-slate-400">{cat.items.reduce((s, i) => s + i.qty, 0)} u.</span>
                    </div>
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {cat.items.map((r, idx) => (
                            <tr key={idx} className="border-t border-slate-100 dark:border-slate-800 first:border-0">
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.name}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                <span className="inline-flex items-center justify-center w-8 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-xs text-slate-800 dark:text-slate-100">{r.qty}</span>
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-slate-500 tabular-nums">{fmtMoney(r.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
 
          {/* Ventas individuales */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Ventas del turno</h4>
            {shiftSales.length ? (
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Hora</th>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Detalle</th>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Método</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftSales.map((s: any) => (
                        <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300 text-xs">
                            {new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            {s.items.map((it: any, i: number) => (
                              <div key={i} className="text-xs">
                                <span className="font-medium">{it.quantity}× {it.name}</span>
                                {it.isPromo && (
                                  <span className="ml-1 text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 px-1.5 py-0.5 rounded-full">PROMO</span>
                                )}
                              </div>
                            ))}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${getPaymentMethodClass(s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod)}`}>
                              {translatePaymentMethod(s.paymentMethod)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {fmtMoney(s.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Sin ventas registradas.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
 
/* ─────────────────────────────────────────────────────────
   SHIFT ROW
   ───────────────────────────────────────────────────────── */
function ShiftRow({
  sh,
  shiftSales,
  isSelected,
  onToggle,
  onOpenDetails,
  updatingId,
  onToggleStatus,
}: {
  sh: any;
  shiftSales: any[];
  isSelected: boolean;
  onToggle: () => void;
  onOpenDetails: () => void;
  updatingId: string | null;
  onToggleStatus: (id: string, current?: boolean) => void;
}) {
  const total = shiftSales.reduce((s: number, v: any) => s + v.total, 0);
 
  const paymentsByMethod = shiftSales.reduce((acc: Record<string, number>, s: any) => {
    const method = s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod;
    acc[method] = (acc[method] || 0) + s.total;
    return acc;
  }, {} as Record<string, number>);
 
  const efectivoVentas = paymentsByMethod["cash"] || 0;
  const montoGuardado = efectivoVentas + (sh.startCash || 0) - (sh.endCash || 0);
  const verified = !!sh.status;
 
  const started = new Date(sh.startTime);
  const ended = sh.endTime ? new Date(sh.endTime) : null;
  const durationMs = ended ? ended.getTime() - started.getTime() : Date.now() - started.getTime();
  const durationH = Math.floor(durationMs / 36e5);
  const durationM = Math.floor((durationMs % 36e5) / 60000);
 
  return (
    <tr
      className={[
        "group transition-colors border-l-4",
        isSelected
          ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20"
          : "border-transparent hover:bg-slate-50/70 dark:hover:bg-slate-800/40",
      ].join(" ")}
    >
      {/* Checkbox */}
      <td className="pl-4 py-3 w-10" onClick={onToggle}>
        <button className="text-slate-400 hover:text-indigo-500 transition-colors">
          {isSelected
            ? <CheckSquare className="w-4 h-4 text-indigo-500" />
            : <Square className="w-4 h-4" />}
        </button>
      </td>
 
      {/* Empleado */}
      <td className="px-3 py-3" onClick={onToggle}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs grid place-items-center shrink-0">
            {(sh.employeeName || "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap">{sh.employeeName}</div>
            <div className="text-xs text-slate-400">{sh.businessName}</div>
          </div>
        </div>
      </td>
 
      {/* Inicio / duración */}
      <td className="px-3 py-3" onClick={onToggle}>
        <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">
          {started.toLocaleDateString("es-AR")}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
          <Clock className="w-3 h-3" />
          {started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {" · "}
          {durationH}h {durationM}m
        </div>
      </td>
 
      {/* Estado */}
      <td className="px-3 py-3" onClick={onToggle}>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
          sh.active
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sh.active ? "bg-emerald-500" : "bg-slate-400"}`} />
          {sh.active ? "Activo" : "Completado"}
        </span>
      </td>
 
      {/* Ventas */}
      <td className="px-3 py-3 text-center" onClick={onToggle}>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{shiftSales.length}</span>
      </td>
 
      {/* Total */}
      <td className="px-3 py-3" onClick={onToggle}>
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">{fmtMoney(total)}</span>
      </td>
 
      {/* Métodos */}
      <td className="px-3 py-3" onClick={onToggle}>
        <div className="flex flex-wrap gap-1">
          {Object.entries(paymentsByMethod).map(([k, amount]) => (
            <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${getPaymentMethodClass(k)}`}>
              {translatePaymentMethod(k)}: {fmtMoney(amount as number)}
            </span>
          ))}
        </div>
      </td>
 
      {/* Guardado */}
      <td className="px-3 py-3" onClick={onToggle}>
        <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100 whitespace-nowrap">{fmtMoney(montoGuardado)}</span>
      </td>
 
      {/* Caja */}
      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400" onClick={onToggle}>
        <div>Ap: <span className="font-medium text-slate-700 dark:text-slate-200">{fmtMoney(sh.startCash || 0)}</span></div>
        <div>Ci: <span className="font-medium text-slate-700 dark:text-slate-200">{sh.endCash != null ? fmtMoney(sh.endCash) : "—"}</span></div>
      </td>
 
      {/* Verificación */}
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold self-start ${
            verified
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          }`}>
            {verified ? <ShieldCheck className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {verified ? "Verificado" : "Pendiente"}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStatus(sh.id, verified); }}
            disabled={updatingId === sh.id}
            className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-50 transition-colors self-start"
          >
            {updatingId === sh.id ? "…" : verified ? "Marcar pendiente" : "Marcar verificado"}
          </button>
        </div>
      </td>
 
      {/* Detalle */}
      <td className="px-3 py-3">
        <button
          onClick={(e) => { e.stopPropagation(); onOpenDetails(); }}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Ver detalle"
        >
          <FileText className="w-4 h-4 text-indigo-500" />
        </button>
      </td>
    </tr>
  );
}
 
/* ─────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────── */
export default function ShiftsPage() {
  /* ─── data fetchers ─── */
  async function fetchShifts(from: Date, to: Date) {
    return fetchAllPaginated((lo, hi) =>
      supabase
        .from("shifts")
        .select("*")
        .eq("business_id", selectedBusinessId)
        .gte("start_time", from.toISOString())
        .lt("start_time", to.toISOString())
        .order("start_time", { ascending: false })
        .range(lo, hi)
    );
  }
 
  async function fetchSalesByShift(shiftIds: string[]) {
    const allSales: any[] = [];
    for (const shiftId of shiftIds) {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id, timestamp, total, payment_method, shift_id,
          sale_items (
            quantity, total, stock, product_id, product_master_id, promotion_id,
            promotion:promos ( name ),
            products ( name ),
            products_master ( name )
          )
        `)
        .eq("shift_id", shiftId);
      if (error) { console.error(`Error shift ${shiftId}:`, error); continue; }
      allSales.push(...(data ?? []));
    }
    return allSales;
  }
 
  async function fetchEmployees() {
    const { data, error } = await supabase.from("employees").select("*").order("name");
    if (error) { console.error(error); return []; }
    return data ?? [];
  }
 
  async function fetchBusinesses() {
    const { data, error } = await supabase.from("businesses").select("*").order("name");
    if (error) { console.error(error); return []; }
    return data ?? [];
  }
 
  /* ─── state ─── */
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedData, setHasFetchedData] = useState(false);
 
  const [selectedBusinessId, setSelectedBusinessId] = useState("all");
  const [hasSelectedBusiness, setHasSelectedBusiness] = useState(false);
 
  const [dateRangeType, setDateRangeType] = useState<"month" | "custom" | number>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
 
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [selectedSavedByShift, setSelectedSavedByShift] = useState<Record<string, number>>({});
  const [selectedTotalByShift, setSelectedTotalByShift] = useState<Record<string, number>>({});
 
  const [search, setSearch] = useState("");
  const [filterVerified, setFilterVerified] = useState<"all" | "verified" | "pending">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed">("all");
 
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [isProductsModalOpen, setIsProductsModalOpen] = useState(false);
 
  const [updatingId, setUpdatingId] = useState<string | null>(null);
 
  const { start: dateStart, end: dateEnd } = useMemo(
    () => computeDateRange(dateRangeType, customFrom, customTo),
    [dateRangeType, customFrom, customTo]
  );
 
  /* ─── initial load ─── */
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const [emp, biz] = await Promise.all([fetchEmployees(), fetchBusinesses()]);
      setEmployees(emp);
      setBusinesses(biz);
      setIsLoading(false);
    })();
  }, []);
 
  /* ─── load shifts + sales when business/date changes ─── */
  useEffect(() => {
    if (!hasSelectedBusiness || selectedBusinessId === "all") return;
    (async () => {
      setIsLoading(true);
      const sh = await fetchShifts(dateStart, dateEnd);
      const sa = await fetchSalesByShift(sh.map((s: any) => s.id));
 
      const shiftsFixed = sh.map((r: any) => ({
        ...r,
        startTime: r.start_time,
        endTime: r.end_time,
        startCash: r.start_cash ?? 0,
        endCash: r.end_cash ?? null,
        employeeName: employees.find((e) => e.id === r.employee_id)?.name ?? "—",
        businessName: businesses.find((b) => b.id === r.business_id)?.name ?? "—",
        status: !!r.status,
      }));
 
      const salesFixed = sa.map((r: any) => ({
        ...r,
        shiftId: r.shift_id,
        paymentMethod: r.payment_method === "mercadopago" ? "transfer" : r.payment_method,
        items: (r.sale_items || []).map((it: any) => ({
          quantity: it.quantity,
          total: it.total,
          stock: it.stock,
          isPromo: !!it.promotion,
          name: it.promotion?.name ?? it.products?.name ?? it.products_master?.name ?? "—",
        })),
      }));
 
      setShifts(shiftsFixed);
      setSales(salesFixed);
      setIsLoading(false);
      setHasFetchedData(true);
      // clear selection on reload
      setSelectedShiftIds(new Set());
      setSelectedSavedByShift({});
      setSelectedTotalByShift({});
    })();
  }, [hasSelectedBusiness, selectedBusinessId, dateStart, dateEnd]);
 
  const getShiftSales = (shiftId: string) =>
    sales.filter((s) => s.shiftId === shiftId);
 
  /* ─── selection logic ─── */
  const computeGuardado = (sh: any, shiftSales: any[]) => {
    const pm = shiftSales.reduce((acc: Record<string, number>, s: any) => {
      const m = s.paymentMethod === "mercadopago" ? "transfer" : s.paymentMethod;
      acc[m] = (acc[m] || 0) + s.total;
      return acc;
    }, {});
    return (pm["cash"] || 0) + (sh.startCash || 0) - (sh.endCash || 0);
  };
 
  const handleRowToggle = (sh: any) => {
    const shiftSales = getShiftSales(sh.id);
    const guardado = computeGuardado(sh, shiftSales);
    const total = shiftSales.reduce((s: number, v: any) => s + v.total, 0);
 
    setSelectedShiftIds((prev) => {
      const next = new Set(prev);
      if (next.has(sh.id)) {
        next.delete(sh.id);
        setSelectedSavedByShift((m) => { const c = { ...m }; delete c[sh.id]; return c; });
        setSelectedTotalByShift((m) => { const c = { ...m }; delete c[sh.id]; return c; });
      } else {
        next.add(sh.id);
        setSelectedSavedByShift((m) => ({ ...m, [sh.id]: guardado }));
        setSelectedTotalByShift((m) => ({ ...m, [sh.id]: total }));
      }
      return next;
    });
  };
 
  const selectedGuardadoTotal = useMemo(
    () => Object.values(selectedSavedByShift).reduce((s, v) => s + (Number(v) || 0), 0),
    [selectedSavedByShift]
  );
 
  const selectedVentasTotal = useMemo(
    () => Object.values(selectedTotalByShift).reduce((s, v) => s + (Number(v) || 0), 0),
    [selectedTotalByShift]
  );
 
  /* ─── products consolidation for selection ─── */
  const consolidatedProducts = useMemo(() => {
    const map = new Map<string, { category: string; name: string; qty: number; total: number }>();
    for (const shiftId of selectedShiftIds) {
      for (const sale of getShiftSales(shiftId)) {
        for (const it of sale.items || []) {
          const name: string = it?.name ?? "—";
          const category = getCategory(name);
          const key = `${category}::${name}`;
          const existing = map.get(key);
          if (existing) {
            existing.qty += Number(it?.quantity || 0);
            existing.total += Number(it?.total || 0);
          } else {
            map.set(key, { category, name, qty: Number(it?.quantity || 0), total: Number(it?.total || 0) });
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.category !== b.category ? a.category.localeCompare(b.category) : b.qty - a.qty
    );
  }, [selectedShiftIds, sales]);
 
  const exportLabel = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }, []);
 
  /* ─── toggle status ─── */
  const handleToggleStatus = async (shiftId: string, current?: boolean) => {
    const next = !current;
    try {
      setUpdatingId(shiftId);
      const { error } = await supabase.from("shifts").update({ status: next }).eq("id", shiftId);
      if (error) { console.error(error); return; }
      setShifts((prev) => prev.map((sh: any) => sh.id === shiftId ? { ...sh, status: next } : sh));
    } finally {
      setUpdatingId(null);
    }
  };
 
  /* ─── filters ─── */
  const filteredShifts = useMemo(() => {
    return shifts.filter((sh: any) => {
      if (filterStatus === "active" && !sh.active) return false;
      if (filterStatus === "completed" && sh.active) return false;
      if (filterVerified === "verified" && !sh.status) return false;
      if (filterVerified === "pending" && sh.status) return false;
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchesEmployee = (sh.employeeName || "").toLowerCase().includes(term);
        const matchesProduct = getShiftSales(sh.id).some((sale: any) =>
          sale.items.some((it: any) => (it.name ?? "").toLowerCase().includes(term))
        );
        if (!matchesEmployee && !matchesProduct) return false;
      }
      return true;
    });
  }, [shifts, filterStatus, filterVerified, search, sales]);
 
  /* ─── summary stats ─── */
  const stats = useMemo(() => {
    const totalVentas = filteredShifts.reduce((s, sh) => {
      return s + getShiftSales(sh.id).reduce((a: number, v: any) => a + v.total, 0);
    }, 0);
    const active = filteredShifts.filter((sh) => sh.active).length;
    const verified = filteredShifts.filter((sh) => sh.status).length;
    return { totalVentas, active, verified, count: filteredShifts.length };
  }, [filteredShifts, sales]);
 
  /* ─── render ─── */
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6 pb-24">
 
      {/* ══ HEADER ══ */}
      <div className="flex flex-col gap-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-5 py-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Turnos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Control y seguimiento de ventas por empleado</p>
          </div>
 
          {/* Negocio selector */}
          <div className="flex items-center gap-2 shrink-0">
            <Store className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedBusinessId}
              onChange={(e) => { setSelectedBusinessId(e.target.value); setHasSelectedBusiness(true); }}
              className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            >
              <option value="all">Seleccioná un negocio</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
 
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end border-t border-slate-100 dark:border-slate-800 pt-4">
 
          {/* Tipo de rango */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Período</label>
            <div className="flex items-center gap-1">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <select
                value={dateRangeType}
                onChange={(e) => setDateRangeType(e.target.value === "month" || e.target.value === "custom" ? e.target.value as any : parseInt(e.target.value))}
                className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              >
                <option value="month">Este mes</option>
                <option value="7">Últimos 7 días</option>
                <option value="14">Últimos 14 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="60">Últimos 60 días</option>
                <option value="custom">Rango personalizado</option>
              </select>
            </div>
          </div>
 
          {/* Custom date range */}
          {dateRangeType === "custom" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Desde</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Hasta</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>
            </>
          )}
 
          {/* Estado */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="completed">Completados</option>
            </select>
          </div>
 
          {/* Verificación */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Verificación</label>
            <select
              value={filterVerified}
              onChange={(e) => setFilterVerified(e.target.value as any)}
              className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            >
              <option value="all">Todos</option>
              <option value="verified">Verificados</option>
              <option value="pending">Pendientes</option>
            </select>
          </div>
 
          {/* Buscador */}
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Buscar</label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Empleado o producto…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      </div>
 
      {/* ══ STATS BAR ══ */}
      {hasFetchedData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Turnos", value: stats.count, color: "text-slate-800 dark:text-slate-100" },
            { label: "Ventas totales", value: fmtMoney(stats.totalVentas), color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Activos ahora", value: stats.active, color: "text-indigo-600 dark:text-indigo-400" },
            { label: "Verificados", value: stats.verified, color: "text-slate-600 dark:text-slate-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3 shadow-sm">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{label}</div>
              <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}
 
      {/* ══ TABLE ══ */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Cargando turnos…</p>
        </div>
      ) : !hasFetchedData ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
          <Store className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">Seleccioná un negocio para ver los turnos</p>
        </div>
      ) : filteredShifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
          <Filter className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">Sin turnos para los filtros seleccionados</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="pl-4 py-3 w-10" />
                  {["Empleado", "Fecha / duración", "Estado", "Ventas", "Total", "Métodos de pago", "Guardado ef.", "Caja", "Verificación", ""].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredShifts.map((sh: any) => (
                  <ShiftRow
                    key={sh.id}
                    sh={sh}
                    shiftSales={getShiftSales(sh.id)}
                    isSelected={selectedShiftIds.has(sh.id)}
                    onToggle={() => handleRowToggle(sh)}
                    onOpenDetails={() => { setSelectedShift(sh); setIsDetailsModalOpen(true); }}
                    updatingId={updatingId}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
 
      {/* ══ SELECTION BAR ══ */}
      <SelectionBar
        count={selectedShiftIds.size}
        totalVentas={selectedVentasTotal}
        totalGuardado={selectedGuardadoTotal}
        onClear={() => { setSelectedShiftIds(new Set()); setSelectedSavedByShift({}); setSelectedTotalByShift({}); }}
        onExport={() => downloadCSV(consolidatedProducts, exportLabel)}
        onViewProducts={() => setIsProductsModalOpen(true)}
      />
 
      {/* ══ PRODUCTS MODAL ══ */}
      <ProductsModal
        open={isProductsModalOpen}
        onClose={() => setIsProductsModalOpen(false)}
        rows={consolidatedProducts}
        label={`${selectedShiftIds.size} turno${selectedShiftIds.size !== 1 ? "s" : ""}`}
        onExport={() => downloadCSV(consolidatedProducts, exportLabel)}
      />
 
      {/* ══ DETAILS MODAL ══ */}
      {isDetailsModalOpen && selectedShift && (
        <DetailsModal
          shift={selectedShift}
          getShiftSales={getShiftSales}
          onClose={() => setIsDetailsModalOpen(false)}
        />
      )}
    </div>
  );
}