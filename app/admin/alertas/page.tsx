"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice";
import { supabase } from "@/lib/supabase";

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────────────────────────────── */
const DEFAULT_DELIVERY_DAYS = 7;
const DEFAULT_BUFFER_DAYS   = 3;
const LS_MULTIPLES_KEY = "centro_comando_multiples";
const LS_DELIVERY_KEY  = "centro_comando_delivery";
const LS_BUFFER_KEY    = "centro_comando_buffer";
const LS_PERIOD_KEY    = "centro_comando_period";

const PERIOD_OPTIONS = [
  { value: 30,  label: "30 días",  shortLabel: "30d" },
  { value: 60,  label: "60 días",  shortLabel: "60d" },
  { value: 90,  label: "90 días",  shortLabel: "90d" },
  { value: 180, label: "180 días", shortLabel: "180d" },
] as const;
type PeriodDays = 30 | 60 | 90 | 180;

const DEFAULT_CATEGORY_MULTIPLES: Record<string, number> = {
  BEBIDA: 4, CERVEZA: 4, ALMACEN: 1, CIGARRILLOS: 1, GOLOSINAS: 1,
  FIAMBRES: 1, TABACO: 1, HUEVOS: 1, HIGIENE: 1, ALCOHOL: 1,
  PROMO: 1, BRECA: 1, "SIN CATEGORIA": 1,
};

const CATEGORIES = [
  "ALMACEN","CIGARRILLOS","GOLOSINAS","BEBIDA","CERVEZA",
  "FIAMBRES","TABACO","HUEVOS","HIGIENE","ALCOHOL","PROMO","SIN CATEGORIA","BRECA",
] as const;

/* ─────────────────────────────────────────────────────────────────────────────
   TIPOS
───────────────────────────────────────────────────────────────────────────── */
type Tab = "reposicion" | "abc" | "tendencias" | "comparacion";

// Tendencia de un producto entre la primera y segunda mitad del período
type Trend = "rocket"   // > +30%
           | "rising"   // +10% a +30%
           | "stable"   // -10% a +10%
           | "falling"  // -30% a -10%
           | "sinking"  // < -30%
           | "dead";    // sin ventas en la segunda mitad

interface TrendItem {
  productId: string;
  productName: string;
  category: string;
  abcClass: AbcClass;
  // ventas primera mitad del período (más viejo)
  soldFirst: number;
  // ventas segunda mitad (más reciente)
  soldSecond: number;
  dailyRateSecond: number;
  changePct: number | null; // null si soldFirst === 0
  trend: Trend;
  stock: number;
  daysLeft: number | null;
  defaultPurchase: number;
  defaultSelling: number;
  capitalInmovilizado: number;
  dailyRevenueLoss: number | null;
  // bandera: era A/B en período anterior y cayó
  classDropAlert: boolean;
  prevAbcClass: AbcClass | null;
}

type AbcClass = "A" | "B" | "C";

interface AbcItem {
  productId: string;
  productName: string;
  category: string;
  soldQty: number;
  revenue: number;
  netProfit: number | null;
  marginPct: number | null;
  daysLeft: number | null;
  stock: number;
  defaultSelling: number;
  defaultPurchase: number;
  abcClass: AbcClass;
  cumulativePct: number;
  dailyRevenueLoss: number | null;
  capitalInmovilizado: number;
  salesDays: number;
}

interface RepoItem {
  productId: string;
  productName: string;
  category: string;
  stock: number;
  soldQty: number;
  dailyRate: number;
  daysLeft: number | null;
  suggestedQty: number;
  suggestedPacks: number;
  packSize: number;
  urgency: "urgent" | "soon" | "ok";
  defaultPurchase: number;
  defaultSelling: number;
  dailyRevenueLoss: number | null;
}

// Para comparación entre sucursales
interface BranchSalesData {
  branchId: string;
  branchName: string;
  soldMap: Map<string, number>;
  revenueMap: Map<string, number>;
  stockMap: Map<string, number>;
}

interface CompareItem {
  productId: string;
  productName: string;
  category: string;
  byBranch: Record<string, {
    soldQty: number;
    revenue: number;
    stock: number;
    daysLeft: number | null;
    abcClass: AbcClass | null;
  }>;
  // diferencia porcentual entre la sucursal con más ventas y la con menos
  spreadPct: number;
  maxBranchId: string;
  minBranchId: string;
}

const ABC_THRESHOLDS = { A: 0.80, B: 0.95 };

const ABC_CONFIG: Record<AbcClass, {
  label: string; badge: string; bar: string; dot: string; headerBg: string; description: string;
}> = {
  A: { label: "Clase A", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", bar: "bg-emerald-500", dot: "bg-emerald-500", headerBg: "bg-emerald-50 dark:bg-emerald-950/20", description: "top 80% de facturación · máxima prioridad" },
  B: { label: "Clase B", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",             bar: "bg-blue-400",   dot: "bg-blue-400",   headerBg: "bg-blue-50 dark:bg-blue-950/20",       description: "siguiente 15% · prioridad media" },
  C: { label: "Clase C", badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",            bar: "bg-slate-300",  dot: "bg-slate-400",  headerBg: "bg-slate-50 dark:bg-slate-800/40",     description: "5% restante · baja prioridad" },
};

const TREND_CONFIG: Record<Trend, { icon: string; label: string; color: string; badge: string; description: string }> = {
  rocket:  { icon: "🚀", label: "+30% o más",    color: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", description: "Volando — asegurate de tener stock" },
  rising:  { icon: "📈", label: "+10% a +30%",   color: "text-blue-600 dark:text-blue-400",       badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",             description: "Creciendo — monitoreá el stock" },
  stable:  { icon: "➡️", label: "Estable",        color: "text-slate-500 dark:text-slate-400",     badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",            description: "Sin cambios significativos" },
  falling: { icon: "📉", label: "-10% a -30%",   color: "text-amber-600 dark:text-amber-400",     badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",         description: "Bajando — revisá precio o exposición" },
  sinking: { icon: "⚠️", label: "Cayendo fuerte", color: "text-red-600 dark:text-red-400",         badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",                 description: "Caída fuerte — decisión urgente" },
  dead:    { icon: "💀", label: "Sin ventas",     color: "text-slate-400 dark:text-slate-500",     badge: "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",            description: "Capital inmovilizado — evaluá descontinuar" },
};

const URGENCY_CONFIG = {
  urgent: { label: "Urgente", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",       dot: "bg-red-500",   rowBg: "bg-red-50/40 dark:bg-red-950/10", order: 1 },
  soon:   { label: "Pronto",  badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dot: "bg-amber-400", rowBg: "",                                 order: 2 },
  ok:     { label: "Planif.", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",    dot: "bg-blue-400",  rowBg: "",                                 order: 3 },
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function extractCategory(name: string): string {
  const cat = name.trim().split(" ")[0].toUpperCase();
  return (CATEGORIES as readonly string[]).includes(cat) ? cat : "SIN CATEGORIA";
}

function lastNDays(n: number) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - n);
  return { start, end };
}

function rangeDays(daysAgo: number, daysBack: number) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  end.setDate(end.getDate() - daysAgo);
  const start = new Date(end); start.setDate(end.getDate() - daysBack);
  return { start, end };
}

async function fetchAll<T>(
  query: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const pageSize = 1000; let page = 0; const all: T[] = [];
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

const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fmtN = (n: number) =>
  Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
const fmtPct = (n: number) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;

/* ─────────────────────────────────────────────────────────────────────────────
   FUNCIÓN: asigna clase ABC a un mapa de revenue
───────────────────────────────────────────────────────────────────────────── */
function assignAbcClasses(revenueMap: Map<string, number>): Map<string, AbcClass> {
  const total = Array.from(revenueMap.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return new Map();
  const sorted = Array.from(revenueMap.entries()).sort((a, b) => b[1] - a[1]);
  let cumulative = 0;
  const result = new Map<string, AbcClass>();
  for (const [id, rev] of sorted) {
    const before = cumulative / total;
    cumulative += rev;
    result.set(id, before < ABC_THRESHOLDS.A ? "A" : before < ABC_THRESHOLDS.B ? "B" : "C");
  }
  return result;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FUNCIÓN: construye items ABC
───────────────────────────────────────────────────────────────────────────── */
function buildAbcItems(
  masters: any[], stockMap: Map<string, number>,
  soldMap: Map<string, number>, revenueMap: Map<string, number>, salesDays: number,
): AbcItem[] {
  const totalRevenue = Array.from(revenueMap.values()).reduce((a, b) => a + b, 0);
  if (totalRevenue === 0) return [];
  const rows: Omit<AbcItem, "abcClass" | "cumulativePct">[] = [];
  masters.forEach((m: any) => {
    const revenue = revenueMap.get(m.id) ?? 0; if (revenue === 0) return;
    const soldQty = soldMap.get(m.id) ?? 0;
    const stock   = stockMap.get(m.id) ?? 0;
    const dailyRate = soldQty / salesDays;
    const purchase = Number(m.default_purchase) || 0;
    const selling  = Number(m.default_selling)  || 0;
    const hasValidCost = purchase >= 10;
    rows.push({
      productId: m.id, productName: m.name, category: extractCategory(m.name),
      soldQty, revenue, stock, defaultSelling: selling, defaultPurchase: purchase,
      netProfit:   hasValidCost ? (selling - purchase) * soldQty : null,
      marginPct:   (hasValidCost && selling > 0) ? ((selling - purchase) / selling) * 100 : null,
      daysLeft:    dailyRate > 0 ? stock / dailyRate : null,
      dailyRevenueLoss: dailyRate > 0 && selling > 0 ? dailyRate * selling : null,
      capitalInmovilizado: stock * purchase,
      salesDays,
    });
  });
  rows.sort((a, b) => b.revenue - a.revenue);
  let cumulative = 0;
  return rows.map((r) => {
    cumulative += r.revenue;
    const cumulativePct = cumulative / totalRevenue;
    const before = (cumulative - r.revenue) / totalRevenue;
    const abcClass: AbcClass = before < ABC_THRESHOLDS.A ? "A" : before < ABC_THRESHOLDS.B ? "B" : "C";
    return { ...r, abcClass, cumulativePct };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   FUNCIÓN: construye items de TENDENCIA
   Compara la primera mitad del período vs la segunda mitad (más reciente)
───────────────────────────────────────────────────────────────────────────── */
function buildTrendItems(
  masters: any[],
  stockMap: Map<string, number>,
  soldFirstMap: Map<string, number>,  // primera mitad (más viejo)
  soldSecondMap: Map<string, number>, // segunda mitad (más reciente)
  revenueSecondMap: Map<string, number>,
  halfPeriod: number,
): TrendItem[] {
  // Clases ABC basadas en la segunda mitad (actual)
  const currentClasses  = assignAbcClasses(revenueSecondMap);
  // Clases ABC basadas en la primera mitad (anterior)
  const revenueFirstMap = new Map<string, number>();
  masters.forEach((m: any) => {
    const sold = soldFirstMap.get(m.id) ?? 0;
    const selling = Number(m.default_selling) || 0;
    if (sold > 0 && selling > 0) revenueFirstMap.set(m.id, sold * selling);
  });
  const prevClasses = assignAbcClasses(revenueFirstMap);

  const items: TrendItem[] = [];
  masters.forEach((m: any) => {
    const soldFirst  = soldFirstMap.get(m.id)  ?? 0;
    const soldSecond = soldSecondMap.get(m.id) ?? 0;
    if (soldFirst === 0 && soldSecond === 0) return;

    const stock    = stockMap.get(m.id) ?? 0;
    const purchase = Number(m.default_purchase) || 0;
    const selling  = Number(m.default_selling)  || 0;
    const dailyRateSecond = soldSecond / halfPeriod;

    const changePct = soldFirst > 0 ? ((soldSecond - soldFirst) / soldFirst) * 100 : null;

    let trend: Trend;
    if (soldSecond === 0)              trend = "dead";
    else if (changePct === null)       trend = "rocket"; // no había ventas antes, ahora sí
    else if (changePct >= 30)          trend = "rocket";
    else if (changePct >= 10)          trend = "rising";
    else if (changePct >= -10)         trend = "stable";
    else if (changePct >= -30)         trend = "falling";
    else                               trend = "sinking";

    const abcClass  = currentClasses.get(m.id) ?? "C";
    const prevClass = prevClasses.get(m.id) ?? null;
    const classDropAlert =
      prevClass !== null &&
      ((prevClass === "A" && abcClass !== "A") ||
       (prevClass === "B" && abcClass === "C"));

    items.push({
      productId: m.id, productName: m.name, category: extractCategory(m.name),
      abcClass, soldFirst, soldSecond, dailyRateSecond,
      changePct: changePct !== null ? changePct : (soldSecond > 0 ? 100 : null),
      trend, stock,
      daysLeft: dailyRateSecond > 0 ? stock / dailyRateSecond : null,
      defaultPurchase: purchase, defaultSelling: selling,
      capitalInmovilizado: stock * purchase,
      dailyRevenueLoss: dailyRateSecond > 0 && selling > 0 ? dailyRateSecond * selling : null,
      classDropAlert, prevAbcClass: prevClass,
    });
  });

  return items;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FUNCIÓN: construye items de REPOSICIÓN
───────────────────────────────────────────────────────────────────────────── */
function buildRepoItems(
  masters: any[], stockMap: Map<string, number>,
  soldMap: Map<string, number>, _revenueMap: Map<string, number>,
  deliveryDays: number, bufferDays: number,
  categoryMultiples: Record<string, number>, salesDays: number,
): RepoItem[] {
  const items: RepoItem[] = [];
  masters.forEach((m: any) => {
    const stock   = stockMap.get(m.id) ?? 0;
    const soldQty = soldMap.get(m.id)  ?? 0;
    if (soldQty === 0) return;
    const category  = extractCategory(m.name);
    const packSize  = categoryMultiples[category] ?? 1;
    const dailyRate = soldQty / salesDays;
    const rawQty    = Math.max(0, dailyRate * (deliveryDays + bufferDays) - stock);
    const suggestedPacks = rawQty <= 0 ? 0 : Math.ceil(rawQty / packSize);
    if (suggestedPacks === 0) return;
    const daysLeft = dailyRate > 0 ? stock / dailyRate : null;
    let urgency: RepoItem["urgency"];
    if (daysLeft === null || daysLeft < deliveryDays) urgency = "urgent";
    else if (daysLeft < deliveryDays + bufferDays + 2) urgency = "soon";
    else urgency = "ok";
    const selling = Number(m.default_selling) || 0;
    items.push({
      productId: m.id, productName: m.name, category, stock, soldQty, dailyRate, daysLeft,
      suggestedQty: suggestedPacks * packSize, suggestedPacks, packSize, urgency,
      defaultPurchase: Number(m.default_purchase) || 0, defaultSelling: selling,
      dailyRevenueLoss: urgency === "urgent" && dailyRate > 0 && selling > 0 ? dailyRate * selling : null,
    });
  });
  return items.sort((a, b) => {
    const od = URGENCY_CONFIG[a.urgency].order - URGENCY_CONFIG[b.urgency].order;
    return od !== 0 ? od : (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   FUNCIÓN: construye items de COMPARACIÓN entre sucursales
───────────────────────────────────────────────────────────────────────────── */
function buildCompareItems(
  masters: any[],
  branches: BranchSalesData[],
  salesDays: number,
): CompareItem[] {
  if (branches.length < 2) return [];
  // ABC por sucursal
  const abcByBranch = branches.map((b) => ({
    branchId: b.branchId,
    classes: assignAbcClasses(b.revenueMap),
  }));

  const items: CompareItem[] = [];
  masters.forEach((m: any) => {
    const byBranch: CompareItem["byBranch"] = {};
    let hasAnySales = false;
    branches.forEach((b) => {
      const soldQty = b.soldMap.get(m.id) ?? 0;
      const revenue = b.revenueMap.get(m.id) ?? 0;
      const stock   = b.stockMap.get(m.id) ?? 0;
      const dailyRate = soldQty / salesDays;
      if (soldQty > 0) hasAnySales = true;
      const abcBranch = abcByBranch.find((x) => x.branchId === b.branchId);
      byBranch[b.branchId] = {
        soldQty, revenue, stock,
        daysLeft: dailyRate > 0 ? stock / dailyRate : null,
        abcClass: soldQty > 0 ? (abcBranch?.classes.get(m.id) ?? "C") : null,
      };
    });
    if (!hasAnySales) return;

    const soldValues = branches.map((b) => byBranch[b.branchId].soldQty);
    const maxSold = Math.max(...soldValues);
    const minSold = Math.min(...soldValues);
    const maxBranchId = branches[soldValues.indexOf(maxSold)].branchId;
    const minBranchId = branches[soldValues.indexOf(minSold)].branchId;
    const spreadPct = minSold > 0 ? ((maxSold - minSold) / minSold) * 100 : 100;

    items.push({
      productId: m.id, productName: m.name, category: extractCategory(m.name),
      byBranch, spreadPct, maxBranchId, minBranchId,
    });
  });

  // Ordenar por spread descendente (los más dispares primero)
  return items.sort((a, b) => b.spreadPct - a.spreadPct);
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────────────────────────────── */
export default function CentroComandoPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { businesses, loading: businessesLoading } = useSelector(
    (s: RootState) => s.businesses
  );

  // Sucursales seleccionadas (múltiples para comparación)
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const primaryBranchId = selectedBranchIds[0] ?? null;
  const selectedBranches = useMemo(
    () => businesses.filter((b) => selectedBranchIds.includes(b.id)),
    [businesses, selectedBranchIds]
  );
  const primaryBranch = selectedBranches[0] ?? null;

  const [activeTab, setActiveTab] = useState<Tab>("reposicion");
  const [loading, setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Período
  const [salesDays, setSalesDays] = useState<PeriodDays>(() => {
    try {
      const v = localStorage.getItem(LS_PERIOD_KEY);
      const n = v ? Number(v) : 30;
      return ([30, 60, 90, 180] as PeriodDays[]).includes(n as PeriodDays) ? (n as PeriodDays) : 30;
    } catch { return 30; }
  });

  // Datos crudos de la sucursal primaria
  const [rawMasters,    setRawMasters]    = useState<any[]>([]);
  const [rawStockMap,   setRawStockMap]   = useState<Map<string, number>>(new Map());
  const [rawSoldMap,    setRawSoldMap]    = useState<Map<string, number>>(new Map());
  const [rawRevenueMap, setRawRevenueMap] = useState<Map<string, number>>(new Map());
  // Segunda mitad (período reciente) para tendencias
  const [rawSoldFirstMap,  setRawSoldFirstMap]  = useState<Map<string, number>>(new Map());
  const [rawSoldSecondMap, setRawSoldSecondMap] = useState<Map<string, number>>(new Map());
  const [rawRevSecondMap,  setRawRevSecondMap]  = useState<Map<string, number>>(new Map());

  // Datos de sucursales para comparación
  const [branchSalesData, setBranchSalesData] = useState<BranchSalesData[]>([]);

  // Parámetros
  const [deliveryDays, setDeliveryDays] = useState(() => {
    try { const v = localStorage.getItem(LS_DELIVERY_KEY); return v ? Number(v) : DEFAULT_DELIVERY_DAYS; } catch { return DEFAULT_DELIVERY_DAYS; }
  });
  const [bufferDays, setBufferDays] = useState(() => {
    try { const v = localStorage.getItem(LS_BUFFER_KEY); return v ? Number(v) : DEFAULT_BUFFER_DAYS; } catch { return DEFAULT_BUFFER_DAYS; }
  });
  const [categoryMultiples, setCategoryMultiples] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(LS_MULTIPLES_KEY);
      return stored ? { ...DEFAULT_CATEGORY_MULTIPLES, ...JSON.parse(stored) } : { ...DEFAULT_CATEGORY_MULTIPLES };
    } catch { return { ...DEFAULT_CATEGORY_MULTIPLES }; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [copyStatus,   setCopyStatus]   = useState<"idle" | "copied" | "error">("idle");

  // Filtros reposición
  const [repoSearch, setRepoSearch]           = useState("");
  const [repoUrgencyFilter, setRepoUrgencyFilter] = useState<"all" | "urgent" | "soon" | "ok">("all");
  const [repoCategoryFilter, setRepoCategoryFilter] = useState<string>("");

  // Filtros ABC
  const [abcClassFilter, setAbcClassFilter]       = useState<AbcClass | "all">("all");
  const [abcCategoryFilter, setAbcCategoryFilter] = useState<string>("");
  const [abcSearch, setAbcSearch]                 = useState("");

  // Filtros Tendencias
  const [trendFilter, setTrendFilter]           = useState<Trend | "all">("all");
  const [trendCategoryFilter, setTrendCategoryFilter] = useState<string>("");
  const [trendSearch, setTrendSearch]           = useState("");
  const [trendAbcFilter, setTrendAbcFilter]     = useState<AbcClass | "all">("all");
  const [showDropAlerts, setShowDropAlerts]     = useState(false);

  // Filtros Comparación
  const [compareSearch, setCompareSearch]         = useState("");
  const [compareCategory, setCompareCategory]     = useState<string>("");
  const [compareMinSpread, setCompareMinSpread]   = useState<number>(30);
  const [compareBranches, setCompareBranches]     = useState<string[]>([]);

  const [editedQtys, setEditedQtys] = useState<Record<string, number>>({});
  const [tooltip, setTooltip]       = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => { dispatch(fetchBusinesses()); }, [dispatch]);
  useEffect(() => { try { localStorage.setItem(LS_DELIVERY_KEY,  String(deliveryDays));  } catch {} }, [deliveryDays]);
  useEffect(() => { try { localStorage.setItem(LS_BUFFER_KEY,    String(bufferDays));    } catch {} }, [bufferDays]);
  useEffect(() => { try { localStorage.setItem(LS_MULTIPLES_KEY, JSON.stringify(categoryMultiples)); } catch {} }, [categoryMultiples]);
  useEffect(() => { try { localStorage.setItem(LS_PERIOD_KEY,    String(salesDays));    } catch {} }, [salesDays]);

  // Cuando cambian sucursales o período, re-fetch
  useEffect(() => {
    if (selectedBranchIds.length === 0) return;
    resetRawData();
    loadAll(selectedBranchIds, salesDays);
  }, [selectedBranchIds, salesDays]);

  function resetRawData() {
    setRawMasters([]); setRawStockMap(new Map()); setRawSoldMap(new Map()); setRawRevenueMap(new Map());
    setRawSoldFirstMap(new Map()); setRawSoldSecondMap(new Map()); setRawRevSecondMap(new Map());
    setBranchSalesData([]);
    setEditedQtys({});
  }

  /* ─── Fetch principal ─── */
  async function loadAll(branchIds: string[], days: number) {
    setLoading(true);
    try {
      const half = Math.floor(days / 2);
      const { start: fullStart, end: fullEnd } = lastNDays(days);
      const { start: secondStart, end: secondEnd } = lastNDays(half);
      const { start: firstStart, end: firstEnd }   = rangeDays(half, half);

      const [masters, ...rest] = await Promise.all([
        // Masters solo una vez
        fetchAll((from, to) =>
          supabase.from("products_master")
            .select("id, name, default_purchase, default_selling")
            .is("deleted_at", null).range(from, to)
        ),
        // Por cada sucursal: inventario + ventas full + ventas segunda mitad + ventas primera mitad
        ...branchIds.flatMap((branchId) => [
          fetchAll((from, to) =>
            supabase.from("business_inventory")
              .select("product_id, stock").eq("business_id", branchId).range(from, to)
          ),
          fetchAll((from, to) =>
            supabase.from("sale_items")
              .select("product_master_id, quantity, total, sales!inner(id)")
              .eq("sales.business_id", branchId)
              .gte("sales.timestamp", fullStart.toISOString())
              .lt("sales.timestamp",  fullEnd.toISOString())
              .not("product_master_id", "is", null).range(from, to)
          ),
          fetchAll((from, to) =>
            supabase.from("sale_items")
              .select("product_master_id, quantity, total, sales!inner(id)")
              .eq("sales.business_id", branchId)
              .gte("sales.timestamp", secondStart.toISOString())
              .lt("sales.timestamp",  secondEnd.toISOString())
              .not("product_master_id", "is", null).range(from, to)
          ),
          fetchAll((from, to) =>
            supabase.from("sale_items")
              .select("product_master_id, quantity, total, sales!inner(id)")
              .eq("sales.business_id", branchId)
              .gte("sales.timestamp", firstStart.toISOString())
              .lt("sales.timestamp",  firstEnd.toISOString())
              .not("product_master_id", "is", null).range(from, to)
          ),
        ]),
      ]);

      setRawMasters(masters);

      const newBranchData: BranchSalesData[] = [];

      branchIds.forEach((branchId, idx) => {
        const base = idx * 4;
        const inventory   = rest[base + 0] as any[];
        const salesFull   = rest[base + 1] as any[];
        const salesSecond = rest[base + 2] as any[];
        const salesFirst  = rest[base + 3] as any[];

        const stockMap    = new Map<string, number>();
        const soldMap     = new Map<string, number>();
        const revenueMap  = new Map<string, number>();
        const soldFirst   = new Map<string, number>();
        const soldSecond  = new Map<string, number>();
        const revSecond   = new Map<string, number>();

        inventory.forEach((r: any) => stockMap.set(r.product_id, Number(r.stock) || 0));

        const accumulateSales = (rows: any[], sm: Map<string, number>, rm: Map<string, number>) => {
          rows.forEach((r: any) => {
            if (!r.product_master_id) return;
            sm.set(r.product_master_id, (sm.get(r.product_master_id) || 0) + (Number(r.quantity) || 1));
            rm.set(r.product_master_id, (rm.get(r.product_master_id) || 0) + (Number(r.total) || 0));
          });
        };
        accumulateSales(salesFull,   soldMap,   revenueMap);
        accumulateSales(salesFirst,  soldFirst,  new Map());
        accumulateSales(salesSecond, soldSecond, revSecond);
        // soldFirst necesita solo qty, no revenue
        salesFirst.forEach((r: any) => {
          if (!r.product_master_id) return;
          soldFirst.set(r.product_master_id, (soldFirst.get(r.product_master_id) || 0) + (Number(r.quantity) || 1));
        });

        if (idx === 0) {
          setRawStockMap(stockMap);
          setRawSoldMap(soldMap);
          setRawRevenueMap(revenueMap);
          setRawSoldFirstMap(soldFirst);
          setRawSoldSecondMap(soldSecond);
          setRawRevSecondMap(revSecond);
        }

        const branch = businesses.find((b) => b.id === branchId);
        newBranchData.push({
          branchId,
          branchName: branch?.name ?? branchId,
          soldMap, revenueMap, stockMap,
        });
      });

      setBranchSalesData(newBranchData);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setLoading(false);
    }
  }

  /* ─── Items calculados ─── */
  const halfPeriod = Math.floor(salesDays / 2);

  const repoItems = useMemo(
    () => buildRepoItems(rawMasters, rawStockMap, rawSoldMap, rawRevenueMap, deliveryDays, bufferDays, categoryMultiples, salesDays),
    [rawMasters, rawStockMap, rawSoldMap, rawRevenueMap, deliveryDays, bufferDays, categoryMultiples, salesDays]
  );

  const abcItems = useMemo(
    () => buildAbcItems(rawMasters, rawStockMap, rawSoldMap, rawRevenueMap, salesDays),
    [rawMasters, rawStockMap, rawSoldMap, rawRevenueMap, salesDays]
  );

  const trendItems = useMemo(
    () => buildTrendItems(rawMasters, rawStockMap, rawSoldFirstMap, rawSoldSecondMap, rawRevSecondMap, halfPeriod),
    [rawMasters, rawStockMap, rawSoldFirstMap, rawSoldSecondMap, rawRevSecondMap, halfPeriod]
  );

  const compareItems = useMemo(
    () => buildCompareItems(rawMasters, branchSalesData, salesDays),
    [rawMasters, branchSalesData, salesDays]
  );

  /* ─── Filtros ─── */
  const filteredRepo = useMemo(() => {
    let list = repoItems;
    if (repoUrgencyFilter !== "all") list = list.filter((i) => i.urgency === repoUrgencyFilter);
    if (repoCategoryFilter)          list = list.filter((i) => i.category === repoCategoryFilter);
    if (repoSearch.trim()) { const q = repoSearch.toLowerCase(); list = list.filter((i) => i.productName.toLowerCase().includes(q)); }
    return list;
  }, [repoItems, repoUrgencyFilter, repoCategoryFilter, repoSearch]);

  const filteredAbc = useMemo(() => {
    let list = abcItems;
    if (abcClassFilter !== "all")    list = list.filter((i) => i.abcClass === abcClassFilter);
    if (abcCategoryFilter)           list = list.filter((i) => i.category === abcCategoryFilter);
    if (abcSearch.trim()) { const q = abcSearch.toLowerCase(); list = list.filter((i) => i.productName.toLowerCase().includes(q)); }
    return list;
  }, [abcItems, abcClassFilter, abcCategoryFilter, abcSearch]);

  const filteredTrends = useMemo(() => {
    let list = trendItems;
    if (showDropAlerts)            list = list.filter((i) => i.classDropAlert);
    if (trendFilter !== "all")     list = list.filter((i) => i.trend === trendFilter);
    if (trendAbcFilter !== "all")  list = list.filter((i) => i.abcClass === trendAbcFilter);
    if (trendCategoryFilter)       list = list.filter((i) => i.category === trendCategoryFilter);
    if (trendSearch.trim()) { const q = trendSearch.toLowerCase(); list = list.filter((i) => i.productName.toLowerCase().includes(q)); }
    // Ordena: rocket/rising primero, dead/sinking al final, class drops marcados primero
    return list.sort((a, b) => {
      const order: Record<Trend, number> = { rocket: 0, rising: 1, stable: 2, falling: 3, sinking: 4, dead: 5 };
      if (a.classDropAlert && !b.classDropAlert) return -1;
      if (!a.classDropAlert && b.classDropAlert) return 1;
      return order[a.trend] - order[b.trend];
    });
  }, [trendItems, trendFilter, trendAbcFilter, trendCategoryFilter, trendSearch, showDropAlerts]);

  const filteredCompare = useMemo(() => {
    let list = compareItems;
    if (compareSearch.trim()) { const q = compareSearch.toLowerCase(); list = list.filter((i) => i.productName.toLowerCase().includes(q)); }
    if (compareCategory)  list = list.filter((i) => i.category === compareCategory);
    list = list.filter((i) => i.spreadPct >= compareMinSpread);
    if (compareBranches.length === 2) {
      // Filtrar solo donde hay diferencia real entre esas dos sucursales
    }
    return list.slice(0, 100); // tope visual
  }, [compareItems, compareSearch, compareCategory, compareMinSpread, compareBranches]);

  /* ─── KPIs reposición ─── */
  const kpis = useMemo(() => {
    const urgentItems = repoItems.filter((i) => i.urgency === "urgent");
    return {
      urgent: urgentItems.length,
      soon:   repoItems.filter((i) => i.urgency === "soon").length,
      totalUnits: repoItems.reduce((a, i) => a + (editedQtys[i.productId] ?? i.suggestedPacks) * i.packSize, 0),
      totalCost:  repoItems.reduce((a, i) => a + (editedQtys[i.productId] ?? i.suggestedPacks) * i.packSize * i.defaultPurchase, 0),
      cats: new Set(repoItems.map((i) => i.category)).size,
      totalDailyLoss: urgentItems.reduce((a, i) => a + (i.dailyRevenueLoss ?? 0), 0),
    };
  }, [repoItems, editedQtys]);

  /* ─── KPIs tendencias ─── */
  const trendKpis = useMemo(() => {
    const rockets  = trendItems.filter((i) => i.trend === "rocket" || i.trend === "rising");
    const dead     = trendItems.filter((i) => i.trend === "dead");
    const sinking  = trendItems.filter((i) => i.trend === "sinking" || i.trend === "falling");
    const dropAlerts = trendItems.filter((i) => i.classDropAlert);
    const capitalMuerto = dead.reduce((a, i) => a + i.capitalInmovilizado, 0);
    const capitalSinking = sinking.reduce((a, i) => a + i.capitalInmovilizado, 0);
    return { rockets: rockets.length, dead: dead.length, sinking: sinking.length, dropAlerts: dropAlerts.length, capitalMuerto, capitalSinking };
  }, [trendItems]);

  /* ─── Categorías presentes ─── */
  const catsRepo  = useMemo(() => { const s = new Set(repoItems.map(i => i.category)); return CATEGORIES.filter(c => s.has(c)); }, [repoItems]);
  const catsAbc   = useMemo(() => { const s = new Set(abcItems.map(i => i.category)); return CATEGORIES.filter(c => s.has(c)); }, [abcItems]);
  const catsTrend = useMemo(() => { const s = new Set(trendItems.map(i => i.category)); return CATEGORIES.filter(c => s.has(c)); }, [trendItems]);
  const catsCompare = useMemo(() => { const s = new Set(compareItems.map(i => i.category)); return CATEGORIES.filter(c => s.has(c)); }, [compareItems]);

  /* ─── ABC KPIs ─── */
  const abcKpis = useMemo(() => {
    const totalRevenue = abcItems.reduce((a, i) => a + i.revenue, 0);
    const byClass = { A: { count: 0, revenue: 0 }, B: { count: 0, revenue: 0 }, C: { count: 0, revenue: 0 } };
    abcItems.forEach((i) => { byClass[i.abcClass].count++; byClass[i.abcClass].revenue += i.revenue; });
    const totalNetProfit  = abcItems.reduce((a, i) => a + (i.netProfit ?? 0), 0);
    const classANetProfit = abcItems.filter(i => i.abcClass === "A").reduce((a, i) => a + (i.netProfit ?? 0), 0);
    const atRiskDailyLoss = abcItems.filter(i => i.abcClass === "A" && (i.daysLeft === null || i.daysLeft < 3)).reduce((a, i) => a + (i.dailyRevenueLoss ?? 0), 0);
    const totalCapital    = abcItems.reduce((a, i) => a + i.capitalInmovilizado, 0);
    return { totalRevenue, byClass, totalNetProfit, classANetProfit, atRiskDailyLoss, totalCapital };
  }, [abcItems]);

  /* ─── Copiar pedido ─── */
  function buildCopyText(items: RepoItem[], edited: Record<string, number>, branchName: string): string {
    const lines = [`Pedido — ${branchName}`, new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }), ""];
    const byCategory = new Map<string, RepoItem[]>();
    items.forEach((i) => { if (!byCategory.has(i.category)) byCategory.set(i.category, []); byCategory.get(i.category)!.push(i); });
    byCategory.forEach((catItems, cat) => {
      lines.push(cat);
      catItems.forEach((i) => {
        const packs = edited[i.productId] ?? i.suggestedPacks;
        lines.push(i.packSize > 1 ? `  ${i.productName}: ${packs} pack` : `  ${i.productName}: ${packs * i.packSize} unidades`);
      });
      lines.push("");
    });
    return lines.join("\n").trimEnd();
  }
  async function handleCopy() {
    if (!primaryBranch) return;
    const urgentItems = filteredRepo.filter((i) => i.urgency === "urgent");
    if (urgentItems.length === 0) return;
    try {
      await navigator.clipboard.writeText(buildCopyText(urgentItems, editedQtys, primaryBranch.name));
      setCopyStatus("copied"); setTimeout(() => setCopyStatus("idle"), 2500);
    } catch { setCopyStatus("error"); setTimeout(() => setCopyStatus("idle"), 2500); }
  }

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, RepoItem[]>();
    filteredRepo.forEach((item) => { if (!map.has(item.category)) map.set(item.category, []); map.get(item.category)!.push(item); });
    map.forEach((items) => items.sort((a, b) => URGENCY_CONFIG[a.urgency].order - URGENCY_CONFIG[b.urgency].order));
    return Array.from(map.entries()).sort(([, a], [, b]) => b.filter(i => i.urgency === "urgent").length - a.filter(i => i.urgency === "urgent").length);
  }, [filteredRepo]);

  const hasData = rawMasters.length > 0;
  const isBusy  = loading || businessesLoading;
  const isMultiBranch = selectedBranchIds.length > 1;

  /* ─────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── Modal selección de sucursales ── */}
      {selectedBranchIds.length === 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 font-bold text-lg">⌘</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Centro de comando</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Seleccioná una o más sucursales</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-[52px]">Seleccioná más de una para habilitar la comparación entre sucursales.</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto mb-4">
              {businessesLoading && <div className="text-center py-8 text-slate-400">Cargando…</div>}
              {!businessesLoading && businesses.map((b) => {
                const selected = selectedBranchIds.includes(b.id);
                return (
                  <button key={b.id}
                    onClick={() => setSelectedBranchIds((prev) => selected ? prev.filter(id => id !== b.id) : [...prev, b.id])}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all group ${selected ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-400" : "border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-semibold ${selected ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100"}`}>{b.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">ID: {b.id}</div>
                      </div>
                      {selected && <span className="text-indigo-500 text-lg">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedBranchIds.length > 0 && (
              <button
                onClick={() => { /* trigger load via useEffect */ setSelectedBranchIds([...selectedBranchIds]); }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors">
                Continuar con {selectedBranchIds.length} sucursal{selectedBranchIds.length > 1 ? "es" : ""} →
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 font-bold">⌘</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Centro de comando</h1>
              {selectedBranches.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedBranches.map(b => b.name).join(" · ")}
                  {lastUpdated && <> · actualizado {lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector período */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
              {PERIOD_OPTIONS.map(({ value, shortLabel, label }) => (
                <button key={value} onClick={() => { if (salesDays !== value) setSalesDays(value as PeriodDays); }}
                  title={`Analizar los últimos ${label}`}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${salesDays === value ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                  {shortLabel}
                </button>
              ))}
            </div>
            <button onClick={() => { setSelectedBranchIds([]); resetRawData(); }}
              className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors">
              ← Sucursales
            </button>
            <button onClick={() => selectedBranchIds.length > 0 && loadAll(selectedBranchIds, salesDays)}
              disabled={isBusy || selectedBranchIds.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : "↻"}
              Actualizar
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "reposicion",  icon: "📦", label: "Reposición" },
            { key: "abc",         icon: "🏆", label: "Análisis ABC" },
            { key: "tendencias",  icon: "📊", label: "Tendencias" },
            { key: "comparacion", icon: "🔀", label: "Comparar sucursales", disabled: !isMultiBranch, disabledTip: "Seleccioná 2+ sucursales" },
          ] as { key: Tab; icon: string; label: string; disabled?: boolean; disabledTip?: string }[]).map(({ key, icon, label, disabled, disabledTip }) => (
            <button key={key} onClick={() => !disabled && setActiveTab(key)} disabled={!!disabled}
              title={disabled ? disabledTip : undefined}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                activeTab === key ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm"
                : disabled ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-white dark:hover:bg-slate-800"
              }`}>
              <span style={{ fontSize: 14 }}>{icon}</span>{label}
              {disabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400">2+ sucursales</span>}
            </button>
          ))}
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Analizando {salesDays} días de datos…</p>
            <p className="text-xs text-slate-400">Comparando períodos para detectar tendencias</p>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: ORDEN DE REPOSICIÓN
        ════════════════════════════════════════════ */}
        {!loading && activeTab === "reposicion" && primaryBranchId && (
          <div className="space-y-4">
            {/* Parámetros */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <button onClick={() => setShowSettings((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                  <span>⚙</span> Parámetros de cálculo
                  <span className="text-xs font-normal text-slate-400 hidden sm:inline">· entrega {deliveryDays}d · buffer {bufferDays}d · base {salesDays}d</span>
                </div>
                <span className="text-slate-400 text-xs">{showSettings ? "▲ cerrar" : "▼ ajustar"}</span>
              </button>
              {showSettings && (
                <div className="px-5 pb-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Días de entrega del proveedor</label>
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{deliveryDays}d</span>
                      </div>
                      <input type="range" min={1} max={30} step={1} value={deliveryDays} onChange={(e) => setDeliveryDays(Number(e.target.value))} className="w-full accent-indigo-600" />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>1d</span><span>30d</span></div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Buffer de seguridad</label>
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{bufferDays}d</span>
                      </div>
                      <input type="range" min={0} max={14} step={1} value={bufferDays} onChange={(e) => setBufferDays(Number(e.target.value))} className="w-full accent-indigo-600" />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0d</span><span>14d</span></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">Pedido mínimo por categoría</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {CATEGORIES.filter((c) => c !== "PROMO" && c !== "SIN CATEGORIA").map((cat) => (
                        <div key={cat} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-700">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{cat}</span>
                          <input type="number" min={1} max={48} value={categoryMultiples[cat] ?? 1}
                            onChange={(e) => setCategoryMultiples((prev) => ({ ...prev, [cat]: Math.max(1, Number(e.target.value) || 1) }))}
                            className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg py-0.5 text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* KPIs */}
            {hasData && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Urgentes ahora",    value: kpis.urgent,                                         sub: "no llega a tiempo",   color: kpis.urgent > 0 ? "text-red-600 dark:text-red-400" : "text-slate-300" },
                  { label: "Pedir pronto",       value: kpis.soon,                                           sub: "próximos días",        color: kpis.soon > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-300" },
                  { label: "Categorías",         value: kpis.cats,                                           sub: "con pedidos",          color: "text-slate-900 dark:text-white" },
                  { label: "Unidades a pedir",   value: fmtN(kpis.totalUnits),                              sub: "total",                color: "text-slate-900 dark:text-white" },
                  { label: "Inversión estimada", value: fmtARS(kpis.totalCost),                             sub: "a precio de compra",   color: "text-slate-900 dark:text-white", small: true },
                  { label: "Pérdida diaria",     value: kpis.totalDailyLoss > 0 ? fmtARS(kpis.totalDailyLoss) : "—", sub: "urgentes sin stock", color: kpis.totalDailyLoss > 0 ? "text-red-600 dark:text-red-400" : "text-slate-300", small: true },
                ].map(({ label, value, sub, color, small }) => (
                  <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">{label}</div>
                    <div className={`font-bold tabular-nums ${small ? "text-xl" : "text-2xl"} ${color}`}>{value}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Filtros */}
            {hasData && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" placeholder="Buscar producto…" value={repoSearch} onChange={(e) => setRepoSearch(e.target.value)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <select value={repoUrgencyFilter} onChange={(e) => setRepoUrgencyFilter(e.target.value as any)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Toda urgencia</option><option value="urgent">🔴 Urgente</option><option value="soon">🟡 Pronto</option><option value="ok">🔵 Planificado</option>
                </select>
                <select value={repoCategoryFilter} onChange={(e) => setRepoCategoryFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Todas las categorías</option>{catsRepo.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {(repoSearch || repoUrgencyFilter !== "all" || repoCategoryFilter) && (
                  <button onClick={() => { setRepoSearch(""); setRepoUrgencyFilter("all"); setRepoCategoryFilter(""); }}
                    className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
                )}
                <button onClick={handleCopy} disabled={filteredRepo.filter(i => i.urgency === "urgent").length === 0 || copyStatus === "copied"}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${copyStatus === "copied" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : copyStatus === "error" ? "bg-red-50 border-red-300 text-red-600" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300"} disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {copyStatus === "copied" ? "✓ Copiado" : copyStatus === "error" ? "✗ Error" : `⧉ Copiar urgentes (${filteredRepo.filter(i => i.urgency === "urgent").length})`}
                </button>
              </div>
            )}

            {/* Empty states */}
            {!hasData && !loading && (
              <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 gap-2">
                <p className="text-sm text-slate-400">Presioná Actualizar para cargar los datos</p>
              </div>
            )}

            {/* Tablas agrupadas */}
            {filteredRepo.length > 0 && (
              <div className="space-y-4">
                {groupedByCategory.map(([category, items]) => {
                  const groupUnits = items.reduce((a, i) => a + (editedQtys[i.productId] ?? i.suggestedPacks) * i.packSize, 0);
                  const groupCost  = items.reduce((a, i) => a + (editedQtys[i.productId] ?? i.suggestedPacks) * i.packSize * i.defaultPurchase, 0);
                  const hasUrgent  = items.some(i => i.urgency === "urgent");
                  return (
                    <div key={category} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                      <div className={`px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 ${hasUrgent ? "bg-red-50 dark:bg-red-950/20" : "bg-slate-50 dark:bg-slate-800/40"}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full ${hasUrgent ? "bg-red-500" : "bg-amber-400"}`} />
                          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{category}</span>
                          <span className="text-xs text-slate-400">{items.length} productos</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-400 tabular-nums hidden sm:inline">{fmtN(groupUnits)} unid.</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{fmtARS(groupCost)}</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                              <th className="px-5 py-2.5 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Producto</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Stock</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Vend. {salesDays}d</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Días rest.</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Urgencia</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Pérdida/día</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">A pedir</th>
                              <th className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Costo est.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                            {items.map((item) => {
                              const cfg = URGENCY_CONFIG[item.urgency];
                              const displayPacks = editedQtys[item.productId] ?? item.suggestedPacks;
                              const displayUnits = displayPacks * item.packSize;
                              const isEdited = editedQtys[item.productId] !== undefined;
                              return (
                                <tr key={item.productId} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30 ${cfg.rowBg}`}>
                                  <td className="px-5 py-3 max-w-[200px]">
                                    <span className="font-medium text-slate-800 dark:text-slate-100 truncate block cursor-default"
                                      onMouseEnter={(e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); setTooltip({ text: item.productName, x: r.left, y: r.bottom + 6 }); }}
                                      onMouseLeave={() => setTooltip(null)}>{item.productName}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`font-bold tabular-nums text-sm ${item.stock === 0 ? "text-red-600 dark:text-red-400" : item.stock < 5 ? "text-orange-500" : "text-slate-700 dark:text-slate-200"}`}>{fmtN(item.stock)}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center tabular-nums text-slate-500 dark:text-slate-400 text-sm">{fmtN(item.soldQty)}</td>
                                  <td className="px-4 py-3 text-center">
                                    {item.daysLeft === null ? <span className="text-xs text-red-500 font-semibold">Sin stock</span>
                                      : <span className={`font-bold tabular-nums text-sm ${item.daysLeft < 1 ? "text-red-600" : item.daysLeft < deliveryDays ? "text-orange-500" : item.daysLeft < deliveryDays + 3 ? "text-amber-600" : "text-slate-600 dark:text-slate-300"}`}>
                                          {item.daysLeft < 1 ? "< 1" : `~${Math.floor(item.daysLeft)}`}d
                                        </span>}
                                  </td>
                                  <td className="px-4 py-3 text-center whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.badge}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {item.dailyRevenueLoss ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 tabular-nums">{fmtARS(item.dailyRevenueLoss)}</span>
                                    ) : <span className="text-slate-300 text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => setEditedQtys((p) => ({ ...p, [item.productId]: Math.max(0, (p[item.productId] ?? item.suggestedPacks) - 1) }))}
                                          className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-base">−</button>
                                        <input type="number" min={0} value={displayPacks}
                                          onChange={(e) => setEditedQtys((p) => ({ ...p, [item.productId]: Math.max(0, Number(e.target.value) || 0) }))}
                                          className="w-14 text-center border border-indigo-300 dark:border-indigo-700 rounded-lg py-0.5 text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                        <button onClick={() => setEditedQtys((p) => ({ ...p, [item.productId]: (p[item.productId] ?? item.suggestedPacks) + 1 }))}
                                          className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-base">+</button>
                                        {isEdited && <button onClick={() => setEditedQtys((p) => { const n = { ...p }; delete n[item.productId]; return n; })} className="text-xs text-slate-400 hover:text-slate-600 ml-0.5" title="Restaurar">↺</button>}
                                      </div>
                                      <div className="text-[10px] text-center text-slate-400 leading-tight">
                                        {item.packSize > 1 ? <span className="text-indigo-500 font-medium">{displayPacks} pack×{item.packSize} = {displayUnits} ud</span> : <span>{displayUnits} unidades</span>}
                                        {isEdited && <span className="block">sugerido: {item.suggestedPacks}</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200 text-sm">
                                    {displayUnits * item.defaultPurchase > 0 ? fmtARS(displayUnits * item.defaultPurchase) : <span className="text-slate-300">—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                            <tr>
                              <td colSpan={6} className="px-5 py-2.5 text-xs text-slate-400 font-medium">Subtotal {category}</td>
                              <td className="px-4 py-2.5 text-center text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">{fmtN(groupUnits)} ud.</td>
                              <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900 dark:text-white tabular-nums">{fmtARS(groupCost)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">Total del pedido</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{kpis.cats} categorías · {fmtN(kpis.totalUnits)} unidades · cobertura {deliveryDays + bufferDays} días</div>
                    {kpis.totalDailyLoss > 0 && <div className="text-xs text-red-500 mt-1 font-medium">⚠ Sin reposición perdés {fmtARS(kpis.totalDailyLoss)}/día</div>}
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{fmtARS(kpis.totalCost)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: ANÁLISIS ABC
        ════════════════════════════════════════════ */}
        {!loading && activeTab === "abc" && primaryBranchId && (
          <div className="space-y-4">
            {abcItems.length > 0 && (
              <>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Distribución de facturación — últimos {salesDays} días</div>
                  <div className="flex rounded-xl overflow-hidden h-5 mb-3 gap-0.5">
                    {(["A","B","C"] as AbcClass[]).map((cls) => {
                      const pct = abcKpis.totalRevenue > 0 ? (abcKpis.byClass[cls].revenue / abcKpis.totalRevenue) * 100 : 0;
                      return <div key={cls} className={`${ABC_CONFIG[cls].bar} transition-all`} style={{ width: `${pct}%`, minWidth: pct > 0 ? 2 : 0 }} title={`Clase ${cls}: ${pct.toFixed(1)}%`} />;
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(["A","B","C"] as AbcClass[]).map((cls) => {
                      const pct = abcKpis.totalRevenue > 0 ? (abcKpis.byClass[cls].revenue / abcKpis.totalRevenue) * 100 : 0;
                      const cfg = ABC_CONFIG[cls];
                      return (
                        <button key={cls} onClick={() => setAbcClassFilter(abcClassFilter === cls ? "all" : cls)}
                          className={`rounded-xl p-3 text-left border transition-all ${abcClassFilter === cls ? `${cfg.headerBg} border-slate-300 ring-2 ring-offset-1 ring-indigo-400` : `${cfg.headerBg} border-slate-200 dark:border-slate-700 hover:ring-1 hover:ring-indigo-300`}`}>
                          <div className="flex items-center gap-1.5 mb-1"><span className={`w-2 h-2 rounded-full ${cfg.dot}`} /><span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{cfg.label}</span></div>
                          <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{abcKpis.byClass[cls].count}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">{fmtARS(abcKpis.byClass[cls].revenue)} · {pct.toFixed(1)}%</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{cfg.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Facturación total",  value: fmtARS(abcKpis.totalRevenue),   sub: `últimos ${salesDays} días`, color: "text-slate-900 dark:text-white" },
                    { label: "Ganancia neta",       value: fmtARS(abcKpis.totalNetProfit), sub: "con costo cargado",         color: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Riesgo clase A",      value: abcKpis.atRiskDailyLoss > 0 ? fmtARS(abcKpis.atRiskDailyLoss) : "—", sub: "pérdida/día A con <3d", color: abcKpis.atRiskDailyLoss > 0 ? "text-red-600 dark:text-red-400" : "text-slate-300" },
                    { label: "Capital en stock",    value: fmtARS(abcKpis.totalCapital),   sub: "pesos inmovilizados",       color: "text-amber-600 dark:text-amber-400" },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">{label}</div>
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" placeholder="Buscar producto…" value={abcSearch} onChange={(e) => setAbcSearch(e.target.value)}
                className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <select value={abcClassFilter} onChange={(e) => setAbcClassFilter(e.target.value as any)}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="all">Todas las clases</option><option value="A">Clase A — top 80%</option><option value="B">Clase B — sig. 15%</option><option value="C">Clase C — resto 5%</option>
              </select>
              <select value={abcCategoryFilter} onChange={(e) => setAbcCategoryFilter(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">Todas las categorías</option>{catsAbc.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {(abcSearch || abcClassFilter !== "all" || abcCategoryFilter) && (
                <button onClick={() => { setAbcSearch(""); setAbcClassFilter("all"); setAbcCategoryFilter(""); }}
                  className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100">✕</button>
              )}
            </div>
            {!hasData && !loading && <div className="flex items-center justify-center h-48 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><p className="text-sm text-slate-400">Presioná Actualizar para cargar los datos</p></div>}
            {filteredAbc.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[65vh]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold w-8">#</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Clase</th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Producto</th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Cat.</th>
                        <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Facturación</th>
                        <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">% acum.</th>
                        <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Ganancia</th>
                        <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Margen</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Stock</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Unid./día</th>
                        <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Capital inmov.</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Días stock</th>
                        <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Pérdida/día</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAbc.map((item, idx) => {
                        const cfg = ABC_CONFIG[item.abcClass];
                        const prevClass = idx > 0 ? filteredAbc[idx - 1].abcClass : null;
                        const isAtRisk = item.daysLeft !== null && item.daysLeft < 3;
                        const isOut    = item.stock === 0;
                        return (
                          <tr key={item.productId} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30 ${prevClass && prevClass !== item.abcClass ? "border-t-2 border-slate-300 dark:border-slate-600" : ""}`}>
                            <td className="px-4 py-2.5 text-xs text-slate-400 tabular-nums text-center">{idx + 1}</td>
                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}</span>
                            </td>
                            <td className="px-4 py-2.5 max-w-[180px]">
                              <span className="font-medium text-slate-800 dark:text-slate-100 truncate block cursor-default"
                                onMouseEnter={(e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); setTooltip({ text: item.productName, x: r.left, y: r.bottom + 6 }); }}
                                onMouseLeave={() => setTooltip(null)}>{item.productName}</span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap"><span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{item.category}</span></td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="font-bold tabular-nums text-slate-900 dark:text-white text-sm">{fmtARS(item.revenue)}</div>
                              <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                                <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${Math.min(100, (item.revenue / (abcItems[0]?.revenue || 1)) * 100)}%` }} />
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-500">{(item.cumulativePct * 100).toFixed(1)}%</td>
                            <td className="px-4 py-2.5 text-right">
                              {item.netProfit === null ? <span className="text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">sin costo</span>
                                : <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 text-sm">{fmtARS(item.netProfit)}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {item.marginPct === null ? <span className="text-slate-300">—</span>
                                : <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${item.marginPct >= 40 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : item.marginPct >= 20 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>{item.marginPct.toFixed(1)}%</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`font-bold tabular-nums text-sm ${isOut ? "text-red-600 dark:text-red-400" : item.stock < 5 ? "text-orange-500" : "text-slate-700 dark:text-slate-200"}`}>{fmtN(item.stock)}</span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {(() => {
                                const dailyRate = item.soldQty / item.salesDays;
                                if (dailyRate === 0) return <span className="text-slate-300 text-xs">—</span>;
                                const display = dailyRate >= 1
                                  ? <span className="font-bold tabular-nums text-sm text-slate-700 dark:text-slate-200">{dailyRate.toFixed(1)}</span>
                                  : <span className="font-bold tabular-nums text-sm text-slate-500 dark:text-slate-400">{dailyRate.toFixed(2)}</span>;
                                return (
                                  <div className="flex flex-col items-center gap-0.5">
                                    {display}
                                    <span className="text-[10px] text-slate-400">ud/día</span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {item.capitalInmovilizado > 0
                                ? <span className={`tabular-nums text-sm font-semibold ${item.capitalInmovilizado > 50000 ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>{fmtARS(item.capitalInmovilizado)}</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {item.daysLeft === null || isOut ? <span className="text-xs text-red-500 font-semibold">{isOut ? "0d" : "Sin stock"}</span>
                                : <span className={`font-bold tabular-nums text-sm ${item.daysLeft < 3 ? "text-red-600" : item.daysLeft < 7 ? "text-amber-600" : "text-slate-600 dark:text-slate-300"}`}>~{Math.floor(item.daysLeft)}d</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {(isOut || isAtRisk) && item.dailyRevenueLoss ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${isOut ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>{fmtARS(item.dailyRevenueLoss)}</span>
                              ) : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Mostrando <b>{filteredAbc.length}</b> de <b>{abcItems.length}</b> productos · últimos <b>{salesDays} días</b></span>
                  {(abcSearch || abcClassFilter !== "all" || abcCategoryFilter) && (
                    <button onClick={() => { setAbcSearch(""); setAbcClassFilter("all"); setAbcCategoryFilter(""); }} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Ver todos →</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: TENDENCIAS
        ════════════════════════════════════════════ */}
        {!loading && activeTab === "tendencias" && primaryBranchId && (
          <div className="space-y-4">
            {/* Explicación del período */}
            {hasData && (
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 px-4 py-3 text-xs text-indigo-600 dark:text-indigo-400">
                Comparando <b>primeros {halfPeriod} días</b> vs <b>últimos {halfPeriod} días</b> del período seleccionado ({salesDays}d).
                Una flecha 🚀 significa que el producto vendió significativamente más en la segunda mitad que en la primera.
              </div>
            )}

            {/* KPIs tendencias */}
            {trendItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Volando o creciendo", value: trendKpis.rockets,                                                sub: "asegurate de tener stock",      color: "text-emerald-600 dark:text-emerald-400" },
                  { label: "En caída",             value: trendKpis.sinking,                                               sub: "revisá precio o exposición",    color: trendKpis.sinking > 0 ? "text-red-600 dark:text-red-400" : "text-slate-300" },
                  { label: "Sin ventas recientes", value: trendKpis.dead,                                                  sub: "stock parado",                  color: trendKpis.dead > 0 ? "text-slate-500" : "text-slate-300" },
                  { label: "Capital en productos muertos", value: (trendKpis.capitalMuerto + trendKpis.capitalSinking) > 0 ? fmtARS(trendKpis.capitalMuerto + trendKpis.capitalSinking) : "—", sub: "en stock que no rota o cae", color: "text-amber-600 dark:text-amber-400", small: true },
                ].map(({ label, value, sub, color, small }) => (
                  <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">{label}</div>
                    <div className={`font-bold tabular-nums ${small ? "text-xl" : "text-2xl"} ${color}`}>{value}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Alertas de caída de clase */}
            {trendKpis.dropAlerts > 0 && (
              <button onClick={() => setShowDropAlerts((v) => !v)}
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl border text-sm font-medium transition-all ${showDropAlerts ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300" : "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100"}`}>
                <span className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span><b>{trendKpis.dropAlerts} productos</b> bajaron de clase ABC respecto al período anterior</span>
                </span>
                <span className="text-xs opacity-70">{showDropAlerts ? "✕ Ocultar" : "Ver cuáles →"}</span>
              </button>
            )}

            {/* Filtros */}
            {trendItems.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                <input type="text" placeholder="Buscar producto…" value={trendSearch} onChange={(e) => setTrendSearch(e.target.value)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <select value={trendFilter} onChange={(e) => setTrendFilter(e.target.value as any)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Toda tendencia</option>
                  <option value="rocket">🚀 Volando (+30%)</option>
                  <option value="rising">📈 Creciendo (+10%)</option>
                  <option value="stable">➡️ Estable</option>
                  <option value="falling">📉 Bajando (-10%)</option>
                  <option value="sinking">⚠️ Cayendo fuerte</option>
                  <option value="dead">💀 Sin ventas</option>
                </select>
                <select value={trendAbcFilter} onChange={(e) => setTrendAbcFilter(e.target.value as any)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Todas las clases</option><option value="A">Clase A</option><option value="B">Clase B</option><option value="C">Clase C</option>
                </select>
                <select value={trendCategoryFilter} onChange={(e) => setTrendCategoryFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Todas las categorías</option>{catsTrend.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {(trendSearch || trendFilter !== "all" || trendAbcFilter !== "all" || trendCategoryFilter || showDropAlerts) && (
                  <button onClick={() => { setTrendSearch(""); setTrendFilter("all"); setTrendAbcFilter("all"); setTrendCategoryFilter(""); setShowDropAlerts(false); }}
                    className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100">✕ Limpiar</button>
                )}
              </div>
            )}

            {!hasData && !loading && <div className="flex items-center justify-center h-48 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><p className="text-sm text-slate-400">Presioná Actualizar para cargar los datos</p></div>}

            {/* Tabla de tendencias */}
            {filteredTrends.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[65vh]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Producto</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">ABC</th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Cat.</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Tendencia</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Vend. 1ª mitad</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Vend. 2ª mitad</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Cambio</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Stock</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Días stock</th>
                        <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Capital inmov.</th>
                        <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Pérdida/día</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTrends.map((item) => {
                        const tCfg   = TREND_CONFIG[item.trend];
                        const abcCfg = ABC_CONFIG[item.abcClass];
                        const isOut  = item.stock === 0;
                        const isAtRisk = item.daysLeft !== null && item.daysLeft < 3;
                        return (
                          <tr key={item.productId} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30 ${item.classDropAlert ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                            <td className="px-4 py-2.5 max-w-[180px]">
                              <div className="flex items-center gap-1.5">
                                {item.classDropAlert && (
                                  <span title={`Era clase ${item.prevAbcClass} y bajó a ${item.abcClass}`} className="text-amber-500 shrink-0">⚠️</span>
                                )}
                                <span className="font-medium text-slate-800 dark:text-slate-100 truncate cursor-default"
                                  onMouseEnter={(e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); setTooltip({ text: `${item.productName}${item.classDropAlert ? ` — bajó de clase ${item.prevAbcClass} a ${item.abcClass}` : ""}`, x: r.left, y: r.bottom + 6 }); }}
                                  onMouseLeave={() => setTooltip(null)}>{item.productName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${abcCfg.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${abcCfg.dot}`} />{item.abcClass}</span>
                            </td>
                            <td className="px-4 py-2.5"><span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{item.category}</span></td>
                            <td className="px-4 py-2.5 text-center">
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${tCfg.badge}`}>
                                <span>{tCfg.icon}</span>{tCfg.label}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 max-w-[140px] mx-auto leading-tight">{tCfg.description}</div>
                            </td>
                            <td className="px-4 py-2.5 text-center tabular-nums text-slate-500 dark:text-slate-400 text-sm">{fmtN(item.soldFirst)}</td>
                            <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-slate-700 dark:text-slate-200 text-sm">{fmtN(item.soldSecond)}</td>
                            <td className="px-4 py-2.5 text-center">
                              {item.changePct === null ? (
                                <span className="text-xs text-emerald-600 font-bold">Nuevo ↑</span>
                              ) : (
                                <span className={`font-bold tabular-nums text-sm ${item.changePct >= 10 ? "text-emerald-600 dark:text-emerald-400" : item.changePct >= -10 ? "text-slate-500" : "text-red-600 dark:text-red-400"}`}>
                                  {fmtPct(item.changePct)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`font-bold tabular-nums text-sm ${isOut ? "text-red-600 dark:text-red-400" : item.stock < 5 ? "text-orange-500" : "text-slate-700 dark:text-slate-200"}`}>{fmtN(item.stock)}</span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {item.daysLeft === null || isOut ? <span className="text-xs text-red-500 font-semibold">{isOut ? "0d" : "Sin stock"}</span>
                                : <span className={`font-bold tabular-nums text-sm ${item.daysLeft < 3 ? "text-red-600" : item.daysLeft < 7 ? "text-amber-600" : "text-slate-600 dark:text-slate-300"}`}>~{Math.floor(item.daysLeft)}d</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {item.capitalInmovilizado > 0
                                ? <span className={`tabular-nums text-sm font-semibold ${(item.trend === "dead" || item.trend === "sinking") ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>{fmtARS(item.capitalInmovilizado)}</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {(isOut || isAtRisk) && item.dailyRevenueLoss ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{fmtARS(item.dailyRevenueLoss)}</span>
                              ) : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Mostrando <b>{filteredTrends.length}</b> de <b>{trendItems.length}</b> productos</span>
                </div>
              </div>
            )}

            {/* Dos listas rápidas */}
            {!showDropAlerts && trendFilter === "all" && trendAbcFilter === "all" && !trendSearch && !trendCategoryFilter && trendItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Maximizá stock */}
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span>🚀</span>
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">Maximizá stock — están volando</span>
                  </div>
                  <div className="space-y-2">
                    {trendItems.filter(i => (i.trend === "rocket" || i.trend === "rising") && i.abcClass === "A").slice(0, 8).map((item) => (
                      <div key={item.productId} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-700 dark:text-slate-200 truncate flex-1">{item.productName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-emerald-600">{item.changePct !== null ? fmtPct(item.changePct) : "Nuevo"}</span>
                          {item.daysLeft !== null && item.daysLeft < 7 && (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">~{Math.floor(item.daysLeft)}d</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {trendItems.filter(i => (i.trend === "rocket" || i.trend === "rising") && i.abcClass === "A").length === 0 && (
                      <p className="text-xs text-slate-400">Sin productos clase A acelerando en este período</p>
                    )}
                  </div>
                </div>

                {/* Revisá estos */}
                <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span>💀</span>
                    <span className="font-semibold text-red-800 dark:text-red-300 text-sm">Revisá estos — muertos o cayendo</span>
                  </div>
                  <div className="space-y-2">
                    {trendItems.filter(i => (i.trend === "dead" || i.trend === "sinking") && i.capitalInmovilizado > 0)
                      .sort((a, b) => b.capitalInmovilizado - a.capitalInmovilizado).slice(0, 8).map((item) => (
                      <div key={item.productId} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-700 dark:text-slate-200 truncate flex-1">{item.productName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400">{TREND_CONFIG[item.trend].icon}</span>
                          <span className="text-xs font-bold text-amber-600">{fmtARS(item.capitalInmovilizado)}</span>
                        </div>
                      </div>
                    ))}
                    {trendItems.filter(i => (i.trend === "dead" || i.trend === "sinking") && i.capitalInmovilizado > 0).length === 0 && (
                      <p className="text-xs text-slate-400">Sin productos muertos con stock</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: COMPARACIÓN ENTRE SUCURSALES
        ════════════════════════════════════════════ */}
        {!loading && activeTab === "comparacion" && isMultiBranch && (
          <div className="space-y-4">
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 px-4 py-3 text-xs text-indigo-600 dark:text-indigo-400">
              Comparando <b>{selectedBranches.map(b => b.name).join(" vs ")}</b> — últimos {salesDays} días.
              Arriba aparecen los productos con mayor diferencia de ventas entre sucursales.
              Podés ver qué vuela en una y está muerto en otra.
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <input type="text" placeholder="Buscar producto…" value={compareSearch} onChange={(e) => setCompareSearch(e.target.value)}
                className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <select value={compareCategory} onChange={(e) => setCompareCategory(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">Todas las categorías</option>{catsCompare.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900">
                <span className="text-xs text-slate-400 whitespace-nowrap">Diferencia mínima</span>
                <input type="range" min={0} max={200} step={10} value={compareMinSpread} onChange={(e) => setCompareMinSpread(Number(e.target.value))} className="w-24 accent-indigo-600" />
                <span className="text-xs font-bold text-indigo-600 tabular-nums w-10">{compareMinSpread}%</span>
              </div>
              {(compareSearch || compareCategory) && (
                <button onClick={() => { setCompareSearch(""); setCompareCategory(""); }} className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100">✕</button>
              )}
            </div>

            {!hasData && !loading && <div className="flex items-center justify-center h-48 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><p className="text-sm text-slate-400">Presioná Actualizar para cargar los datos</p></div>}

            {filteredCompare.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Producto</th>
                        <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Cat.</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Diferencia</th>
                        {selectedBranches.map((b) => (
                          <th key={b.id} className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{b.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCompare.map((item) => (
                        <tr key={item.productId} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 max-w-[180px]">
                            <span className="font-medium text-slate-800 dark:text-slate-100 truncate block cursor-default"
                              onMouseEnter={(e) => { const r = (e.target as HTMLElement).getBoundingClientRect(); setTooltip({ text: item.productName, x: r.left, y: r.bottom + 6 }); }}
                              onMouseLeave={() => setTooltip(null)}>{item.productName}</span>
                          </td>
                          <td className="px-4 py-2.5"><span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{item.category}</span></td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold tabular-nums ${item.spreadPct >= 100 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : item.spreadPct >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
                              {fmtPct(item.spreadPct)} dif.
                            </span>
                          </td>
                          {selectedBranches.map((b) => {
                            const data = item.byBranch[b.id];
                            const isMax = b.id === item.maxBranchId;
                            const isMin = b.id === item.minBranchId;
                            return (
                              <td key={b.id} className="px-4 py-2.5 text-right">
                                <div className={`font-bold tabular-nums text-sm ${isMax ? "text-emerald-600 dark:text-emerald-400" : isMin && data?.soldQty === 0 ? "text-slate-300" : "text-slate-600 dark:text-slate-300"}`}>
                                  {fmtN(data?.soldQty ?? 0)} ud
                                </div>
                                <div className="text-[10px] text-slate-400 tabular-nums">{fmtARS(data?.revenue ?? 0)}</div>
                                {data?.abcClass && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${ABC_CONFIG[data.abcClass].badge}`}>{data.abcClass}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-xs text-slate-400">Mostrando <b>{filteredCompare.length}</b> productos con diferencia ≥ {compareMinSpread}% entre sucursales</span>
                </div>
              </div>
            )}
            {hasData && filteredCompare.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 gap-2">
                <p className="text-sm text-slate-400">No hay productos con diferencia ≥ {compareMinSpread}% entre sucursales</p>
                <button onClick={() => setCompareMinSpread(0)} className="text-xs text-indigo-500 hover:text-indigo-700">Bajar el umbral →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl border border-slate-700 max-w-xs whitespace-normal break-words">
            {tooltip.text}
            <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-900 dark:bg-slate-700 border-l border-t border-slate-700 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}