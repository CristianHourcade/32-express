"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/lib/redux/store";
import { Plus, X, Search, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* ========= Hook debounce ========= */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

/* ========= Tipos ========= */
export interface Product {
  id: number | string;
  name: string;
  code: string;
  description: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  businessId: string;
  salesCount: number;
  totalRevenue: number;
  margin: number; // nuevo campo margen %
}

/* ========= Constantes ========= */
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
];

/* ========= Dropdowns ========= */
function MultiSelectDropdown({
  options,
  selectedOptions,
  onChange,
  placeholder = "Filtrar por categorías",
}: {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleOption = (option: string) => {
    const next = selectedOptions.includes(option)
      ? selectedOptions.filter((o) => o !== option)
      : [...selectedOptions, option];
    onChange(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="input w-full text-left flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>
          {selectedOptions.length > 0 ? selectedOptions.join(", ") : placeholder}
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 shadow-lg border rounded w-full">
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedOptions.includes(opt)}
                  onChange={() => toggleOption(opt)}
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SingleSelectDropdown({
  options,
  selectedOption,
  onChange,
  placeholder = "Selecciona categoría",
}: {
  options: string[];
  selectedOption: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const choose = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
  };
  return (
    <div className="relative">
      <button
        type="button"
        className="input w-full text-left flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption || placeholder}</span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 shadow-lg border rounded w-full">
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => choose(opt)}
                className="w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========= Helper ========= */
function extractCategory(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length > 1 && categories.includes(parts[0].toUpperCase())) {
    return { category: parts[0].toUpperCase(), baseName: parts.slice(1).join(" ") };
  }
  return { category: null, baseName: name };
}

/* ========= Main ========= */
export default function EmployeeProductsPage() {
  /* -- auth / business info -- */
  const { user } = useSelector((s: RootState) => s.auth);
  const { businesses, loading: businessesLoading } = useSelector(
    (s: RootState) => s.businesses
  );
  const businessId = user?.businessId;

  /* -- supervisor flag -- */
  const [isSupervisor, setIsSupervisor] = useState(false);
  useEffect(() => {
    const fetchFlag = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("employees")
        .select("supervisor")
        .eq("email", user.email)
        .single();
      if (!error) setIsSupervisor(Boolean(data?.supervisor));
    };
    fetchFlag();
  }, [user?.email]);

  /* -- products -- */
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  const fetchProducts = async () => {
    if (!businessId) return;
    setIsProductsLoading(true);
    const pageSize = 1000;
    let page = 0;
    let acc: any[] = [];
    let done = false;

    while (!done) {
      const { from, to } = { from: page * pageSize, to: page * pageSize + pageSize - 1 };
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId)
        .range(from, to);
      if (error) break;
      if (data?.length) {
        acc = acc.concat(data);
        done = data.length < pageSize;
        page++;
      } else done = true;
    }

    setProducts(
      acc.map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        purchasePrice: p.purchase_price,
        sellingPrice: p.selling_price,
        stock: p.stock,
        minStock: p.min_stock,
        businessId: p.business_id,
        salesCount: p.sales_count || 0,
        totalRevenue: p.total_revenue || 0,
        margin: p.margen ?? 0,
      }))
    );
    setIsProductsLoading(false);
  };

  useEffect(() => {
    if (businessId) fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  /* -- filters / search -- */
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 150);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let arr = products;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      arr = arr.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }
    if (selectedCats.length) {
      arr = arr.filter((p) => {
        const first = p.name.split(" ")[0].toUpperCase();
        const hasCat = categories.includes(first);
        return hasCat
          ? selectedCats.includes(first)
          : selectedCats.includes("SIN CATEGORIA");
      });
    }
    return arr.sort((a, b) => (sortOrder === "asc" ? a.stock - b.stock : b.stock - a.stock));
  }, [debouncedSearch, products, selectedCats, sortOrder]);

  /* -- modals and form state -- */
  const [isAddStockModal, setIsAddStockModal] = useState(false);
  const [isSubStockModal, setIsSubStockModal] = useState(false);
  const [isProductModal, setIsProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [stockToAdd, setStockToAdd] = useState(0);
  const [stockToSub, setStockToSub] = useState(0);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    purchasePrice: 0,
    sellingPrice: 0,
    stock: 0,
    minStock: 0,
    description: "",
    businessId: businessId || "",
    category: "",
  });
  const [marginPct, setMarginPct] = useState(0);

  /* -- helpers -- */
  const openAddProduct = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      code: "",
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0,
      minStock: 0,
      description: "",
      businessId: businessId || "",
      category: "",
    });
    setMarginPct(0);
    setIsProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    const { category, baseName } = extractCategory(p.name);
    setEditingProduct(p);
    setFormData({
      name: baseName,
      code: p.code,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      stock: p.stock,
      minStock: p.minStock,
      description: p.description,
      businessId: p.businessId,
      category: category || "",
      margin: p.margin
    });
    setMarginPct(p.margen ?? 0);
    setIsProductModal(true);
  };

  /* recalcular margen dinámico al editar form */
  useEffect(() => {
    if (formData.purchasePrice > 0) {
      setMarginPct(
        Number(((formData.sellingPrice / formData.purchasePrice - 1) * 100).toFixed(2))
      );
    } else setMarginPct(0);
  }, [formData.purchasePrice, formData.sellingPrice]);

  /* -- high-level loading flags -- */
  const lowStock = products.filter((p) => p.stock <= p.minStock);
  const isLoading = isProductsLoading || businessesLoading;
  const currBiz = businesses.find((b) => b.id === businessId);

  /* ============ UI ============ */
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Productos
            {isSupervisor && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                Supervisor ✅
              </span>
            )}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestión de inventario para {currBiz?.name || "tu negocio"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total de productos: {filtered.length}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={openAddProduct} className="btn btn-primary flex items-center">
            <Plus className="w-5 h-5 mr-1" /> Agregar Producto
          </button>
          <Link href="/employee/dashboard" className="btn btn-secondary">
            Volver al Dashboard
          </Link>
        </div>
      </div>

      {/* Alerta stock bajo */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-md">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Alerta de Stock Bajo
              </h3>
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-200">
                Hay {lowStock.length} productos con stock por debajo del mínimo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Buscador + Filtro */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full">
            <Search className="absolute inset-y-0 left-0 ml-3 h-5 w-5 text-gray-400 pointer-events-none" />
            <input
              className="input pl-10 w-full"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full md:w-1/3">
            <MultiSelectDropdown
              options={[...categories, "SIN CATEGORIA"]}
              selectedOptions={selectedCats}
              onChange={setSelectedCats}
            />
          </div>
        </div>
      </div>

      {/* Tabla de productos */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
            <colgroup>
              <col className="w-2/5" />
              <col className="w-1/5" />
              {isSupervisor && <col className="w-1/5" />} {/* margen */}
              <col className="w-1/5" />
              <col className="w-1/5" />
            </colgroup>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Precio
                </th>
                {isSupervisor && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Margen
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {!isLoading && filtered.length ? (
                filtered.map((p) => {
                  const { category, baseName } = extractCategory(p.name);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 break-words">
                        {category && (
                          <div className="text-xs font-bold text-blue-400 dark:text-blue-300">
                            {category}
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {baseName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{p.code}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        ${p.sellingPrice.toFixed(2)}
                      </td>
                      {isSupervisor && (
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {p.margin.toFixed(2)}%
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            p.stock <= p.minStock
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          }`}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm flex flex-wrap gap-2">
                        <button
                          className="bg-black text-white p-2 rounded"
                          onClick={() => {
                            setCurrentProduct(p);
                            setStockToAdd(0);
                            setIsAddStockModal(true);
                          }}
                        >
                          Agregar Stock
                        </button>
                        <button
                          className="bg-red-600 text-white p-2 rounded"
                          onClick={() => {
                            setCurrentProduct(p);
                            setStockToSub(0);
                            setIsSubStockModal(true);
                          }}
                        >
                          Quitar Stock
                        </button>
                        {isSupervisor && (
                          <button
                            className="bg-blue-600 text-white p-2 rounded"
                            onClick={() => openEditProduct(p)}
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={isSupervisor ? 5 : 4}
                    className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {isLoading ? "Cargando productos..." : "No hay productos para mostrar."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* -------------------- MODALES --------------------- */}
      {/* -------------------------------------------------- */}

      {/* Modal Agregar Stock */}
      {isAddStockModal && currentProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Agregar Stock</h2>
              <button className="text-gray-500" onClick={() => setIsAddStockModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p>
                Producto: <strong>{currentProduct.name}</strong>
              </p>
              <p>
                Stock actual: <strong>{currentProduct.stock}</strong>
              </p>
              <label className="block text-sm font-medium">Cantidad a agregar</label>
              <input
                type="number"
                min={1}
                value={stockToAdd}
                onChange={(e) => setStockToAdd(Number(e.target.value) || 0)}
                className="input w-full"
              />
              <div className="flex justify-end gap-3 pt-4">
                <button className="btn btn-secondary" onClick={() => setIsAddStockModal(false)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  disabled={stockToAdd <= 0}
                  onClick={async () => {
                    if (stockToAdd <= 0) return;
                    const newStock = currentProduct.stock + stockToAdd;
                    const { error: err } = await supabase
                      .from("products")
                      .update({ stock: newStock })
                      .eq("id", currentProduct.id);
                    if (!err) {
                      await supabase.from("activities").insert({
                        business_id: businessId,
                        details: `${user?.name} - Added ${stockToAdd} to ${currentProduct.name} -> NEW STOCK: ${newStock}`,
                        created_at: new Date().toISOString(),
                      });
                      setIsAddStockModal(false);
                      fetchProducts();
                    }
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Quitar Stock */}
      {isSubStockModal && currentProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Quitar Stock</h2>
              <button className="text-gray-500" onClick={() => setIsSubStockModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p>
                Producto: <strong>{currentProduct.name}</strong>
              </p>
              <p>
                Stock actual: <strong>{currentProduct.stock}</strong>
              </p>
              <label className="block text-sm font-medium">Cantidad a quitar</label>
              <input
                type="number"
                min={1}
                max={currentProduct.stock}
                value={stockToSub}
                onChange={(e) => setStockToSub(Number(e.target.value) || 0)}
                className="input w-full"
              />
              <div className="flex justify-end gap-3 pt-4">
                <button className="btn btn-secondary" onClick={() => setIsSubStockModal(false)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  disabled={stockToSub < 1 || stockToSub > currentProduct.stock}
                  onClick={async () => {
                    if (stockToSub < 1 || stockToSub > currentProduct.stock) return;
                    const newStock = currentProduct.stock - stockToSub;
                    const { error: err } = await supabase
                      .from("products")
                      .update({ stock: newStock })
                      .eq("id", currentProduct.id);
                    if (!err) {
                      await supabase.from("activities").insert({
                        business_id: businessId,
                        details: `${user?.name} Removed ${stockToSub} from ${currentProduct.name} -> NEW STOCK: ${newStock}`,
                        created_at: new Date().toISOString(),
                      });
                      setIsSubStockModal(false);
                      fetchProducts();
                    }
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Producto */}
      {isProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                {editingProduct ? "Editar Producto" : "Agregar Nuevo Producto"}
              </h2>
              <button className="text-gray-500" onClick={() => setIsProductModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              className="p-6 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const finalName =
                  formData.category !== "" ? `${formData.category} ${formData.name}` : formData.name;
                const dbData = {
                  name: finalName,
                  code: formData.code,
                  purchase_price: formData.purchasePrice,
                  selling_price: formData.sellingPrice,
                  stock: formData.stock,
                  min_stock: formData.minStock,
                  description: formData.description,
                  business_id: formData.businessId,
                };

                try {
                  if (editingProduct) {
                    const { error } = await supabase
                      .from("products")
                      .update(dbData)
                      .eq("id", editingProduct.id);
                    if (error) throw error;
                  } else {
                    const { error } = await supabase
                      .from("products")
                      .insert({ ...dbData, created_at: new Date().toISOString() });
                    if (error) throw error;
                  }
                  fetchProducts();
                  setIsProductModal(false);
                } catch (err) {
                  console.error("Error saving product:", err);
                }
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* categoría */}
                <div>
                  <label className="label">Categoría</label>
                  <SingleSelectDropdown
                    options={categories}
                    selectedOption={formData.category}
                    onChange={(v) => setFormData((p) => ({ ...p, category: v }))}
                  />
                </div>
                {/* nombre */}
                <div>
                  <label className="label">Nombre del Producto</label>
                  <input
                    className="input"
                    required
                    placeholder="Nombre sin categoría"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    disabled={editingProduct ? !isSupervisor : false}
                  />
                </div>
                {/* código */}
                <div>
                  <label className="label">Código</label>
                  <input
                    className="input"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                    disabled={editingProduct ? !isSupervisor : false}
                  />
                </div>
                {/* compra */}
                <div>
                  <label className="label">Precio de Compra</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="input"
                    value={formData.purchasePrice}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, purchasePrice: Number(e.target.value) }))
                    }
                    disabled={editingProduct ? !isSupervisor : false}
                  />
                </div>
                {/* venta */}
                <div>
                  <label className="label">Precio de Venta</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="input"
                    value={formData.sellingPrice}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, sellingPrice: Number(e.target.value) }))
                    }
                    disabled={editingProduct ? !isSupervisor : false}
                  />
                </div>
                {/* stock min */}
                <div>
                  <label className="label">Stock Mínimo</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, minStock: Number(e.target.value) }))
                    }
                    disabled={editingProduct ? !isSupervisor : false}
                  />
                </div>
                {/* descripción */}
                <div className="md:col-span-2">
                  <label className="label">Descripción</label>
                  <textarea
                    rows={3}
                    className="input"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, description: e.target.value }))
                    }
                    disabled={editingProduct ? !isSupervisor : false}
                  />
                </div>
                {/* negocio */}
                <div className="md:col-span-2">
                  <label className="label">Negocio</label>
                  <select
                    className="input"
                    value={formData.businessId}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, businessId: e.target.value }))
                    }
                    disabled={editingProduct ? !isSupervisor : false}
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* margen (solo lectura) */}
                {isSupervisor && (
                  <div>
                    <label className="label">Margen estimado (%)</label>
                    <input
                      type="number"
                      readOnly
                      className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                      value={(formData.margin ?? 0).toFixed(2)}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsProductModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editingProduct && !isSupervisor}
                >
                  {editingProduct ? "Actualizar Producto" : "Agregar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
