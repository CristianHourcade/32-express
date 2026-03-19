"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, AlertTriangle, Activity, Building2,
  Calendar, User, ChevronDown, X, Filter,
  TrendingDown, Clock, RefreshCw,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────── */
type ActivityRow = {
  id: string;
  business_id: string;
  details: string;
  timestamp: string;
  businesses: { name: string } | null;
};

type ActivityType =
  | "stock_up"    // - PRODUCTO: X → Y donde Y > X
  | "stock_down"  // - PRODUCTO: X → Y donde Y < X
  | "scan_found"  // Escaneo: code=X → N coincidencia(s)
  | "scan_miss"   // Escaneo: code=X → 0 coincidencias
  | "scan_multi"  // Escaneo: code=X → 2+ coincidencias
  | "sel_scanner" // Selección desde modal de scanner
  | "sel_manual"  // Selección desde búsqueda manual
  | "perdida"     // [PERDIDA - $X]
  | "other";

/* ─────────────────────────────────────────────────────────
   PARSE HELPERS
   ───────────────────────────────────────────────────────── */
function parseActivity(a: ActivityRow) {
  // El responsible puede terminar en ":" o no (ej: "Mati:" vs "Mati")
  const rawParts = a.details.split(" ");
  const firstWord = rawParts[0].replace(/:$/, "");
  const detail = rawParts.slice(1).join(" ");
  const lower = detail.toLowerCase();

  // Pérdida
  const perdidaMatch = a.details.match(/\[PERDIDA - \$([\d.]+)\]/i);
  const perdidaAmount = perdidaMatch ? parseFloat(perdidaMatch[1]) : 0;

  // Cambio de stock: "- PRODUCTO: X → Y"
  const stockMatch = detail.match(/^-\s+(.+?):\s*([\d.]+)\s*→\s*([\d.]+)/);
  let stockProduct = "";
  let stockFrom = 0;
  let stockTo = 0;
  if (stockMatch) {
    stockProduct = stockMatch[1].trim();
    stockFrom = parseFloat(stockMatch[2]);
    stockTo = parseFloat(stockMatch[3]);
  }

  // Escaneo
  const scanMatch = detail.match(/Escaneo:\s*code=([\w\d]+)\s*→\s*(\d+)\s*coincidencia/i);
  const scanCode = scanMatch ? scanMatch[1] : "";
  const scanCount = scanMatch ? parseInt(scanMatch[2]) : -1;

  // Selección desde modal de scanner
  const selScannerMatch = detail.match(/Selecci[oó]n desde modal de scanner:\s*(.+)/i);
  const selScannerProduct = selScannerMatch ? selScannerMatch[1].trim() : "";

  // Selección desde búsqueda manual
  const selManualMatch = detail.match(/Selecci[oó]n desde b[uú]squeda manual:\s*(.+)/i);
  const selManualProduct = selManualMatch ? selManualMatch[1].trim() : "";

  let type: ActivityType = "other";
  if (perdidaAmount > 0) type = "perdida";
  else if (stockMatch) type = stockTo > stockFrom ? "stock_up" : "stock_down";
  else if (scanMatch && scanCount === 0) type = "scan_miss";
  else if (scanMatch && scanCount >= 2) type = "scan_multi";
  else if (scanMatch && scanCount === 1) type = "scan_found";
  else if (selScannerMatch) type = "sel_scanner";
  else if (selManualMatch) type = "sel_manual";

  return {
    responsible: firstWord,
    detail,
    perdidaAmount,
    type,
    stockProduct, stockFrom, stockTo,
    scanCode, scanCount,
    selScannerProduct,
    selManualProduct,
  };
}

function getTypeConfig(type: ActivityType) {
  switch (type) {
    case "stock_up": return {
      dot: "bg-emerald-500",
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      label: "Stock ↑",
      row: "border-l-emerald-400",
    };
    case "stock_down": return {
      dot: "bg-orange-500",
      badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      label: "Stock ↓",
      row: "border-l-orange-400",
    };
    case "scan_found": return {
      dot: "bg-sky-400",
      badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
      label: "Escaneo ✓",
      row: "border-l-sky-300",
    };
    case "scan_miss": return {
      dot: "bg-red-400",
      badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      label: "Sin resultado",
      row: "border-l-red-300",
    };
    case "scan_multi": return {
      dot: "bg-amber-400",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      label: "Múltiples",
      row: "border-l-amber-300",
    };
    case "sel_scanner": return {
      dot: "bg-violet-400",
      badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
      label: "Scanner →",
      row: "border-l-violet-300",
    };
    case "sel_manual": return {
      dot: "bg-indigo-400",
      badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
      label: "Manual →",
      row: "border-l-indigo-300",
    };
    case "perdida": return {
      dot: "bg-red-600",
      badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      label: "Pérdida",
      row: "border-l-red-500",
    };
    default: return {
      dot: "bg-slate-400",
      badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
      label: "Actividad",
      row: "border-l-slate-300",
    };
  }
}

function formatDetail(parsed: ReturnType<typeof parseActivity>): string {
  const { type, detail, stockProduct, stockFrom, stockTo, scanCode, scanCount,
          selScannerProduct, selManualProduct } = parsed;

  if (type === "stock_up" || type === "stock_down") {
    const arrow = stockTo > stockFrom
      ? `<span class="font-bold text-emerald-600 dark:text-emerald-400">${stockFrom} → ${stockTo}</span>`
      : `<span class="font-bold text-orange-600 dark:text-orange-400">${stockFrom} → ${stockTo}</span>`;
    return `<span class="text-slate-800 dark:text-slate-100 font-medium">${stockProduct}</span> <span class="text-slate-400 mx-1">·</span> ${arrow}`;
  }

  if (type === "scan_found") {
    const productMatch = detail.match(/\((.+?)\)$/);
    const product = productMatch ? productMatch[1] : "";
    return `<span class="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">${scanCode}</span>`
      + (product ? ` <span class="text-slate-400 mx-1">→</span> <span class="text-slate-800 dark:text-slate-100 font-medium">${product}</span>` : "");
  }

  if (type === "scan_miss") {
    return `<span class="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">${scanCode}</span>`
      + ` <span class="text-red-500 dark:text-red-400 text-xs ml-1">sin coincidencias</span>`;
  }

  if (type === "scan_multi") {
    return `<span class="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">${scanCode}</span>`
      + ` <span class="text-amber-600 dark:text-amber-400 text-xs ml-1">${scanCount} coincidencias</span>`;
  }

  if (type === "sel_scanner" || type === "sel_manual") {
    const product = type === "sel_scanner" ? selScannerProduct : selManualProduct;
    return `<span class="text-slate-800 dark:text-slate-100 font-medium">${product}</span>`;
  }

  if (type === "perdida") {
    const m = detail.match(/\[PERDIDA - \$([\d.]+)\]/i);
    return m
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold text-[11px]">⚠ Pérdida $${m[1]}</span>`
      : detail;
  }

  return detail
    .replace(/\badded\b/gi, `<span class="text-emerald-600 dark:text-emerald-400 font-semibold">agregado</span>`)
    .replace(/\bremoved\b/gi, `<span class="text-amber-600 dark:text-amber-400 font-semibold">eliminado</span>`);
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  if (hrs < 24) return `hace ${hrs}h`;
  if (days < 7) return `hace ${days}d`;
  return new Date(ts).toLocaleDateString("es-AR");
}

/* ─────────────────────────────────────────────────────────
   FETCH
   ───────────────────────────────────────────────────────── */
async function fetchActivities(): Promise<ActivityRow[]> {
  const pageSize = 1000;
  let from = 0;
  let acc: ActivityRow[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from("activities")
      .select("id, business_id, details, timestamp, businesses(name)")
      .order("timestamp", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) { console.error(error); break; }
    const batch = data ?? [];
    acc = acc.concat(batch as ActivityRow[]);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return acc;
}

/* ─────────────────────────────────────────────────────────
   FILTER PILL
   ───────────────────────────────────────────────────────── */
function FilterPill({
  label, value, options, onChange, icon: Icon,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[140px] flex-1">
      <label className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ACTIVITY ROW
   ───────────────────────────────────────────────────────── */
function ActivityItem({
  a,
  onAddPerdida,
  isSelected,
}: {
  a: ActivityRow;
  onAddPerdida: (amount: number) => void;
  isSelected: boolean;
}) {
  const parsed = parseActivity(a);
  const { responsible, perdidaAmount, type, stockProduct, stockFrom, stockTo } = parsed;
  const cfg = getTypeConfig(type);

  return (
    <div className={`group relative flex gap-4 py-3 px-4 border-l-4 transition-colors rounded-r-xl ${cfg.row} ${
      isSelected ? "bg-red-50/60 dark:bg-red-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
    }`}>
      {/* dot */}
      <div className="relative shrink-0 mt-1">
        <span className={`w-2.5 h-2.5 rounded-full block ${cfg.dot}`} />
      </div>

      {/* content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
            {responsible}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
            {cfg.label}
          </span>
          {a.businesses?.name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <Building2 className="w-2.5 h-2.5" />
              {a.businesses.name}
            </span>
          )}
          <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap">
            {relativeTime(a.timestamp)}
          </span>
        </div>

        {/* detail */}
        <p
          className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-snug"
          dangerouslySetInnerHTML={{ __html: formatDetail(parsed) }}
        />

        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
          <Clock className="w-3 h-3" />
          {new Date(a.timestamp).toLocaleString("es-AR")}
        </div>
      </div>

      {/* botón pérdida */}
      {perdidaAmount > 0 && (
        <button
          onClick={() => onAddPerdida(perdidaAmount)}
          className="shrink-0 self-center px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors shadow-sm"
        >
          + ${perdidaAmount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   FETCH
   ───────────────────────────────────────────────────────── */
async function fetchBusinesses() {
  const { data, error } = await supabase.from("businesses").select("id, name").order("name");
  if (error) { console.error(error); return []; }
  return data ?? [];
}

async function fetchActivitiesForBusiness(businessId: string, fromDate?: Date): Promise<ActivityRow[]> {
  const pageSize = 1000;
  let from = 0;
  let acc: ActivityRow[] = [];
  for (;;) {
    let q = supabase
      .from("activities")
      .select("id, business_id, details, timestamp, businesses(name)")
      .eq("business_id", businessId)
      .order("timestamp", { ascending: false })
      .range(from, from + pageSize - 1);
    if (fromDate) q = q.gte("timestamp", fromDate.toISOString());
    const { data, error } = await q;
    if (error) { console.error(error); break; }
    const batch = data ?? [];
    acc = acc.concat(batch as ActivityRow[]);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return acc;
}
/* ─────────────────────────────────────────────────────────
   MAIN
   ───────────────────────────────────────────────────────── */
export default function ActivitiesPage() {
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPerdidas, setTotalPerdidas] = useState(0);
  const [perdidasIds, setPerdidasIds] = useState<Set<string>>(new Set());

  const [selectedResponsible, setSelectedResponsible] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | 3 | 7 | 14 | 30>("all");
  const [search, setSearch] = useState("");
  const [showCount, setShowCount] = useState(50);

  // Cargar negocios al inicio (liviano)
  useEffect(() => {
    fetchBusinesses().then(setBusinesses);
  }, []);

  const load = async (businessId: string, range: "all" | 3 | 7 | 14 | 30, isRefresh = false) => {
    if (!businessId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    // reset filtros de cliente al cambiar negocio (no al refrescar ni al cambiar rango)
    if (!isRefresh) {
      setActivities([]);
      setSelectedResponsible("all");
      setSelectedDate("");
      setSelectedType("all");
      setSearch("");
      setShowCount(50);
      setTotalPerdidas(0);
      setPerdidasIds(new Set());
    }
    const fromDate = range !== "all"
      ? new Date(Date.now() - range * 86_400_000)
      : undefined;
    const rows = await fetchActivitiesForBusiness(businessId, fromDate);
    setActivities(rows);
    setHasFetched(true);
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  // Re-fetch cuando cambia el rango (sin resetear filtros de cliente)
  useEffect(() => {
    if (!selectedBusinessId) return;
    setLoading(true);
    setShowCount(50);
    setTotalPerdidas(0);
    setPerdidasIds(new Set());
    const fromDate = dateRange !== "all"
      ? new Date(Date.now() - dateRange * 86_400_000)
      : undefined;
    fetchActivitiesForBusiness(selectedBusinessId, fromDate).then((rows) => {
      setActivities(rows);
      setLoading(false);
    });
  }, [dateRange, selectedBusinessId]);

  const handleBusinessChange = (id: string) => {
    setSelectedBusinessId(id);
    if (id) load(id, dateRange);
    else { setActivities([]); setHasFetched(false); }
  };

  /* ─── derived lists ─── */
  const responsibles = useMemo(() => {
    const names = activities.map((a) => a.details.split(" ")[0]).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [activities]);

  /* ─── filtered ─── */
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const { responsible, type } = parseActivity(a);
      const ts = new Date(a.timestamp);
      const datePart = ts.toISOString().split("T")[0];
      const lowerDetails = a.details.toLowerCase();
      const lowerSearch = search.toLowerCase();

      if (selectedResponsible !== "all" && responsible !== selectedResponsible) return false;
      if (selectedDate && datePart !== selectedDate) return false;
      if (selectedType !== "all" && type !== selectedType) return false;
      if (search && !lowerDetails.includes(lowerSearch)) return false;
      return true;
    });
  }, [activities, selectedResponsible, selectedDate, selectedType, search]);

  /* ─── stats ─── */
  const stats = useMemo(() => {
    const perdidas = filtered.filter((a) => parseActivity(a).type === "perdida");
    const totalPerd = perdidas.reduce((s, a) => s + parseActivity(a).perdidaAmount, 0);
    const stockUp   = filtered.filter((a) => parseActivity(a).type === "stock_up").length;
    const stockDown = filtered.filter((a) => parseActivity(a).type === "stock_down").length;
    const scanMiss  = filtered.filter((a) => parseActivity(a).type === "scan_miss").length;
    const uniqueUsers = new Set(filtered.map((a) => parseActivity(a).responsible)).size;
    return { perdidas: perdidas.length, totalPerd, stockUp, stockDown, scanMiss, uniqueUsers };
  }, [filtered]);

  const activeFilters = [
    selectedResponsible !== "all",
    !!selectedDate, selectedType !== "all", !!search,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedResponsible("all");
    setSelectedDate("");
    setSelectedType("all");
    setSearch("");
  };

  const handleAddPerdida = (id: string, amount: number) => {
    if (perdidasIds.has(id)) {
      setPerdidasIds((p) => { const n = new Set(p); n.delete(id); return n; });
      setTotalPerdidas((p) => p - amount);
    } else {
      setPerdidasIds((p) => new Set(p).add(id));
      setTotalPerdidas((p) => p + amount);
    }
  };

  const visible = filtered.slice(0, showCount);
  const hasMore = filtered.length > showCount;

  /* ─── loading ─── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      <p className="text-sm text-slate-400">Cargando actividades…</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ══ HEADER ══ */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Registro de actividades
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Historial de acciones por usuario y local
            </p>
          </div>
          {selectedBusinessId && (
            <button
              onClick={() => load(selectedBusinessId, dateRange, true)}
              disabled={refreshing}
              className="self-start inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          )}
        </div>

        {/* Paso 1: Período — siempre visible */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="shrink-0">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Paso 1 — Período a consultar
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { v: "all", l: "Todo" },
                  { v: 3,     l: "3 días" },
                  { v: 7,     l: "7 días" },
                  { v: 14,    l: "14 días" },
                  { v: 30,    l: "30 días" },
                ] as { v: "all" | 3 | 7 | 14 | 30; l: string }[]).map(({ v, l }) => (
                  <button
                    key={String(v)}
                    onClick={() => { setDateRange(v); setSelectedDate(""); }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      dateRange === v
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Flecha separadora visible en desktop */}
            <div className="hidden sm:flex items-center text-slate-300 dark:text-slate-600 text-lg font-light px-2">→</div>

            {/* Paso 2: Local — aparece después de elegir período */}
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium mb-2 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Paso 2 — Elegí el local
              </div>
              <select
                value={selectedBusinessId}
                onChange={(e) => handleBusinessChange(e.target.value)}
                className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 w-full sm:w-auto"
              >
                <option value="">Seleccioná un local…</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ══ EMPTY STATE ══ */}
      {!selectedBusinessId && (
        <div className="flex flex-col items-center justify-center h-52 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 gap-3">
          <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">
            {dateRange === "all"
              ? "Elegí un período y luego un local para ver las actividades"
              : "Ahora elegí un local para cargar las actividades"}
          </p>
        </div>
      )}

      {/* ══ STATS ══ */}
      {hasFetched && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total filtradas",   value: filtered.length,  color: "text-slate-800 dark:text-slate-100",    bg: "bg-slate-50 dark:bg-slate-800" },
          { label: "Stock subió ↑",     value: stats.stockUp,    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Stock bajó ↓",      value: stats.stockDown,  color: "text-orange-600 dark:text-orange-400",   bg: "bg-orange-50 dark:bg-orange-900/20" },
          { label: "Sin resultado scan", value: stats.scanMiss,  color: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-900/20" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl border border-slate-200 dark:border-slate-700 ${bg} px-4 py-3`}>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">{label}</div>
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
      </div>}

      {/* ══ PÉRDIDAS TRACKER ══ */}
      {hasFetched && (stats.perdidas > 0 || totalPerdidas > 0) && (
        <div className="rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 px-5 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 grid place-items-center shrink-0">
                <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-red-500 dark:text-red-400 font-medium">
                  {stats.perdidas} pérdidas en el filtro actual
                </div>
                <div className="text-lg font-bold text-red-700 dark:text-red-300 tabular-nums">
                  Total acumulado seleccionado: ${ totalPerdidas.toLocaleString("es-AR", { maximumFractionDigits: 0 }) }
                </div>
              </div>
            </div>
            {totalPerdidas > 0 && (
              <button
                onClick={() => { setTotalPerdidas(0); setPerdidasIds(new Set()); }}
                className="shrink-0 text-xs px-3 py-1.5 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                Limpiar acumulado
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-red-500 dark:text-red-400 opacity-80">
            Hacé click en los botones de pérdida de cada actividad para acumular el total.
          </p>
        </div>
      )}

      {/* ══ FILTROS ══ */}
      {hasFetched && <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {activeFilters > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                {activeFilters}
              </span>
            )}
          </div>
          {activeFilters > 0 && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X className="w-3.5 h-3.5" />
              Limpiar todo
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <FilterPill
            label="Responsable" value={selectedResponsible} icon={User}
            onChange={setSelectedResponsible}
            options={[
              { value: "all", label: "Todos" },
              ...responsibles.map((r) => ({ value: r, label: r })),
            ]}
          />
          <FilterPill
            label="Tipo" value={selectedType} icon={Activity}
            onChange={setSelectedType}
            options={[
              { value: "all",         label: "Todos" },
              { value: "stock_up",    label: "Stock subió ↑" },
              { value: "stock_down",  label: "Stock bajó ↓" },
              { value: "scan_found",  label: "Escaneo encontrado" },
              { value: "scan_miss",   label: "Escaneo sin resultado" },
              { value: "scan_multi",  label: "Escaneo múltiple" },
              { value: "sel_scanner", label: "Selección scanner" },
              { value: "sel_manual",  label: "Selección manual" },
              { value: "perdida",     label: "Pérdidas" },
              { value: "other",       label: "Otros" },
            ]}
          />
          <div className="flex flex-col gap-1 min-w-[140px] flex-1">
            <label className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Fecha
            </label>
            <input type="date" value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setDateRange("all"); }}
              className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[200px] flex-1">
            <label className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
              <Search className="w-3 h-3" />
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Texto libre…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>}

      {/* ══ LISTA ══ */}
      {hasFetched && <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* barra de estado */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Mostrando <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.min(showCount, filtered.length)}</span> de{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span> actividades
            {activeFilters > 0 && ` (${activities.length} total)`}
          </span>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Activity className="w-3.5 h-3.5" />
            {activities.length} en base de datos
          </div>
        </div>

        {/* actividades */}
        {visible.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((a) => {
              const { perdidaAmount } = parseActivity(a);
              return (
                <ActivityItem
                  key={a.id}
                  a={a}
                  isSelected={perdidasIds.has(a.id)}
                  onAddPerdida={(amount) => handleAddPerdida(a.id, amount)}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400">No se encontraron actividades con estos filtros</p>
            {activeFilters > 0 && (
              <button onClick={clearFilters}
                className="text-xs text-indigo-500 hover:text-indigo-700 underline">
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* load more */}
        {hasMore && (
          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">{filtered.length - showCount} actividades más</span>
            <button
              onClick={() => setShowCount((n) => n + 50)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Cargar 50 más
            </button>
          </div>
        )}
      </div>}
    </div>
  );
}