/* ----------------------------------------------------------------
   src/app/admin/inventory-by-branch/page.tsx
   ---------------------------------------------------------------- */
   "use client";

   import React, { useEffect, useMemo, useState } from "react";
   import { useDispatch, useSelector } from "react-redux";
   import type { AppDispatch, RootState } from "@/lib/redux/store";
   import { fetchBusinesses } from "@/lib/redux/slices/businessSlice";
   import { supabase } from "@/lib/supabase";
   
   /* ─────────── Config ─────────── */
   const PAGE_SIZE = 10;
   
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
   ] as const;
   type Category = (typeof CATEGORIES)[number];
   
   function extractCategory(name: string): { category: Category; base: string } {
     const parts = (name ?? "").trim().split(" ");
     const first = (parts[0]?.toUpperCase() as Category) || "SIN CATEGORIA";
     if (first && (CATEGORIES as readonly string[]).includes(first)) {
       return { category: first as Category, base: parts.slice(1).join(" ") || "" };
     }
     return { category: "SIN CATEGORIA", base: name ?? "" };
   }
   
   function moneyARS(n: number) {
     return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n || 0);
   }
   
   type InventoryItem = {
     id: string; // products_master.id
     code: string;
     codes_asociados: string[];
     name: string;
     default_purchase: number;
     margin_percent: number;
     default_selling: number;
     stock_branch: number; // stock SOLO de la sucursal activa
   };
   
   type StockRow = { business_id: string; product_id: string; stock: number };
   
   /* ─────────── Logs ─────────── */
   async function logActivity(params: {
     business_id: string;
     product_id?: string | null;
     motivo: "Actualizacion" | "Perdida" | "Creacion" | "Edicion";
     details: string;
     lost_cash?: number | null;
   }) {
     try {
       await supabase.from("activities").insert({
         business_id: params.business_id,
         product_id: params.product_id ?? null,
         motivo: params.motivo,
         details: params.details,
         lost_cash: params.lost_cash ?? null,
         created_at: new Date().toISOString(),
       });
     } catch (e) {
       console.error("Log error:", e);
     }
   }
   
   /* ─────────── UI helpers ─────────── */
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
     BRECA: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
   };
   
   /* ─────────── Página ─────────── */
   export default function InventoryByBranchPage() {
     const dispatch = useDispatch<AppDispatch>();
     const { businesses, loading: businessesLoading } = useSelector((s: RootState) => s.businesses);
     const { user } = useSelector((s: RootState) => s.auth);
     const businessId = user?.businessId ?? null;
   
     // Nombre del empleado (fallbacks seguros)
     const employeeName =
       [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
       (user as any)?.employeeName ||
       (user as any)?.name ||
       user?.email ||
       "Empleado desconocido";
   
     const [loading, setLoading] = useState(false);
     const [items, setItems] = useState<InventoryItem[]>([]);
   
     // filtros/orden/paginación
     const [search, setSearch] = useState("");
     const [category, setCategory] = useState<string>("");
     const [sortBy, setSortBy] = useState<"stock" | "price">("stock");
     const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
     const [page, setPage] = useState(1);
   
     // Drawer producto
     const [drawerOpen, setDrawerOpen] = useState(false);
     const [draft, setDraft] = useState<{
       id: string | null;
       code: string;
       category: Category;
       base: string;
       default_purchase: number;
       margin_percent: number;
       default_selling: number;
       stock_branch: number; // editable solo sucursal activa
     } | null>(null);
   
     // Modal stock rápido
     const [stockModal, setStockModal] = useState<{ item: InventoryItem | null; type: "add" | "remove" | null }>({
       item: null,
       type: null,
     });
     const [stockAmount, setStockAmount] = useState<number>(0);
   
     useEffect(() => {
       dispatch(fetchBusinesses());
     }, [dispatch]);
   
     useEffect(() => {
       if (!businessId) return;
       (async () => {
         setLoading(true);
         try {
           // 1) Traer productos master (paginado por si hay muchos)
           const pageSize = 1000;
           let page = 0;
           let masters: any[] = [];
           let done = false;
           while (!done) {
             const { from, to } = { from: page * pageSize, to: page * pageSize + pageSize - 1 };
             const { data, error } = await supabase
               .from("products_master")
               .select("id, code, codes_asociados, name, default_purchase, margin_percent, default_selling")
               .is("deleted_at", null)
               .range(from, to);
             if (error) throw error;
             masters = masters.concat(data ?? []);
             if (!data?.length || data.length < pageSize) done = true;
             page++;
           }
   
           // 2) Traer SOLO stock de la sucursal activa
           const stockMap: Record<string, number> = {};
           {
             const pageSize = 1000;
             let page = 0;
             let done = false;
             while (!done) {
               const { from, to } = { from: page * pageSize, to: page * pageSize + pageSize - 1 };
               const { data, error } = await supabase
                 .from("business_inventory")
                 .select("product_id, stock")
                 .eq("business_id", businessId)
                 .range(from, to);
               if (error) throw error;
               (data ?? []).forEach((r) => (stockMap[String(r.product_id)] = r.stock));
               if (!data?.length || data.length < pageSize) done = true;
               page++;
             }
           }
   
           // 3) Armar lista
           const list: InventoryItem[] = masters.map((m) => ({
             id: m.id,
             code: m.code ?? "",
             codes_asociados: Array.isArray(m.codes_asociados) ? m.codes_asociados : [],
             name: m.name ?? "",
             default_purchase: m.default_purchase ?? 0,
             margin_percent: m.margin_percent ?? 0,
             default_selling: m.default_selling ?? 0,
             stock_branch: stockMap[String(m.id)] ?? 0,
           }));
   
           setItems(list);
         } catch (e) {
           console.error("Fetch error:", e);
           setItems([]);
         } finally {
           setLoading(false);
         }
       })();
     }, [businessId]);
   
     // filtros/orden
     const filtered = useMemo(() => {
       let list = items;
   
       // 🔍 Búsqueda ampliada (nombre, código principal y códigos secundarios)
       const q = search.trim().toLowerCase();
       if (q) {
         list = list.filter((it) => {
           const inName = it.name.toLowerCase().includes(q);
           const inCode = it.code.toLowerCase().includes(q);
           const inCodesAsociados =
             Array.isArray(it.codes_asociados) &&
             it.codes_asociados.some((c) => c.toLowerCase().includes(q));
           return inName || inCode || inCodesAsociados;
         });
       }
   
       // categoría
       if (category) {
         list = list.filter((it) => extractCategory(it.name).category === category);
       }
   
       // orden
       list = [...list].sort((a, b) => {
         const dir = sortDir === "asc" ? 1 : -1;
         if (sortBy === "stock") return (a.stock_branch - b.stock_branch) * dir;
         return (a.default_selling - b.default_selling) * dir;
       });
   
       return list;
     }, [items, search, category, sortBy, sortDir]);
   
     // paginación
     const totalItems = filtered.length;
     const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
     const startIndex = (page - 1) * PAGE_SIZE;
     const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
     const pageItems = useMemo(() => filtered.slice(startIndex, endIndex), [filtered, startIndex, endIndex]);
   
     useEffect(() => {
       setPage(1);
     }, [search, category, sortBy, sortDir]);
   
     const currentBranchName =
       businesses.find((b) => b.id === businessId)?.name ?? (businessId ?? "Sucursal");
   
     /* ─────────── Acciones: stock rápido ─────────── */
     function openStockModal(item: InventoryItem, type: "add" | "remove") {
       setStockModal({ item, type });
       setStockAmount(0);
     }
     function closeStockModal() {
       setStockModal({ item: null, type: null });
     }
   
     async function confirmStockChange() {
       if (!businessId || !stockModal.item || !stockModal.type) return;
       const product = stockModal.item;
       const delta = stockModal.type === "add" ? stockAmount : -stockAmount;
   
       try {
         // Leer stock actual (para bloqueo optimista)
         const { data: currentRow, error: readErr } = await supabase
           .from("business_inventory")
           .select("product_id, business_id, stock")
           .eq("business_id", businessId)
           .eq("product_id", product.id)
           .maybeSingle();
         if (readErr && (readErr as any).code !== "PGRST116") throw readErr; // ignora not found
   
         const old = currentRow?.stock ?? 0;
         const next = Math.max(0, old + delta);
   
         let conflict = false;
   
         if (currentRow) {
           // UPDATE con bloqueo optimista
           const { data: upd, error: updErr } = await supabase
             .from("business_inventory")
             .update({ stock: next })
             .eq("business_id", businessId)
             .eq("product_id", product.id)
             .eq("stock", old)
             .select("product_id");
           if (updErr) throw updErr;
           if (!upd || upd.length === 0) conflict = true;
         } else {
           // INSERT; si alguien insertó entre medio, reintento UPDATE condicional
           const { error: insErr } = await supabase
             .from("business_inventory")
             .insert({ business_id: businessId, product_id: product.id, stock: next });
           if (insErr) {
             const { data: retry, error: retryErr } = await supabase
               .from("business_inventory")
               .update({ stock: next })
               .eq("business_id", businessId)
               .eq("product_id", product.id)
               .eq("stock", old) // old=0
               .select("product_id");
             if (retryErr) throw retryErr;
             if (!retry || retry.length === 0) conflict = true;
           }
         }
   
         if (conflict) {
           alert("El stock cambió mientras editabas. No se guardó para evitar sobrescrituras.");
           closeStockModal();
           return;
         }
   
         // Log SIEMPRE como Edicion y SIN pérdida
         await logActivity({
           business_id: businessId,
           product_id: product.id,
           motivo: "Edicion",
           details: `${employeeName} - ${product.name}: ${old} → ${next}`,
           lost_cash: null,
         });
   
         // Estado local
         setItems((prev) =>
           prev.map((p) => (p.id === product.id ? { ...p, stock_branch: next } : p))
         );
   
         closeStockModal();
       } catch (e) {
         console.error("Stock update error:", e);
         alert("No se pudo actualizar el stock.");
       }
     }
   
     /* ─────────── Acciones: drawer (crear/editar master + stock sucursal activa) ─────────── */
     function openDrawer(item?: InventoryItem) {
       if (item) {
         const { category, base } = extractCategory(item.name);
         setDraft({
           id: item.id,
           code: item.code ?? "",
           category,
           base,
           default_purchase: item.default_purchase ?? 0,
           margin_percent: item.margin_percent ?? 0,
           default_selling: item.default_selling ?? 0,
           stock_branch: item.stock_branch ?? 0,
         });
       } else {
         setDraft({
           id: null,
           code: "",
           category: "SIN CATEGORIA",
           base: "",
           default_purchase: 0,
           margin_percent: 0,
           default_selling: 0,
           stock_branch: 0,
         });
       }
       setDrawerOpen(true);
     }
     function closeDrawer() {
       setDrawerOpen(false);
       setDraft(null);
     }
   
     async function saveDraft() {
       if (!draft || !businessId) return;
       const fullName = draft.category === "SIN CATEGORIA" ? draft.base : `${draft.category} ${draft.base}`.trim();
   
       try {
         let productId = draft.id;
   
         // 1) Crear/editar master
         if (!productId) {
           const { data, error } = await supabase
             .from("products_master")
             .insert({
               code: draft.code,
               name: fullName,
               default_purchase: draft.default_purchase,
               margin_percent: draft.margin_percent,
               default_selling: draft.default_selling,
             })
             .select("id")
             .single();
           if (error) throw error;
           productId = data?.id;
           await logActivity({
             business_id: businessId,
             product_id: productId,
             motivo: "Creacion",
             details: `Creación master: ${fullName} (por: ${employeeName})`,
           });
         } else {
           const { error } = await supabase
             .from("products_master")
             .update({
               code: draft.code,
               name: fullName,
               default_purchase: draft.default_purchase,
               margin_percent: draft.margin_percent,
               default_selling: draft.default_selling,
             })
             .eq("id", productId);
           if (error) throw error;
           await logActivity({
             business_id: businessId,
             product_id: productId,
             motivo: "Edicion",
             details: `Edición master: ${fullName} (por: ${employeeName})`,
           });
         }
   
         // 2) Ajustar SOLO stock de sucursal activa con bloqueo optimista
         // Leer old
         const { data: existing, error: readErr } = await supabase
           .from("business_inventory")
           .select("product_id, business_id, stock")
           .eq("business_id", businessId)
           .eq("product_id", productId!)
           .maybeSingle();
         if (readErr && (readErr as any).code !== "PGRST116") throw readErr;
   
         const old = existing?.stock ?? 0;
         const next = Math.max(0, draft.stock_branch ?? 0);
         let conflict = false;
   
         if (existing) {
           const { data: upd, error: updErr } = await supabase
             .from("business_inventory")
             .update({ stock: next })
             .eq("business_id", businessId)
             .eq("product_id", productId!)
             .eq("stock", old)
             .select("product_id");
           if (updErr) throw updErr;
           if (!upd || upd.length === 0) conflict = true;
         } else {
           const { error: insErr } = await supabase
             .from("business_inventory")
             .insert({ business_id: businessId, product_id: productId!, stock: next });
           if (insErr) {
             // Reintento si alguien insertó entre medio
             const { data: retry, error: retryErr } = await supabase
               .from("business_inventory")
               .update({ stock: next })
               .eq("business_id", businessId)
               .eq("product_id", productId!)
               .eq("stock", old)
               .select("product_id");
             if (retryErr) throw retryErr;
             if (!retry || retry.length === 0) conflict = true;
           }
         }
   
         if (conflict) {
           alert("El stock cambió mientras editabas. No se guardó el stock para evitar sobrescrituras.");
         } else if (old !== next) {
           // SIEMPRE Edicion + sin pérdida
           await logActivity({
             business_id: businessId,
             product_id: productId!,
             motivo: "Edicion",
             details: `${employeeName} en ${fullName}: ${old} → ${next}`,
             lost_cash: null,
           });
         }
   
         // 3) Estado local
         setItems((prev) => {
           const exists = prev.find((p) => p.id === productId);
           const merged: InventoryItem = {
             id: productId!,
             code: draft.code,
             name: fullName,
             default_purchase: draft.default_purchase,
             margin_percent: draft.margin_percent,
             default_selling: draft.default_selling,
             stock_branch: conflict ? old : next,
             // mantenemos codes_asociados si ya existía
             ...(exists ? { codes_asociados: (exists as InventoryItem).codes_asociados } : { codes_asociados: [] }),
           };
           if (exists) return prev.map((p) => (p.id === productId ? merged : p));
           return [merged, ...prev];
         });
   
         closeDrawer();
       } catch (e) {
         console.error("Save draft error:", e);
         alert("No se pudo guardar.");
       }
     }
   
     /* ─────────── Render ─────────── */
     const busy = loading || businessesLoading || !businessId;
   
     return (
       <div className="space-y-6 p-6">
         {/* Header */}
         <header className="flex flex-col md:flex-row justify-between items-center gap-4">
           <div>
             <div className="text-sm text-gray-500">Sucursal actual</div>
             <div className="font-semibold">{currentBranchName}</div>
           </div>
           <h1 className="text-3xl font-bold">Inventario</h1>
           <div className="flex items-center gap-2">
             <button
               onClick={() => openDrawer()}
               className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
               disabled={!businessId}
             >
               + Agregar producto
             </button>
           </div>
         </header>
   
         {/* Filtros */}
         <div className="flex flex-col md:flex-row gap-2">
           <input
             type="text"
             placeholder="Buscar por nombre o código"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="bg-white dark:bg-slate-800 border rounded-md p-2 text-sm w-full md:w-1/2"
           />
           <select
             value={category}
             onChange={(e) => setCategory(e.target.value)}
             className="bg-white dark:bg-slate-800 border rounded-md p-2 text-sm md:w-1/2"
           >
             <option value="">Todas las categorías</option>
             {CATEGORIES.map((c) => (
               <option key={c} value={c}>
                 {c}
               </option>
             ))}
           </select>
         </div>
   
         {/* Tabla */}
         <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
           <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-lg">
             <table className="min-w-full text-base">
               <thead className="bg-slate-100 dark:bg-slate-700 text-sm uppercase">
                 <tr>
                   <th className="px-6 py-4 text-left">Producto</th>
                   <th className="px-6 py-4 text-left">Código</th>
                   <th className="px-6 py-4 text-left cursor-pointer" title="Ordenar por precio">
                     Venta
                   </th>
                   <th className="px-6 py-4 text-center">Stock ({currentBranchName})</th>
                   <th className="px-6 py-4 text-right">Acciones</th>
                 </tr>
               </thead>
               <tbody>
                 {busy ? (
                   <tr>
                     <td colSpan={5} className="py-16 text-center">
                       Cargando…
                     </td>
                   </tr>
                 ) : pageItems.length === 0 ? (
                   <tr>
                     <td colSpan={5} className="py-12 text-center text-gray-500">
                       Sin resultados
                     </td>
                   </tr>
                 ) : (
                   pageItems.map((item) => {
                     const { category, base } = extractCategory(item.name);
                     const badgeStyle = categoryColors[category] || categoryColors["SIN CATEGORIA"];
                     const qty = item.stock_branch;
                     const color = qty === 0 ? "bg-red-500" : qty < 6 ? "bg-yellow-400" : "bg-green-500";
                     return (
                       <tr
                         key={item.id}
                         className="border-b even:bg-slate-50/60 dark:even:bg-slate-800/30 hover:bg-slate-100 transition"
                       >
                         <td className="px-6 py-4">
                           <div className="flex flex-col gap-1">
                             <span className={`text-xs rounded-full px-2 py-0.5 ${badgeStyle}`}>{category}</span>
                             <div className="font-medium">{base}</div>
                           </div>
                         </td>
                         <td className="px-6 py-4 text-sm text-gray-600">{item.code}</td>
                         <td className="px-6 py-4 text-sm">{moneyARS(item.default_selling)}</td>
                         <td className="px-6 py-4 text-center">
                           <span className={`${color} text-white rounded-full px-2`}>{qty}</span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex gap-2 justify-end">
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
                           </div>
                         </td>
                       </tr>
                     );
                   })
                 )}
               </tbody>
             </table>
           </div>
   
           {/* Footer paginación */}
           <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-3 px-4 py-3">
             <span className="text-sm text-gray-600">
               Mostrando <b>{totalItems === 0 ? 0 : startIndex + 1}</b>–<b>{endIndex}</b> de <b>{totalItems}</b>
             </span>
             <div className="flex items-center gap-2">
               <button
                 onClick={() => setPage((p) => Math.max(1, p - 1))}
                 disabled={page <= 1}
                 className={`px-3 py-1 rounded-md border ${page <= 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 dark:hover:bg-slate-700"
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
                 className={`px-3 py-1 rounded-md border ${page >= totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 dark:hover:bg-slate-700"
                   }`}
               >
                 Siguiente
               </button>
             </div>
           </div>
         </div>
   
         {/* Modal stock */}
         {stockModal.item && stockModal.type && (
           <div className="fixed inset-0 z-50 flex items-center justify-center">
             <div className="absolute inset-0 bg-black/50" onClick={closeStockModal} />
             <div className="relative z-10 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl max-w-md w-full space-y-4">
               <h3 className="text-xl font-semibold">
                 {stockModal.type === "add" ? "Agregar" : "Quitar"} stock
               </h3>
               <p className="text-sm text-gray-600">
                 Producto: <b>{stockModal.item.name}</b> — Sucursal: <b>{currentBranchName}</b>
               </p>
               <label className="block text-sm mb-1">Cantidad</label>
               <input
                 type="number"
                 min={0}
                 value={stockAmount}
                 onChange={(e) => setStockAmount(Number(e.target.value))}
                 className="w-full border rounded-md p-2 bg-white dark:bg-slate-900"
               />
               <p className="text-xs text-gray-500">
                 Nota: los cambios de stock hechos desde esta pantalla se registran como <b>Edición</b> y no generan pérdida.
               </p>
               <div className="flex justify-end gap-2">
                 <button onClick={closeStockModal} className="px-4 py-2 rounded-md border">Cancelar</button>
                 <button
                   onClick={confirmStockChange}
                   className={`px-4 py-2 rounded-md text-white ${stockModal.type === "add" ? "bg-green-600" : "bg-red-600"
                     }`}
                 >
                   Confirmar
                 </button>
               </div>
             </div>
           </div>
         )}
   
         {/* Drawer producto */}
         {drawerOpen && draft && (
           <div className="fixed inset-0 z-50 flex">
             <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
             <div className="relative ml-auto w-full max-w-3xl h-full bg-white dark:bg-slate-900 p-6 overflow-y-auto shadow-xl rounded-l-2xl">
               <h2 className="text-2xl font-semibold mb-6">
                 {draft.id ? "Editar producto" : "Nuevo producto"}
               </h2>
   
               {/* Datos master */}
               <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 shadow space-y-4 mb-8">
                 <h3 className="text-lg font-semibold">Datos del producto</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm mb-1">Categoría</label>
                     <select
                       value={draft.category}
                       onChange={(e) => setDraft((d) => d && { ...d, category: e.target.value as Category })}
                       className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                     >
                       {CATEGORIES.map((c) => (
                         <option key={c} value={c}>
                           {c}
                         </option>
                       ))}
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm mb-1">Nombre base</label>
                     <input
                       type="text"
                       value={draft.base}
                       onChange={(e) => setDraft((d) => d && { ...d, base: e.target.value })}
                       className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                     />
                   </div>
                   <div>
                     <label className="block text-sm mb-1">Código</label>
                     <input
                       type="text"
                       value={draft.code}
                       onChange={(e) => setDraft((d) => d && { ...d, code: e.target.value })}
                       className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                     />
                   </div>
                   <div>
                     <label className="block text-sm mb-1">Precio compra (costo)</label>
                     <input
                       type="number"
                       value={draft.default_purchase}
                       onChange={(e) =>
                         setDraft((d) => d && { ...d, default_purchase: Number(e.target.value) })
                       }
                       className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                     />
                   </div>
                   <div>
                     <label className="block text-sm mb-1">Margen %</label>
                     <input
                       type="number"
                       value={draft.margin_percent}
                       onChange={(e) =>
                         setDraft((d) => d && { ...d, margin_percent: Number(e.target.value) })
                       }
                       className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                     />
                   </div>
                   <div>
                     <label className="block text-sm mb-1">Precio venta</label>
                     <input
                       type="number"
                       value={draft.default_selling}
                       onChange={(e) =>
                         setDraft((d) => d && { ...d, default_selling: Number(e.target.value) })
                       }
                       className="w-full border rounded-lg p-3 text-sm bg-white dark:bg-slate-800"
                     />
                     <div className="text-xs italic text-gray-500 mt-1">
                       Sugerido:{" "}
                       {moneyARS(
                         (draft.default_purchase || 0) * (1 + (draft.margin_percent || 0) / 100)
                       )}
                     </div>
                   </div>
                 </div>
               </div>
   
               {/* Stock solo sucursal activa */}
               <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 shadow space-y-4">
                 <h3 className="text-lg font-semibold">Stock en {currentBranchName}</h3>
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-gray-600">Unidades</span>
                   <input
                     type="number"
                     min={0}
                     value={draft.stock_branch}
                     onChange={(e) =>
                       setDraft((d) => d && { ...d, stock_branch: Math.max(0, Number(e.target.value)) })
                     }
                     className="w-40 border rounded-lg p-2 text-sm bg-white dark:bg-slate-900"
                   />
                 </div>
                 <p className="text-xs text-gray-500">
                   Nota: los cambios de stock hechos desde esta pantalla se registran como <b>Edición</b> y no generan pérdida.
                 </p>
               </div>
   
               <div className="flex justify-end gap-3 mt-8">
                 <button onClick={closeDrawer} className="px-6 py-3 border rounded-lg text-sm">
                   Cancelar
                 </button>
                 <button
                   onClick={saveDraft}
                   className="px-6 py-3 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700"
                 >
                   Guardar
                 </button>
               </div>
             </div>
           </div>
         )}
       </div>
     );
   }
   