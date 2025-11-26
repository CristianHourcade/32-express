"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

const isUUID = (s: any) =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

const money = (n: number) =>
  `$ ${Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

function todayInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoInput(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchAll(query: (from: number, to: number) => any) {
  const pageSize = 500;
  let page = 0;
  let done = false;
  let all: any[] = [];

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
    } else {
      done = true;
    }
  }

  return all;
}

// Items de venta por negocio y rango
const loadSaleItemsByRange = async (
  businessId: string,
  fromISO: string,
  toISO: string
) =>
  fetchAll((from, to) =>
    supabase
      .from("sale_items")
      .select(
        `
        quantity,
        total,
        product_master_id,
        sale:sales!inner(id,business_id,timestamp),
        master:products_master(id, name)
      `
      )
      .eq("sale.business_id", businessId)
      .gte("sale.timestamp", fromISO)
      .lte("sale.timestamp", toISO)
      .order("id", { ascending: true })
      .range(from, to)
  );

// Ventas (para efectivo) por negocio y rango
const loadSalesByRange = async (
  businessId: string,
  fromISO: string,
  toISO: string
) =>
  fetchAll((from, to) =>
    supabase
      .from("sales")
      .select("total,payment_method,timestamp")
      .eq("business_id", businessId)
      .gte("timestamp", fromISO)
      .lte("timestamp", toISO)
      .order("timestamp", { ascending: true })
      .range(from, to)
  );

type Row = {
  id: string;
  name: string;
  categoria: string;
  totalVendido: number;
};

export default function FaltantesPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBiz, setSelectedBiz] = useState("");
  const [dateFrom, setDateFrom] = useState(daysAgoInput(7));
  const [dateTo, setDateTo] = useState(todayInput());
  const [categoryFilter, setCategoryFilter] = useState<string>("TODAS");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [cashInRange, setCashInRange] = useState<number>(0);

  // Carga negocios
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .order("name");
      if (error) {
        console.error(error);
        return;
      }
      setBusinesses(data ?? []);
    })();
  }, []);

  // Carga datos por rango (productos + efectivo)
  useEffect(() => {
    if (!selectedBiz || !dateFrom || !dateTo) return;

    (async () => {
      try {
        setLoading(true);

        const fromISO = new Date(`${dateFrom}T00:00:00`).toISOString();
        const toISO = new Date(`${dateTo}T23:59:59`).toISOString();

        const [saleItems, sales] = await Promise.all([
          loadSaleItemsByRange(selectedBiz, fromISO, toISO),
          loadSalesByRange(selectedBiz, fromISO, toISO),
        ]);

        // ---- Agregado: efectivo del rango ----
        let efectivo = 0;
        for (const s of sales) {
          const method = String(s.payment_method || "").toLowerCase();
          if (method === "cash") {
            efectivo += Number(s.total || 0);
          }
        }
        setCashInRange(efectivo);
        // --------------------------------------

        const map = new Map<string, Row>();

        for (const si of saleItems) {
          const mid = String(si?.product_master_id ?? "");
          if (!isUUID(mid)) continue;

          const lineTotal = Number(si?.total ?? 0);
          if (!lineTotal) continue;

          if (!map.has(mid)) {
            const nombre = si?.master?.name || "(sin nombre)";
            const primeraPalabra = (nombre.split(" ")[0] || "").toUpperCase();
            const categoria = CATEGORIES.includes(primeraPalabra)
              ? primeraPalabra
              : "OTROS";

            map.set(mid, {
              id: mid,
              name: nombre,
              categoria,
              totalVendido: 0,
            });
          }

          const row = map.get(mid)!;
          row.totalVendido += lineTotal;
        }

        const list = Array.from(map.values()).filter(
          (r) => r.totalVendido > 0
        );

        // Orden default: por total vendido desc
        list.sort((a, b) => b.totalVendido - a.totalVendido);

        setRows(list);
      } catch (e) {
        console.error(e);
        setRows([]);
        setCashInRange(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedBiz, dateFrom, dateTo]);

  // Filtro por categoría
  const filteredRows = useMemo(() => {
    if (categoryFilter === "TODAS") return rows;
    return rows.filter((r) => r.categoria === categoryFilter);
  }, [rows, categoryFilter]);

  // Totales
  const summary = useMemo(() => {
    let totalVendido = 0;
    let totalReposicion = 0;

    for (const r of filteredRows) {
      totalVendido += r.totalVendido ?? 0;
      totalReposicion += (r.totalVendido ?? 0) * 0.5;
    }

    return { totalVendido, totalReposicion };
  }, [filteredRows]);

  const currentBiz = businesses.find((b) => b.id === selectedBiz);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reposición por ventas</h1>
      <p className="text-sm text-slate-600">
        Calculá cuánto deberías reponer en función de lo vendido en un rango de
        fechas. El costo de reposición estimado se calcula como el{" "}
        <strong>50% del total vendido</strong>. Además, se muestra cuánto
        efectivo ingresó en ese período.
      </p>

      {/* Filtros */}
      <div className="p-4 bg-white rounded-xl border space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={selectedBiz}
            onChange={(e) => setSelectedBiz(e.target.value)}
            className="px-3 py-2 text-sm rounded border bg-white"
          >
            <option value="">Seleccioná un negocio</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-sm">
            <span>Desde</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1 rounded border text-sm"
            />
            <span>hasta</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1 rounded border text-sm"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded border bg-white"
          >
            <option value="TODAS">Todas las categorías</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            <option value="OTROS">OTROS</option>
          </select>
        </div>

        {/* Resumen */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-slate-50 border">
            <div className="text-xs text-slate-500 uppercase">
              Local seleccionado
            </div>
            <div className="font-semibold">
              {currentBiz ? currentBiz.name : "—"}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border">
            <div className="text-xs text-slate-500 uppercase">
              Total vendido (productos)
            </div>
            <div className="font-semibold">
              {money(summary.totalVendido)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border">
            <div className="text-xs text-slate-500 uppercase">
              Costo reposición estimado (50%)
            </div>
            <div className="font-semibold">
              {money(summary.totalReposicion)}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="text-xs text-emerald-700 uppercase">
              Efectivo ingresado en el período
            </div>
            <div className="font-semibold text-emerald-900">
              {money(cashInRange)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-slate-500">Cargando datos...</p>
      ) : !selectedBiz ? (
        <p className="text-slate-500">
          Seleccioná un negocio y un rango de fechas para ver los datos.
        </p>
      ) : !filteredRows.length ? (
        <p className="text-slate-500">
          No hay ventas registradas para los filtros seleccionados.
        </p>
      ) : (
        <div className="border rounded-xl overflow-hidden mt-4">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-4 py-2 w-[45%]">Producto</th>
                <th className="text-left px-4 py-2 w-[15%]">Categoría</th>
                <th className="text-right px-4 py-2 w-[20%]">Total vendido</th>
                <th className="text-right px-4 py-2 w-[20%]">
                  Costo reposición (50%)
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const costoReposicion = (r.totalVendido ?? 0) * 0.5;
                return (
                  <tr
                    key={r.id}
                    className="odd:bg-white even:bg-slate-50 border-t border-slate-100"
                  >
                    <td className="px-4 py-2 break-words font-medium">
                      {r.name}
                    </td>
                    <td className="px-4 py-2">{r.categoria}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {money(r.totalVendido)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {money(costoReposicion)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-semibold border-t border-slate-200">
                <td className="px-4 py-2 text-right" colSpan={2}>
                  Totales
                </td>
                <td className="px-4 py-2 text-right">
                  {money(summary.totalVendido)}
                </td>
                <td className="px-4 py-2 text-right">
                  {money(summary.totalReposicion)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
