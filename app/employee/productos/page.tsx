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

    // Estados
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [drawerProduct, setDrawerProduct] = useState<InventoryItem | null>(null);
    const [editableStocks, setEditableStocks] = useState<Record<string, number>>({});
    const [salePrice, setSalePrice] = useState<number>(0);
    const [drawerCategory, setDrawerCategory] = useState<string>("SIN CATEGORIA");
    const [drawerBase, setDrawerBase] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
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
        if (!selectedCategory) return inventory;
        return inventory.filter(item => {
            const { category } = extractCategory(item.name);
            return category === selectedCategory;
        });
    }, [inventory, selectedCategory]);

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
        const newName =
            drawerCategory === "SIN CATEGORIA"
                ? drawerBase
                : `${drawerCategory} ${drawerBase}`;
        let prodId = drawerProduct.id;
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
                console.error(insErr);
                return;
            }
            prodId = insData[0].id;
        } else {
            await supabase
                .from("products_master")
                .update({
                    name: newName,
                    default_purchase: drawerProduct.default_purchase,
                    margin_percent: drawerProduct.margin_percent,
                    default_selling: salePrice,
                })
                .eq("id", prodId);
        }
        const ops = Object.entries(editableStocks).map(([business_id, stock]) => ({
            product_id: prodId,
            business_id,
            stock,
        }));
        await supabase.from("business_inventory").upsert(ops, {
            onConflict: ["business_id", "product_id"],
        });
        setInventory(prev => prev.filter(it => it.id !== prodId).concat({
            id: prodId,
            code: drawerProduct.code,
            name: newName,
            default_purchase: drawerProduct.default_purchase,
            margin_percent: drawerProduct.margin_percent,
            default_selling: salePrice,
            stocks: editableStocks,
        }));
        closeDrawer();
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
                <h1 className="text-3xl font-bold">Inventario por Local</h1>
                <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="bg-white dark:bg-slate-800 border rounded-md p-2 text-sm"
                >
                    <option value="">Todas las categorías</option>
                    {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </header>

            <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
                <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-lg">
                    <table className="min-w-full text-base">
                        <thead className="bg-slate-100 dark:bg-slate-700 text-sm uppercase">
                            <tr>
                                <th className="px-6 py-4">Producto</th>
                                <th className="px-6 py-4">Compra</th>
                                <th className="px-6 py-4">Venta</th>
                                {businesses.map(b => (<th key={b.id} className="px-6 py-4">{b.name}</th>))}
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
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-sm text-gray-500">{item.code}</div>
                                            </td>
                                            <td className="px-6 py-4">{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(item.default_purchase)}</td>
                                            <td className="px-6 py-4">{sell}</td>
                                            {businesses.map(b => {
                                                const qty = item.stocks[b.id] || 0;
                                                const color = qty === 0 ? "bg-red-500" : qty < 6 ? "bg-yellow-400" : "bg-green-500";
                                                return <td key={b.id} className="px-6 py-4 text-center"><span className={`${color} text-white rounded-full px-2`}>{qty}</span></td>;
                                            })}
                                            <td className="px-6 py-4 flex gap-2 justify-end">
                                                <button onClick={() => openDrawer(item)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Ajustar</button>
                                                <button onClick={() => { if (confirm(`¿Eliminar ${item.name}?`)) { supabase.from('products_master').delete().eq('id', item.id).then(() => setInventory(prev => prev.filter(p => p.id !== item.id))); supabase.from('business_inventory').delete().eq('product_id', item.id); } }} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Eliminar</button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {drawerProduct && (
                <div className="fixed inset-0 flex z-50">
                    <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
                    <div className="relative ml-auto w-3/5 h-full bg-white p-8 overflow-y-auto shadow-xl">
                        <h2 className="text-2xl font-semibold mb-6">Ajustar Producto</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm">Categoría</label>
                                <select value={drawerCategory} onChange={e => setDrawerCategory(e.target.value)} className="w-full border rounded-md p-2">
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm">Nombre</label>
                                <input type="text" value={drawerBase} onChange={e => setDrawerBase(e.target.value)} className="w-full border rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm">Precio Compra</label>
                                <input type="number" value={drawerProduct.default_purchase || ""} onChange={e => setDrawerProduct(pr => pr && ({ ...pr, default_purchase: Number(e.target.value) }))} className="w-full border rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm">Margen %</label>
                                <input type="number" value={drawerProduct.margin_percent || ""} onChange={e => setDrawerProduct(pr => pr && ({ ...pr, margin_percent: Number(e.target.value) }))} className="w-full border rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm">Precio Venta</label>
                                <input type="number" value={salePrice || ""} onChange={e => setSalePrice(Number(e.target.value))} className="w-full border rounded-md p-2" />
                                <div className="text-xs italic text-gray-500 mt-1">Sugerido: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(drawerProduct.default_purchase * (1 + drawerProduct.margin_percent / 100))}</div>
                            </div>
                        </div>
                        <div className="mt-8 space-y-4">
                            {businesses.map(b => (
                                <div key={b.id} className="flex justify-between items-center"><span>{b.name}</span><input type="number" value={editableStocks[b.id] || ""} onChange={e => setEditableStocks(prev => ({ ...prev, [b.id]: Number(e.target.value) }))} className="w-24 border rounded-md p-2" /></div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-4 mt-8">
                            <button onClick={closeDrawer} className="px-6 py-2 border rounded-md">Cancelar</button>
                            <button onClick={saveAll} className="px-6 py-2 bg-green-600 text-white rounded-md">Guardar Todo</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
