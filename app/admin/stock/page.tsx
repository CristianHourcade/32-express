"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Check, ClipboardCopy } from "lucide-react";

/* ========= MULTI-SELECT DROPDOWN ========= */
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
        <div className="absolute z-10 mt-1 w-max min-w-[180px] rounded border bg-white dark:bg-slate-800 shadow">
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

/* ========= HELPERS ========= */
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

/* ========= CONSTANTES ========= */
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

/* ========= PÁGINA ========= */
export default function TopProductsPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBiz, setSelectedBiz] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [daysFilter, setDaysFilter] = useState(7);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const top = useMemo(() => {
    if (!selectedBiz) return [];
    const now = Date.now();
    const recentSales = sales.filter(
      (s) => (now - new Date(s.timestamp).getTime()) / 86400000 <= daysFilter
    );

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

    let arr = Array.from(map.values());

    if (selectedCats.length) arr = arr.filter((p) => selectedCats.includes(p.cat));
    return arr.sort((a, b) => b.qty - a.qty);
  }, [sales, products, daysFilter, selectedCats, selectedBiz]);

  /* ----- COPIAR FALTANTES ----- */
 /* ----- COPIAR FALTANTES ----- */
const copyList = () => {
  if (!selectedBiz) return;

  // Nombre del negocio y rango elegido
  const bizName = businesses.find((b) => b.id === selectedBiz)?.name ?? "NEGOCIO";
  const header = `${bizName.toUpperCase()} — Ventas últimos ${daysFilter} días`;

  // Agrupar por categoría
  const grouped = new Map<string, { name: string; qty: number }[]>();
  top.forEach((p) => {
    if (!grouped.has(p.cat)) grouped.set(p.cat, []);
    grouped.get(p.cat)!.push({ name: p.name.toUpperCase(), qty: p.qty });
  });

  // Construir texto
  const lines: string[] = [header, ""]; // encabezado + línea en blanco
  grouped.forEach((items, cat) => {
    lines.push(cat); // categoría
    items.forEach((i) => lines.push(`${i.name} - ${i.qty}`));
    lines.push(""); // espacio entre categorías
  });

  navigator.clipboard.writeText(lines.join("\n"));
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};



  const selectedBizName = businesses.find((b) => b.id === selectedBiz)?.name ?? "";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Productos más vendidos</h1>

      {/* Nombre de negocio */}
      {selectedBiz && (
        <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
          {selectedBizName}
        </p>
      )}

      {/* CONTROLES */}
      <div className="flex flex-wrap gap-4 items-center">
        <select
          className="input w-[160px] text-xs p-2 rounded border shadow-sm"
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
          className="input w-[140px] text-xs p-2 rounded border shadow-sm"
          value={daysFilter}
          onChange={(e) => setDaysFilter(Number(e.target.value))}
        >
          <option value={3}>Últimos 3 días</option>
          <option value={7}>Últimos 7 días</option>
          <option value={14}>Últimos 14 días</option>
          <option value={30}>Últimos 30 días</option>
        </select>

        <MultiSelectDropdown
          options={[...CATEGORIES, "SIN CATEGORIA"]}
          selectedOptions={selectedCats}
          onChange={setSelectedCats}
          placeholder="Filtrar categorías"
        />

        <button
          disabled={!top.length}
          onClick={copyList}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-medium rounded px-3 py-2 transition"
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

      {/* TABLA */}
      <div className="card bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Categoría</th>
                <th className="px-3 py-2 text-left font-medium">Producto</th>
                <th className="px-3 py-2 text-left font-medium">Qty</th>
                <th className="px-3 py-2 text-left font-medium">Facturado</th>
                <th className="px-3 py-2 text-left font-medium">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {!selectedBiz ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    Seleccioná un negocio para comenzar.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : top.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    Sin resultados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                top.map((p) => (
                  <tr key={p.name + p.cat}>
                    <td className="px-3 py-2 whitespace-nowrap">{p.cat}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{p.name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.qty}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      $ {formatPrice(p.revenue)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {p.stock ?? "—"}
                    </td>
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
