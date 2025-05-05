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

const loadSales = async (businessId: string) =>
  fetchAll((from, to) =>
    supabase
      .from("sales")
      .select(
        `
        *,
        sale_items (
          *,
          products(name)
        )
      `
      )
      .eq("business_id", businessId)
      .order("timestamp", { ascending: false })
      .range(from, to)
  );

const loadProducts = async (businessId: string) =>
  fetchAll((from, to) =>
    supabase.from("products").select("*").eq("business_id", businessId).range(from, to)
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

const formatPrice = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  /* ---------- load data ---------- */
  useEffect(() => {
    (async () => setBusinesses(await loadBusinesses()))();
  }, []);

  useEffect(() => {
    if (!selectedBiz) return;
    (async () => {
      setLoading(true);
      const [s, p] = await Promise.all([loadSales(selectedBiz), loadProducts(selectedBiz)]);
      setSales(s);
      setProducts(p);
      setLoading(false);
    })();
  }, [selectedBiz]);

  /* ---------- compute top ---------- */
  const top = useMemo(() => {
    if (!selectedBiz) return [];

    /* filtrar ventas recientes */
    const now = Date.now();
    const recentSales = sales.filter(
      (s) => (now - new Date(s.timestamp).getTime()) / 86400000 <= daysFilter
    );

    /* mapear productos */
    const map = new Map<
      string,
      { name: string; qty: number; revenue: number; stock: number | null; cat: string }
    >();

    recentSales.forEach((sale) =>
      sale.sale_items?.forEach((item: any) => {
        const prod = products.find((p) => p.id === item.product_id);
        if (!prod) return;
        const key = item.product_id as string;
        if (!map.has(key)) {
          const { category, baseName } = extractCategory(item.products?.name ?? "—");
          map.set(key, {
            name: baseName,
            cat: category,
            qty: 0,
            revenue: 0,
            stock: prod.stock ?? prod.current_stock ?? null,
          });
        }
        const e = map.get(key)!;
        e.qty += item.quantity;
        e.revenue += item.total;
      })
    );

    /* a array + filtros */
    let arr = Array.from(map.values());
    if (selectedCats.length) arr = arr.filter((p) => selectedCats.includes(p.cat));

    /* ordenar */
    arr.sort((a, b) => {
      const diff = (a[sortCol] ?? -Infinity) - (b[sortCol] ?? -Infinity);
      return sortDir === "asc" ? diff : -diff;
    });

    return arr;
  }, [
    sales,
    products,
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
    top.forEach((p) => {
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

  /* ---------- UI ---------- */
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
          {[3, 7, 14, 30].map((d) => (
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
          disabled={!top.length}
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

      {/* ───────── Tabla ───────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700">
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
              ) : top.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Sin resultados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                top.map((p) => (
                  <tr
                    key={p.name + p.cat}
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
    </div>
  );
}
