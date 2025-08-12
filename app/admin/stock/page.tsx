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
  fetchAll((from, to) => supabase.from("products_master").select("id,name").range(from, to));

const loadPromotions = async () =>
  fetchAll((from, to) => supabase.from("promos").select("id,name").range(from, to));

/* ========= Página ========= */
type Mode = "month";
export default function CategoryRevenuePage() {
  // ——— Mes seleccionado (estilo Dashboard) ———
  const [monthOffset, setMonthOffset] = useState(0);
  const { start: monthStart, end: monthEnd } = useMemo(
    () => monthRange(monthOffset),
    [monthOffset]
  );

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

  // Modal top productos de la categoría
  const [showModal, setShowModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalItems, setModalItems] = useState<Array<{ name: string; revenue: number }>>([]);

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
        const salesMonth = await loadSales(selectedBiz, monthStart, monthEnd);

        // 2) Items de esas ventas
        const items = await loadSaleItemsByBizAndMonth(selectedBiz, monthStart, monthEnd);


        // 3) Maestros de nombres
        const [masters, promos] = await Promise.all([loadProductMasters(), loadPromotions()]);
        const productMapTemp = new Map<string, string>();
        masters.forEach((m: any) => productMapTemp.set(m.id, m.name));
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
  }, [selectedBiz, monthStart, monthEnd]);

  // ——— Summary por categoría (mes completo) ———
  const { rows, totals } = useMemo(() => {
    const summary = new Map<string, { revenue: number; cash: number; transfer: number; card: number }>();
    let totalRevenue = 0;

    // Index rápido: ventas por id
    const saleById = new Map<string, any>(sales.map((s) => [s.id, s]));

    saleItems.forEach((item: any) => {
      const sale = saleById.get(item.sale_id);
      if (!sale) return;

      // map método de pago
      const pm = (sale.payment_method || "").toLowerCase();
      const method = pm === "mercadopago" ? "transfer" : pm; // tu regla

      // nombre + categoría
      let name: string;
      let cat: string;
      if (item.promotion_id) {
        name = promotionMap.get(item.promotion_id) ?? "[PROMO]";
        cat = "PROMO";
      } else {
        name = productMap.get(item.product_master_id) ?? "—";
        cat = extractCategory(name);
      }

      const value = Number(item.total) || 0;
      totalRevenue += value;

      if (!summary.has(cat)) {
        summary.set(cat, { revenue: 0, cash: 0, transfer: 0, card: 0 });
      }
      const entry = summary.get(cat)!;
      entry.revenue += value;

      if (method === "cash" || method === "efectivo") entry.cash += value;
      else if (method === "transfer") entry.transfer += value;
      else if (method === "card" || method === "tarjeta") entry.card += value;
    });

    // Aseguramos fila PROMO
    if (!summary.has("PROMO")) summary.set("PROMO", { revenue: 0, cash: 0, transfer: 0, card: 0 });

    const resultRows = Array.from(summary.entries())
      .map(([category, v]) => ({
        category,
        ...v,
        percent: totalRevenue ? (v.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const total = resultRows.reduce(
      (acc, cur) => {
        acc.revenue += cur.revenue;
        acc.cash += cur.cash;
        acc.transfer += cur.transfer;
        acc.card += cur.card;
        return acc;
      },
      { revenue: 0, cash: 0, transfer: 0, card: 0 }
    );

    return { rows: resultRows, totals: total };
  }, [sales, saleItems, productMap, promotionMap]);

  // Top 10 de una categoría (mes completo)
  const handleCategoryClick = (category: string) => {
    const saleById = new Map<string, any>(sales.map((s) => [s.id, s]));
    const prodSummary = new Map<string, number>();

    saleItems.forEach((item: any) => {
      const sale = saleById.get(item.sale_id);
      if (!sale) return;

      let name: string;
      let isMatch = false;

      if (item.promotion_id) {
        name = promotionMap.get(item.promotion_id) ?? "[PROMO]";
        isMatch = category === "PROMO";
      } else {
        name = productMap.get(item.product_master_id) ?? "—";
        isMatch = extractCategory(name) === category;
      }

      if (isMatch) {
        const value = Number(item.total) || 0;
        prodSummary.set(name, (prodSummary.get(name) || 0) + value);
      }
    });

    const top10 = Array.from(prodSummary.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    setModalCategory(category);
    setModalItems(top10);
    setShowModal(true);
  };

  const monthLabel = monthStart.toLocaleString("es-ES", { month: "long", year: "numeric" });

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

        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-full hover:bg-slate-200 disabled:opacity-40"
            onClick={() => setMonthOffset((o) => o - 1)}
            disabled={loading}
            title="Mes anterior"
          >
            ‹
          </button>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
            {monthLabel}
          </span>
          <button
            className="p-2 rounded-full hover:bg-slate-200 disabled:opacity-40"
            onClick={() => setMonthOffset((o) => o + 1)}
            disabled={loading}
            title="Mes siguiente"
          >
            ›
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Categoría</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Efectivo</th>
              <th className="px-4 py-2 text-right">Transfer</th>
              <th className="px-4 py-2 text-right">Tarjeta</th>
              <th className="px-4 py-2 text-right">% Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-4 text-center">
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center">
                  Sin datos
                </td>
              </tr>
            ) : (
              rows.map((cat) => (
                <tr
                  key={cat.category}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleCategoryClick(cat.category)}
                >
                  <td className="px-4 py-2">{cat.category}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    $ {formatPrice(cat.revenue)}
                  </td>
                  <td className="px-4 py-2 text-right text-green-700">
                    $ {formatPrice(cat.cash)}
                  </td>
                  <td className="px-4 py-2 text-right text-purple-700">
                    $ {formatPrice(cat.transfer)}
                  </td>
                  <td className="px-4 py-2 text-right text-blue-700">
                    $ {formatPrice(cat.card)}
                  </td>
                  <td className="px-4 py-2 text-right">{cat.percent.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-200 text-sm font-semibold">
            <tr>
              <td className="px-4 py-2">TOTAL</td>
              <td className="px-4 py-2 text-right">$ {formatPrice(totals.revenue)}</td>
              <td className="px-4 py-2 text-right text-green-700">
                $ {formatPrice(totals.cash)}
              </td>
              <td className="px-4 py-2 text-right text-purple-700">
                $ {formatPrice(totals.transfer)}
              </td>
              <td className="px-4 py-2 text-right text-blue-700">
                $ {formatPrice(totals.card)}
              </td>
              <td className="px-4 py-2 text-right">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Modal Top 10 Productos */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-[90%] max-w-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Top 10 en {modalCategory}</h2>
              <button onClick={() => setShowModal(false)} className="text-xl font-semibold">
                ×
              </button>
            </div>
            <div className="overflow-y-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="border-b mb-2">
                  <tr>
                    <th className="text-left pb-2">Producto</th>
                    <th className="text-right pb-2">Facturación</th>
                  </tr>
                </thead>
                <tbody>
                  {modalItems.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-100">
                      <td className="py-1">{item.name}</td>
                      <td className="py-1 text-right font-semibold">
                        $ {formatPrice(item.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
