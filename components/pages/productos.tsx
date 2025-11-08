"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice";
import { supabase } from "@/lib/supabase";

/* ──────────────────────────────────────────────────────────────────────────
  INVENTARIO POR SUCURSAL (ENFORCED)
  - Paso 1: selección obligatoria de sucursal (bloquea la UI hasta elegir).
  - Paso 2: listado/edición de productos, trabajando SOLO sobre esa sucursal.
  - Respeta features previos: búsqueda, filtros, paginación, orden, drawer,
    optimista para stock, logs en activities (Perdida / Actualizacion / Vencimiento).
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
type Motivo = "Perdida" | "Actualizacion" | "Vencimiento";

function extractCategory(name: string): { category: Category; base: string } {
  const parts = name.trim().split(" ");
  const first = parts[0]?.toUpperCase() as Category;
  if (first && (categories as readonly string[]).includes(first)) {
    return { category: first as Category, base: parts.slice(1).join(" ") };
  }
  return { category: "SIN CATEGORIA", base: name };
}

export type InventoryItem = {
  id: string;
  code: string;
  codes_asociados?: string[];
  name: string;
  default_purchase: number;
  margin_percent: number;
  default_selling: number;
  stocks: Record<string, number>; // { [business_id]: stock }
  entryManual?: boolean;
};

const hasStockInBranch = (item: InventoryItem, branchId: string) =>
  ((item.stocks || {})[branchId] ?? 0) > 0;

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

export default function InventoryByBranchPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { businesses, loading: businessesLoading } = useSelector(
    (s: RootState) => s.businesses
  );
  const { user } = useSelector((s: RootState) => s.auth);

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const selectedBranch = useMemo(
    () => businesses.find((b) => b.id === selectedBranchId) || null,
    [businesses, selectedBranchId]
  );

  // Códigos secundarios
  const [codesAsociados, setCodesAsociados] = useState<string[]>([]);
  const [codeDraft, setCodeDraft] = useState<string>("");

  // UI
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Drawer
  const [drawerProduct, setDrawerProduct] = useState<InventoryItem | null>(null);
  const [drawerCategory, setDrawerCategory] = useState<Category>("SIN CATEGORIA");
  const [drawerBase, setDrawerBase] = useState<string>("");
  const [salePrice, setSalePrice] = useState<number>(0);
  const [editableStocks, setEditableStocks] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Modal de stock
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockModalAction, setStockModalAction] = useState<"add" | "remove" | null>(null);
  const [stockModalAmount, setStockModalAmount] = useState<number>(1);
  const [stockModalReason, setStockModalReason] = useState<Motivo>("Actualizacion"); // ✅ consistente
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);

  // Paginación
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchBusinesses());
  }, [dispatch]);

  useEffect(() => {
    const run = async () => {
      if (!selectedBranchId) return;
      setLoading(true);
      try {
        const masters = await fetchAllMasters();
        const invForBranch = await fetchInventoryForBranch(selectedBranchId);

        const map: Record<string, Record<string, number>> = {};
        invForBranch.forEach((r) => {
          map[r.product_id] = map[r.product_id] || {};
          map[r.product_id][r.business_id] = r.stock;
        });

        setInventory(
          masters.map((m: any) => ({
            id: m.id,
            code: m.code,
            codes_asociados: Array.isArray(m.codes_asociados) ? m.codes_asociados : [],
            name: m.name,
            default_purchase: m.default_purchase,
            margin_percent: m.margin_percent,
            default_selling: m.default_selling,
            stocks: map[m.id] || {},
            entryManual: !!(m.entryManual ?? false),
          }))
        );
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [selectedBranchId]);

  async function fetchAllMasters() {
    const step = 1000;
    let from = 0;
    let all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("products_master")
        .select(
          "id, code, name, default_purchase, margin_percent, default_selling, entryManual, codes_asociados"
        )
        .is("deleted_at", null)
        .range(from, from + step - 1);
      if (error) throw error;
      all = all.concat(data || []);
      if (!data || data.length < step) break;
      from += step;
    }
    return all;
  }

  async function fetchInventoryForBranch(branchId: string) {
    const step = 1000;
    let from = 0;
    let all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("business_inventory")
        .select("business_id, product_id, stock")
        .eq("business_id", branchId)
        .range(from, from + step - 1);
      if (error) throw error;
      all = all.concat(data || []);
      if (!data || data.length < step) break;
      from += step;
    }
    return all;
  }

  function openNew() {
    if (!selectedBranchId) return;
    setDrawerProduct({
      id: "",
      code: "",
      codes_asociados: [],
      name: "",
      default_purchase: 0,
      margin_percent: 0,
      default_selling: 0,
      stocks: { [selectedBranchId]: 0 },
      entryManual: false,
    });
    setCodesAsociados([]);
    setCodeDraft("");
    setDrawerCategory("SIN CATEGORIA");
    setDrawerBase("");
    setSalePrice(0);
    setEditableStocks({ [selectedBranchId]: 0 });
  }

  function openDrawer(item: InventoryItem) {
    const { category, base } = extractCategory(item.name);
    setDrawerProduct(item);
    setEditableStocks({ ...item.stocks });
    setSalePrice(item.default_selling);
    setDrawerCategory(category);
    setDrawerBase(base);
    setCodesAsociados(Array.isArray(item.codes_asociados) ? item.codes_asociados : []);
    setCodeDraft("");
  }
  function closeDrawer() {
    setDrawerProduct(null);
  }

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
  }

  const filtered = useMemo(() => {
    if (!selectedBranchId) return [] as InventoryItem[];

    const base = searchTerm.trim()
      ? inventory
      : inventory.filter((it) => hasStockInBranch(it, selectedBranchId));

    let list = base.filter((item) => {
      const { category } = extractCategory(item.name);
      const matchesCategory = selectedCategory ? category === selectedCategory : true;

      const q = searchTerm.toLowerCase();
      const matchesSearch = !q
        ? true
        : item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          (Array.isArray(item.codes_asociados) &&
            item.codes_asociados.some((cs) => cs.toLowerCase().includes(q)));

      return matchesCategory && matchesSearch;
    });

    if (sortOrder) {
      list = [...list].sort((a, b) =>
        sortOrder === "asc"
          ? a.default_selling - b.default_selling
          : b.default_selling - a.default_selling
      );
    } else {
      list = [...list].sort((a, b) => {
        const sa = a.stocks[selectedBranchId] ?? 0;
        const sb = b.stocks[selectedBranchId] ?? 0;
        return sb - sa;
      });
    }

    return list;
  }, [inventory, searchTerm, selectedCategory, sortOrder, selectedBranchId]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, sortOrder, inventory.length, selectedBranchId]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginated = useMemo(
    () => filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );

  function openStockModal(action: "add" | "remove") {
    setStockModalAction(action);
    setStockModalAmount(1);
    setStockModalReason("Actualizacion"); // ✅ por defecto coherente
    setIsStockModalOpen(true);
  }

  async function handleConfirmStockModal() {
    if (!drawerProduct || !selectedBranchId || !stockModalAction) return;
    if (isModalSubmitting) return;
    setIsModalSubmitting(true);

    try {
      const current = editableStocks[selectedBranchId] ?? 0;
      const newValue =
        stockModalAction === "add"
          ? current + stockModalAmount
          : Math.max(0, current - stockModalAmount);

      // ✅ Log de pérdida o vencimiento (ambos descuentan y generan lost_cash)
      if (stockModalAction === "remove" && (stockModalReason === "Perdida" || stockModalReason === "Vencimiento")) {
        const qtyLost = Math.max(0, current - newValue);
        if (qtyLost > 0) {
          const nameFinal =
            drawerCategory === "SIN CATEGORIA" ? drawerBase : `${drawerCategory} ${drawerBase}`;
          const details = user?.name
            ? `${user.name} cambió stock de ${nameFinal} en ${selectedBranch?.name ?? selectedBranchId}: ${current} → ${newValue}`
            : `Cambio stock de ${nameFinal} en ${selectedBranch?.name ?? selectedBranchId}: ${current} → ${newValue}`;
          const lost_cash = qtyLost * (drawerProduct.default_selling ?? 0);
          await supabase.from("activities").insert({
            business_id: selectedBranchId,
            product_id: drawerProduct.id,
            details,
            motivo: stockModalReason as Motivo, // "Perdida" | "Vencimiento"
            lost_cash,
            created_at: new Date().toISOString(),
          });
        }
      }

      // ✅ Log de actualización (sin lost_cash)
      if (stockModalAction && stockModalReason === "Actualizacion" && current !== newValue) {
        const nameFinal =
          drawerCategory === "SIN CATEGORIA" ? drawerBase : `${drawerCategory} ${drawerBase}`;
        const details = user?.name
          ? `${user.name} cambió stock de ${nameFinal} en ${selectedBranch?.name ?? selectedBranchId}: ${current} → ${newValue}`
          : `Cambio stock de ${nameFinal} en ${selectedBranch?.name ?? selectedBranchId}: ${current} → ${newValue}`;
        await supabase.from("activities").insert({
          business_id: selectedBranchId,
          product_id: drawerProduct.id,
          details,
          motivo: "Actualizacion",
          lost_cash: null,
          created_at: new Date().toISOString(),
        });
      }

      setEditableStocks((prev) => ({ ...prev, [selectedBranchId]: newValue }));
      setIsStockModalOpen(false);
    } finally {
      setIsModalSubmitting(false);
    }
  }

  async function saveAll() {
    if (!drawerProduct || !selectedBranchId) return;
    setIsSaving(true);
    try {
      const oldStocks = { ...(drawerProduct.stocks || {}) };
      const newName =
        drawerCategory === "SIN CATEGORIA" ? drawerBase : `${drawerCategory} ${drawerBase}`;
      let prodId = drawerProduct.id;

      // Crear / actualizar master
      if (!prodId) {
        const { data, error } = await supabase
          .from("products_master")
          .insert({
            code: drawerProduct.code,
            codes_asociados: codesAsociados,
            name: newName,
            entryManual: !!drawerProduct.entryManual,
            default_purchase: drawerProduct.default_purchase,
            margin_percent: drawerProduct.margin_percent,
            default_selling: salePrice,
          })
          .select("id");
        if (error || !data?.[0]?.id) throw error || new Error("No se pudo crear el producto");
        prodId = data[0].id;
      } else {
        const { error } = await supabase
          .from("products_master")
          .update({
            code: drawerProduct.code,
            codes_asociados: codesAsociados,
            name: newName,
            default_purchase: drawerProduct.default_purchase,
            margin_percent: drawerProduct.margin_percent,
            entryManual: !!drawerProduct.entryManual,
            default_selling: salePrice,
          })
          .eq("id", prodId);
        if (error) throw error;
      }

      const old = oldStocks[selectedBranchId] ?? 0;
      const next = editableStocks[selectedBranchId] ?? 0;
      const changed = old !== next;

      const newStocksApplied: Record<string, number> = { ...(drawerProduct.stocks || {}) };
      if (changed) newStocksApplied[selectedBranchId] = next;

      if (!changed) {
        setInventory((prev) =>
          prev.filter((it) => it.id !== prodId).concat({
            id: prodId,
            code: drawerProduct.code,
            codes_asociados: codesAsociados,
            name: newName,
            default_purchase: drawerProduct.default_purchase,
            margin_percent: drawerProduct.margin_percent,
            default_selling: salePrice,
            stocks: newStocksApplied,
            entryManual: !!drawerProduct.entryManual,
          })
        );
        setIsSaving(false);
        closeDrawer();
        return;
      }

      // Upsert inventario SOLO sucursal activa con control optimista
      const { data: existing, error: readErr } = await supabase
        .from("business_inventory")
        .select("product_id, business_id, stock")
        .eq("product_id", prodId)
        .eq("business_id", selectedBranchId)
        .maybeSingle();
      if (readErr && (readErr as any).code !== "PGRST116") throw readErr;

      let conflict = false;

      if (existing) {
        const { data, error } = await supabase
          .from("business_inventory")
          .update({ stock: next })
          .eq("product_id", prodId)
          .eq("business_id", selectedBranchId)
          .eq("stock", old)
          .select("business_id");
        if (error) throw error;
        if (!data || data.length === 0) conflict = true;
      } else {
        const { error } = await supabase
          .from("business_inventory")
          .insert({ product_id: prodId, business_id: selectedBranchId, stock: next });
        if (error) {
          const retry = await supabase
            .from("business_inventory")
            .update({ stock: next })
            .eq("product_id", prodId)
            .eq("business_id", selectedBranchId)
            .eq("stock", old)
            .select("business_id");
          if (retry.error) throw retry.error;
          if (!retry.data || retry.data.length === 0) conflict = true;
        }
      }

      // Log de Actualizacion si cambió (sin lost_cash)
      if (!conflict && old !== next) {
        const details = user?.name
          ? `${user.name} cambió stock de ${newName} en ${selectedBranch?.name ?? selectedBranchId}: ${old} → ${next}`
          : `Cambio stock de ${newName} en ${selectedBranch?.name ?? selectedBranchId}: ${old} → ${next}`;
        try {
          await supabase.from("activities").insert({
            business_id: selectedBranchId,
            product_id: prodId,
            details,
            motivo: "Actualizacion",
            lost_cash: null,
            created_at: new Date().toISOString(),
          });
        } catch (logErr) {
          console.error("Error al loguear actualización:", logErr);
        }
      }

      if (conflict) {
        alert(
          `Atención: el stock en ${selectedBranch?.name ?? selectedBranchId} cambió mientras editabas.\n` +
            `No se guardó para evitar sobrescrituras.`
        );
      }

      setInventory((prev) =>
        prev.filter((it) => it.id !== prodId).concat({
          id: prodId,
          code: drawerProduct.code,
          codes_asociados: codesAsociados,
          name: newName,
          default_purchase: drawerProduct.default_purchase,
          margin_percent: drawerProduct.margin_percent,
          default_selling: salePrice,
          stocks: conflict ? (drawerProduct.stocks || {}) : newStocksApplied,
          entryManual: !!drawerProduct.entryManual,
        })
      );

      setIsSaving(false);
      if (!conflict) closeDrawer();
    } catch (e) {
      console.error("Error en saveAll:", e);
      alert("Ocurrió un error al guardar. Intenta nuevamente.");
      setIsSaving(false);
    }
  }

  const productRows = useMemo(() => {
    return paginated.map((item) => {
      const branchId = selectedBranchId!;
      const branchQty = item.stocks[branchId] ?? 0;
      const showNoStockBadge = searchTerm.trim() && branchQty === 0;

      const qtyColor =
        branchQty === 0 ? "bg-red-500" : branchQty < 6 ? "bg-yellow-400" : "bg-green-500";

      return (
        <tr
          key={item.id}
          className="border-b even:bg-slate-50/60 dark:even:bg-slate-800/30 hover:bg-slate-100 transition"
        >
          {/* Producto */}
          <td className="px-4 py-3">
            <div className="flex flex-col gap-1">
              <div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColor(
                    extractCategory(item.name).category
                  )}`}
                >
                  {extractCategory(item.name).category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">{item.name}</span>
                {showNoStockBadge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    SIN STOCK
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 truncate">{item.code}</div>
            </div>
          </td>

          {/* Compra */}
          <td className="px-4 py-3 whitespace-nowrap text-sm">
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: "ARS",
            }).format(item.default_purchase)}
          </td>

          {/* Venta (ordenable) */}
          <td
            className="px-4 py-3 whitespace-nowrap text-sm cursor-pointer select-none"
            onClick={toggleSortOrder}
            title="Ordenar por precio de venta"
          >
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: "ARS",
            }).format(item.default_selling)}
            {sortOrder === "asc" && " ▲"}
            {sortOrder === "desc" && " ▼"}
          </td>

          {/* Stock en sucursal activa */}
          <td className="px-4 py-3 text-sm text-center ">
            <div className="flex flex justify-center items-center">
              <div className={`${qtyColor} text-white text-xs rounded-full px-2`}>{branchQty}</div>
            </div>
          </td>

          {/* Acciones */}
          <td className="px-4 py-3 whitespace-nowrap">
            <div className="flex gap-2 justify-end items-center">
              <button
                onClick={() => openDrawer(item)}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                Ajustar
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`¿Eliminar ${item.name}?`)) return;

                  try {
                    // Soft delete master
                    const { error: upErr } = await supabase
                      .from("products_master")
                      .update({ deleted_at: new Date().toISOString() })
                      .eq("id", item.id);
                    if (upErr) throw upErr;

                    // Limpio inventario relacionado
                    await supabase.from("business_inventory").delete().eq("product_id", item.id);

                    setInventory((prev) => prev.filter((p) => p.id !== item.id));
                  } catch (e: any) {
                    alert("No se pudo eliminar (soft). " + (e?.message ?? "Error desconocido"));
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition"
              >
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      );
    });
  }, [paginated, selectedBranchId, selectedBranch?.name, searchTerm, sortOrder]);

  const isBusy = loading || businessesLoading;

  return (
    <div className="space-y-6 p-6">
      {/* Bloqueo hasta seleccionar sucursal */}
      {!selectedBranchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-2">Seleccioná la sucursal</h2>
            <p className="text-sm text-gray-600 mb-4">
              Para evitar confusiones, primero elegí sobre qué sucursal querés trabajar. Podrás
              cambiarla luego desde el encabezado.
            </p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {businessesLoading && (
                <div className="text-center py-6">Cargando sucursales…</div>
              )}
              {!businessesLoading &&
                businesses.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBranchId(b.id)}
                    className="w-full text-left px-4 py-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-gray-500">ID: {b.id}</div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedBranchId(null)}
            className="px-3 py-2 rounded-md border hover:bg-gray-100 dark:hover:bg-slate-800"
            title="Cambiar sucursal"
          >
            Cambiar sucursal
          </button>
          <div className="text-sm">
            <div className="text-gray-500 leading-tight">Sucursal actual</div>
            <div className="font-semibold leading-tight">
              {selectedBranch?.name ?? "—"}
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold">Inventario por Sucursal</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={openNew}
            disabled={!selectedBranchId}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${
              selectedBranchId
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
          >
            + Agregar Producto
          </button>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white dark:bg-slate-800 border rounded-md p-2 text-sm"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Buscador */}
      <div className="flex">
        <input
          type="text"
          placeholder="Buscar por nombre o código"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border rounded-md p-2 text-sm bg-white dark:bg-slate-800"
        />
        <button
          onClick={() => setSearchTerm("")}
          className="ml-2 px-4 rounded-md bg-red-600 text-white text-sm"
        >
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg">
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full text-base">
              <thead className="bg-slate-100 dark:bg-slate-700 text-sm uppercase">
                <tr>
                  <th className="px-6 py-4 text-left">Producto</th>
                  <th className="px-6 py-4 text-left">Compra</th>
                  <th className="px-6 py-4 text-left">Venta</th>
                  <th className="px-6 py-4 text-center">
                    Stock ({selectedBranch?.name ?? "Sucursal"})
                  </th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isBusy || !selectedBranchId ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      {selectedBranchId
                        ? "Cargando…"
                        : "Seleccione una sucursal para continuar"}
                    </td>
                  </tr>
                ) : (
                  productRows
                )}
              </tbody>
            </table>
          </div>

          {/* Footer paginación */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-3 px-4 py-3">
            <span className="text-sm text-gray-600">
              Mostrando <b>{totalItems === 0 ? 0 : startIndex + 1}</b>–<b>{endIndex}</b> de{" "}
              <b>{totalItems}</b>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`px-3 py-1 rounded-md border ${
                  page <= 1
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-100 dark:hover:bg-slate-700"
                }`}
              >
                Anterior
              </button>
              <span className="text-sm">
                Página <b>{page}</b> / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`px-3 py-1 rounded-md border ${
                  page >= totalPages
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-100 dark:hover:bg-slate-700"
                }`}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {drawerProduct && selectedBranchId && (
        <div className="fixed inset-0 flex z-50">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
          <div className="relative ml-auto w-full max-w-3xl h-full bg-white p-6 overflow-y-auto shadow-xl rounded-l-2xl">
            <h2 className="text-2xl font-semibold mb-6">Ajustar Producto</h2>

            {/* Datos del producto */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 shadow-md space-y-4 mb-8">
              <h3 className="text-lg font-semibold mb-2">Datos del producto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Categoría</label>
                  <select
                    value={drawerCategory}
                    onChange={(e) => setDrawerCategory(e.target.value as Category)}
                    className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Nombre base</label>
                  <input
                    type="text"
                    value={drawerBase}
                    onChange={(e) => setDrawerBase(e.target.value)}
                    className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium">Código principal</label>
                  <input
                    type="text"
                    value={drawerProduct.code || ""}
                    onChange={(e) =>
                      setDrawerProduct((pr) => (pr ? { ...pr, code: e.target.value } : pr))
                    }
                    className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                  />
                </div>

                {/* Códigos secundarios */}
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium">Códigos secundarios</label>

                  {/* Input + acciones */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={codeDraft}
                      onChange={(e) => setCodeDraft(e.target.value)}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text");
                        if (!text || text.trim() === "") return;
                        const parts = text
                          .split(/[\s,;\n\r]+/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        if (parts.length <= 1) return; // paste normal si es 1
                        e.preventDefault();
                        setCodesAsociados((prev) => {
                          const set = new Set(prev);
                          parts.forEach((p) => set.add(p));
                          return Array.from(set);
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          const raw = (codeDraft || "").trim();
                          if (!raw) return;
                          setCodesAsociados((prev) =>
                            prev.includes(raw) ? prev : [...prev, raw]
                          );
                          setCodeDraft("");
                        } else if (e.key === "Backspace" && !codeDraft) {
                          setCodesAsociados((prev) => prev.slice(0, -1));
                        }
                      }}
                      placeholder="Escribí un código y Enter (podés pegar varios)"
                      className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                      inputMode="text"
                      autoComplete="off"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const raw = (codeDraft || "").trim();
                          if (!raw) return;
                          setCodesAsociados((prev) =>
                            prev.includes(raw) ? prev : [...prev, raw]
                          );
                          setCodeDraft("");
                        }}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[.98]"
                      >
                        Agregar
                      </button>
                      {codesAsociados.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("¿Limpiar todos los códigos secundarios?"))
                              setCodesAsociados([]);
                          }}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-slate-200 text-slate-800 hover:bg-slate-300 active:scale-[.98]"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chips */}
                  <div className="flex sm:grid gap-2 sm:grid-cols-2 lg:grid-cols-3 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
                    {codesAsociados.length === 0 && (
                      <span className="text-xs text-gray-500">
                        Sin códigos secundarios cargados
                      </span>
                    )}

                    {codesAsociados.map((c) => (
                      <div
                        key={c}
                        className="group shrink-0 sm:shrink sm:w-auto inline-flex items-center justify-between rounded-full border border-slate-300 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-700/60 px-3 py-2 min-h-[38px] gap-2 max-w-[85vw] sm:max-w-none"
                        title={c}
                      >
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate max-w-[60vw] sm:max-w-[16rem]">
                          {c}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(c);
                              } catch {}
                            }}
                            className="rounded-full p-1.5 text-[10px] leading-none bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-600"
                            aria-label={`Copiar ${c}`}
                            title="Copiar"
                          >
                            ⧉
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setCodesAsociados((prev) => prev.filter((x) => x !== c))
                            }
                            className="rounded-full p-1.5 text-[12px] leading-none bg-red-100/80 text-red-700 hover:bg-red-200 border border-red-200 min-w-[28px] min-h-[28px]"
                            aria-label={`Eliminar ${c}`}
                            title="Eliminar"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-slate-500">
                    {codesAsociados.length} código(s)
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Precio Compra - <b style={{ fontSize: 18 }}>VERIFICAR SIEMPRE</b>
                  </label>
                  <input
                    type="number"
                    value={drawerProduct.default_purchase || 0}
                    onChange={(e) =>
                      setDrawerProduct((pr) =>
                        pr ? { ...pr, default_purchase: Number(e.target.value) } : pr
                      )
                    }
                    className="w-full border rounded-lg p-3 text-sm dark:bg-slate-800"
                    style={{ background: "#ffa2a2", border: 1, borderColor: "black", borderRadius: 15 }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Margen %</label>
                  <input
                    type="number"
                    value={drawerProduct.margin_percent || 0}
                    onChange={(e) =>
                      setDrawerProduct((pr) =>
                        pr ? { ...pr, margin_percent: Number(e.target.value) } : pr
                      )
                    }
                    className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Precio Venta</label>
                  <input
                    type="number"
                    value={salePrice || 0}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                  />
                  <div className="text-xs italic text-gray-500 mt-1">
                    Sugerido:{" "}
                    {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                    }).format(
                      (drawerProduct.default_purchase || 0) *
                        (1 + (drawerProduct.margin_percent || 0) / 100)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* entryManual */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Búsqueda manual</label>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!drawerProduct.entryManual}
                  onChange={(e) =>
                    setDrawerProduct((pr) =>
                      pr ? { ...pr, entryManual: e.target.checked } : pr
                    )
                  }
                  className="h-4 w-4 accent-black"
                />
                <span className="text-sm">
                  Permitir que este producto <b>aparezca en la búsqueda manual</b>
                </span>
              </label>
              <p className="text-xs text-gray-500">
                Si está desactivado, el producto sólo se podrá vender por <i>scanner</i> o
                accesos directos.
              </p>
            </div>

            {/* Stock por sucursal */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 shadow-md space-y-4 mt-6">
              <h3 className="text-lg font-semibold mb-2">
                Stock en {selectedBranch?.name}
              </h3>
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                <span className="text-sm font-medium">{selectedBranch?.name}</span>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
                  <span className="text-sm text-gray-700">
                    Stock actual:{" "}
                    <span className="font-semibold">
                      {editableStocks[selectedBranchId] ?? 0}
                    </span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openStockModal("add")}
                      className="px-3 py-1 rounded-md text-sm bg-green-600 text-white hover:bg-green-700"
                    >
                      Agregar stock
                    </button>
                    <button
                      onClick={() => openStockModal("remove")}
                      className="px-3 py-1 rounded-md text-sm bg-red-600 text-white hover:bg-red-700"
                    >
                      Quitar stock
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-10">
              <button
                onClick={closeDrawer}
                disabled={isSaving}
                className={`px-6 py-3 border rounded-lg text-sm font-medium ${
                  isSaving ? "bg-gray-100 cursor-not-allowed" : "hover:bg-gray-100"
                }`}
              >
                CANCELAR
              </button>
              <button
                onClick={saveAll}
                disabled={isSaving}
                className={`px-6 py-3 rounded-lg text-sm font-semibold transition ${
                  isSaving
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                CONFIRMAR CAMBIOS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de stock */}
      {isStockModalOpen && drawerProduct && selectedBranchId && (
        <div className="fixed inset-0 flex z-50 items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsStockModalOpen(false)}
          />
          <div className="relative z-10 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl max-w-md w-full space-y-4">
            <h3 className="text-xl font-semibold">
              {stockModalAction === "add" ? "Agregar Stock" : "Quitar Stock"}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              ¿Cuántas unidades querés{" "}
              {stockModalAction === "add" ? "agregar" : "quitar"} en{" "}
              {selectedBranch?.name}?
            </p>
            <input
              type="number"
              min={1}
              value={stockModalAmount}
              onChange={(e) => setStockModalAmount(Number(e.target.value))}
              className="w-full border rounded-md p-2 bg-white dark:bg-slate-900"
            />
            {stockModalAction === "remove" && (
              <div>
                <label className="block text-sm mb-1">Motivo</label>
                <select
                  value={stockModalReason}
                  onChange={(e) =>
                    setStockModalReason(e.target.value as Motivo)
                  }
                  className="w-full border rounded-md p-2 bg-white dark:bg-slate-900"
                >
                  {/* ✅ Valores consistentes: "Perdida" | "Actualizacion" | "Vencimiento" */}
                  <option value="Perdida">Pérdida</option>
                  <option value="Vencimiento">Vencimiento</option>
                  <option value="Actualizacion">Actualización</option>
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsStockModalOpen(false)}
                className="px-4 py-2 rounded-md border hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStockModal}
                disabled={isModalSubmitting}
                className={`px-4 py-2 rounded-md text-white ${
                  isModalSubmitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isModalSubmitting ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
