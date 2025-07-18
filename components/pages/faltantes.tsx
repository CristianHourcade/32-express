"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { ClipboardCopy, Check, AlertTriangle } from "lucide-react";
import clsx from "clsx";

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

async function fetchAll(query) {
  const pageSize = 1000;
  let page = 0,
    done = false,
    all = [];
  while (!done) {
    const { data, error } = await query(
      page * pageSize,
      (page + 1) * pageSize - 1
    );
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

const loadProductMasters = async () =>
  fetchAll((from, to) =>
    supabase.from("products_master").select("id, name").range(from, to)
  );

const loadMasterStocks = async (businessId) =>
  fetchAll((from, to) =>
    supabase
      .from("business_inventory")
      .select("product_id, stock")
      .eq("business_id", businessId)
      .range(from, to)
  );

export default function FaltantesPage() {
  const [businesses, setBusinesses] = useState([]);
  const [selectedBiz, setSelectedBiz] = useState("");
  const [daysFilter, setDaysFilter] = useState(7);
  const [faltantes, setFaltantes] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [sortBy, setSortBy] = useState("stock");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("businesses")
        .select("*")
        .order("name");
      setBusinesses(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedBiz) return;
    setLoading(true);
    (async () => {
      const since = new Date(
        Date.now() - daysFilter * 86400000
      ).toISOString();

      const [sales, masters, inventory] = await Promise.all([
        fetchAll((from, to) =>
          supabase
            .from("sales")
            .select("sale_items(quantity, product_master_id)")
            .eq("business_id", selectedBiz)
            .gte("timestamp", since)
            .range(from, to)
        ),
        loadProductMasters(),
        loadMasterStocks(selectedBiz),
      ]);

      const ventaMap = new Map();
      sales?.forEach((s) => {
        s.sale_items?.forEach((item) => {
          if (!item.product_master_id) return;
          ventaMap.set(
            item.product_master_id,
            (ventaMap.get(item.product_master_id) ?? 0) + item.quantity
          );
        });
      });

      const stockMap = new Map(
        inventory.map((i) => [i.product_id, i.stock])
      );

      // Solo productos con ventas > 0
      const faltantesCalculados = masters
        .map((m) => {
          const vendido = ventaMap.get(m.id) ?? 0;
          const stock = stockMap.get(m.id) ?? 0;
          const faltan = Math.max(vendido - stock, 0);
          const needsInspection = stock === 0 && vendido > 0;
          const needsReplenish = vendido > stock;
          const categoria = m.name?.split(" ")[0]?.toUpperCase();

          return {
            id: m.id,
            name: m.name,
            vendido,
            stock,
            faltan,
            needsInspection,
            needsReplenish,
            categoria: CATEGORIES.includes(categoria) ? categoria : "OTROS",
          };
        })
        .filter((f) => f.vendido > 0);

      setFaltantes(faltantesCalculados);
      setLoading(false);
    })();
  }, [selectedBiz, daysFilter]);

  const sortedFaltantes = useMemo(() => {
    return [...faltantes].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [faltantes, sortBy]);

  const toggleSelect = (id) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRows(newSet);
  };

  const toggleAllByCategory = (category, select = true) => {
    const newSet = new Set(selectedRows);
    for (const f of sortedFaltantes.filter((f) => f.categoria === category)) {
      if (select) newSet.add(f.id);
      else newSet.delete(f.id);
    }
    setSelectedRows(newSet);
  };

  const copyToClipboard = () => {
    // Buscamos el nombre del local seleccionado
    const currentBiz = businesses.find((b) => b.id === selectedBiz);
    const bizName = currentBiz ? currentBiz.name : "Local";

    const lines = [];
    // Título con nombre de local
    lines.push(`*${bizName} — FALTANTES*`, "");

    // Creamos el orden de categorías
    const categoriesOrder = [...CATEGORIES, "OTROS"];
    categoriesOrder.forEach((categoria) => {
      const items = grouped[categoria] || [];
      // Solo los seleccionados en esa categoría
      const sel = items.filter((f) => selectedRows.has(f.id));
      if (!sel.length) return;

      // Encabezado de categoría
      lines.push(`*${categoria}*`);
      // Lista de productos
      sel.forEach((f) => {
        lines.push(`- ${f.name}: *${f.faltan}*`);
      });
      lines.push("");
    });

    // Copiamos al portapapeles
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const [copiedMissing, setCopiedMissing] = useState(false);

  const copyMissingOnly = () => {
    const currentBiz = businesses.find((b) => b.id === selectedBiz);
    const bizName = currentBiz ? currentBiz.name : "Local";

    const lines = [];
    lines.push(`*${bizName} — REPOSICIÓN SUGERIDA*`, "");

    const categoriesOrder = [...CATEGORIES, "OTROS"];
    categoriesOrder.forEach((categoria) => {
      const items = grouped[categoria] || [];
      // Solo con faltan > 0
      const sel = items.filter((f) => f.faltan > 0);
      if (!sel.length) return;

      lines.push(`*${categoria}*`);
      sel.forEach((f) => {
        lines.push(`- ${f.name}: *${f.faltan}*`);
      });
      lines.push("");
    });

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedMissing(true);
    setTimeout(() => setCopiedMissing(false), 2000);
  };


  const grouped = useMemo(() => {
    const groups = {};
    for (const f of sortedFaltantes) {
      if (!groups[f.categoria]) groups[f.categoria] = [];
      groups[f.categoria].push(f);
    }
    // Ordena cada grupo para que inspección manual aparezca primero
    Object.keys(groups).forEach((cat) => {
      groups[cat].sort((a, b) => (b.needsInspection ? 1 : 0) - (a.needsInspection ? 1 : 0));
    });
    return groups;
  }, [sortedFaltantes]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reposición sugerida</h1>

      <div className="p-4 bg-white rounded-xl border space-y-2">
        <div className="flex gap-4 flex-wrap items-center">
          <select
            value={selectedBiz}
            onChange={(e) => setSelectedBiz(e.target.value)}
            className="input px-3 py-1 text-sm rounded border"
          >
            <option value="">Seleccioná un negocio</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={daysFilter}
            onChange={(e) => setDaysFilter(Number(e.target.value))}
            className="input px-3 py-1 text-sm rounded border"
          >
            {[1, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>Últimos {d} días</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input px-3 py-1 text-sm rounded border"
          >
            <option value="vendido">Ordenar por Vendido</option>
            <option value="stock">Ordenar por Stock</option>
          </select>

          <button
            disabled={!selectedRows.size}
            onClick={copyToClipboard}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm"
          >
            {copied ? (
              <><Check size={16} /> Copiado</>
            ) : (
              <><ClipboardCopy size={16} /> Copiar seleccionados</>
            )}
          </button>
          <button
            disabled={!faltantes.some((f) => f.faltan > 0)}
            onClick={copyMissingOnly}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full text-sm"
          >
            {copiedMissing ? (
              <><Check size={16} /> Copiado</>
            ) : (
              <><ClipboardCopy size={16} /> Copiar reposición</>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando datos...</p>
      ) : !faltantes.length ? (
        <p className="text-slate-500">Sin faltantes para el filtro seleccionado.</p>
      ) : (
        Object.entries(grouped).map(([categoria, productos]) => (
          <div key={categoria} className="border rounded-xl overflow-hidden mt-6">
            <div className="flex items-center justify-between bg-slate-200 px-4 py-2">
              <h2 className="text-lg font-bold">{categoria}</h2>
              <div className="space-x-2">
                <button onClick={() => toggleAllByCategory(categoria, true)} className="text-xs px-2 py-1 rounded bg-green-100">Seleccionar todos</button>
                <button onClick={() => toggleAllByCategory(categoria, false)} className="text-xs px-2 py-1 rounded bg-red-100">Deseleccionar</button>
              </div>
            </div>

            <table className="w-full text-sm table-fixed">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 w-8">✓</th>
                  <th className="text-left px-4 py-2 w-[40%]">Producto</th>
                  <th className="text-right px-4 py-2 w-[15%]">Stock</th>
                  <th className="text-right px-4 py-2 w-[15%]">Vendido</th>
                  <th className="text-right px-4 py-2 w-[20%]">Reposición sugerida</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((f) => (
                  <tr
                    key={f.id}
                    className={clsx(
                      "cursor-pointer odd:bg-white even:bg-slate-50",
                      f.needsReplenish && "bg-red-50"
                    )}
                    onClick={() => toggleSelect(f.id)}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(f.id)}
                        onChange={() => toggleSelect(f.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-2 font-medium break-words">
                      <div className="flex items-center gap-2">
                        {f.name}
                        {f.needsInspection ? (
                          <AlertTriangle size={16} className="text-amber-500 animate-pulse" title="Posible pérdida de ventas por falta de stock" />
                        ) : (
                          <Check size={16} className="text-green-500" title="Stock suficiente" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={clsx(
                        "px-2 py-1 text-xs rounded font-semibold",
                        f.stock === 0 ? "bg-red-200 text-red-800" : "bg-slate-200 text-slate-800"
                      )}>{f.stock}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{f.vendido}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className="font-semibold text-rose-600">{f.faltan}</span>
                      {f.needsInspection && (
                        <span className="ml-2 px-2 py-1 text-xs rounded bg-yellow-200 text-yellow-800">INSPECCIÓN MANUAL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
