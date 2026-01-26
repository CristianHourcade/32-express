"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice";
import { supabase } from "@/lib/supabase";

/* ──────────────────────────────────────────────────────────────────────────
  POTENCIAL POR CATEGORÍA - MULTI SUCURSAL (COMPARACIÓN)
  - Selección obligatoria de 1+ sucursales (modal NO se cierra al seleccionar).
  - Se cierra solo con botón "Continuar".
  - Cálculo: SUM(stock * default_selling) agrupado por categoría y por sucursal.
  - Regla: si stock > 100 => NO SE SUMA (se ignora ese producto).
  - Tabla comparativa: categorías en filas, sucursales en columnas.
────────────────────────────────────────────────────────────────────────── */

const categories = [
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
] as const;

type Category = (typeof categories)[number];

function extractCategory(name: string): { category: Category; base: string } {
  const parts = name.trim().split(" ");
  const first = parts[0]?.toUpperCase() as Category;
  if (first && (categories as readonly string[]).includes(first)) {
    return { category: first as Category, base: parts.slice(1).join(" ") };
  }
  return { category: "SIN CATEGORIA", base: name };
}

function categoryColor(cat: string): string {
  switch (cat) {
    case "CIGARRILLOS":
      return "bg-yellow-300 text-black";
    case "GOLOSINAS":
      return "bg-pink-300 text-black";
    case "BEBIDA":
      return "bg-blue-200 text-black";
    case "CERVEZA":
      return "bg-amber-300 text-black";
    case "FIAMBRES":
      return "bg-rose-300 text-black";
    case "HUEVOS":
      return "bg-amber-200 text-black";
    case "HIGIENE":
      return "bg-teal-200 text-black";
    case "ALCOHOL":
      return "bg-indigo-300 text-white";
    case "TABACO":
      return "bg-red-300 text-black";
    case "ALMACEN":
      return "bg-green-200 text-black";
    default:
      return "bg-slate-200 text-gray-800";
  }
}

type MasterProduct = {
  id: string;
  name: string;
  default_selling: number;
};

type InventoryRow = {
  business_id: string;
  product_id: string;
  stock: number;
};

type CategoryRow = {
  category: Category;
  byBranch: Record<string, number>; // business_id -> potencial
  total: number; // total sumando sucursales seleccionadas
  ignoredByStockCap: Record<string, number>; // business_id -> count ignored products
};

export default function PotentialByCategoryMultiBranchPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { businesses, loading: businessesLoading } = useSelector(
    (s: RootState) => s.businesses
  );

  // ✅ Modal controlado (no se cierra al seleccionar)
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(true);

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const selectedBranches = useMemo(() => {
    const set = new Set(selectedBranchIds);
    return businesses.filter((b) => set.has(b.id));
  }, [businesses, selectedBranchIds]);

  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState<MasterProduct[]>([]);
  const [invRows, setInvRows] = useState<InventoryRow[]>([]);

  const [searchCat, setSearchCat] = useState("");
  const [sortMode, setSortMode] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    dispatch(fetchBusinesses());
  }, [dispatch]);

  useEffect(() => {
    // si no hay sucursales seleccionadas, no calcular nada
    if (selectedBranchIds.length === 0) return;

    const run = async () => {
      setLoading(true);
      try {
        const [m, inv] = await Promise.all([
          fetchAllMasters(),
          fetchInventoryForBranches(selectedBranchIds),
        ]);
        setMasters(m);
        setInvRows(inv);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [selectedBranchIds]);

  async function fetchAllMasters() {
    const step = 1000;
    let from = 0;
    let all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("products_master")
        .select("id, name, default_selling")
        .is("deleted_at", null)
        .range(from, from + step - 1);

      if (error) throw error;
      all = all.concat(data || []);
      if (!data || data.length < step) break;
      from += step;
    }

    return (all || []).map((x) => ({
      id: x.id,
      name: x.name,
      default_selling: Number(x.default_selling ?? 0),
    })) as MasterProduct[];
  }

  async function fetchInventoryForBranches(branchIds: string[]) {
    const step = 1000;
    let from = 0;
    let all: any[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("business_inventory")
        .select("business_id, product_id, stock")
        .in("business_id", branchIds)
        .range(from, from + step - 1);

      if (error) throw error;
      all = all.concat(data || []);
      if (!data || data.length < step) break;
      from += step;
    }

    return (all || []).map((x) => ({
      business_id: x.business_id,
      product_id: x.product_id,
      stock: Number(x.stock ?? 0),
    })) as InventoryRow[];
  }

  function toggleBranch(branchId: string) {
    setSelectedBranchIds((prev) => {
      const set = new Set(prev);
      if (set.has(branchId)) set.delete(branchId);
      else set.add(branchId);
      return Array.from(set);
    });
  }

  const rows = useMemo(() => {
    if (selectedBranchIds.length === 0) return [] as CategoryRow[];

    // stockBy[branchId][productId] = stock
    const stockBy: Record<string, Record<string, number>> = {};
    for (const bId of selectedBranchIds) stockBy[bId] = {};

    for (const r of invRows) {
      if (!stockBy[r.business_id]) stockBy[r.business_id] = {};
      stockBy[r.business_id][r.product_id] = r.stock;
    }

    const acc: Record<Category, CategoryRow> = {} as any;
    for (const c of categories) {
      acc[c] = {
        category: c,
        byBranch: {},
        total: 0,
        ignoredByStockCap: {},
      };

      for (const bId of selectedBranchIds) {
        acc[c].byBranch[bId] = 0;
        acc[c].ignoredByStockCap[bId] = 0;
      }
    }

    // recorremos productos
    for (const p of masters) {
      const { category } = extractCategory(p.name);
      const price = Number(p.default_selling ?? 0);

      for (const bId of selectedBranchIds) {
        const stock = stockBy[bId]?.[p.id] ?? 0;
        if (stock <= 0) continue;

        // ✅ regla: si stock > 100 NO suma
        if (stock > 100) {
          acc[category].ignoredByStockCap[bId] += 1;
          continue;
        }

        const pot = stock * price;
        acc[category].byBranch[bId] += pot;
        acc[category].total += pot;
      }
    }

    let list = Object.values(acc);

    // minimal: ocultar vacíos
    list = list.filter((x) => x.total > 0);

    // filtro por texto
    if (searchCat.trim()) {
      const q = searchCat.trim().toLowerCase();
      list = list.filter((x) => x.category.toLowerCase().includes(q));
    }

    // orden
    list = [...list].sort((a, b) =>
      sortMode === "desc" ? b.total - a.total : a.total - b.total
    );

    return list;
  }, [selectedBranchIds, invRows, masters, searchCat, sortMode]);

  const totalsByBranch = useMemo(() => {
    const map: Record<string, number> = {};
    for (const bId of selectedBranchIds) map[bId] = 0;

    for (const r of rows) {
      for (const bId of selectedBranchIds) {
        map[bId] += r.byBranch[bId] ?? 0;
      }
    }
    return map;
  }, [rows, selectedBranchIds]);

  const totalAll = useMemo(() => {
    return Object.values(totalsByBranch).reduce((a, b) => a + b, 0);
  }, [totalsByBranch]);

  const isBusy = loading || businessesLoading;

  return (
    <div className="space-y-6 p-6">
      {/* ✅ Modal selección sucursales (NO se cierra al seleccionar) */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-2">Seleccioná sucursales</h2>
            <p className="text-sm text-gray-600 mb-4">
              Elegí 1 o más sucursales para comparar potencial por categoría.
            </p>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {businessesLoading && (
                <div className="text-center py-6">Cargando sucursales…</div>
              )}

              {!businessesLoading &&
                businesses.map((b) => {
                  const isSelected = selectedBranchIds.includes(b.id);

                  return (
                    <button
                      key={b.id}
                      onClick={() => toggleBranch(b.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-4 ${
                        isSelected ? "border-indigo-500 bg-indigo-50/40" : ""
                      }`}
                    >
                      <div>
                        <div className="font-medium">{b.name}</div>
                        <div className="text-xs text-gray-500">ID: {b.id}</div>
                      </div>

                      <div className="text-xs">
                        <span
                          className={`px-2 py-1 rounded-full ${
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800"
                          }`}
                        >
                          {isSelected ? "Seleccionado" : "Seleccionar"}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="flex items-center justify-between mt-5 gap-2">
              <button
                onClick={() => setSelectedBranchIds([])}
                className="px-4 py-2 rounded-md border hover:bg-gray-100 dark:hover:bg-slate-800 text-sm"
                disabled={selectedBranchIds.length === 0}
              >
                Limpiar
              </button>

              <button
                onClick={() => setIsBranchModalOpen(false)}
                disabled={selectedBranchIds.length === 0}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  selectedBranchIds.length === 0
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                Continuar
              </button>
            </div>

            {selectedBranchIds.length === 0 && (
              <div className="text-xs text-red-500 mt-3">
                Tenés que seleccionar al menos 1 sucursal.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBranchModalOpen(true)}
            className="px-3 py-2 rounded-md border hover:bg-gray-100 dark:hover:bg-slate-800"
            title="Cambiar selección"
          >
            Cambiar sucursales
          </button>

          <div className="text-sm">
            <div className="text-gray-500 leading-tight">Seleccionadas</div>
            <div className="font-semibold leading-tight">
              {selectedBranches.length} sucursal(es)
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold">Potencial por Categoría</h1>

        <div className="flex items-center gap-2">
          <input
            value={searchCat}
            onChange={(e) => setSearchCat(e.target.value)}
            placeholder="Filtrar categoría…"
            className="bg-white dark:bg-slate-800 border rounded-md p-2 text-sm"
          />

          <button
            onClick={() => setSortMode((p) => (p === "desc" ? "asc" : "desc"))}
            className="px-3 py-2 rounded-md border hover:bg-gray-100 dark:hover:bg-slate-800 text-sm"
            title="Ordenar por total"
          >
            Orden: {sortMode === "desc" ? "Mayor → Menor" : "Menor → Mayor"}
          </button>
        </div>
      </header>

      {/* Resumen */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 space-y-4">
        <div>
          <div className="text-sm text-gray-500">
            Potencial total (sumando sucursales seleccionadas)
          </div>
          <div className="text-3xl font-bold">
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: "ARS",
            }).format(totalAll)}
          </div>
        </div>

        {/* Totales por sucursal */}
        <div className="flex flex-wrap gap-2">
          {selectedBranches.map((b) => (
            <div
              key={b.id}
              className="text-xs px-3 py-2 rounded-full bg-slate-100 dark:bg-slate-700"
            >
              <b>{b.name}:</b>{" "}
              {new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: "ARS",
              }).format(totalsByBranch[b.id] ?? 0)}
            </div>
          ))}
        </div>
      </div>

      {/* Tabla comparativa */}
      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg">
          <div className="max-h-[650px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full text-base">
              <thead className="bg-slate-100 dark:bg-slate-700 text-sm uppercase">
                <tr>
                  <th className="px-6 py-4 text-left">Categoría</th>

                  {selectedBranches.map((b) => (
                    <th key={b.id} className="px-6 py-4 text-right">
                      {b.name}
                    </th>
                  ))}

                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                {isBusy ? (
                  <tr>
                    <td
                      colSpan={selectedBranches.length + 2}
                      className="py-16 text-center"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedBranches.length + 2}
                      className="py-16 text-center text-gray-500"
                    >
                      No hay datos para mostrar.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.category}
                      className="border-b even:bg-slate-50/60 dark:even:bg-slate-800/30 hover:bg-slate-100 transition"
                    >
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColor(
                            row.category
                          )}`}
                        >
                          {row.category}
                        </span>
                      </td>

                      {selectedBranches.map((b) => (
                        <td key={b.id} className="px-6 py-4 text-right text-sm">
                          {new Intl.NumberFormat("es-AR", {
                            style: "currency",
                            currency: "ARS",
                          }).format(row.byBranch[b.id] ?? 0)}
                        </td>
                      ))}

                      <td className="px-6 py-4 text-right font-semibold">
                        {new Intl.NumberFormat("es-AR", {
                          style: "currency",
                          currency: "ARS",
                        }).format(row.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 mt-3 px-4 py-3">
            <span className="text-sm text-gray-600">
              Categorías: <b>{rows.length}</b>
            </span>

            <button
              onClick={() => {
                setSearchCat("");
                setSortMode("desc");
              }}
              className="px-3 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
