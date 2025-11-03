"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice";
import { supabase } from "@/lib/supabase";

// Categorías disponibles
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
];

// Helper para derivar categoría y base del nombre
function extractCategory(name: string): { category: string; base: string } {
  const parts = name.trim().split(" ");
  const first = parts[0].toUpperCase();
  if (categories.includes(first)) {
    return { category: first, base: parts.slice(1).join(" ") };
  }
  return { category: "SIN CATEGORIA", base: name };
}

type InventoryItem = {
  id: string;
  code: string;
  name: string;
  default_purchase: number;
  margin_percent: number;
  default_selling: number;
  stocks: Record<string, number>;
  entryManual?: boolean; // UI; en DB es entryManual
};

// ¿Tiene stock en algún local?
const hasAnyStock = (item: InventoryItem) =>
  Object.values(item.stocks || {}).some((q) => (q ?? 0) > 0);

export default function InventoryPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { businesses, loading: businessesLoading } = useSelector(
    (s: RootState) => s.businesses
  );
  const { user } = useSelector((s: RootState) => s.auth);

  // Estados
  const [stockModalReason, setStockModalReason] =
    useState<"Perdida" | "Actualizacion">("Actualizacion");
  const [searchTerm, setSearchTerm] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState<InventoryItem | null>(null);
  const [editableStocks, setEditableStocks] = useState<Record<string, number>>(
    {}
  );
  const [salePrice, setSalePrice] = useState<number>(0);
  const [drawerCategory, setDrawerCategory] = useState<string>("SIN CATEGORIA");
  const [drawerBase, setDrawerBase] = useState<string>("");
  const [stockChangeReasons, setStockChangeReasons] = useState<
    Record<string, "Perdida" | "Actualizacion">
  >({});
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // 🧭 Paginación (10 por página)
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  async function fetchAllMasters() {
    const step = 1000;
    let from = 0;
    let allMasters: any[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("products_master")
        .select(
          "id, code, name, default_purchase, margin_percent, default_selling, entryManual"
        )
        .range(from, from + step - 1);

      if (error) throw error;
      allMasters = allMasters.concat(data || []);
      if (!data || data.length < step) break;
      from += step;
    }

    return allMasters;
  }

  async function fetchAllInventory() {
    const step = 1000;
    let from = 0;
    let allInv: any[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("business_inventory")
        .select("business_id, product_id, stock")
        .range(from, from + step - 1);

      if (error) throw error;
      allInv = allInv.concat(data || []);
      if (!data || data.length < step) break;
      from += step;
    }

    return allInv;
  }

  // Crear nuevo producto
  function openNew() {
    setDrawerProduct({
      id: "",
      code: "",
      name: "",
      default_purchase: 0,
      margin_percent: 0,
      default_selling: 0,
      stocks: {},
      entryManual: false,
    });
    setDrawerCategory("SIN CATEGORIA");
    setDrawerBase("");
    setSalePrice(0);
    setEditableStocks({});
    setStockChangeReasons({});
  }

  // Fetch inicial
  useEffect(() => {
    dispatch(fetchBusinesses());
  }, [dispatch]);

  useEffect(() => {
    async function fetchData() {
      if (!businesses.length) return;
      setLoading(true);

      // traigo TODO products_master en bloques de 1000
      const masters = await fetchAllMasters();

      // traigo TODO business_inventory en bloques de 1000
      const invData = await fetchAllInventory();

      // reconstruyo el mapa de stocks
      const map: Record<string, Record<string, number>> = {};
      invData.forEach((r) => {
        map[r.product_id] = map[r.product_id] || {};
        map[r.product_id][r.business_id] = r.stock;
      });

      // armo el estado de inventory
      setInventory(
        masters.map((m: any) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          default_purchase: m.default_purchase,
          margin_percent: m.margin_percent,
          default_selling: m.default_selling,
          stocks: map[m.id] || {},
          entryManual: !!(m.entryManual ?? m.entryManual ?? false), // normalizo camel
        }))
      );

      setLoading(false);
    }

    fetchData();
  }, [businesses]);

  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  function toggleSortOrder() {
    setSortOrder((prev) => {
      if (prev === "asc") return "desc";
      if (prev === "desc") return null;
      return "asc";
    });
  }

  // Filtrado:
  // - Sin búsqueda: solo productos con stock > 0 (en cualquier local)
  // - Con búsqueda: busca en TODO el inventory (aunque stock sea 0)
  const filtered = useMemo(() => {
    const base = searchTerm.trim() ? inventory : inventory.filter(hasAnyStock);

    let list = base.filter((item) => {
      const { category } = extractCategory(item.name);
      const matchesCategory = selectedCategory ? category === selectedCategory : true;

      const q = searchTerm.toLowerCase();
      const matchesSearch = !q
        ? true
        : item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });

    if (sortOrder) {
      list = [...list].sort((a, b) =>
        sortOrder === "asc"
          ? a.default_selling - b.default_selling
          : b.default_selling - a.default_selling
      );
    }

    return list;
  }, [inventory, selectedCategory, searchTerm, sortOrder]);

  // 🔄 Resetear página cuando cambian filtros/orden/datos
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, sortOrder, inventory.length]);

  // Derivar paginado
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

  const paginated = useMemo(
    () => filtered.slice(startIndex, endIndex),
    [filtered, startIndex, endIndex]
  );

  const isBusy = loading || businessesLoading;

  // Abrir/cerrar drawer
  function openDrawer(item: InventoryItem) {
    const { category, base } = extractCategory(item.name);
    setDrawerProduct(item);
    setEditableStocks({ ...item.stocks });
    setSalePrice(item.default_selling);
    setDrawerCategory(category);
    setDrawerBase(base);
    setStockChangeReasons({});
  }
  function closeDrawer() {
    setDrawerProduct(null);
  }

  const [isSaving, setIsSaving] = useState(false);

  // Guardar o crear
  async function saveAll() {
    if (!drawerProduct) return;
    setIsSaving(true);

    try {
      const oldStocks: Record<string, number> = { ...(drawerProduct.stocks || {}) };
      const newName =
        drawerCategory === "SIN CATEGORIA" ? drawerBase : `${drawerCategory} ${drawerBase}`;
      let prodId = drawerProduct.id;

      // === 1) Crear/Actualizar producto master ===
      if (!prodId) {
        const { data: insData, error: insErr } = await supabase
          .from("products_master")
          .insert({
            code: drawerProduct.code,
            name: newName,
            entryManual: !!drawerProduct.entryManual,
            default_purchase: drawerProduct.default_purchase,
            margin_percent: drawerProduct.margin_percent,
            default_selling: salePrice,
          })
          .select("id");

        if (insErr || !insData?.[0]?.id) {
          console.error("Error al crear producto master:", insErr);
          alert("No se pudo crear el producto. Intenta nuevamente.");
          setIsSaving(false);
          return;
        }
        prodId = insData[0].id;
      } else {
        const { error: updErr } = await supabase
          .from("products_master")
          .update({
            code: drawerProduct.code,
            name: newName,
            default_purchase: drawerProduct.default_purchase,
            margin_percent: drawerProduct.margin_percent,
            entryManual: !!drawerProduct.entryManual,
            default_selling: salePrice,
          })
          .eq("id", prodId);

        if (updErr) {
          console.error("Error al actualizar producto master:", updErr);
          alert("No se pudo actualizar el producto. Intenta nuevamente.");
          setIsSaving(false);
          return;
        }
      }

      // === 2) Detectar cambios reales de stock (solo lo que difiere) ===
      const changedEntries = Object.entries(editableStocks).filter(([business_id, newStock]) => {
        const old = (oldStocks ?? {})[business_id] ?? 0;
        return old !== newStock;
      });
      const businessIdsChanged = changedEntries.map(([business_id]) => business_id);

      // Nada cambió en inventario: solo refrescamos master y salimos
      if (businessIdsChanged.length === 0) {
        // Actualiza estado local del producto (por si cambió nombre/precio/etc.)
        setInventory((prev) =>
          prev
            .filter((it) => it.id !== prodId)
            .concat({
              id: prodId,
              code: drawerProduct.code,
              name: newName,
              default_purchase: drawerProduct.default_purchase,
              margin_percent: drawerProduct.margin_percent,
              default_selling: salePrice,
              stocks: { ...(drawerProduct.stocks || {}) },
              entryManual: !!drawerProduct.entryManual,
            })
        );
        setIsSaving(false);
        closeDrawer();
        return;
      }

      // === 3) Traer inventario existente SOLO de sucursales cambiadas ===
      const { data: existing, error: fetchError } = await supabase
        .from("business_inventory")
        .select("product_id, business_id, stock")
        .eq("product_id", prodId)
        .in("business_id", businessIdsChanged);

      if (fetchError) {
        console.error("Error al obtener inventario existente:", fetchError);
        alert("No se pudo leer el inventario. Intenta nuevamente.");
        setIsSaving(false);
        return;
      }

      const existingMap = new Map((existing ?? []).map((r) => [r.business_id, r]));

      type ChangeRow = { business_id: string; oldStock: number; newStock: number };
      const updates: ChangeRow[] = [];
      const inserts: ChangeRow[] = [];

      for (const [business_id, newStock] of changedEntries) {
        const oldStock = (oldStocks ?? {})[business_id] ?? 0;
        if (existingMap.has(business_id)) {
          updates.push({ business_id, oldStock, newStock });
        } else {
          inserts.push({ business_id, oldStock, newStock });
        }
      }

      // === 4) Ejecutar UPDATES con bloqueo optimista (stock actual debe igualar oldStock) ===
      const conflicts: string[] = [];
      for (const u of updates) {
        const { data, error } = await supabase
          .from("business_inventory")
          .update({ stock: u.newStock })
          .eq("product_id", prodId)
          .eq("business_id", u.business_id)
          .eq("stock", u.oldStock) // evita pisar cambios concurrentes
          .select("business_id");

        if (error) {
          console.error("Error al actualizar stock:", error);
          alert("No se pudo actualizar el stock en una sucursal.");
          setIsSaving(false);
          return;
        }
        if (!data || data.length === 0) {
          // Nadie coincide con el oldStock -> alguien lo cambió
          conflicts.push(u.business_id);
        }
      }

      // === 5) Ejecutar INSERTS (si otro insertó, reintenta como UPDATE condicionado) ===
      for (const ins of inserts) {
        const { error } = await supabase
          .from("business_inventory")
          .insert({ product_id: prodId, business_id: ins.business_id, stock: ins.newStock });

        if (error) {
          // Reintento como UPDATE con lock por oldStock (evita pisar)
          const retry = await supabase
            .from("business_inventory")
            .update({ stock: ins.newStock })
            .eq("product_id", prodId)
            .eq("business_id", ins.business_id)
            .eq("stock", ins.oldStock)
            .select("business_id");

          if (retry.error) {
            console.error("Error al reintentar insert->update stock:", retry.error);
            alert("No se pudo insertar/actualizar el stock en una sucursal.");
            setIsSaving(false);
            return;
          }
          if (!retry.data || retry.data.length === 0) {
            conflicts.push(ins.business_id);
          }
        }
      }

      // === 6) Log de actividades “Actualización” SOLO para cambios aplicados ===
      const appliedIds = new Set(businessIdsChanged.filter((id) => !conflicts.includes(id)));

      for (const [business_id, newStock] of changedEntries) {
        if (!appliedIds.has(business_id)) continue; // no loguear conflictos

        const motivo = stockChangeReasons[business_id] || "Actualizacion";
        if (motivo === "Perdida") continue; // las pérdidas ya se loguean al confirmar el modal

        const oldStock = (oldStocks ?? {})[business_id] ?? 0;
        if (oldStock === newStock) continue;

        const biz = businesses.find((b) => b.id === business_id);
        const bizName = biz ? biz.name : business_id;
        const details = user?.name
          ? `${user.name} cambió stock de ${newName} en ${bizName}: ${oldStock} → ${newStock}`
          : `Cambio stock de ${newName} en ${bizName}: ${oldStock} → ${newStock}`;

        try {
          await supabase.from("activities").insert({
            business_id,
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

      // === 7) Avisar conflictos (si hubo) y actualizar estado local SOLO con lo aplicado ===
      if (conflicts.length > 0) {
        alert(
          `Atención: el stock de ${conflicts.length} sucursal(es) cambió mientras editabas.\n` +
          `No se guardaron esos cambios para evitar sobrescrituras.\n` +
          `Sucursales: ${conflicts
            .map((id) => businesses.find((b) => b.id === id)?.name || id)
            .join(", ")}`
        );
      }

      const newStocksApplied: Record<string, number> = { ...(drawerProduct.stocks || {}) };
      for (const [business_id, newStock] of changedEntries) {
        if (appliedIds.has(business_id)) {
          newStocksApplied[business_id] = newStock;
        }
      }

      // === 8) Actualizar inventario en estado global y cerrar si no hubo conflictos ===
      setInventory((prev) =>
        prev
          .filter((it) => it.id !== prodId)
          .concat({
            id: prodId,
            code: drawerProduct.code,
            name: newName,
            default_purchase: drawerProduct.default_purchase,
            margin_percent: drawerProduct.margin_percent,
            default_selling: salePrice,
            stocks: newStocksApplied,
            entryManual: !!drawerProduct.entryManual,
          })
      );

      setIsSaving(false);
      if (conflicts.length === 0) closeDrawer();
    } catch (e) {
      console.error("Error en saveAll:", e);
      alert("Ocurrió un error al guardar. Intenta nuevamente.");
      setIsSaving(false);
    }
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

  const productRows = useMemo(() => {
    return paginated.map((item) => {
      const showNoStockBadge = searchTerm.trim() && !hasAnyStock(item);

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

          {/* Venta */}
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

          {/* Ver Inventario */}
          <td className="px-4 py-3 text-sm">
            <details className="group">
              <summary className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2 rounded-md text-center cursor-pointer w-full text-sm font-medium">
                VER INVENTARIO
              </summary>
              <div className="mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-slate-700 p-3 space-y-2 w-full max-w-md">
                {businesses.map((b) => {
                  const qty = item.stocks[b.id] || 0;
                  const color =
                    qty === 0
                      ? "bg-red-500"
                      : qty < 6
                        ? "bg-yellow-400"
                        : "bg-green-500";
                  return (
                    <div key={b.id} className="flex justify-between items-center">
                      <span className="truncate">{b.name}</span>
                      <span className={`${color} text-white text-xs rounded-full px-2`}>
                        {qty}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
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
                onClick={() => {
                  if (confirm(`¿Eliminar ${item.name}?`)) {
                    supabase
                      .from("products_master")
                      .delete()
                      .eq("id", item.id)
                      .then(() =>
                        setInventory((prev) => prev.filter((p) => p.id !== item.id))
                      );
                    supabase.from("business_inventory").delete().eq("product_id", item.id);
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
  }, [paginated, businesses, searchTerm, sortOrder]);

  // --- Modal de stock ---
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockModalAction, setStockModalAction] =
    useState<"add" | "remove" | null>(null);
  const [stockModalBusiness, setStockModalBusiness] = useState<string | null>(
    null
  );
  const [stockModalAmount, setStockModalAmount] = useState<number>(1);

  function openStockModal(action: "add" | "remove", businessId: string) {
    setStockModalAction(action);
    setStockModalBusiness(businessId);
    setStockModalAmount(1);
    setStockModalReason("Actualizacion");
    setIsStockModalOpen(true);
  }
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);

  // Handler: confirmar modal (con log inmediato de Pérdida)
  async function handleConfirmStockModal() {
    if (!stockModalAction || !stockModalBusiness) return;
    if (isModalSubmitting) return;
    setIsModalSubmitting(true);

    try {
      const businessId = stockModalBusiness;
      const current = editableStocks[businessId] ?? 0;
      const newValue =
        stockModalAction === "add"
          ? current + stockModalAmount
          : Math.max(0, current - stockModalAmount);

      // Log inmediato de Pérdida
      if (
        stockModalAction === "remove" &&
        stockModalReason === "Perdida" &&
        drawerProduct?.id
      ) {
        const qtyLost = Math.max(0, current - newValue);
        if (qtyLost > 0) {
          const newName =
            drawerCategory === "SIN CATEGORIA" ? drawerBase : `${drawerCategory} ${drawerBase}`;
          const biz = businesses.find((b) => b.id === businessId);
          const bizName = biz ? biz.name : businessId;
          const details = user?.name
            ? `${user.name} cambió stock de ${newName} en ${bizName}: ${current} → ${newValue}`
            : `Cambio stock de ${newName} en ${bizName}: ${current} → ${newValue}`;
          const lost_cash = qtyLost * (drawerProduct.default_selling ?? 0);

          await supabase.from("activities").upsert({
            business_id: businessId,
            product_id: drawerProduct.id,
            details,
            motivo: "Perdida",
            lost_cash,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Estado
      setEditableStocks((prev) => ({ ...prev, [businessId]: newValue }));
      setStockChangeReasons((prev) => ({
        ...prev,
        [businessId]:
          stockModalAction === "remove" ? stockModalReason : "Actualizacion",
      }));

      setIsStockModalOpen(false);
    } catch (e) {
      console.error("Error al confirmar stock:", e);
    } finally {
      setIsModalSubmitting(false);
    }
  }

  function categoryColorFooter() {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          + Agregar Producto
        </button>
        <h1 className="text-3xl font-bold">Productos de 32 EXPRESS</h1>
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
      </header>

      <div className="flex">
        <input
          type="text"
          placeholder="Buscar por nombre o código"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full  border rounded-md p-2 text-sm bg-white dark:bg-slate-800"
        />
        <button style={{ backgroundColor: 'red', color: 'white', padding: '0 20px' }} onClick={() => setSearchTerm('')}>
          Limpiar
        </button>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg">
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full text-base">
              <thead className="bg-slate-100 dark:bg-slate-700 text-sm uppercase">
                <tr>
                  <th className="px-6 py-4 text-left">Producto</th>
                  <th className="px-6 py-4 text-left">Compra</th>
                  <th className="px-6 py-4 text-left">Venta</th>
                  <th className="px-6 py-4 text-center">STOCK</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isBusy ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      Cargando…
                    </td>
                  </tr>
                ) : (
                  productRows
                )}
              </tbody>
            </table>
          </div>

          {/* Footer de paginación */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-3 px-4 py-3">
            <span className="text-sm text-gray-600">
              Mostrando{" "}
              <b>{totalItems === 0 ? 0 : startIndex + 1}</b>–<b>{endIndex}</b> de{" "}
              <b>{totalItems}</b>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`px-3 py-1 rounded-md border ${page <= 1
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
                className={`px-3 py-1 rounded-md border ${page >= totalPages
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

      {drawerProduct && (
        <div className="fixed inset-0 flex z-50">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
          <div className="relative ml-auto w-full max-w-3xl h-full bg-white p-6 overflow-y-auto shadow-xl rounded-l-2xl">
            <h2 className="text-2xl font-semibold mb-6">Ajustar Producto</h2>

            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 shadow-md space-y-4 mb-8">
              <h3 className="text-lg font-semibold mb-2">Datos del producto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Categoría</label>
                  <select
                    value={drawerCategory}
                    onChange={(e) => setDrawerCategory(e.target.value)}
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
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Código</label>
                  <input
                    type="text"
                    value={drawerProduct?.code || ""}
                    onChange={(e) =>
                      setDrawerProduct((pr) =>
                        pr ? { ...pr, code: e.target.value } : pr
                      )
                    }
                    className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Precio Compra - <b style={{ fontSize: 18 }}>VERIFICAR SIEMPRE</b>
                  </label>
                  <input
                    type="number"
                    value={drawerProduct?.default_purchase || ""}
                    onChange={(e) =>
                      setDrawerProduct((pr) =>
                        pr
                          ? { ...pr, default_purchase: Number(e.target.value) }
                          : pr
                      )
                    }
                    className="w-full border rounded-lg p-3 text-sm dark:bg-slate-800"
                    style={{
                      background: "#ffa2a2",
                      border: 1,
                      borderColor: "black",
                      borderRadius: 15,
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Margen %</label>
                  <input
                    type="number"
                    value={drawerProduct?.margin_percent || ""}
                    onChange={(e) =>
                      setDrawerProduct((pr) =>
                        pr
                          ? { ...pr, margin_percent: Number(e.target.value) }
                          : pr
                      )
                    }
                    className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Precio Venta</label>
                  <input
                    type="number"
                    value={salePrice || ""}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                  />
                  <div className="text-xs italic text-gray-500 mt-1">
                    Sugerido:{" "}
                    {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                    }).format(
                      (drawerProduct!.default_purchase || 0) *
                      (1 + (drawerProduct!.margin_percent || 0) / 100)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Switch entryManual */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Búsqueda manual</label>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!drawerProduct?.entryManual}
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

            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 shadow-md space-y-4">
              <h3 className="text-lg font-semibold mb-2">Stock por Local</h3>
              {businesses.map((b) => {
                const current = editableStocks[b.id] ?? 0;

                return (
                  <div
                    key={b.id}
                    className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg"
                  >
                    <span className="text-sm font-medium">{b.name}</span>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
                      <span className="text-sm text-gray-700">
                        Stock actual: <span className="font-semibold">{current}</span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openStockModal("add", b.id)}
                          className="px-3 py-1 rounded-md text-sm bg-green-600 text-white hover:bg-green-700"
                        >
                          Agregar stock
                        </button>
                        <button
                          onClick={() => openStockModal("remove", b.id)}
                          className="px-3 py-1 rounded-md text-sm bg-red-600 text-white hover:bg-red-700"
                        >
                          Quitar stock
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-4 mt-10">
              <button
                onClick={closeDrawer}
                disabled={isSaving}
                className={`px-6 py-3 border rounded-lg text-sm font-medium ${isSaving ? "bg-gray-100 cursor-not-allowed" : "hover:bg-gray-100"
                  }`}
              >
                CANCELAR
              </button>
              <button
                onClick={saveAll}
                disabled={isSaving}
                className={`px-6 py-3 rounded-lg text-sm font-semibold transition ${isSaving
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

      {isStockModalOpen && stockModalAction && stockModalBusiness && (
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
              {businesses.find((b) => b.id === stockModalBusiness)?.name}?
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
                    setStockModalReason(
                      e.target.value as "Perdida" | "Actualizacion"
                    )
                  }
                  className="w-full border rounded-md p-2 bg-white dark:bg-slate-900"
                >
                  <option value="Perdida">Pérdida</option>
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
                className={`px-4 py-2 rounded-md text-white ${isModalSubmitting
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
