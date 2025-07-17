"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// Paginación genérica
async function fetchAll(
  query: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>
) {
  const pageSize = 1000;
  let page = 0;
  const all: any[] = [];
  while (true) {
    const { data, error } = await query(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

// Carga negocios
const loadBusinesses = async () => {
  const { data, error } = await supabase.from("businesses").select("id,name").order("name");
  return error ? [] : data ?? [];
};

// Carga ventas sin join a productos
const loadSales = async (bizId: string, days: number) => {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return fetchAll((from, to) =>
    supabase
      .from("sales")
      .select(`
        payment_method,
        sale_items(total, product_master_id)
      `)
      .eq("business_id", bizId)
      .gte("timestamp", since)
      .range(from, to)
  );
};

// Carga maestro de productos
const loadProductMasters = async () =>
  fetchAll((from, to) =>
    supabase.from("products_master").select("id,name").range(from, to)
  );

// Categorías fijas
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
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TopProductsPage() {
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [selectedBiz, setSelectedBiz] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [productMap, setProductMap] = useState<Map<string, string>>(new Map());
  const [daysFilter, setDaysFilter] = useState(7);
  const [loading, setLoading] = useState(false);

  // Modal top productos
  const [showModal, setShowModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalItems, setModalItems] = useState<Array<{ name: string; revenue: number }>>([]);

  // Inicial: cargar negocios
  useEffect(() => { (async () => setBusinesses(await loadBusinesses()))(); }, []);

  // Al cambiar negocio o días: cargar ventas + maestros
  useEffect(() => {
    if (!selectedBiz) return;
    (async () => {
      setLoading(true);
      const [sals, masters] = await Promise.all([
        loadSales(selectedBiz, daysFilter),
        loadProductMasters(),
      ]);
      setSales(sals);
      const map = new Map<string, string>();
      masters.forEach((m: any) => map.set(m.id, m.name));
      setProductMap(map);
      setLoading(false);
    })();
  }, [selectedBiz, daysFilter]);

  // Resumen por categoría
  const { rows, totals } = useMemo(() => {
    const summary = new Map<string, { revenue: number; cash: number; transfer: number; card: number }>();
    let totalRevenue = 0;

    sales.forEach((sale) => {
      const method = sale.payment_method === "mercadopago" ? "transfer" : sale.payment_method;
      sale.sale_items?.forEach((item: any) => {
        const name = productMap.get(item.product_master_id) ?? "—";
        const cat = extractCategory(name);
        const value = item.total;
        totalRevenue += value;
        if (!summary.has(cat)) summary.set(cat, { revenue: 0, cash: 0, transfer: 0, card: 0 });
        const entry = summary.get(cat)!;
        entry.revenue += value;
        entry[method] += value;
      });
    });

    const resultRows = Array.from(summary.entries()).map(([category, v]) => ({
      category,
      ...v,
      percent: totalRevenue ? (v.revenue / totalRevenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

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
  }, [sales, productMap]);

  // Maneja click en categoría
  const handleCategoryClick = (category: string) => {
    const prodSummary = new Map<string, number>();
    sales.forEach((sale) => {
      sale.sale_items?.forEach((item: any) => {
        const name = productMap.get(item.product_master_id) ?? "—";
        if (extractCategory(name) === category) {
          prodSummary.set(name, (prodSummary.get(name) || 0) + item.total);
        }
      });
    });
    const top10 = Array.from(prodSummary.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    setModalCategory(category);
    setModalItems(top10);
    setShowModal(true);
  };

  return (
    <div className="p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Facturación por categoría</h1>
        {selectedBiz && <p className="text-lg text-sky-600">{businesses.find(b => b.id === selectedBiz)?.name}</p>}
      </header>

      <div className="flex gap-3">
        <select value={selectedBiz} onChange={e => setSelectedBiz(e.target.value)} className="rounded border px-3 py-1 text-xs">
          <option value="">Negocio</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={daysFilter} onChange={e => setDaysFilter(+e.target.value)} className="rounded border px-3 py-1 text-xs">
          {[1,3,7,14,30].map(d => <option key={d} value={d}>Últimos {d} días</option>)}
        </select>
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
              <tr><td colSpan={6} className="py-4 text-center">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-4 text-center">Sin datos</td></tr>
            ) : (
              rows.map(cat => (
                <tr key={cat.category} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleCategoryClick(cat.category)}>
                  <td className="px-4 py-2">{cat.category}</td>
                  <td className="px-4 py-2 text-right font-semibold">$ {formatPrice(cat.revenue)}</td>
                  <td className="px-4 py-2 text-right text-green-700">$ {formatPrice(cat.cash)}</td>
                  <td className="px-4 py-2 text-right text-purple-700">$ {formatPrice(cat.transfer)}</td>
                  <td className="px-4 py-2 text-right text-blue-700">$ {formatPrice(cat.card)}</td>
                  <td className="px-4 py-2 text-right">{cat.percent.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-200 text-sm font-semibold">
            <tr>
              <td className="px-4 py-2">TOTAL</td>
              <td className="px-4 py-2 text-right">$ {formatPrice(totals.revenue)}</td>
              <td className="px-4 py-2 text-right text-green-700">$ {formatPrice(totals.cash)}</td>
              <td className="px-4 py-2 text-right text-purple-700">$ {formatPrice(totals.transfer)}</td>
              <td className="px-4 py-2 text-right text-blue-700">$ {formatPrice(totals.card)}</td>
              <td className="px-4 py-2 text-right">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Modal Top 10 Productos */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-[90%] max-w-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Top 10 en {modalCategory}</h2>
              <button onClick={() => setShowModal(false)} className="text-xl font-semibold">×</button>
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
                      <td className="py-1 text-right font-semibold">$ {formatPrice(item.revenue)}</td>
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
