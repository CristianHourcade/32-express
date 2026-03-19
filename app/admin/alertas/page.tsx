"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice";
import { supabase } from "@/lib/supabase";

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────────────────────────────── */
const SALES_DAYS = 30;
const DEFAULT_DELIVERY_DAYS = 7;
const DEFAULT_BUFFER_DAYS = 3;
const LS_MULTIPLES_KEY = "centro_comando_multiples";
const LS_DELIVERY_KEY  = "centro_comando_delivery";
const LS_BUFFER_KEY    = "centro_comando_buffer";

// Múltiplo mínimo de pedido por categoría (ej: BEBIDA=6 = paquete de 6)
// El sugerido siempre se redondea al múltiplo superior más cercano
const DEFAULT_CATEGORY_MULTIPLES: Record<string, number> = {
  BEBIDA:      4,
  CERVEZA:     4,
  ALMACEN:     1,
  CIGARRILLOS: 1,
  GOLOSINAS:   1,
  FIAMBRES:    1,
  TABACO:      1,
  HUEVOS:      1,
  HIGIENE:     1,
  ALCOHOL:     1,
  PROMO:       1,
  BRECA:       1,
  "SIN CATEGORIA": 1,
};

const CATEGORIES = [
  "ALMACEN","CIGARRILLOS","GOLOSINAS","BEBIDA","CERVEZA",
  "FIAMBRES","TABACO","HUEVOS","HIGIENE","ALCOHOL","PROMO","SIN CATEGORIA","BRECA",
] as const;

/* ─────────────────────────────────────────────────────────────────────────────
   TIPOS
───────────────────────────────────────────────────────────────────────────── */
type Tab = "reposicion" | "abc" | "rentabilidad";

interface RepoItem {
  productId: string;
  productName: string;
  category: string;
  stock: number;
  soldQty: number;
  dailyRate: number;
  daysLeft: number | null;
  suggestedQty: number;   // en unidades (para cálculo de costo)
  suggestedPacks: number; // en packs (lo que se muestra y edita)
  packSize: number;       // 1 = sin pack, 4 = pack de 4, etc.
  urgency: "urgent" | "soon" | "ok";
  defaultPurchase: number;
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
}

const ABC_THRESHOLDS = { A: 0.80, B: 0.95 };

const ABC_CONFIG: Record<AbcClass, {
  label: string; badge: string; bar: string; dot: string; headerBg: string; description: string;
}> = {
  A: { label: "Clase A", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", bar: "bg-emerald-500", dot: "bg-emerald-500", headerBg: "bg-emerald-50 dark:bg-emerald-950/20", description: "top 80% de facturación · máxima prioridad" },
  B: { label: "Clase B", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",             bar: "bg-blue-400",   dot: "bg-blue-400",   headerBg: "bg-blue-50 dark:bg-blue-950/20",       description: "siguiente 15% · prioridad media" },
  C: { label: "Clase C", badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",            bar: "bg-slate-300",  dot: "bg-slate-400",  headerBg: "bg-slate-50 dark:bg-slate-800/40",     description: "5% restante · baja prioridad" },
};

/* ─────────────────────────────────────────────────────────────────────────────
   FUNCIÓN PURA: construye el ranking ABC
───────────────────────────────────────────────────────────────────────────── */
function buildAbcItems(
  masters: any[],
  stockMap: Map<string, number>,
  soldMap: Map<string, number>,
  revenueMap: Map<string, number>,
): AbcItem[] {
  const totalRevenue = Array.from(revenueMap.values()).reduce((a, b) => a + b, 0);
  if (totalRevenue === 0) return [];

  const rows: Omit<AbcItem, "abcClass" | "cumulativePct">[] = [];

  masters.forEach((m: any) => {
    const revenue = revenueMap.get(m.id) ?? 0;
    if (revenue === 0) return;

    const soldQty        = soldMap.get(m.id) ?? 0;
    const stock          = stockMap.get(m.id) ?? 0;
    const dailyRate      = soldQty / SALES_DAYS;
    const daysLeft       = dailyRate > 0 ? stock / dailyRate : null;
    const purchase       = Number(m.default_purchase) || 0;
    const selling        = Number(m.default_selling)  || 0;
    const hasValidCost   = purchase >= 10;
    const netProfit      = hasValidCost ? (selling - purchase) * soldQty : null;
    const marginPct      = (hasValidCost && selling > 0) ? ((selling - purchase) / selling) * 100 : null;

    rows.push({
      productId: m.id, productName: m.name, category: extractCategory(m.name),
      soldQty, revenue, netProfit, marginPct, daysLeft, stock,
      defaultSelling: selling, defaultPurchase: purchase,
    });
  });

  rows.sort((a, b) => b.revenue - a.revenue);

  let cumulative = 0;
  return rows.map((r) => {
    cumulative += r.revenue;
    const cumulativePct = cumulative / totalRevenue;
    const abcClass: AbcClass =
      (cumulative - r.revenue) / totalRevenue < ABC_THRESHOLDS.A ? "A" :
      (cumulative - r.revenue) / totalRevenue < ABC_THRESHOLDS.B ? "B" : "C";
    return { ...r, abcClass, cumulativePct };
  });
}

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
  const start = new Date(end);
  start.setDate(end.getDate() - n);
  return { start, end };
}

async function fetchAll<T>(
  query: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const pageSize = 1000;
  let page = 0;
  const all: T[] = [];
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

/* ─────────────────────────────────────────────────────────────────────────────
   URGENCY CONFIG
───────────────────────────────────────────────────────────────────────────── */
const URGENCY_CONFIG = {
  urgent: {
    label: "Urgente",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    dot: "bg-red-500",
    rowBg: "bg-red-50/40 dark:bg-red-950/10",
    order: 1,
  },
  soon: {
    label: "Pronto",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-400",
    rowBg: "",
    order: 2,
  },
  ok: {
    label: "Planificado",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-400",
    rowBg: "",
    order: 3,
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   FUNCIÓN PURA: calcula los items desde datos crudos + parámetros UI
   No hace fetches — se llama en useMemo cada vez que cambian los sliders.
───────────────────────────────────────────────────────────────────────────── */
function buildRepoItems(
  masters: any[],
  stockMap: Map<string, number>,
  soldMap: Map<string, number>,
  deliveryDays: number,
  bufferDays: number,
  categoryMultiples: Record<string, number>
): RepoItem[] {
  const items: RepoItem[] = [];

  masters.forEach((m: any) => {
    const stock   = stockMap.get(m.id) ?? 0;
    const soldQty = soldMap.get(m.id)  ?? 0;
    if (soldQty === 0) return;

    const category   = extractCategory(m.name);
    const packSize   = categoryMultiples[category] ?? 1;
    const dailyRate  = soldQty / SALES_DAYS;
    const neededQty  = dailyRate * (deliveryDays + bufferDays);
    const rawQty     = Math.max(0, neededQty - stock);
    // Cuántos packs necesitamos (redondeamos para arriba)
    const suggestedPacks = rawQty <= 0 ? 0 : Math.ceil(rawQty / packSize);
    if (suggestedPacks === 0) return;
    const suggestedQty = suggestedPacks * packSize; // unidades reales

    const daysLeft = dailyRate > 0 ? stock / dailyRate : null;

    let urgency: RepoItem["urgency"];
    if (daysLeft === null || daysLeft < deliveryDays)   urgency = "urgent";
    else if (daysLeft < deliveryDays + bufferDays + 2)  urgency = "soon";
    else                                                urgency = "ok";

    items.push({
      productId: m.id,
      productName: m.name,
      category,
      stock,
      soldQty,
      dailyRate,
      daysLeft,
      suggestedQty,
      suggestedPacks,
      packSize,
      urgency,
      defaultPurchase: Number(m.default_purchase) || 0,
    });
  });

  return items.sort((a, b) => {
    const od = URGENCY_CONFIG[a.urgency].order - URGENCY_CONFIG[b.urgency].order;
    if (od !== 0) return od;
    return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────────────────────────────── */
export default function CentroComandoPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { businesses, loading: businessesLoading } = useSelector(
    (s: RootState) => s.businesses
  );

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const selectedBranch = useMemo(
    () => businesses.find((b) => b.id === selectedBranchId) || null,
    [businesses, selectedBranchId]
  );

  const [activeTab, setActiveTab]     = useState<Tab>("reposicion");
  const [loading, setLoading]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Datos crudos — se guardan una vez por sucursal
  const [rawMasters,    setRawMasters]    = useState<any[]>([]);
  const [rawStockMap,   setRawStockMap]   = useState<Map<string, number>>(new Map());
  const [rawSoldMap,    setRawSoldMap]    = useState<Map<string, number>>(new Map());
  const [rawRevenueMap, setRawRevenueMap] = useState<Map<string, number>>(new Map());

  // Parámetros configurables desde la UI — recalculan sin re-fetch
  const [deliveryDays,  setDeliveryDays]  = useState(() => {
    try { const v = localStorage.getItem(LS_DELIVERY_KEY); return v ? Number(v) : DEFAULT_DELIVERY_DAYS; } catch { return DEFAULT_DELIVERY_DAYS; }
  });
  const [bufferDays,    setBufferDays]    = useState(() => {
    try { const v = localStorage.getItem(LS_BUFFER_KEY); return v ? Number(v) : DEFAULT_BUFFER_DAYS; } catch { return DEFAULT_BUFFER_DAYS; }
  });
  const [categoryMultiples, setCategoryMultiples] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(LS_MULTIPLES_KEY);
      return stored ? { ...DEFAULT_CATEGORY_MULTIPLES, ...JSON.parse(stored) } : { ...DEFAULT_CATEGORY_MULTIPLES };
    } catch { return { ...DEFAULT_CATEGORY_MULTIPLES }; }
  });
  const [showSettings,  setShowSettings]  = useState(false);

  // Estado del botón copiar
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  // Persistir en localStorage cuando cambian
  useEffect(() => { try { localStorage.setItem(LS_DELIVERY_KEY, String(deliveryDays)); } catch {} }, [deliveryDays]);
  useEffect(() => { try { localStorage.setItem(LS_BUFFER_KEY,   String(bufferDays));   } catch {} }, [bufferDays]);
  useEffect(() => { try { localStorage.setItem(LS_MULTIPLES_KEY, JSON.stringify(categoryMultiples)); } catch {} }, [categoryMultiples]);

  // Filtros reposición
  const [repoSearch,         setRepoSearch]         = useState("");
  const [repoUrgencyFilter,  setRepoUrgencyFilter]  = useState<"all" | "urgent" | "soon" | "ok">("all");
  const [repoCategoryFilter, setRepoCategoryFilter] = useState<string>("");

  // Filtros ABC
  const [abcClassFilter,    setAbcClassFilter]    = useState<AbcClass | "all">("all");
  const [abcCategoryFilter, setAbcCategoryFilter] = useState<string>("");
  const [abcSearch,         setAbcSearch]         = useState("");

  // Edición inline de cantidades sugeridas
  const [editedQtys, setEditedQtys] = useState<Record<string, number>>({});

  // Tooltip nombre producto
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => { dispatch(fetchBusinesses()); }, [dispatch]);

  useEffect(() => {
    if (!selectedBranchId) return;
    setRepoSearch(""); setRepoUrgencyFilter("all"); setRepoCategoryFilter(""); setEditedQtys({});
    setAbcClassFilter("all"); setAbcCategoryFilter(""); setAbcSearch("");
    setRawMasters([]); setRawStockMap(new Map()); setRawSoldMap(new Map()); setRawRevenueMap(new Map());
    loadAll(selectedBranchId);
  }, [selectedBranchId]);

  /* ─── Fetch — solo ocurre al cambiar sucursal o al presionar Actualizar ─── */
  async function loadAll(branchId: string) {
    setLoading(true);
    try {
      const { start, end } = lastNDays(SALES_DAYS);

      const [masters, inventory, saleItems] = await Promise.all([
        fetchAll((from, to) =>
          supabase
            .from("products_master")
            .select("id, name, default_purchase, default_selling")
            .is("deleted_at", null)
            .range(from, to)
        ),
        fetchAll((from, to) =>
          supabase
            .from("business_inventory")
            .select("product_id, stock")
            .eq("business_id", branchId)
            .range(from, to)
        ),
        fetchAll((from, to) =>
          supabase
            .from("sale_items")
            .select("product_master_id, quantity, total, sales!inner(id)")
            .eq("sales.business_id", branchId)
            .gte("sales.timestamp", start.toISOString())
            .lt("sales.timestamp",  end.toISOString())
            .not("product_master_id", "is", null)
            .range(from, to)
        ),
      ]);

      const stockMap = new Map<string, number>();
      inventory.forEach((r: any) => stockMap.set(r.product_id, Number(r.stock) || 0));

      const soldMap = new Map<string, number>();
      const revenueMap = new Map<string, number>();
      saleItems.forEach((r: any) => {
        if (!r.product_master_id) return;
        soldMap.set(r.product_master_id, (soldMap.get(r.product_master_id) || 0) + (Number(r.quantity) || 1));
        revenueMap.set(r.product_master_id, (revenueMap.get(r.product_master_id) || 0) + (Number(r.total) || 0));
      });

      setRawMasters(masters);
      setRawStockMap(stockMap);
      setRawSoldMap(soldMap);
      setRawRevenueMap(revenueMap);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setLoading(false);
    }
  }

  /* ─── Items calculados en el cliente cada vez que cambian los sliders ─── */
  const repoItems = useMemo(
    () => buildRepoItems(rawMasters, rawStockMap, rawSoldMap, deliveryDays, bufferDays, categoryMultiples),
    [rawMasters, rawStockMap, rawSoldMap, deliveryDays, bufferDays, categoryMultiples]
  );

  /* ─── Filtrado ─── */
  const filteredRepo = useMemo(() => {
    let list = repoItems;
    if (repoUrgencyFilter !== "all")  list = list.filter((i) => i.urgency  === repoUrgencyFilter);
    if (repoCategoryFilter)           list = list.filter((i) => i.category === repoCategoryFilter);
    if (repoSearch.trim()) {
      const q = repoSearch.toLowerCase();
      list = list.filter((i) => i.productName.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return list;
  }, [repoItems, repoUrgencyFilter, repoCategoryFilter, repoSearch]);

  /* ─── Agrupado por categoría ─── */
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, RepoItem[]>();
    filteredRepo.forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    });
    map.forEach((items) => items.sort((a, b) => URGENCY_CONFIG[a.urgency].order - URGENCY_CONFIG[b.urgency].order));
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      return b.filter((i) => i.urgency === "urgent").length - a.filter((i) => i.urgency === "urgent").length;
    });
  }, [filteredRepo]);

  /* ─── KPIs ─── */
  const kpis = useMemo(() => ({
    urgent:     repoItems.filter((i) => i.urgency === "urgent").length,
    soon:       repoItems.filter((i) => i.urgency === "soon").length,
    totalUnits: repoItems.reduce((a, i) => {
      const packs = editedQtys[i.productId] ?? i.suggestedPacks;
      return a + packs * i.packSize;
    }, 0),
    totalCost: repoItems.reduce((a, i) => {
      const packs = editedQtys[i.productId] ?? i.suggestedPacks;
      return a + packs * i.packSize * i.defaultPurchase;
    }, 0),
    cats: new Set(repoItems.map((i) => i.category)).size,
  }), [repoItems, editedQtys]);

  /* ─── Categorías presentes en la lista repo ─── */
  const categoriesInRepo = useMemo(() => {
    const set = new Set(repoItems.map((i) => i.category));
    return CATEGORIES.filter((c) => set.has(c));
  }, [repoItems]);

  /* ─── Copiar pedido al portapapeles ─── */
  function buildCopyText(items: RepoItem[], edited: Record<string, number>, branchName: string): string {
    const lines: string[] = [];
    lines.push(`Pedido — ${branchName}`);
    lines.push(`${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}`);
    lines.push("");

    const byCategory = new Map<string, RepoItem[]>();
    items.forEach((i) => {
      if (!byCategory.has(i.category)) byCategory.set(i.category, []);
      byCategory.get(i.category)!.push(i);
    });

    byCategory.forEach((catItems, cat) => {
      lines.push(`${cat}`);
      catItems.forEach((i) => {
        const packs = edited[i.productId] ?? i.suggestedPacks;
        const units = packs * i.packSize;
        if (i.packSize > 1) {
          lines.push(`  ${i.productName}: ${packs} pack`);
        } else {
          lines.push(`  ${i.productName}: ${units} unidades`);
        }
      });
      lines.push("");
    });

    return lines.join("\n").trimEnd();
  }

  async function handleCopy() {
    if (!selectedBranch) return;
    const urgentItems = filteredRepo.filter((i) => i.urgency === "urgent");
    if (urgentItems.length === 0) return;
    const text = buildCopyText(urgentItems, editedQtys, selectedBranch.name);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2500);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2500);
    }
  }

  /* ─── ABC: items calculados ─── */
  const abcItems = useMemo(
    () => buildAbcItems(rawMasters, rawStockMap, rawSoldMap, rawRevenueMap),
    [rawMasters, rawStockMap, rawSoldMap, rawRevenueMap]
  );

  /* ─── ABC: KPIs de resumen ─── */
  const abcKpis = useMemo(() => {
    const totalRevenue = abcItems.reduce((a, i) => a + i.revenue, 0);
    const byClass = { A: { count: 0, revenue: 0 }, B: { count: 0, revenue: 0 }, C: { count: 0, revenue: 0 } };
    abcItems.forEach((i) => { byClass[i.abcClass].count++; byClass[i.abcClass].revenue += i.revenue; });
    const totalNetProfit = abcItems.reduce((a, i) => a + (i.netProfit ?? 0), 0);
    const classANetProfit = abcItems.filter((i) => i.abcClass === "A").reduce((a, i) => a + (i.netProfit ?? 0), 0);
    return { totalRevenue, byClass, totalNetProfit, classANetProfit };
  }, [abcItems]);

  /* ─── ABC: filtrado ─── */
  const filteredAbc = useMemo(() => {
    let list = abcItems;
    if (abcClassFilter !== "all") list = list.filter((i) => i.abcClass === abcClassFilter);
    if (abcCategoryFilter)        list = list.filter((i) => i.category === abcCategoryFilter);
    if (abcSearch.trim()) {
      const q = abcSearch.toLowerCase();
      list = list.filter((i) => i.productName.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return list;
  }, [abcItems, abcClassFilter, abcCategoryFilter, abcSearch]);

  /* ─── ABC: categorías presentes ─── */
  const categoriesInAbc = useMemo(() => {
    const set = new Set(abcItems.map((i) => i.category));
    return CATEGORIES.filter((c) => set.has(c));
  }, [abcItems]);

  const hasData = rawMasters.length > 0;
  const isBusy  = loading || businessesLoading;

  /* ─────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── Modal selección de sucursal ── */}
      {!selectedBranchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 font-bold text-lg">⌘</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Centro de comando</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Seleccioná una sucursal para comenzar</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {businessesLoading && <div className="text-center py-8 text-slate-400">Cargando…</div>}
              {!businessesLoading && businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBranchId(b.id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 transition-all group"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{b.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">ID: {b.id}</div>
                </button>
              ))}
            </div>
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
              {selectedBranch && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedBranch.name}
                  {lastUpdated && <> · actualizado {lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedBranchId(null); setRawMasters([]); }}
              className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              ← Cambiar sucursal
            </button>
            <button
              onClick={() => selectedBranchId && loadAll(selectedBranchId)}
              disabled={isBusy || !selectedBranchId}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : "↻"}
              Actualizar
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "reposicion",   icon: "📦", label: "Orden de reposición" },
            { key: "abc",          icon: "🏆", label: "Análisis ABC" },
            { key: "rentabilidad", icon: "💰", label: "Rentabilidad real",   soon: true },
          ] as { key: Tab; icon: string; label: string; soon?: boolean }[]).map(({ key, icon, label, soon }) => (
            <button
              key={key}
              onClick={() => !soon && setActiveTab(key)}
              disabled={!!soon}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                activeTab === key
                  ? "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : soon
                  ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-white dark:hover:bg-slate-800"
              }`}
            >
              <span style={{ fontSize: 14 }}>{icon}</span>
              {label}
              {soon && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">Próximo</span>}
            </button>
          ))}
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Calculando reposición óptima…</p>
              <p className="text-xs text-slate-400 mt-1">Cruzando stock actual con ventas de los últimos {SALES_DAYS} días</p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: ORDEN DE REPOSICIÓN
        ════════════════════════════════════════════ */}
        {!loading && activeTab === "reposicion" && selectedBranchId && (
          <div className="space-y-4">

            {/* ── Panel de parámetros configurables (sin base de datos) ── */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                  <span>⚙</span>
                  Parámetros de cálculo
                  <span className="text-xs font-normal text-slate-400 hidden sm:inline">
                    · entrega en {deliveryDays}d · buffer {bufferDays}d · cobertura objetivo {deliveryDays + bufferDays}d
                  </span>
                </div>
                <span className="text-slate-400 text-xs">{showSettings ? "▲ cerrar" : "▼ ajustar"}</span>
              </button>

              {showSettings && (
                <div className="px-5 pb-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ajustá los sliders y la lista se recalcula al instante — sin tocar la base de datos.
                    <br />
                    Fórmula: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      a pedir = ceil(consumo_diario × (entrega + buffer)) − stock_actual
                    </code>
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Días de entrega del proveedor</label>
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{deliveryDays}d</span>
                      </div>
                      <input type="range" min={1} max={30} step={1} value={deliveryDays}
                        onChange={(e) => setDeliveryDays(Number(e.target.value))}
                        className="w-full accent-indigo-600" />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>1 día</span><span>30 días</span></div>
                      <p className="text-xs text-slate-400 mt-1.5">Cuántos días tarda en llegar desde que pedís.</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Buffer de seguridad</label>
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{bufferDays}d</span>
                      </div>
                      <input type="range" min={0} max={14} step={1} value={bufferDays}
                        onChange={(e) => setBufferDays(Number(e.target.value))}
                        className="w-full accent-indigo-600" />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0 días</span><span>14 días</span></div>
                      <p className="text-xs text-slate-400 mt-1.5">Días extra para cubrirte ante demoras o picos.</p>
                    </div>
                  </div>

                  {/* Múltiplos mínimos por categoría */}
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Pedido mínimo por categoría</div>
                    <p className="text-xs text-slate-400 mb-3">
                      El sugerido se redondea siempre al múltiplo superior. Ejemplo: BEBIDA=6 → si hay que pedir 8, se sugieren 12 (2 sixpacks).
                      Se guarda automáticamente en el navegador.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {CATEGORIES.filter((c) => c !== "PROMO" && c !== "SIN CATEGORIA").map((cat) => (
                        <div key={cat} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-700">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{cat}</span>
                          <input
                            type="number"
                            min={1}
                            max={48}
                            value={categoryMultiples[cat] ?? 1}
                            onChange={(e) => setCategoryMultiples((prev) => ({
                              ...prev,
                              [cat]: Math.max(1, Number(e.target.value) || 1),
                            }))}
                            className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg py-0.5 text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setCategoryMultiples({ ...DEFAULT_CATEGORY_MULTIPLES })}
                      className="mt-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      Restablecer múltiplos
                    </button>
                  </div>

                  {/* Preview del impacto en tiempo real */}
                  <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 px-4 py-3 flex flex-wrap gap-6 items-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-indigo-400 font-medium mb-0.5">Cobertura objetivo</div>
                      <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">{deliveryDays + bufferDays} días</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-indigo-400 font-medium mb-0.5">Productos en lista</div>
                      <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">{repoItems.length}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-indigo-400 font-medium mb-0.5">Inversión estimada</div>
                      <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{fmtARS(kpis.totalCost)}</div>
                    </div>
                    <button
                      onClick={() => { setDeliveryDays(DEFAULT_DELIVERY_DAYS); setBufferDays(DEFAULT_BUFFER_DAYS); }}
                      className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Restablecer ({DEFAULT_DELIVERY_DAYS}d + {DEFAULT_BUFFER_DAYS}d buffer)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── KPIs ── */}
            {hasData && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Urgentes ahora",    value: kpis.urgent,              sub: "no llega a tiempo",    color: kpis.urgent > 0 ? "text-red-600 dark:text-red-400" : "text-slate-300 dark:text-slate-600" },
                  { label: "Pedir pronto",       value: kpis.soon,                sub: "en los próximos días", color: kpis.soon > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-300 dark:text-slate-600" },
                  { label: "Categorías",         value: kpis.cats,                sub: "con pedidos",          color: "text-slate-900 dark:text-white" },
                  { label: "Unidades a pedir",   value: fmtN(kpis.totalUnits),   sub: "total",               color: "text-slate-900 dark:text-white" },
                  { label: "Inversión estimada", value: fmtARS(kpis.totalCost),  sub: "a precio de compra",  color: "text-slate-900 dark:text-white", small: true },
                ].map(({ label, value, sub, color, small }) => (
                  <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">{label}</div>
                    <div className={`font-bold tabular-nums ${small ? "text-xl" : "text-2xl"} ${color}`}>{value}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Filtros + botón copiar ── */}
            {hasData && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Buscar producto…"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <select value={repoUrgencyFilter} onChange={(e) => setRepoUrgencyFilter(e.target.value as any)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Toda urgencia</option>
                  <option value="urgent">🔴 Urgente</option>
                  <option value="soon">🟡 Pronto</option>
                  <option value="ok">🔵 Planificado</option>
                </select>
                <select value={repoCategoryFilter} onChange={(e) => setRepoCategoryFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Todas las categorías</option>
                  {categoriesInRepo.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {(repoSearch || repoUrgencyFilter !== "all" || repoCategoryFilter) && (
                  <button
                    onClick={() => { setRepoSearch(""); setRepoUrgencyFilter("all"); setRepoCategoryFilter(""); }}
                    className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    ✕ Limpiar
                  </button>
                )}
                {/* Botón copiar */}
                <button
                  onClick={handleCopy}
                  disabled={filteredRepo.filter((i) => i.urgency === "urgent").length === 0 || copyStatus === "copied"}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
                    copyStatus === "copied"
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                      : copyStatus === "error"
                      ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {copyStatus === "copied" ? "✓ Copiado" : copyStatus === "error" ? "✗ Error" : (() => {
                    const n = filteredRepo.filter((i) => i.urgency === "urgent").length;
                    return `⧉ Copiar urgentes${n > 0 ? ` (${n})` : ""}`;
                  })()}
                </button>
              </div>
            )}

            {/* ── Empty states ── */}
            {!hasData && !loading && (
              <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 gap-2">
                <p className="text-sm text-slate-400">Presioná Actualizar para cargar los datos</p>
              </div>
            )}
            {hasData && filteredRepo.length === 0 && repoItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-950/10 gap-3">
                <span className="text-4xl">✅</span>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Todo el stock cubre los próximos {deliveryDays + bufferDays} días</p>
                <p className="text-xs text-slate-400">Probá aumentar los días de entrega o el buffer para planificar con más anticipación</p>
              </div>
            )}
            {hasData && filteredRepo.length === 0 && repoItems.length > 0 && (
              <div className="flex flex-col items-center justify-center h-32 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 gap-2">
                <p className="text-sm text-slate-400">No hay productos con ese filtro</p>
              </div>
            )}

            {/* ── Tablas agrupadas por categoría ── */}
            {filteredRepo.length > 0 && (
              <div className="space-y-4">
                {groupedByCategory.map(([category, items]) => {
                  const groupUnits = items.reduce((a, i) => a + (editedQtys[i.productId] ?? i.suggestedPacks) * i.packSize, 0);
                  const groupCost  = items.reduce((a, i) => a + (editedQtys[i.productId] ?? i.suggestedPacks) * i.packSize * i.defaultPurchase, 0);
                  const hasUrgent  = items.some((i) => i.urgency === "urgent");

                  return (
                    <div key={category} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">

                      {/* Cabecera de grupo */}
                      <div className={`px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 ${hasUrgent ? "bg-red-50 dark:bg-red-950/20" : "bg-slate-50 dark:bg-slate-800/40"}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full ${hasUrgent ? "bg-red-500" : "bg-amber-400"}`} />
                          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{category}</span>
                          <span className="text-xs text-slate-400">{items.length} producto{items.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-400 tabular-nums hidden sm:inline">{fmtN(groupUnits)} unid.</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{fmtARS(groupCost)}</span>
                        </div>
                      </div>

                      {/* Tabla */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                              <th className="px-5 py-2.5 text-left   text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Producto</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Stock</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Vend. 30d</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Días rest.</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Urgencia</th>
                              <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">A pedir</th>
                              <th className="px-4 py-2.5 text-right  text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Costo est.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                            {items.map((item) => {
                              const cfg          = URGENCY_CONFIG[item.urgency];
                              const displayPacks = editedQtys[item.productId] ?? item.suggestedPacks;
                              const displayUnits = displayPacks * item.packSize;
                              const displayCost  = displayUnits * item.defaultPurchase;
                              const isEdited     = editedQtys[item.productId] !== undefined;
                              const usesPacks    = item.packSize > 1;

                              return (
                                <tr key={item.productId} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30 ${cfg.rowBg}`}>

                                  {/* Producto */}
                                  <td className="px-5 py-3 max-w-[220px]">
                                    <span
                                      className="font-medium text-slate-800 dark:text-slate-100 truncate block cursor-default"
                                      onMouseEnter={(e) => {
                                        const r = (e.target as HTMLElement).getBoundingClientRect();
                                        setTooltip({ text: item.productName, x: r.left, y: r.bottom + 6 });
                                      }}
                                      onMouseLeave={() => setTooltip(null)}
                                    >
                                      {item.productName}
                                    </span>
                                  </td>

                                  {/* Stock */}
                                  <td className="px-4 py-3 text-center">
                                    <span className={`font-bold tabular-nums text-sm ${
                                      item.stock === 0 ? "text-red-600 dark:text-red-400" :
                                      item.stock < 5   ? "text-orange-500 dark:text-orange-400" :
                                                         "text-slate-700 dark:text-slate-200"
                                    }`}>{fmtN(item.stock)}</span>
                                  </td>

                                  {/* Vendidos */}
                                  <td className="px-4 py-3 text-center tabular-nums text-slate-500 dark:text-slate-400 text-sm">
                                    {fmtN(item.soldQty)}
                                  </td>

                                  {/* Días restantes */}
                                  <td className="px-4 py-3 text-center">
                                    {item.daysLeft === null ? (
                                      <span className="text-xs text-red-500 font-semibold">Sin stock</span>
                                    ) : (
                                      <span className={`font-bold tabular-nums text-sm ${
                                        item.daysLeft < 1                   ? "text-red-600 dark:text-red-400" :
                                        item.daysLeft < deliveryDays        ? "text-orange-500 dark:text-orange-400" :
                                        item.daysLeft < deliveryDays + 3    ? "text-amber-600 dark:text-amber-400" :
                                                                              "text-slate-600 dark:text-slate-300"
                                      }`}>
                                        {item.daysLeft < 1 ? "< 1" : `~${Math.floor(item.daysLeft)}`}d
                                      </span>
                                    )}
                                  </td>

                                  {/* Urgencia */}
                                  <td className="px-4 py-3 text-center whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.badge}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                      {cfg.label}
                                    </span>
                                  </td>

                                  {/* Cantidad editable — en PACKS si packSize > 1, en unidades si no */}
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => setEditedQtys((p) => ({ ...p, [item.productId]: Math.max(0, (p[item.productId] ?? item.suggestedPacks) - 1) }))}
                                          className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center leading-none text-base"
                                        >−</button>
                                        <input
                                          type="number" min={0} value={displayPacks}
                                          onChange={(e) => setEditedQtys((p) => ({ ...p, [item.productId]: Math.max(0, Number(e.target.value) || 0) }))}
                                          className="w-14 text-center border border-indigo-300 dark:border-indigo-700 rounded-lg py-0.5 text-sm font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                        <button
                                          onClick={() => setEditedQtys((p) => ({ ...p, [item.productId]: (p[item.productId] ?? item.suggestedPacks) + 1 }))}
                                          className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center leading-none text-base"
                                        >+</button>
                                        {isEdited && (
                                          <button
                                            onClick={() => setEditedQtys((p) => { const n = { ...p }; delete n[item.productId]; return n; })}
                                            className="text-xs text-slate-400 hover:text-slate-600 ml-0.5" title="Restaurar sugerido"
                                          >↺</button>
                                        )}
                                      </div>
                                      {/* Label: "2 packs × 4 = 8 ud" o solo unidades */}
                                      <div className="text-[10px] text-center text-slate-400 leading-tight">
                                        {usesPacks ? (
                                          <span className="text-indigo-500 font-medium">{displayPacks} pack×{item.packSize} = {displayUnits} ud</span>
                                        ) : (
                                          <span>{displayUnits} unidades</span>
                                        )}
                                        {isEdited && <span className="block text-slate-400">sugerido: {item.suggestedPacks}</span>}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Costo estimado */}
                                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200 text-sm">
                                    {displayCost > 0 ? fmtARS(displayCost) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>

                          {/* Subtotal del grupo */}
                          <tfoot className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                            <tr>
                              <td colSpan={5} className="px-5 py-2.5 text-xs text-slate-400 font-medium">Subtotal {category}</td>
                              <td className="px-4 py-2.5 text-center text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">{fmtN(groupUnits)} ud.</td>
                              <td className="px-4 py-2.5 text-right  text-sm font-bold text-slate-900 dark:text-white tabular-nums">{fmtARS(groupCost)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {/* Total general */}
                <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">Total del pedido</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {kpis.cats} categoría{kpis.cats !== 1 ? "s" : ""} · {fmtN(kpis.totalUnits)} unidades · cobertura objetivo {deliveryDays + bufferDays} días
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{fmtARS(kpis.totalCost)}</div>
                </div>

                {/* Leyenda */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Criterios de urgencia</div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />Urgente: el stock se agota antes de que llegue el pedido ({deliveryDays}d)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />Pronto: queda poco margen de seguridad (menos de {deliveryDays + bufferDays}d)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />Planificado: hay stock suficiente pero conviene pedir en este ciclo</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: ANÁLISIS ABC
        ════════════════════════════════════════════ */}
        {!loading && activeTab === "abc" && selectedBranchId && (
          <div className="space-y-4">

            {/* KPIs ABC */}
            {abcItems.length > 0 && (
              <>
                {/* Distribución visual */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Distribución de facturación</div>
                  <div className="flex rounded-xl overflow-hidden h-5 mb-3 gap-0.5">
                    {(["A","B","C"] as AbcClass[]).map((cls) => {
                      const pct = abcKpis.totalRevenue > 0 ? (abcKpis.byClass[cls].revenue / abcKpis.totalRevenue) * 100 : 0;
                      return (
                        <div
                          key={cls}
                          className={`${ABC_CONFIG[cls].bar} transition-all`}
                          style={{ width: `${pct}%`, minWidth: pct > 0 ? 2 : 0 }}
                          title={`Clase ${cls}: ${pct.toFixed(1)}%`}
                        />
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(["A","B","C"] as AbcClass[]).map((cls) => {
                      const pct = abcKpis.totalRevenue > 0 ? (abcKpis.byClass[cls].revenue / abcKpis.totalRevenue) * 100 : 0;
                      const cfg = ABC_CONFIG[cls];
                      return (
                        <button
                          key={cls}
                          onClick={() => setAbcClassFilter(abcClassFilter === cls ? "all" : cls)}
                          className={`rounded-xl p-3 text-left border transition-all ${
                            abcClassFilter === cls
                              ? `${cfg.headerBg} border-slate-300 dark:border-slate-500 ring-2 ring-offset-1 ring-indigo-400`
                              : `${cfg.headerBg} border-slate-200 dark:border-slate-700 hover:ring-1 hover:ring-indigo-300`
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{cfg.label}</span>
                          </div>
                          <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{abcKpis.byClass[cls].count}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">{fmtARS(abcKpis.byClass[cls].revenue)} · {pct.toFixed(1)}%</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{cfg.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* KPI strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">Facturación total</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{fmtARS(abcKpis.totalRevenue)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">últimos 30 días</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">Ganancia neta total</div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmtARS(abcKpis.totalNetProfit)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">productos con costo cargado</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">Ganancia clase A</div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmtARS(abcKpis.classANetProfit)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{abcKpis.totalNetProfit > 0 ? ((abcKpis.classANetProfit / abcKpis.totalNetProfit) * 100).toFixed(0) : "—"}% de toda la ganancia</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">Productos rankeados</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{abcItems.length}</div>
                    <div className="text-xs text-slate-400 mt-0.5">con ventas en 30 días</div>
                  </div>
                </div>
              </>
            )}

            {/* Filtros */}
            {abcItems.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Buscar producto…"
                  value={abcSearch}
                  onChange={(e) => setAbcSearch(e.target.value)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <select value={abcClassFilter} onChange={(e) => setAbcClassFilter(e.target.value as any)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Todas las clases</option>
                  <option value="A">Clase A — top 80%</option>
                  <option value="B">Clase B — siguiente 15%</option>
                  <option value="C">Clase C — resto 5%</option>
                </select>
                <select value={abcCategoryFilter} onChange={(e) => setAbcCategoryFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Todas las categorías</option>
                  {categoriesInAbc.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {(abcSearch || abcClassFilter !== "all" || abcCategoryFilter) && (
                  <button
                    onClick={() => { setAbcSearch(""); setAbcClassFilter("all"); setAbcCategoryFilter(""); }}
                    className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
            )}

            {/* Empty state */}
            {!hasData && !loading && (
              <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 gap-2">
                <p className="text-sm text-slate-400">Presioná Actualizar para cargar los datos</p>
              </div>
            )}
            {hasData && abcItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 gap-2">
                <p className="text-sm text-slate-400">Sin ventas registradas en este período</p>
              </div>
            )}

            {/* Tabla ABC */}
            {filteredAbc.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[65vh]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left   text-[11px] uppercase tracking-wide text-slate-400 font-semibold w-8">#</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Clase</th>
                        <th className="px-4 py-3 text-left   text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Producto</th>
                        <th className="px-4 py-3 text-left   text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Categoría</th>
                        <th className="px-4 py-3 text-right  text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Facturación</th>
                        <th className="px-4 py-3 text-right  text-[11px] uppercase tracking-wide text-slate-400 font-semibold">% acum.</th>
                        <th className="px-4 py-3 text-right  text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Ganancia neta</th>
                        <th className="px-4 py-3 text-right  text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Margen %</th>
                        <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Días stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAbc.map((item, idx) => {
                        const cfg = ABC_CONFIG[item.abcClass];
                        const prevClass = idx > 0 ? filteredAbc[idx - 1].abcClass : null;
                        const showClassDivider = prevClass !== null && prevClass !== item.abcClass;
                        return (
                          <tr key={item.productId} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30 ${showClassDivider ? "border-t-2 border-slate-300 dark:border-slate-600" : ""}`}>

                            {/* Rank */}
                            <td className="px-4 py-2.5 text-xs text-slate-400 tabular-nums text-center">{idx + 1}</td>

                            {/* Clase */}
                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </td>

                            {/* Producto con tooltip */}
                            <td className="px-4 py-2.5 max-w-[200px]">
                              <span
                                className="font-medium text-slate-800 dark:text-slate-100 truncate block cursor-default"
                                onMouseEnter={(e) => {
                                  const r = (e.target as HTMLElement).getBoundingClientRect();
                                  setTooltip({ text: item.productName, x: r.left, y: r.bottom + 6 });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                              >
                                {item.productName}
                              </span>
                            </td>

                            {/* Categoría */}
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                {item.category}
                              </span>
                            </td>

                            {/* Facturación + barra */}
                            <td className="px-4 py-2.5 text-right">
                              <div className="font-bold tabular-nums text-slate-900 dark:text-white text-sm">{fmtARS(item.revenue)}</div>
                              <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                                <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${Math.min(100, (item.revenue / (abcItems[0]?.revenue || 1)) * 100)}%` }} />
                              </div>
                            </td>

                            {/* % acumulado */}
                            <td className="px-4 py-2.5 text-right tabular-nums text-xs text-slate-500 dark:text-slate-400">
                              {(item.cumulativePct * 100).toFixed(1)}%
                            </td>

                            {/* Ganancia neta */}
                            <td className="px-4 py-2.5 text-right">
                              {item.netProfit === null ? (
                                <span className="text-xs text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">sin costo</span>
                              ) : (
                                <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 text-sm">{fmtARS(item.netProfit)}</span>
                              )}
                            </td>

                            {/* Margen % */}
                            <td className="px-4 py-2.5 text-right">
                              {item.marginPct === null ? (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              ) : (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${
                                  item.marginPct >= 40 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                  item.marginPct >= 20 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                                                         "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}>
                                  {item.marginPct.toFixed(1)}%
                                </span>
                              )}
                            </td>

                            {/* Días de stock restante */}
                            <td className="px-4 py-2.5 text-center">
                              {item.daysLeft === null ? (
                                <span className="text-xs text-red-500 font-semibold">Sin stock</span>
                              ) : item.stock === 0 ? (
                                <span className="text-xs text-red-500 font-semibold">0</span>
                              ) : (
                                <span className={`font-bold tabular-nums text-sm ${
                                  item.daysLeft < 3  ? "text-red-600 dark:text-red-400" :
                                  item.daysLeft < 7  ? "text-amber-600 dark:text-amber-400" :
                                                       "text-slate-600 dark:text-slate-300"
                                }`}>
                                  ~{Math.floor(item.daysLeft)}d
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Mostrando <b>{filteredAbc.length}</b> de <b>{abcItems.length}</b> productos
                  </span>
                  {(abcSearch || abcClassFilter !== "all" || abcCategoryFilter) && (
                    <button onClick={() => { setAbcSearch(""); setAbcClassFilter("all"); setAbcCategoryFilter(""); }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                      Ver todos →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Leyenda */}
            {abcItems.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Cómo leer el análisis ABC</div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />Clase A: los productos que llegan primero al 80% de facturación acumulada. Son tu motor. Nunca deben quedarse sin stock.</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />Clase B: el siguiente 15%. Importantes pero toleran más variación de stock.</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />Clase C: el 5% restante. Evaluá si vale la pena mantenerlos en inventario.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PRÓXIMAMENTE: Rentabilidad ── */}
        {!loading && activeTab === "rentabilidad" && (
          <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 gap-3">
            <span className="text-4xl">🚧</span>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Módulo en construcción</p>
            <p className="text-xs text-slate-400">Próximamente: Rentabilidad real</p>
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