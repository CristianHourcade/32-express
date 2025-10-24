"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { ClipboardCopy, Check, AlertTriangle } from "lucide-react";
import clsx from "clsx";
// Validador simple de UUID v4/v1
const isUUID = (s: any) =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

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
const loadSaleItems = async (businessId: string, sinceISO: string) =>
  fetchAll((from, to) =>
    supabase
      .from("sale_items")
      .select(`
        quantity,
        product_master_id,
        sale:sales!inner(id,business_id,timestamp),
        master:products_master( id, name, default_purchase )  -- 👈 embebido
      `)
      .eq("sale.business_id", businessId)
      .gte("sale.timestamp", sinceISO)
      .order("id", { ascending: true })
      .range(from, to)
  );


const loadMasterStocks = async (businessId: string) =>
  fetchAll((from, to) =>
    supabase
      .from("business_inventory")
      .select("product_id, stock")
      .eq("business_id", businessId)
      .order("product_id", { ascending: true })
      .range(from, to)
  );

// trae SOLO los masters necesarios por ids (evita paginar todo el catálogo)
async function fetchMastersByIds(ids: string[]) {
  // ✅ sanitizar una vez más (defensa en profundidad)
  const clean = Array.from(new Set(ids.filter(isUUID)));
  if (!clean.length) return [];

  const chunkSize = 500;
  const out: any[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) {
    const chunk = clean.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("products_master")
      .select("id, name, default_purchase")
      .in("id", chunk)                          // <- ya no puede contener "null"
      .order("id", { ascending: true });
    if (error) {
      console.error("fetchMastersByIds error", error, { chunk });
      continue;
    }
    if (data?.length) out.push(...data);
  }
  return out;
}



const money = (n: number) =>
  `$ ${Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

async function fetchAll(query) {
  const pageSize = 500;
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


export default function FaltantesPage() {
  const [businesses, setBusinesses] = useState([]);
  const [selectedBiz, setSelectedBiz] = useState("");
  const [daysFilter, setDaysFilter] = useState(7);
  const [faltantes, setFaltantes] = useState([]);
  const [copiedSelected, setCopiedSelected] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

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
      const since = new Date(Date.now() - daysFilter * 86400000).toISOString();

      const [saleItems, inventory] = await Promise.all([
        loadSaleItems(selectedBiz, since),     // 👈 trae master embebido
        loadMasterStocks(selectedBiz),         // product_id = products_master.id en tu esquema
      ]);

      const isUUID = (s: any) =>
        typeof s === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

      const toNumber = (x: any) => {
        if (x == null || x === "") return 0;
        if (typeof x === "number") return Number.isFinite(x) ? x : 0;
        const n = Number(String(x).trim().replace(/\s+/g, "").replace(",", "."));
        return Number.isFinite(n) ? n : 0;
      };

      // ventas por master_id
      const ventaMap = new Map<string, number>();
      // También guardo 1 muestra del master embebido por id para nombre/costo
      const masterSample = new Map<string, { name?: string; default_purchase?: any }>();

      for (const si of saleItems) {
        const qty = Math.max(0, Number(si?.quantity ?? 0));
        const mid = String(si?.product_master_id ?? "");
        if (!qty || !isUUID(mid)) continue;

        ventaMap.set(mid, (ventaMap.get(mid) ?? 0) + qty);

        const m = si?.master || {};
        if (!masterSample.has(mid) && (m?.id === mid)) {
          masterSample.set(mid, { name: m?.name, default_purchase: m?.default_purchase });
        }
      }

      const ventaIds = Array.from(ventaMap.keys());
      if (!ventaIds.length) {
        setFaltantes([]);
        setLoading(false);
        return;
      }

      const stockMap = new Map<string, number>(
        inventory.map((i: any) => [String(i.product_id), Number(i.stock || 0)])
      );

      const filas = ventaIds.map((mid) => {
        const m = masterSample.get(mid) || {};
        const nombre = m?.name || "(sin nombre)";
        const categoria = (nombre.split(" ")[0] || "").toUpperCase();

        // costo directo desde la venta embebida
        const unitCost = toNumber(m?.default_purchase ?? 0);

        const vendido = ventaMap.get(mid) ?? 0;
        const stock = stockMap.get(mid) ?? 0;
        const faltan = Math.max(vendido - stock, 0); // si querés seguir marcando alertas
        const costoRepo = unitCost > 0 ? unitCost * vendido : 0;



        return {
          id: mid,
          name: nombre,
          vendido,
          stock,
          faltan,
          needsInspection: stock === 0 && vendido > 0,
          needsReplenish: vendido > stock,
          categoria: CATEGORIES.includes(categoria) ? categoria : "OTROS",
          unitCost,
          costoRepo,
        };
      }).filter(f => (f.vendido ?? 0) > 0);

      setFaltantes(filas);
      setLoading(false);
    })().catch(e => {
      console.error(e);
      setFaltantes([]);
      setLoading(false);
    });
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

  const copySelectedSoldCost = () => {
    if (!selectedRows.size) return;

    const currentBiz = businesses.find((b) => b.id === selectedBiz);
    const bizName = currentBiz ? currentBiz.name : "Local";

    const lines: string[] = [];
    lines.push(`*${bizName}*`, ""); // negrita en título

    let granTotal = 0;
    const categoriesOrder = [...CATEGORIES, "OTROS"];

    categoriesOrder.forEach((categoria) => {
      const items = (grouped[categoria] || []).filter((f) => selectedRows.has(f.id));
      if (!items.length) return;

      lines.push(`*${categoria}*`); // negrita categoría
      let subtotal = 0;

      items.forEach((f) => {
        const costo = Number(f.costoRepo || 0);
        subtotal += costo;
        lines.push(`- ${f.name} · *${f.vendido}u* · ${costo > 0 ? `*${money(costo)}*` : "—"}`);
      });

      granTotal += subtotal;
      lines.push(`_Subtotal ${categoria}: ${subtotal > 0 ? `*${money(subtotal)}*` : "—"}_`, "");
    });

    lines.push(`*TOTAL A REPONER: ${granTotal > 0 ? money(granTotal) : "—"}*`);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedSelected(true);
    setTimeout(() => setCopiedSelected(false), 2000);
  };




  const [copiedMissing, setCopiedMissing] = useState(false);

  const copyAllSoldCost = () => {
    const currentBiz = businesses.find((b) => b.id === selectedBiz);
    const bizName = currentBiz ? currentBiz.name : "Local";

    const lines: string[] = [];
    lines.push(`*${bizName}*`, "");

    let granTotal = 0;
    const categoriesOrder = [...CATEGORIES, "OTROS"];

    categoriesOrder.forEach((categoria) => {
      const items = grouped[categoria] || [];
      if (!items.length) return;

      const sel = items.filter((f) => (f.vendido ?? 0) > 0);
      if (!sel.length) return;

      lines.push(`*${categoria}*`);
      let subtotal = 0;

      sel.forEach((f) => {
        const costo = Number(f.costoRepo || 0);
        subtotal += costo;
        lines.push(`- ${f.name} · *${f.vendido}u* · ${costo > 0 ? `*${money(costo)}*` : "—"}`);
      });

      granTotal += subtotal;
      lines.push(`_Subtotal ${categoria}: ${subtotal > 0 ? `*${money(subtotal)}*` : "—"}_`, "");
    });

    lines.push(`*TOTAL A REPONER: ${granTotal > 0 ? money(granTotal) : "—"}*`);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
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
            onClick={copySelectedSoldCost}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm"
          >
            {copiedSelected ? (
              <><Check size={16} /> Copiado</>
            ) : (
              <><ClipboardCopy size={16} /> Copiar seleccionados (vendidos)</>
            )}
          </button>

          <button
            disabled={!faltantes.length}
            onClick={copyAllSoldCost}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full text-sm"
          >
            {copiedAll ? (
              <><Check size={16} /> Copiado</>
            ) : (
              <><ClipboardCopy size={16} /> Copiar todo (vendidos)</>
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
                  <th className="text-left px-4 py-2 w-[55%]">Producto</th>
                  <th className="text-right px-4 py-2 w-[15%]">Stock</th>
                  <th className="text-right px-4 py-2 w-[15%]">Vendido</th>
                  <th className="text-right px-4 py-2 w-[15%]">Costo reposición</th> {/* ⬅️ NUEVO */}
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
                      {f.costoRepo > 0
                        ? `$ ${Number(f.costoRepo).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                        : "—"}
                    </td>


                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(() => {
                  const totalVendidos = productos.reduce((a, x) => a + (x.vendido ?? 0), 0);
                  const totalCostoVendidos = productos.reduce((a, x) => a + (x.costoRepo ?? 0), 0);

                  return (
                    <tr className="bg-slate-100 font-semibold">
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2 text-right">Totales</td>
                      <td className="px-4 py-2 text-right">—</td>
                      <td className="px-4 py-2 text-right">{totalVendidos}</td>
                      <td className="px-4 py-2 text-right">
                        {totalCostoVendidos > 0
                          ? `$ ${totalCostoVendidos.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>


            </table>
          </div>
        ))
      )}
    </div>
  );
}
