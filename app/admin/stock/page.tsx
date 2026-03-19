"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  ChevronLeft, ChevronRight, Building2, X,
  TrendingUp, Package, AlertTriangle, BarChart2,
  ShoppingCart, Banknote, CreditCard, Wallet,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────── */
function monthRange(offset = 0) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

function lastNDays(n: number) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - n);
  return { start, end };
}

function formatShortRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const s = start.toLocaleDateString("es-AR", opts);
  const e = new Date(end.getTime() - 1).toLocaleDateString("es-AR", opts);
  return `${s} – ${e}`;
}

const CATEGORIES = [
  "ALMACEN","CIGARRILLOS","GOLOSINAS","BEBIDA","CERVEZA",
  "FIAMBRES","TABACO","HUEVOS","HIGIENE","ALCOHOL","PROMO","SIN CATEGORIA","BRECA",
];

function extractCategory(name: string) {
  const cat = name.trim().split(" ")[0].toUpperCase();
  return CATEGORIES.includes(cat) ? cat : "SIN CATEGORIA";
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDec = (n: number) =>
  Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtM = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000 ? `$${(n / 1_000).toFixed(0)}k` : `$${fmt(n)}`;

type Mode = "month" | "last3" | "last7" | "last14";

/* ─────────────────────────────────────────────────────────
   FETCH
   ───────────────────────────────────────────────────────── */
async function fetchAll(query: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>) {
  const pageSize = 1000;
  let page = 0;
  const all: any[] = [];
  for (;;) {
    const from = page * pageSize;
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) { console.error(error); break; }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

const loadBusinesses = async () => {
  const { data, error } = await supabase.from("businesses").select("id,name").order("name");
  return error ? [] : data ?? [];
};

const loadSales = async (bizId: string, from: Date, to: Date) =>
  fetchAll((lo, hi) =>
    supabase.from("sales").select("*")
      .eq("business_id", bizId)
      .gte("timestamp", from.toISOString())
      .lt("timestamp", to.toISOString())
      .order("timestamp", { ascending: false })
      .range(lo, hi)
  );

const loadSaleItemsByBizAndMonth = async (bizId: string, from: Date, to: Date) =>
  fetchAll((lo, hi) =>
    supabase.from("sale_items")
      .select("sale_id, total, quantity, product_master_id, promotion_id, sales!inner(id)")
      .eq("sales.business_id", bizId)
      .gte("sales.timestamp", from.toISOString())
      .lt("sales.timestamp", to.toISOString())
      .order("sale_id", { ascending: false })
      .range(lo, hi)
  );

const loadProductMasters = async () =>
  fetchAll((from, to) =>
    supabase.from("products_master")
      .select("id,name,default_purchase,default_selling")
      .range(from, to)
  );

const loadPromotions = async () =>
  fetchAll((from, to) => supabase.from("promos").select("id,name").range(from, to));

/* ─────────────────────────────────────────────────────────
   MARGIN BADGE
   ───────────────────────────────────────────────────────── */
function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  const color =
    pct >= 40 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
    pct >= 20 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

/* ─────────────────────────────────────────────────────────
   CATEGORY COLOR (visual identity per category)
   ───────────────────────────────────────────────────────── */
const CAT_COLORS: Record<string, string> = {
  CIGARRILLOS: "bg-slate-400",
  GOLOSINAS:   "bg-pink-400",
  BEBIDA:      "bg-sky-400",
  ALMACEN:     "bg-amber-400",
  CERVEZA:     "bg-yellow-500",
  FIAMBRES:    "bg-orange-400",
  TABACO:      "bg-stone-400",
  HUEVOS:      "bg-yellow-300",
  HIGIENE:     "bg-teal-400",
  ALCOHOL:     "bg-purple-400",
  PROMO:       "bg-indigo-400",
  BRECA:       "bg-lime-400",
  "SIN CATEGORIA": "bg-slate-300",
};

function catColor(cat: string) {
  return CAT_COLORS[cat] ?? "bg-slate-300";
}

/* ─────────────────────────────────────────────────────────
   MAIN
   ───────────────────────────────────────────────────────── */
export default function CategoryRevenuePage() {
  const [mode, setMode] = useState<Mode>("month");
  const [monthOffset, setMonthOffset] = useState(0);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [selectedBiz, setSelectedBiz] = useState("");
  const [loading, setLoading] = useState(false);

  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [productMap, setProductMap] = useState<Map<string, string>>(new Map());
  const [promotionMap, setPromotionMap] = useState<Map<string, string>>(new Map());
  const [productCostMap, setProductCostMap] = useState<Map<string, number>>(new Map());
  const [productSellMap, setProductSellMap] = useState<Map<string, number>>(new Map());

  const [showModal, setShowModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalItems, setModalItems] = useState<Array<{
    name: string; qty: number; unitPriceAvg: number;
    purchaseUnitAvg: number | null; totalValue: number;
    profit: number | null; marginPct: number | null;
  }>>([]);

  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (mode === "month") return monthRange(monthOffset);
    if (mode === "last3") return lastNDays(3);
    if (mode === "last7") return lastNDays(7);
    return lastNDays(14);
  }, [mode, monthOffset]);

  const rangeLabel = useMemo(() => {
    if (mode === "month")
      return rangeStart.toLocaleString("es-ES", { month: "long", year: "numeric" });
    const prefix = mode === "last3" ? "3 días" : mode === "last7" ? "7 días" : "14 días";
    return `${prefix} · ${formatShortRange(rangeStart, rangeEnd)}`;
  }, [mode, rangeStart, rangeEnd]);

  useEffect(() => {
    loadBusinesses().then(setBusinesses);
  }, []);

  useEffect(() => {
    if (!selectedBiz) return;
    setLoading(true);
    (async () => {
      try {
        const [salesData, items, masters, promos] = await Promise.all([
          loadSales(selectedBiz, rangeStart, rangeEnd),
          loadSaleItemsByBizAndMonth(selectedBiz, rangeStart, rangeEnd),
          loadProductMasters(),
          loadPromotions(),
        ]);

        const pMap = new Map<string, string>();
        const pCost = new Map<string, number>();
        const pSell = new Map<string, number>();
        masters.forEach((m: any) => {
          pMap.set(m.id, m.name);
          if (m.default_purchase != null) pCost.set(m.id, Number(m.default_purchase));
          if (m.default_selling != null)  pSell.set(m.id, Number(m.default_selling));
        });

        const prMap = new Map<string, string>();
        promos.forEach((p: any) => prMap.set(p.id, p.name));

        setSales(salesData);
        setSaleItems(items);
        setProductMap(pMap);
        setProductCostMap(pCost);
        setProductSellMap(pSell);
        setPromotionMap(prMap);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedBiz, rangeStart, rangeEnd]);

  /* ─── Category summary ─── */
  const { rows, totals } = useMemo(() => {
    type Acc = { revenue: number; cash: number; transfer: number; card: number; revForMargin: number; costForMargin: number };
    const summary = new Map<string, Acc>();
    let totalRevenueAll = 0;
    const saleById = new Map<string, any>(sales.map((s) => [s.id, s]));

    saleItems.forEach((item: any) => {
      const sale = saleById.get(item.sale_id);
      if (!sale) return;

      const pm = (sale.payment_method || "").toLowerCase();
      const method = pm === "mercadopago" ? "transfer" : pm;

      let cat: string;
      if (item.promotion_id) {
        cat = "PROMO";
      } else {
        const name = productMap.get(item.product_master_id) ?? "—";
        cat = extractCategory(name);
      }

      if (!summary.has(cat)) summary.set(cat, { revenue: 0, cash: 0, transfer: 0, card: 0, revForMargin: 0, costForMargin: 0 });
      const acc = summary.get(cat)!;

      const revenue = Number(item.total) || 0;
      const unitSellFallback = productSellMap.get(item.product_master_id);
      const unitPrice = Number(item.unit_price ?? item.price ?? unitSellFallback ?? 0);
      const qtyRaw = item.quantity != null ? Number(item.quantity) : unitPrice > 0 ? revenue / unitPrice : 1;
      const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
      const unitCost = productCostMap.get(item.product_master_id);
      const hasValidCost = unitCost != null && unitCost >= 10;

      acc.revenue += revenue;
      totalRevenueAll += revenue;

      if (method === "cash" || method === "efectivo") acc.cash += revenue;
      else if (method === "transfer") acc.transfer += revenue;
      else if (method === "card" || method === "tarjeta") acc.card += revenue;

      if (!item.promotion_id && hasValidCost && unitPrice > 0 && qty > 0) {
        acc.revForMargin += revenue;
        acc.costForMargin += (unitCost as number) * qty;
      }
    });

    if (!summary.has("PROMO")) summary.set("PROMO", { revenue: 0, cash: 0, transfer: 0, card: 0, revForMargin: 0, costForMargin: 0 });

    const resultRows = Array.from(summary.entries())
      .map(([category, v]) => ({
        category,
        revenue: v.revenue,
        cash: v.cash,
        transfer: v.transfer,
        card: v.card,
        percent: totalRevenueAll ? (v.revenue / totalRevenueAll) * 100 : 0,
        marginPct: v.revForMargin > 0 ? ((v.revForMargin - v.costForMargin) / v.revForMargin) * 100 : null,
        replenishmentCost: v.costForMargin,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalsBase = resultRows.reduce(
      (acc, cur) => ({ revenue: acc.revenue + cur.revenue, cash: acc.cash + cur.cash, transfer: acc.transfer + cur.transfer, card: acc.card + cur.card }),
      { revenue: 0, cash: 0, transfer: 0, card: 0 }
    );

    let revForMarginAll = 0, costForMarginAll = 0;
    summary.forEach((v) => { revForMarginAll += v.revForMargin; costForMarginAll += v.costForMargin; });

    return {
      rows: resultRows,
      totals: {
        ...totalsBase,
        marginPct: revForMarginAll > 0 ? ((revForMarginAll - costForMarginAll) / revForMarginAll) * 100 : null,
        replenishmentCost: costForMarginAll,
      },
    };
  }, [sales, saleItems, productMap, productSellMap, productCostMap]);

  /* ─── Category click → modal ─── */
  const handleCategoryClick = (category: string) => {
    const saleById = new Map<string, any>(sales.map((s) => [s.id, s]));
    type Agg = { name: string; qty: number; revenue: number; costSum: number; unitPriceSum: number; hasCost: boolean };
    const agg = new Map<string, Agg>();

    saleItems.forEach((item: any) => {
      const sale = saleById.get(item.sale_id);
      if (!sale) return;

      let name: string;
      let matches = false;
      if (item.promotion_id) {
        name = promotionMap.get(item.promotion_id) ?? "[PROMO]";
        matches = category === "PROMO";
      } else {
        name = productMap.get(item.product_master_id) ?? "—";
        matches = extractCategory(name) === category;
      }
      if (!matches) return;

      const qty = Number(item.quantity ?? 1);
      const revenue = Number(item.total ?? 0);
      const unitSellFallback = productSellMap.get(item.product_master_id);
      const derivedUnit = qty ? revenue / qty : undefined;
      const unitPrice = Number(item.unit_price ?? item.price ?? derivedUnit ?? unitSellFallback ?? 0);
      const unitCost = productCostMap.get(item.product_master_id);

      if (!agg.has(name)) agg.set(name, { name, qty: 0, revenue: 0, costSum: 0, unitPriceSum: 0, hasCost: false });
      const a = agg.get(name)!;
      a.qty += qty;
      a.revenue += revenue;
      a.unitPriceSum += unitPrice * qty;
      if (unitCost != null) { a.costSum += unitCost * qty; a.hasCost = true; }
    });

    const items = Array.from(agg.values())
      .map((x) => {
        const unitPriceAvg = x.qty ? x.unitPriceSum / x.qty : 0;
        const purchaseUnitAvg = x.hasCost ? x.costSum / (x.qty || 1) : null;
        const profit = x.hasCost ? x.revenue - x.costSum : null;
        const marginPct = (x.hasCost && unitPriceAvg > 0)
          ? ((unitPriceAvg - (purchaseUnitAvg as number)) / unitPriceAvg) * 100
          : null;
        return { name: x.name, qty: x.qty, unitPriceAvg, purchaseUnitAvg, totalValue: x.revenue, profit, marginPct };
      })
      .sort((a, b) => b.totalValue - a.totalValue);

    setModalCategory(category);
    setModalItems(items);
    setShowModal(true);
  };

  const bizName = businesses.find((b) => b.id === selectedBiz)?.name;

  /* ─── Top 20 productos más vendidos (por revenue) ─── */
  const topProducts = useMemo(() => {
    if (!saleItems.length) return [];
    type Agg = { name: string; category: string; qty: number; revenue: number; costSum: number; unitPriceSum: number; hasCost: boolean };
    const agg = new Map<string, Agg>();

    saleItems.forEach((item: any) => {
      let name: string;
      let category: string;

      if (item.promotion_id) {
        name = promotionMap.get(item.promotion_id) ?? "[PROMO]";
        category = "PROMO";
      } else {
        name = productMap.get(item.product_master_id) ?? "—";
        category = extractCategory(name);
      }

      const qty = Number(item.quantity ?? 1);
      const revenue = Number(item.total ?? 0);
      const unitSellFallback = productSellMap.get(item.product_master_id);
      const derivedUnit = qty ? revenue / qty : undefined;
      const unitPrice = Number(item.unit_price ?? item.price ?? derivedUnit ?? unitSellFallback ?? 0);
      const unitCost = productCostMap.get(item.product_master_id);

      if (!agg.has(name)) agg.set(name, { name, category, qty: 0, revenue: 0, costSum: 0, unitPriceSum: 0, hasCost: false });
      const a = agg.get(name)!;
      a.qty += qty;
      a.revenue += revenue;
      a.unitPriceSum += unitPrice * qty;
      if (unitCost != null) { a.costSum += unitCost * qty; a.hasCost = true; }
    });

    return Array.from(agg.values())
      .map((x) => {
        const unitPriceAvg = x.qty ? x.unitPriceSum / x.qty : 0;
        const purchaseUnitAvg = x.hasCost ? x.costSum / (x.qty || 1) : null;
        const marginPct = (x.hasCost && purchaseUnitAvg != null && purchaseUnitAvg >= 10 && unitPriceAvg > 0)
          ? ((unitPriceAvg - purchaseUnitAvg) / unitPriceAvg) * 100
          : null;
        return { name: x.name, category: x.category, qty: x.qty, revenue: x.revenue, unitPriceAvg, purchaseUnitAvg, marginPct };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);
  }, [saleItems, productMap, promotionMap, productSellMap, productCostMap]);

  /* ─── Render ─── */
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* ══ HEADER ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Facturación por categoría
          </h1>
          {bizName && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {bizName}
            </p>
          )}
        </div>
      </div>

      {/* ══ CONTROLES ══ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">

          {/* Negocio */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Negocio
            </label>
            <select
              value={selectedBiz}
              onChange={(e) => setSelectedBiz(e.target.value)}
              className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            >
              <option value="">Seleccioná un negocio</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Modo */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Período</label>
            <div className="flex gap-1.5">
              {([
                { k: "month", l: "Mes" },
                { k: "last3", l: "3 días" },
                { k: "last7", l: "7 días" },
                { k: "last14", l: "14 días" },
              ] as { k: Mode; l: string }[]).map(({ k, l }) => (
                <button
                  key={k}
                  onClick={() => { setMode(k); if (k !== "month") setMonthOffset(0); }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    mode === k
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Nav mes */}
          {mode === "month" && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMonthOffset((o) => o - 1)}
                disabled={loading}
                className="p-2 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
              <span className="px-3 text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize whitespace-nowrap">
                {rangeLabel}
              </span>
              <button
                onClick={() => setMonthOffset((o) => o + 1)}
                disabled={loading}
                className="p-2 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          )}

          {mode !== "month" && (
            <span className="text-sm text-slate-500 dark:text-slate-400 self-end pb-2">{rangeLabel}</span>
          )}
        </div>
      </div>

      {/* ══ EMPTY STATE ══ */}
      {!selectedBiz && (
        <div className="flex flex-col items-center justify-center h-52 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 gap-3">
          <BarChart2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">Seleccioná un negocio para ver la facturación</p>
        </div>
      )}

      {/* ══ LOADING ══ */}
      {loading && (
        <div className="flex flex-col items-center justify-center h-52 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Cargando datos…</p>
        </div>
      )}

      {/* ══ CONTENT ══ */}
      {!loading && selectedBiz && rows.length > 0 && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Ventas totales", value: fmtM(totals.revenue), icon: TrendingUp, color: "text-slate-900 dark:text-white", bg: "bg-slate-50 dark:bg-slate-800" },
              { label: "Margen global", value: totals.marginPct != null ? `${totals.marginPct.toFixed(1)}%` : "—", icon: BarChart2, color: totals.marginPct != null && totals.marginPct >= 30 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400", bg: "bg-slate-50 dark:bg-slate-800" },
              { label: "Categorías", value: rows.length, icon: Package, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
              { label: "Costo reposición", value: fmtM(totals.replenishmentCost), icon: ShoppingCart, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-800" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`rounded-2xl border border-slate-200 dark:border-slate-700 ${bg} px-4 py-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium">{label}</div>
                </div>
                <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── TABLA ── */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[65vh]">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                  <tr>
                    {["Categoría", "Total", "Costo repos.", "Margen", "Efectivo", "Transfer.", "Tarjeta", "% del total"].map((h) => (
                      <th key={h} className={`px-4 py-3 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap ${h === "Categoría" ? "text-left" : "text-right"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((cat) => (
                    <tr
                      key={cat.category}
                      onClick={() => handleCategoryClick(cat.category)}
                      className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer"
                    >
                      {/* Categoría */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${catColor(cat.category)}`} />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                            {cat.category}
                          </span>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">${fmt(cat.revenue)}</span>
                      </td>

                      {/* Costo reposición */}
                      <td className="px-4 py-3 text-right">
                        {cat.replenishmentCost > 0
                          ? <span className="tabular-nums text-slate-600 dark:text-slate-300">${fmt(cat.replenishmentCost)}</span>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>
                        }
                      </td>

                      {/* Margen */}
                      <td className="px-4 py-3 text-right">
                        <MarginBadge pct={cat.marginPct} />
                      </td>

                      {/* Métodos */}
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                        ${fmt(cat.cash)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-violet-600 dark:text-violet-400 font-medium">
                        ${fmt(cat.transfer)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-indigo-600 dark:text-indigo-400 font-medium">
                        ${fmt(cat.card)}
                      </td>

                      {/* % barra */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${catColor(cat.category)}`}
                              style={{ width: `${Math.min(100, cat.percent)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 w-10 text-right">
                            {cat.percent.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer */}
                <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <td className="px-4 py-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">${fmt(totals.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300 font-semibold">
                      {totals.replenishmentCost > 0 ? `$${fmt(totals.replenishmentCost)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right"><MarginBadge pct={totals.marginPct} /></td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300 font-bold">${fmt(totals.cash)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-violet-700 dark:text-violet-300 font-bold">${fmt(totals.transfer)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-300 font-bold">${fmt(totals.card)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══ TOP 20 PRODUCTOS ══ */}
      {!loading && selectedBiz && topProducts.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Top 20 productos</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Ordenado por facturación · {rangeLabel}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold w-8">#</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Producto</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Cant.</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">P. venta</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">P. compra</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Total</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Margen</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">% total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {topProducts.map((p, i) => {
                  const pct = totals.revenue > 0 ? (p.revenue / totals.revenue) * 100 : 0;
                  return (
                    <tr key={p.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Rank */}
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          i === 1 ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" :
                          i === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                          "text-slate-400 dark:text-slate-500"
                        }`}>
                          {i + 1}
                        </span>
                      </td>

                      {/* Nombre */}
                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100 max-w-[240px] truncate">
                        {p.name}
                      </td>

                      {/* Categoría */}
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className={`w-2 h-2 rounded-full ${catColor(p.category)}`} />
                          {p.category}
                        </span>
                      </td>

                      {/* Cantidad */}
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                        {p.qty}
                      </td>

                      {/* Precio venta */}
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400 text-xs">
                        ${fmtDec(p.unitPriceAvg)}
                      </td>

                      {/* Precio compra */}
                      <td className="px-4 py-2.5 text-right">
                        {p.purchaseUnitAvg == null ? (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        ) : p.purchaseUnitAvg <= 10 ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-semibold">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Sin costo
                          </span>
                        ) : (
                          <span className="tabular-nums text-slate-500 dark:text-slate-400 text-xs">${fmtDec(p.purchaseUnitAvg)}</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                        ${fmt(p.revenue)}
                      </td>

                      {/* Margen */}
                      <td className="px-4 py-2.5 text-right">
                        <MarginBadge pct={p.marginPct} />
                      </td>

                      {/* % barra */}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-400 dark:bg-indigo-500"
                              style={{ width: `${Math.min(100, pct * 5)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-slate-400 w-8 text-right">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && selectedBiz && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 gap-3">
          <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">Sin ventas en este período</p>
        </div>
      )}

      {/* ══ MODAL ══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative w-full sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">

            {/* Modal header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${catColor(modalCategory)}`} />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{modalCategory}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {modalItems.length} productos · {rangeLabel}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                  <tr>
                    {["Producto", "Precio venta", "Cant.", "Precio compra", "Total", "Margen"].map((h) => (
                      <th key={h} className={`px-4 py-3 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold ${h === "Producto" ? "text-left" : "text-right"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {modalItems.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-2.5 text-slate-800 dark:text-slate-100 max-w-[280px] truncate font-medium">
                        {item.name}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        ${fmtDec(item.unitPriceAvg)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200 font-semibold">
                        {item.qty}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {item.purchaseUnitAvg == null ? (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        ) : item.purchaseUnitAvg <= 10 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[11px] font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            Sin costo
                          </span>
                        ) : (
                          <span className="tabular-nums text-slate-600 dark:text-slate-300">${fmtDec(item.purchaseUnitAvg)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                        ${fmt(item.totalValue)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <MarginBadge pct={item.marginPct} />
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Modal footer */}
                <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  {(() => {
                    const totalRevenue = modalItems.reduce((a, x) => a + x.totalValue, 0);
                    const valid = modalItems.filter((x) => x.purchaseUnitAvg != null && x.purchaseUnitAvg >= 10 && x.unitPriceAvg > 0);
                    const revWithCost = valid.reduce((a, x) => a + x.totalValue, 0);
                    const costWithCost = valid.reduce((a, x) => a + (x.purchaseUnitAvg as number) * x.qty, 0);
                    const weightedMargin = revWithCost > 0 ? ((revWithCost - costWithCost) / revWithCost) * 100 : null;
                    return (
                      <tr>
                        <td className="px-4 py-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Total</td>
                        <td colSpan={3} className="px-4 py-3" />
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">${fmt(totalRevenue)}</td>
                        <td className="px-4 py-3 text-right"><MarginBadge pct={weightedMargin} /></td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}