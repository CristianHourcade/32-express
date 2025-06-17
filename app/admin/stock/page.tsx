"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Check, ClipboardCopy } from "lucide-react";

/* ═════════════ MULTI‑SELECT ═════════════ */
function MultiSelectDropdown({
  options,
  selectedOptions,
  onChange,
  placeholder = "Categorías",
}: {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = (opt: string) => {
    const next = selectedOptions.includes(opt)
      ? selectedOptions.filter((o) => o !== opt)
      : [...selectedOptions, opt];
    onChange(next);
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input min-w-[140px] rounded border shadow-sm text-xs px-2 py-1 bg-white dark:bg-slate-800"
      >
        {selectedOptions.length ? selectedOptions.join(", ") : placeholder}
      </button>

      {isOpen && (
        <div className="absolute z-[9999] mt-1 w-max min-w-[180px] rounded border bg-white dark:bg-slate-800 shadow">
          <div className="max-h-60 overflow-y-auto p-1">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═════════════ HELPERS ═════════════ */
async function fetchAll(
  query: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>
) {
  const pageSize = 1000;
  let page = 0,
    done = false,
    all: any[] = [];
  while (!done) {
    const { data, error } = await query(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      console.error(error);
      break;
    }
    if (data) {
      all = all.concat(data);
      if (data.length < pageSize) done = true;
      else page++;
    } else done = true;
  }
  return all;
}

const loadBusinesses = async () => {
  const { data, error } = await supabase.from("businesses").select("*").order("name");
  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
};

const loadSales = async (businessId: string, days: number) => {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  return fetchAll((from, to) =>
    supabase
      .from("sales")
      .select(`
        id,
        timestamp,
        payment_method,
        sale_items (
          quantity,
          promotion_id,
          total,
          product_id,
          product_master_id,
          products(name)
        )
      `)
      .eq("business_id", businessId)
      .gte("timestamp", since) // FILTRA EN LA DB, no en frontend
      .order("timestamp", { ascending: false })
      .range(from, to)
  );
};

const loadPromotionsByIds = async (ids: string[]) => {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("promotions")
    .select("id, name, price, products")
    .in("id", ids);

  if (error) {
    console.error("Error loading promotions:", error);
    return [];
  }

  return data ?? [];
};

const loadProductMasters = async () => {
  return fetchAll((from, to) =>
    supabase
      .from("products_master")
      .select("id, name")
      .range(from, to)
  );
};
const loadMasterStocks = async (businessId: string) =>
  fetchAll((from, to) =>
    supabase
      .from("business_inventory")
      .select("product_id, stock")
      .eq("business_id", businessId)
      .range(from, to)
  );


const loadProducts = async (businessId: string) =>
  fetchAll((from, to) =>
    supabase
      .from("products")
      .select("id, name, stock") // solo lo necesario
      .eq("business_id", businessId)
      .range(from, to)
  );

/* ═════════════ CONST ═════════════ */
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
  const parts = name.trim().split(" ");
  const cat = parts[0].toUpperCase();
  if (parts.length > 1 && CATEGORIES.includes(cat)) {
    return { category: cat, baseName: parts.slice(1).join(" ") };
  }
  return { category: "SIN CATEGORIA", baseName: name };
}

const formatPrice = (n: number | null | undefined) =>
  typeof n === "number" && !isNaN(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";


/* ═════════════ PAGE ═════════════ */
export default function TopProductsPage() {
  /* ---------- state ---------- */
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBiz, setSelectedBiz] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [daysFilter, setDaysFilter] = useState(7);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sortCol, setSortCol] = useState<"qty" | "revenue" | "stock">("qty");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [promotions, setPromotions] = useState<any[]>([]);
  const [productMasterMap, setProductMasterMap] = useState<Map<string, string>>(new Map());
  const [masterStockMap, setMasterStockMap] = useState<Map<string, number>>(new Map());

  /* ---------- load data ---------- */
  useEffect(() => {
    (async () => setBusinesses(await loadBusinesses()))();
  }, []);


  useEffect(() => {
    if (!selectedBiz) return;

    (async () => {
      setLoading(true);

      const [s, p, masters, inventory] = await Promise.all([
        loadSales(selectedBiz, daysFilter),
        loadProducts(selectedBiz),
        loadProductMasters(),
        loadMasterStocks(selectedBiz),
      ]);
      setSales(s);
      setProducts(p);

      const masterMap = new Map<string, string>();
      masters.forEach((m) => masterMap.set(m.id, m.name));
      setProductMasterMap(masterMap);

      const stockMap = new Map<string, number>();
      inventory.forEach((inv) => stockMap.set(inv.product_id, inv.stock));
      setMasterStockMap(stockMap);

      const promoIds = s
        .flatMap((sale) => sale.sale_items ?? [])
        .filter((item) => item.promotion_id)
        .map((item) => item.promotion_id);

      const uniquePromoIds = Array.from(new Set(promoIds));
      const promos = await loadPromotionsByIds(uniquePromoIds);
      setPromotions(promos);

      setLoading(false);
    })();
  }, [selectedBiz, daysFilter]);

  const categorySummary = useMemo(() => {
    if (!sales.length) {
      return {
        rows: [],
        totals: {
          revenue: 0,
          cash: 0,
          transfer: 0,
          card: 0,
          rappi: 0,
        },
      };
    }

    const totalRevenue = sales.reduce((sum, sale) => {
      const items = sale.sale_items ?? [];
      return sum + items.reduce((s, i) => s + i.total, 0);
    }, 0);

    const summaryMap = new Map<
      string,
      {
        revenue: number;
        percent: number;
        cash: number;
        card: number;
        transfer: number;
        rappi: number;
      }
    >();

    sales.forEach((sale) => {
      const items = sale.sale_items ?? [];
      const method = sale.payment_method === "mercadopago" ? "transfer" : sale.payment_method;

      items.forEach((item) => {
        const name =
          item.products?.name || productMasterMap.get(item.product_master_id) || "—";
        const { category } = extractCategory(name);

        if (!summaryMap.has(category)) {
          summaryMap.set(category, {
            revenue: 0,
            percent: 0,
            cash: 0,
            card: 0,
            transfer: 0,
            rappi: 0,
          });
        }

        const m = summaryMap.get(category)!;
        m.revenue += item.total;
        m[method] += item.total;
      });
    });

    const totals = {
      revenue: 0,
      cash: 0,
      transfer: 0,
      card: 0,
      rappi: 0,
    };

    summaryMap.forEach((v) => {
      totals.revenue += v.revenue;
      totals.cash += v.cash;
      totals.transfer += v.transfer;
      totals.card += v.card;
      totals.rappi += v.rappi;
    });

    return {
      rows: Array.from(summaryMap.entries())
        .map(([category, values]) => ({
          category,
          ...values,
          percent: totalRevenue ? (values.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      totals,
    };
  }, [sales, productMasterMap]);
  /* ---------- compute top ---------- */
  const top = useMemo(() => {
    if (!selectedBiz) return { products: [] };

    const now = Date.now();

    const recentSales = sales.filter(
      (s) => (now - new Date(s.timestamp).getTime()) / 86400000 <= daysFilter
    );

    const map = new Map<
      string,
      { id: string; name: string; qty: number; revenue: number; stock: number | null; cat: string }
    >();

    // 🔹 1. Ventas normales
    recentSales.forEach((sale) =>
      sale.sale_items?.forEach((item: any) => {
        if (!item.promotion_id) {
          const key = item.product_id || item.product_master_id;
          if (!key) return;

          const prod = products.find((p) => p.id === item.product_id);
          let stock: number | null = null;
          if (item.product_id) {
            stock = prod?.stock ?? null;
          } else if (item.product_master_id) {
            stock = masterStockMap.get(item.product_master_id) ?? null;
          }
          const name =
            item.products?.name ||
            productMasterMap.get(item.product_master_id) ||
            prod?.name ||
            "—";

          if (!map.has(key)) {
            const { category, baseName } = extractCategory(name);
            map.set(key, {
              id: key,
              name: baseName,
              cat: category,
              qty: 0,
              revenue: 0,
              stock,
            });
          }

          const e = map.get(key)!;
          e.qty += item.quantity;
          e.revenue += item.total;
        }
      })
    );



    // 🔹 2. Promociones
    recentSales.forEach((sale) =>
      sale.sale_items?.forEach((item: any) => {
        if (!item.promotion_id) return;

        const promo = promotions.find((p) => p.id === item.promotion_id);
        if (!promo?.products) return;

        const totalQty = promo.products.reduce((sum, p) => sum + p.qty, 0) || 1;
        const promoUnitValue = promo.price / totalQty;

        promo.products.forEach((promoItem: any) => {
          const key = promoItem.id;
          const qty = promoItem.qty ?? 1;
          const revenue = promoUnitValue * qty;

          const prod = products.find((p) => p.id === key);
          const stock =
            prod?.stock ?? masterStockMap.get(key) ?? null;
          const name =
            productMasterMap.get(key) ?? prod?.name ?? "—";

          if (!map.has(key)) {
            const { category, baseName } = extractCategory(name);
            map.set(key, {
              id: key,
              name: baseName,
              cat: category,
              qty: 0,
              revenue: 0,
              stock,
            });
          }

          const e = map.get(key)!;
          e.qty += qty;
          e.revenue += revenue;
        });
      })
    );

    let arr = Array.from(map.values());
    if (selectedCats.length) arr = arr.filter((p) => selectedCats.includes(p.cat));

    arr.sort((a, b) => {
      const diff = (a[sortCol] ?? -Infinity) - (b[sortCol] ?? -Infinity);
      return sortDir === "asc" ? diff : -diff;
    });





    return { products: arr };
  }, [
    sales,
    products,
    promotions,
    daysFilter,
    selectedCats,
    selectedBiz,
    sortCol,
    sortDir,
  ]);

  /* ---------- copy list ---------- */
  const copyList = () => {
    if (!selectedBiz) return;
    const bizName = businesses.find((b) => b.id === selectedBiz)?.name ?? "NEGOCIO";
    const header = `*${bizName.toUpperCase()} — Ventas últimos ${daysFilter} días*`;

    const grouped = new Map<string, { name: string; qty: number }[]>();
    top.products?.forEach((p) => {
      if (!grouped.has(p.cat)) grouped.set(p.cat, []);
      grouped.get(p.cat)!.push({ name: p.name.toUpperCase(), qty: p.qty });
    });

    const lines: string[] = [header, ""];
    grouped.forEach((items, cat) => {
      lines.push(`*${cat}*`);
      items.forEach((i) => lines.push(`• ${i.name} - *${i.qty}*`));
      lines.push("");
    });

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ───────── UI ───────── */
  const selectedBizName = businesses.find((b) => b.id === selectedBiz)?.name ?? "";

  return (
    <div className="p-6 space-y-8">
      {/* ───────── Titular ───────── */}
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Productos más vendidos
        </h1>
        {selectedBiz && (
          <p className="text-lg font-semibold text-sky-600 dark:text-sky-400">
            {selectedBizName}
          </p>
        )}
      </header>

      {/* ───────── Controles ───────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[160px]"
          value={selectedBiz}
          onChange={(e) => {
            setSelectedBiz(e.target.value);
            setSales([]);
            setProducts([]);
          }}
        >
          <option value="">Negocio</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[140px]"
          value={daysFilter}
          onChange={(e) => setDaysFilter(Number(e.target.value))}
        >
          {[1, 2, 3, 7, 14, 30].map((d) => (
            <option key={d} value={d}>
              Últimos {d} días
            </option>
          ))}
        </select>

        <MultiSelectDropdown
          options={[...CATEGORIES, "SIN CATEGORIA"]}
          selectedOptions={selectedCats}
          onChange={setSelectedCats}
        />

        <button
          disabled={!top.products?.length}
          onClick={copyList}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-full px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {copied ? (
            <>
              <Check size={16} /> Copiado
            </>
          ) : (
            <>
              <ClipboardCopy size={16} /> Copiar faltantes
            </>
          )}
        </button>
      </div>

      {/* ───────── Tablas ───────── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabla productos (60%) */}
        <div className="w-full lg:w-[60%] bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700">
          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10 text-[11px] uppercase tracking-wide select-none">
                <tr className="divide-x divide-slate-200 dark:divide-slate-600">
                  <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold">Producto</th>
                  <th
                    onClick={() => {
                      if (sortCol === "qty") setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else {
                        setSortCol("qty");
                        setSortDir("desc");
                      }
                    }}
                    className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/30"
                  >
                    Unidades&nbsp;
                    {sortCol === "qty" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => {
                      if (sortCol === "revenue") setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else {
                        setSortCol("revenue");
                        setSortDir("desc");
                      }
                    }}
                    className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/30"
                  >
                    Facturado&nbsp;
                    {sortCol === "revenue" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    onClick={() => {
                      if (sortCol === "stock") setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else {
                        setSortCol("stock");
                        setSortDir("desc");
                      }
                    }}
                    className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/30"
                  >
                    Stock&nbsp;
                    {sortCol === "stock" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {!selectedBiz ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Seleccioná un negocio para comenzar.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Cargando…
                    </td>
                  </tr>
                ) : top.products?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      Sin resultados para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  top.products?.map((p) => (
                    <tr key={p.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/40 odd:bg-slate-50/40 dark:odd:bg-slate-800/30"
                    >
                      <td className="px-4 py-2">{p.cat}</td>
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2">{p.qty}</td>
                      <td className="px-4 py-2">
                        <span className="font-semibold text-green-700">
                          $ {formatPrice(p.revenue)}
                        </span>
                      </td>
                      <td className="px-4 py-2">{p.stock ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla resumen (40%) */}
        <div className="w-full lg:w-[50%] bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700 ">
          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700 text-[11px] uppercase tracking-wide select-none">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Efectivo</th>
                  <th className="px-4 py-3 text-right font-semibold">Transfer</th>
                  <th className="px-4 py-3 text-right font-semibold">Tarjeta</th>
                  <th className="px-4 py-3 text-right font-semibold">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {categorySummary?.rows?.map((cat) => (
                  <tr key={cat.category} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <td className="px-4 py-2">{cat.category}</td>
                    <td className="px-4 py-2 text-right font-semibold">$ {formatPrice(cat.revenue)}</td>
                    <td className="px-4 py-2 text-right text-emerald-700">$ {formatPrice(cat.cash)}</td>
                    <td className="px-4 py-2 text-right text-purple-700">$ {formatPrice(cat.transfer)}</td>
                    <td className="px-4 py-2 text-right text-indigo-700">$ {formatPrice(cat.card)}</td>
                    <td className="px-4 py-2 text-right">{cat.percent.toFixed(1)}%</td>
                  </tr>
                ))}
                <tr className="bg-slate-200 dark:bg-slate-700 font-semibold">
                  <td className="px-4 py-2">TOTAL</td>
                  <td className="px-4 py-2 text-right">$ {formatPrice(categorySummary.totals?.revenue)}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">$ {formatPrice(categorySummary.totals?.cash)}</td>
                  <td className="px-4 py-2 text-right text-purple-700">$ {formatPrice(categorySummary.totals?.transfer)}</td>
                  <td className="px-4 py-2 text-right text-indigo-700">$ {formatPrice(categorySummary.totals?.card)}</td>
                  <td className="px-4 py-2 text-right">100%</td>
                </tr>
              </tbody>


            </table>
          </div>
        </div>
      </div>
    </div>
  );

}
