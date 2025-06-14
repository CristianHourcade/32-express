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
  "SIN CATEGORIA",
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
};

export default function InventoryPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { businesses, loading: businessesLoading } = useSelector(
    (s: RootState) => s.businesses
  );
  const { user } = useSelector((s: RootState) => s.auth);
  const businessId = user?.businessId
  const [stockModal, setStockModal] = useState<{
    item: InventoryItem | null;
    type: "add" | "remove" | null;
  }>({ item: null, type: null });

  const [stockAmount, setStockAmount] = useState<number>(0);
  function openStockModal(item: InventoryItem, type: "add" | "remove") {
    setStockModal({ item, type });
    setStockAmount(0);
  }
  function closeStockModal() {
    setStockModal({ item: null, type: null });
  }

  // Estados
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState<InventoryItem | null>(null);
  const [editableStocks, setEditableStocks] = useState<Record<string, number>>({});
  const [salePrice, setSalePrice] = useState<number>(0);
  const [drawerCategory, setDrawerCategory] = useState<string>("SIN CATEGORIA");
  const [drawerBase, setDrawerBase] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  async function fetchAllMasters() {
    const step = 1000;
    let from = 0;
    let allMasters: any[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("products_master")
        .select("id, code, name, default_purchase, margin_percent, default_selling")
        .range(from, from + step - 1);

      if (error) throw error;
      allMasters = allMasters.concat(data);
      if (data.length < step) break;
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
      allInv = allInv.concat(data);
      if (data.length < step) break;
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
    });
    setDrawerCategory("SIN CATEGORIA");
    setDrawerBase("");
    setSalePrice(0);
    setEditableStocks({});
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
      invData.forEach(r => {
        map[r.product_id] = map[r.product_id] || {};
        map[r.product_id][r.business_id] = r.stock;
      });

      // armo el estado de inventory
      setInventory(
        masters.map(m => ({
          id: m.id,
          code: m.code,
          name: m.name,
          default_purchase: m.default_purchase,
          margin_percent: m.margin_percent,
          default_selling: m.default_selling,
          stocks: map[m.id] || {},
        }))
      );

      setLoading(false);
    }

    fetchData();
  }, [businesses]);

  // Filtrado por categoría
  const filtered = useMemo(() => {
    const filteredList = inventory.filter(item => {
      const categoryMatch = selectedCategory
        ? extractCategory(item.name).category === selectedCategory
        : true;

      const searchMatch = searchQuery.trim() === "" || (
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase())
      );

      return categoryMatch && searchMatch;
    });

    return filteredList.sort((a, b) => {
      const stockA = a.stocks[businessId ?? ""] || 0;
      const stockB = b.stocks[businessId ?? ""] || 0;
      return stockB - stockA;
    });
  }, [inventory, selectedCategory, searchQuery, businessId]);



  const isBusy = loading || businessesLoading;

  // Abrir/cerrar drawer
  function openDrawer(item: InventoryItem) {
    const { category, base } = extractCategory(item.name);
    setDrawerProduct(item);
    setEditableStocks({ ...item.stocks });
    setSalePrice(item.default_selling);
    setDrawerCategory(category);
    setDrawerBase(base);
  }
  function closeDrawer() {
    setDrawerProduct(null);
  }

  // Guardar o crear
  async function saveAll() {
    if (!drawerProduct) return;

    // 1) Snapshot de stocks viejos
    const oldStocks = { ...drawerProduct.stocks };

    // 2) Construye el nombre final
    const newName =
      drawerCategory === "SIN CATEGORIA"
        ? drawerBase
        : `${drawerCategory} ${drawerBase}`;

    let prodId = drawerProduct.id;

    // 3) Inserta o actualiza en products_master
    if (!prodId) {
      const { data: insData, error: insErr } = await supabase
        .from("products_master")
        .insert({
          code: drawerProduct.code,
          name: newName,
          default_purchase: drawerProduct.default_purchase,
          margin_percent: drawerProduct.margin_percent,
          default_selling: salePrice,
        })
        .select("id");
      if (insErr || !insData?.[0]?.id) {
        console.error("Error al crear producto master:", insErr);
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
          default_selling: salePrice,
        })
        .eq("id", prodId);
      if (updErr) {
        console.error("Error al actualizar producto master:", updErr);
        return;
      }
    }

    // 4) Upsert en business_inventory
    const ops = Object.entries(editableStocks).map(([business_id, stock]) => ({
      product_id: prodId,
      business_id,
      stock,
    }));
    const { error: invErr } = await supabase
      .from("business_inventory")
      .upsert(ops, { onConflict: ["business_id", "product_id"] });
    if (invErr) {
      console.error("Error al guardar inventario:", invErr);
      return;
    }

    // 5) Actualiza estado local
    setInventory(prev =>
      prev
        .filter(it => it.id !== prodId)
        .concat({
          id: prodId,
          code: drawerProduct.code,
          name: newName,
          default_purchase: drawerProduct.default_purchase,
          margin_percent: drawerProduct.margin_percent,
          default_selling: salePrice,
          stocks: editableStocks,
        })
    );

    // 6) Log en activities por cada cambio, usando el nombre del local
    for (const [business_id, newStock] of Object.entries(editableStocks)) {
      const oldStock = oldStocks[business_id] ?? 0;
      if (oldStock !== newStock) {
        // Busca el nombre del local en el array de businesses
        const biz = businesses.find(b => b.id === business_id);
        const bizName = biz ? biz.name : business_id;

        const details = user?.name
          ? `${user.name} cambió stock de ${newName} en ${bizName}: ${oldStock} → ${newStock}`
          : `Cambio stock de ${newName} en ${bizName}: ${oldStock} → ${newStock}`;

        try {
          await supabase.from("activities").insert({
            business_id,
            details,
            created_at: new Date().toISOString(),
          });
        } catch (logErr) {
          console.error("Error al loguear actividad:", logErr);
        }
      }
    }

    // 7) Cierra el drawer
    closeDrawer();
  }

  const categoryColors: Record<string, string> = {
    ALMACEN: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    CIGARRILLOS: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    GOLOSINAS: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    BEBIDA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    CERVEZA: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    FIAMBRES: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    TABACO: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    HUEVOS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    HIGIENE: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    ALCOHOL: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    "SIN CATEGORIA": "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  };

  async function confirmStockChange() {
    const product = stockModal.item;
    const type = stockModal.type;
    if (!product || !type || !businessId) return;

    const currentStock = product.stocks[businessId] || 0;
    const delta = type === "add" ? stockAmount : -stockAmount;
    const newStock = Math.max(0, currentStock + delta);

    // Upsert nuevo stock
    const { error } = await supabase
      .from("business_inventory")
      .upsert([{ product_id: product.id, business_id: businessId, stock: newStock }], {
        onConflict: ["business_id", "product_id"],
      });

    if (error) {
      console.error("Error al actualizar stock:", error);
      return;
    }

    // Log de actividad
    const details = `${user?.name || "Usuario"} ${type === "add" ? "agregó" : "quitó"} stock de ${product.name}: ${currentStock} → ${newStock}`;
    await supabase.from("activities").insert({
      business_id: businessId,
      details,
      created_at: new Date().toISOString(),
    });

    // Actualiza local
    setInventory(prev =>
      prev.map(p =>
        p.id === product.id
          ? {
            ...p,
            stocks: { ...p.stocks, [businessId]: newStock },
          }
          : p
      )
    );

    closeStockModal();
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">Inventario</h1>

        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white dark:bg-slate-800 border rounded-md p-2 text-sm"
          />
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


      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
        <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-lg">
          <table className="min-w-full text-base">
            <thead className="bg-slate-100 dark:bg-slate-700 text-sm uppercase">
              <tr>
                <th className="px-6 py-4 text-left">Producto</th>
                <th className="px-6 py-4">Venta</th>
                <th className="px-6 py-4">STOCK</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isBusy ? (
                <tr><td colSpan={4 + businesses.length} className="py-16 text-center">Cargando…</td></tr>
              ) : (
                filtered.map(item => {
                  const sell = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(item.default_selling);
                  return (
                    <tr key={item.id} className="border-b even:bg-slate-50/60 dark:even:bg-slate-800/30 hover:bg-slate-100 transition">
                      <td className="px-6 py-4">
                        {(() => {
                          const { category, base } = extractCategory(item.name);
                          const badgeStyle = categoryColors[category] || "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
                          return (
                            <div>
                              <span className={`text-xs rounded-full px-2 py-0.5 ${badgeStyle}`}>
                                {category}
                              </span>
                              <div className="font-medium flex items-center gap-2">
                                {base}
                              </div>
                              <div className="text-sm text-gray-500">{item.code}</div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">{sell}</td>
                      {businesses.filter(b => b.id === businessId).map(b => {
                        const qty = item.stocks[b.id] || 0;
                        const color = qty === 0 ? "bg-red-500" : qty < 6 ? "bg-yellow-400" : "bg-green-500";
                        return <td key={b.id} className="px-6 py-4 text-center"><span className={`${color} text-white rounded-full px-2`}>{qty}</span></td>;
                      })}
                      <td className="px-6 py-4 flex gap-2 justify-end">
                        <button
                          onClick={() => openStockModal(item, "add")}
                          className="bg-green-600 text-white text-xs px-4 py-2 rounded-lg"
                        >
                          Agregar stock
                        </button>
                        <button
                          onClick={() => openStockModal(item, "remove")}
                          className="bg-red-600 text-white text-xs px-4 py-2 rounded-lg"
                        >
                          Quitar stock
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {stockModal.item && stockModal.type && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-black/20" onClick={closeStockModal} />
          <div className="absolute top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-lg bg-white dark:bg-slate-800 p-6 pointer-events-auto">
            <h2 className="text-xl font-semibold mb-4">
              {stockModal.type === "add" ? "Agregar" : "Quitar"} stock a <br />
              <span className="text-indigo-600 dark:text-indigo-300">{stockModal.item.name}</span>
            </h2>

            <label className="block text-sm mb-4">
              Cantidad:
              <input
                type="number"
                min="0"
                value={stockAmount}
                onChange={(e) => setStockAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-md border p-2 text-base"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                onClick={closeStockModal}
                className="px-4 py-2 rounded-md border text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmStockChange}
                className={`px-4 py-2 text-sm rounded-md text-white ${stockModal.type === "add" ? "bg-green-600" : "bg-red-600"}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
