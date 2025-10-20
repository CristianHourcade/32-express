"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ========= Helpers ========= */

// Mes completo en hora local
function monthRange(offset = 0) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

const CATEGORIES = [
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
];

function extractCategory(name: string) {
  const cat = name.trim().split(" ")[0].toUpperCase();
  return CATEGORIES.includes(cat) ? cat : "SIN CATEGORIA";
}

const formatPrice = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ========= Fetch genérico paginado ========= */
async function fetchAll(
  query: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>
) {
  const pageSize = 1000;
  let page = 0;
  const all: any[] = [];
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await query(from, to);
    if (error) {
      console.error(error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

/* ========= Queries ========= */
const loadBusinesses = async () => {
  const { data, error } = await supabase.from("businesses").select("id,name").order("name");
  return error ? [] : data ?? [];
};
const loadSaleItemsByBizAndMonth = async (businessId: string, from: Date, to: Date) =>
  fetchAll((lo, hi) =>
    supabase
      .from("sale_items")
      .select(`
        sale_id,
        total,
        product_master_id,
        promotion_id,
        sales!inner(id)         -- fuerza INNER JOIN con sales
      `)
      .eq("sales.business_id", businessId)    // filtro en la tabla relacionada
      .gte("sales.timestamp", from.toISOString())
      .lt("sales.timestamp", to.toISOString())
      .order("sale_id", { ascending: false })
      .range(lo, hi)
  );

// Igual que tu Dashboard: sales del mes (sin joins), luego traemos sale_items por IDs
const loadSales = async (bizId: string, from: Date, to: Date) =>
  fetchAll((lo, hi) =>
    supabase
      .from("sales")
      .select("*")
      .eq("business_id", bizId)
      .gte("timestamp", from.toISOString())
      .lt("timestamp", to.toISOString())
      .order("timestamp", { ascending: false })
      .range(lo, hi)
  );

const loadSaleItemsBySaleIds = async (saleIds: string[]) => {
  if (!saleIds.length) return [];
  // Batches por si hay muchas
  const batchSize = 1000;
  const batches: Promise<any>[] = [];
  for (let i = 0; i < saleIds.length; i += batchSize) {
    const ids = saleIds.slice(i, i + batchSize);
    batches.push(
      supabase
        .from("sale_items")
        .select("sale_id, total, product_master_id, promotion_id")
        .in("sale_id", ids)
    );
  }
  const results = await Promise.all(batches);
  return results.flatMap((r) => (r.data ?? []));
};

const loadProductMasters = async () =>
  fetchAll((from, to) =>
    supabase
      .from("products_master")
      .select("id,name,default_purchase,default_selling")
      .range(from, to)
  );

const loadPromotions = async () =>
  fetchAll((from, to) => supabase.from("promos").select("id,name").range(from, to));

/* ========= Página ========= */
type Mode = "month" | "last3" | "last7" | "last14";

export default function CategoryRevenuePage() {
  // ——— Mes seleccionado (estilo Dashboard) ———
  const [mode, setMode] = useState<Mode>("month");
  const [monthOffset, setMonthOffset] = useState(0);
  // Rango activo según el modo elegido
  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (mode === "month") return monthRange(monthOffset);
    if (mode === "last3") return lastNDays(3);
    if (mode === "last7") return lastNDays(7);
    return lastNDays(14); // last14
  }, [mode, monthOffset]);

  // Etiqueta visible del rango actual
  const rangeLabel = useMemo(() => {
    if (mode === "month") {
      return rangeStart.toLocaleString("es-ES", { month: "long", year: "numeric" });
    }
    const prefix =
      mode === "last3" ? "Últimos 3 días" :
        mode === "last7" ? "Últimos 7 días" :
          "Últimos 14 días";
    return `${prefix} · ${formatShortRange(rangeStart, rangeEnd)}`;
  }, [mode, rangeStart, rangeEnd]);


  // ——— Estados base ———
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [selectedBiz, setSelectedBiz] = useState("");
  const [loading, setLoading] = useState(false);

  // Data del mes (ventas + items)
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);

  // Mapas de nombres
  const [productMap, setProductMap] = useState<Map<string, string>>(new Map());
  const [promotionMap, setPromotionMap] = useState<Map<string, string>>(new Map());
  const [productCostMap, setProductCostMap] = useState<Map<string, number>>(new Map());
  const [productSellMap, setProductSellMap] = useState<Map<string, number>>(new Map());

  // Modal top productos de la categoría
  const [showModal, setShowModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  // Estado del modal: ahora incluye profit y marginPct
  const [modalItems, setModalItems] = useState<
    Array<{
      name: string;
      qty: number;
      unitPriceAvg: number;        // precio unit. de venta (prom. ponderado)
      purchaseUnitAvg: number | null;// precio unit. compra (prom. ponderado si hay datos)
      totalValue: number;          // facturación (ingresos)
      profit: number | null;         // ingresos - costo (null si falta costo)
      marginPct: number | null;      // profit / ingresos * 100 (null si falta costo o ingresos=0)
    }>
  >([]);

  // Rango "últimos N días" en hora local (hoy exclusivo del límite superior)
  function lastNDays(n: number) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0); // mañana 00:00
    const start = new Date(end);
    start.setDate(end.getDate() - n);
    return { start, end };
  }

  function formatShortRange(start: Date, end: Date) {
    const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
    const s = start.toLocaleDateString("es-AR", opts);
    const e = new Date(end.getTime() - 1).toLocaleDateString("es-AR", opts); // end es exclusivo
    return `${s} – ${e}`;
  }

  // Cargar negocios al inicio
  useEffect(() => {
    (async () => setBusinesses(await loadBusinesses()))();
  }, []);

  // Cargar data del mes según negocio y mes
  useEffect(() => {
    if (!selectedBiz) return;
    (async () => {
      setLoading(true);
      try {
        // 1) Ventas del mes (como Dashboard)
        const salesMonth = await loadSales(selectedBiz, rangeStart, rangeEnd);

        // 2) Items de esas ventas
        const items = await loadSaleItemsByBizAndMonth(selectedBiz, rangeStart, rangeEnd);


        // 3) Maestros de nombres
        const [masters, promos] = await Promise.all([loadProductMasters(), loadPromotions()]);
        const productMapTemp = new Map<string, string>();
        const productCostTemp = new Map<string, number>();
        const productSellTemp = new Map<string, number>();

        masters.forEach((m: any) => {
          productMapTemp.set(m.id, m.name);
          if (m.default_purchase != null)
            productCostTemp.set(m.id, Number(m.default_purchase));
          if (m.default_selling != null)
            productSellTemp.set(m.id, Number(m.default_selling));
        });

        setProductMap(productMapTemp);
        setProductCostMap(productCostTemp);
        setProductSellMap(productSellTemp); // ← nuevo

        const promoMapTemp = new Map<string, string>();
        promos.forEach((p: any) => promoMapTemp.set(p.id, p.name));

        setSales(salesMonth);
        setSaleItems(items);
        setProductMap(productMapTemp);
        setPromotionMap(promoMapTemp);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedBiz, rangeStart, rangeEnd]);

  // ——— Summary por categoría (mes completo) ———
  // ——— Summary por categoría (mes completo) ———
  const { rows, totals } = useMemo(() => {
    type Acc = {
      revenue: number;
      cash: number;
      transfer: number;
      card: number;
      revForMargin: number;   // ventas consideradas para margen
      costForMargin: number;  // costos correspondientes
    };

    const summary = new Map<string, Acc>();
    let totalRevenueAll = 0;

    // Index rápido: ventas por id
    const saleById = new Map<string, any>(sales.map((s) => [s.id, s]));

    saleItems.forEach((item: any) => {
      const sale = saleById.get(item.sale_id);
      if (!sale) return;

      // método de pago
      const pm = (sale.payment_method || "").toLowerCase();
      const method = pm === "mercadopago" ? "transfer" : pm;

      // categoría
      let cat: string;
      if (item.promotion_id) {
        cat = "PROMO";
      } else {
        const name = productMap.get(item.product_master_id) ?? "—";
        cat = extractCategory(name);
      }

      if (!summary.has(cat)) {
        summary.set(cat, {
          revenue: 0, cash: 0, transfer: 0, card: 0,
          revForMargin: 0, costForMargin: 0
        });
      }
      const acc = summary.get(cat)!;

      // métricas de línea SIN pedir a la DB
      const { qty, unitPrice, unitCost, hasValidCost, revenue } =
        resolveLine(item, productSellMap, productCostMap);

      // ventas totales
      acc.revenue += revenue;
      totalRevenueAll += revenue;

      if (method === "cash" || method === "efectivo") acc.cash += revenue;
      else if (method === "transfer") acc.transfer += revenue;
      else if (method === "card" || method === "tarjeta") acc.card += revenue;

      // margen: solo productos (no PROMO), costo válido (>=10) y precio venta > 0
      if (!item.promotion_id && hasValidCost && unitPrice > 0 && qty > 0) {
        acc.revForMargin += revenue;
        acc.costForMargin += (unitCost as number) * qty;
      }
    });

    // asegurar PROMO
    if (!summary.has("PROMO")) {
      summary.set("PROMO", { revenue: 0, cash: 0, transfer: 0, card: 0, revForMargin: 0, costForMargin: 0 });
    }

    const resultRows = Array.from(summary.entries())
      .map(([category, v]) => {
        const marginPct =
          v.revForMargin > 0
            ? ((v.revForMargin - v.costForMargin) / v.revForMargin) * 100
            : null;
        return {
          category,
          revenue: v.revenue,
          cash: v.cash,
          transfer: v.transfer,
          card: v.card,
          percent: totalRevenueAll ? (v.revenue / totalRevenueAll) * 100 : 0,
          marginPct,
          replenishmentCost: v.costForMargin, // ← NUEVO
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // totales básicos
    const totalsBase = resultRows.reduce(
      (acc, cur) => {
        acc.revenue += cur.revenue;
        acc.cash += cur.cash;
        acc.transfer += cur.transfer;
        acc.card += cur.card;
        return acc;
      },
      { revenue: 0, cash: 0, transfer: 0, card: 0 }
    );

    // margen global ponderado con la MISMA regla (solo líneas con costo válido)
    let revForMarginAll = 0, costForMarginAll = 0;
    summary.forEach((v) => {
      revForMarginAll += v.revForMargin;
      costForMarginAll += v.costForMargin;
    });
    const totalMarginPct =
      revForMarginAll > 0 ? ((revForMarginAll - costForMarginAll) / revForMarginAll) * 100 : null;

    return {
      rows: resultRows,
      totals: {
        ...totalsBase,
        marginPct: totalMarginPct,
        replenishmentCost: costForMarginAll, // ← NUEVO
      },
    };
  }, [sales, saleItems, productMap, productSellMap, productCostMap, promotionMap]);


  // Top 10 de una categoría (mes completo)
  const handleCategoryClick = (category: string) => {
    const saleById = new Map<string, any>(sales.map((s) => [s.id, s]));
    type Agg = {
      name: string;
      qty: number;
      revenue: number;
      costSum: number;         // suma de costos (si hay dato)
      unitPriceSum: number;    // para promedio ponderado de venta
      hasCost: boolean;        // <- NUEVO

    };

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

      // unit price de venta: item.unit_price || item.price || derivado
      const derivedUnit = qty ? revenue / qty : undefined; // undefined permite que funcione el ?? siguiente
      const fallbackSell = productSellMap.get(item.product_master_id); // puede ser undefined

      const unitPrice = Number(
        (item.unit_price ?? item.price ?? derivedUnit ?? fallbackSell ?? 0)
      );

      // unit cost de compra desde products_master.default_purchase
      const unitCost = productCostMap.get(item.product_master_id);
      const lineCost = unitCost != null ? unitCost * qty : 0;

      if (!agg.has(name)) {
        agg.set(name, { name, qty: 0, revenue: 0, costSum: 0, unitPriceSum: 0, hasCost: false });
      }
      const a = agg.get(name)!;
      a.qty += qty;
      a.revenue += revenue;
      a.unitPriceSum += unitPrice * qty;

      if (unitCost != null) {         // aunque sea 0, cuenta como “tengo costo”
        a.costSum += unitCost * qty;
        a.hasCost = true;
      }

    });

    const rows = Array.from(agg.values())
      .map((x) => {
        const unitPriceAvg = x.qty ? x.unitPriceSum / x.qty : 0;
        const purchaseUnitAvg = x.hasCost ? (x.costSum / (x.qty || 1)) : null;

        const totalValue = x.revenue;
        const profit = x.hasCost ? (totalValue - x.costSum) : null;

        const marginPct = (x.hasCost && unitPriceAvg > 0)
          ? ((unitPriceAvg - (purchaseUnitAvg as number)) / unitPriceAvg) * 100
          : null;

        return {
          name: x.name,
          qty: x.qty,
          unitPriceAvg,
          purchaseUnitAvg,
          totalValue,
          profit,
          marginPct,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);



    setModalCategory(category);
    setModalItems(rows);
    setShowModal(true);
  };


  // Resuelve métricas de la línea SIN pedir más a la DB
  function resolveLine(
    item: any,
    productSellMap: Map<string, number>,
    productCostMap: Map<string, number>
  ) {
    const revenue = Number(item.total) || 0;

    // Precio de venta unitario: usa el que venga en item, si no el default_selling
    const unitSellFallback = productSellMap.get(item.product_master_id);
    const unitPrice = Number(item.unit_price ?? item.price ?? unitSellFallback ?? 0);

    // Cantidad: si no viene, la inferimos (total / unitPrice). Si no hay forma, 1.
    const qtyRaw =
      item.quantity != null ? Number(item.quantity)
        : unitPrice > 0 ? revenue / unitPrice
          : 1;

    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;

    // Costo unitario desde products_master (default_purchase)
    const unitCost = productCostMap.get(item.product_master_id);
    const hasValidCost = unitCost != null && unitCost >= 10;

    return { qty, unitPrice, unitCost, hasValidCost, revenue };
  }



  return (
    <div className="p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Facturación por categoría</h1>
        {selectedBiz && (
          <p className="text-lg text-sky-600">
            {businesses.find((b) => b.id === selectedBiz)?.name}
          </p>
        )}
      </header>

      {/* Filtros: negocio + navegación mensual (igual espíritu del Dashboard) */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Negocio */}
        <select
          value={selectedBiz}
          onChange={(e) => setSelectedBiz(e.target.value)}
          className="rounded border px-3 py-1 text-xs"
        >
          <option value="">Negocio</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Selector de rango */}
        <div className="flex items-center gap-1">
          {[
            { k: "month", label: "Mes" },
            { k: "last3", label: "3d" },
            { k: "last7", label: "7d" },
            { k: "last14", label: "14d" },
          ].map((opt) => (
            <button
              key={opt.k}
              onClick={() => {
                setMode(opt.k as Mode);
                if (opt.k !== "month") setMonthOffset(0); // resetea offset al salir de "Mes"
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition
          ${mode === opt.k
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
              title={`Ver ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Navegación mensual (solo activa en modo Mes) */}
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-full hover:bg-slate-200 disabled:opacity-40"
            onClick={() => setMonthOffset((o) => o - 1)}
            disabled={loading || mode !== "month"}
            title="Mes anterior"
          >
            ‹
          </button>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
            {rangeLabel}
          </span>
          <button
            className="p-2 rounded-full hover:bg-slate-200 disabled:opacity-40"
            onClick={() => setMonthOffset((o) => o + 1)}
            disabled={loading || mode !== "month"}
            title="Mes siguiente"
          >
            ›
          </button>
        </div>
      </div>


      <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b text-xs uppercase text-slate-600 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">Costo reposición</th>
                <th className="px-4 py-3 text-right font-semibold">Margen</th>
                <th className="px-4 py-3 text-right font-semibold">Efectivo</th>
                <th className="px-4 py-3 text-right font-semibold">Transfer</th>
                <th className="px-4 py-3 text-right font-semibold">Tarjeta</th>
                <th className="px-4 py-3 text-right font-semibold">% Total</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">Cargando…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">Sin datos</td>
                </tr>
              ) : (
                rows.map((cat, i) => (
                  <tr
                    key={cat.category}
                    className={`hover:bg-slate-50 cursor-pointer transition ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                    onClick={() => handleCategoryClick(cat.category)}
                  >
                    <td className="px-4 py-2.5">{cat.category}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">$ {formatPrice(cat.revenue)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {cat.replenishmentCost > 0 ? `$ ${formatPrice(cat.replenishmentCost)}` : "—"}
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      {cat.marginPct != null ? (
                        <span
                          className={`inline-flex items-center justify-end min-w-[72px] px-2 py-1 rounded-lg text-xs font-semibold
                      ${cat.marginPct >= 40
                              ? "bg-emerald-100 text-emerald-700"
                              : cat.marginPct >= 20
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"}`}
                          title="Margen promedio ponderado por ventas (solo productos con costo ≥ 10)"
                        >
                          {cat.marginPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-green-700">$ {formatPrice(cat.cash)}</td>
                    <td className="px-4 py-2.5 text-right text-purple-700">$ {formatPrice(cat.transfer)}</td>
                    <td className="px-4 py-2.5 text-right text-blue-700">$ {formatPrice(cat.card)}</td>
                    <td className="px-4 py-2.5 text-right">{cat.percent.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot className="bg-slate-100/70 border-t text-sm font-semibold">
              <tr>
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-right">$ {formatPrice(totals.revenue)}</td>
                <td className="px-4 py-3 text-right">
                  {totals.replenishmentCost > 0 ? `$ ${formatPrice(totals.replenishmentCost)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {totals.marginPct != null ? `${totals.marginPct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-green-700">
                  $ {formatPrice(rows.reduce((a, r) => a + r.cash, 0))}
                </td>
                <td className="px-4 py-3 text-right text-purple-700">
                  $ {formatPrice(rows.reduce((a, r) => a + r.transfer, 0))}
                </td>
                <td className="px-4 py-3 text-right text-blue-700">
                  $ {formatPrice(rows.reduce((a, r) => a + r.card, 0))}
                </td>
                <td className="px-4 py-3 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>


      {/* Modal Top 10 Productos */}
      {showModal && (
        <div className="fixed inset-0 z-50">
          {/* Overlay con blur */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Panel */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-[95vw] max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight">
                    Productos en <span className="text-sky-700">{modalCategory}</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click en el fondo para cerrar • Ordenado por facturación
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition"
                  title="Cerrar"
                >
                  <span className="text-slate-600">Cerrar</span>
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>

              {/* Tabla scrolleable */}
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b z-10">
                    <tr className="text-xs uppercase text-slate-600">
                      <th className="px-4 py-3 text-left font-semibold">Producto</th>
                      <th className="px-4 py-3 text-right font-semibold">Precio unit.</th>
                      <th className="px-4 py-3 text-right font-semibold">Cant.</th>
                      <th className="px-4 py-3 text-right font-semibold">Precio compra</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor total</th>
                      <th className="px-4 py-3 text-right font-semibold">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modalItems.map((item, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-slate-50 transition ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                          }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="max-w-[32rem] truncate">{item.name}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right">$ {formatPrice(item.unitPriceAvg)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{item.qty}</td>
                        <td className="px-4 py-2.5 text-right">
                          {item.purchaseUnitAvg == null ? (
                            <span className="text-slate-400">—</span>
                          ) : item.purchaseUnitAvg <= 10 ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-semibold"
                              title="Precio de compra en 0. Completar en productos_master"
                            >
                              ⚠ completar costo
                            </span>
                          ) : (
                            `$ ${formatPrice(item.purchaseUnitAvg)}`
                          )}
                        </td>

                        <td className="px-4 py-2.5 text-right font-semibold">$ {formatPrice(item.totalValue)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {item.marginPct != null ? (
                            <span
                              className={`inline-flex items-center justify-end min-w-[72px] px-2 py-1 rounded-lg text-xs font-semibold
                          ${item.marginPct >= 40
                                  ? "bg-emerald-100 text-emerald-700"
                                  : item.marginPct >= 20
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              title={`Profit: $ ${formatPrice(item.profit ?? 0)}`}
                            >
                              {item.marginPct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Totales del modal (pie) */}
                  <tfoot className="bg-slate-100/70 border-t">
                    {(() => {
                      const totalRevenue = modalItems.reduce((a, x) => a + x.totalValue, 0);

                      // Filtramos productos válidos: tienen precio de compra ≥ 10
                      const validForMargin = modalItems.filter(
                        (x) =>
                          x.purchaseUnitAvg != null &&
                          x.purchaseUnitAvg >= 10 &&
                          x.unitPriceAvg > 0
                      );

                      const revenueWithCost = validForMargin.reduce((a, x) => a + x.totalValue, 0);
                      const totalCostWithCost = validForMargin.reduce(
                        (a, x) => a + (x.purchaseUnitAvg as number) * x.qty,
                        0
                      );

                      // Margen ponderado (solo con productos válidos)
                      const weightedMarginPct =
                        revenueWithCost > 0
                          ? ((revenueWithCost - totalCostWithCost) / revenueWithCost) * 100
                          : null;

                      return (
                        <tr className="text-sm font-semibold">
                          <td className="px-4 py-3 text-left">TOTAL</td>
                          <td className="px-4 py-3 text-right">—</td>
                          <td className="px-4 py-3 text-right">—</td>
                          <td className="px-4 py-3 text-right">—</td>
                          <td className="px-4 py-3 text-right">$ {formatPrice(totalRevenue)}</td>
                          <td className="px-4 py-3 text-right">
                            {weightedMarginPct != null ? `${weightedMarginPct.toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })()}

                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
