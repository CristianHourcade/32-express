"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import {
  createProduct,
  editProduct,
  removeProduct,
  type Product,
} from "@/lib/redux/slices/productSlice";
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice";
import { Plus, X, Search } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Lista de categorías para la edición/creación de producto
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
/* ───────── MultiSelectDropdown ───────── */
function MultiSelectDropdown({
  options,
  selectedOptions,
  onChange,
  placeholder = "Selecciona categorías",
}: {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (opt: string) =>
    onChange(
      selectedOptions.includes(opt)
        ? selectedOptions.filter((o) => o !== opt)
        : [...selectedOptions, opt]
    );

  const label =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length > 2
        ? `${selectedOptions.length} seleccionadas`
        : selectedOptions.join(", ");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <span className={selectedOptions.length ? "font-medium" : "text-slate-400"}>
          {label}
        </span>
        {/* caret */}
        <svg
          className={`h-4 w-4 ml-2 transition-transform ${open ? "rotate-180" : ""
            } text-slate-400`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg ring-1 ring-black/5">
          <ul className="max-h-56 overflow-y-auto py-2">
            {options.map((opt) => (
              <li
                key={opt}
                className="px-3 py-1.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-xs"
                onClick={() => toggle(opt)}
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(opt)}
                  readOnly
                  className="accent-indigo-600 h-3 w-3"
                />
                <span>{opt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ───────── SingleSelectDropdown ───────── */
function SingleSelectDropdown({
  options,
  selectedOption,
  onChange,
  placeholder = "Selecciona categoría",
}: {
  options: string[];
  selectedOption: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const select = (opt: string) => {
    onChange(opt);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <span className={selectedOption ? "font-medium" : "text-slate-400"}>
          {selectedOption || placeholder}
        </span>
        <svg
          className={`h-4 w-4 ml-2 transition-transform ${open ? "rotate-180" : ""
            } text-slate-400`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg ring-1 ring-black/5">
          <ul className="max-h-56 overflow-y-auto py-2">
            {options.map((opt) => (
              <li
                key={opt}
                className="px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                onClick={() => select(opt)}
              >
                {opt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


// Función para calcular el margen
function calculateMargin(purchasePrice: number, sellingPrice: number): number {
  if (purchasePrice === 0) return 0;
  return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
}

// Helper que extrae la categoría al inicio del nombre
function extractCategory(name: string): { category: string | null; baseName: string } {
  const parts = name.trim().split(" ");
  if (parts.length > 1 && categories.includes(parts[0].toUpperCase())) {
    return { category: parts[0].toUpperCase(), baseName: parts.slice(1).join(" ") };
  }
  return { category: null, baseName: name };
}

export default function ProductsAdminPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { businesses, loading: businessesLoading } = useSelector(
    (state: RootState) => state.businesses
  );
  const businessIdFromAuth = useSelector(
    (state: RootState) => state.auth.user?.businessId
  );

  // ---------------------------
  // STATES LOCALES
  // ---------------------------
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Para el filtro de la tabla, combinamos las categorías conocidas más la opción "SIN CATEGORÍA"
  const allFilterOptions = [...categories, "SIN CATEGORIA"];
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Estados para modal (crear/editar producto)
  // Se agrega el campo "category", y en "name" se ingresa el nombre sin la categoría (base)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState({
    name: "",
    code: "",
    purchasePrice: 0,
    sellingPrice: 0,
    stock: 0,
    minStock: 0,
    description: "",
    businessId: "",
    category: "",
  });
  const [marginPercent, setMarginPercent] = useState(0);

  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [currentProductForStock, setCurrentProductForStock] = useState<Product | null>(null);
  const [stockToAdd, setStockToAdd] = useState(0);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentProductForDelete, setCurrentProductForDelete] = useState<Product | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortField, setSortField] = useState<"stock" | null>("stock");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // ---------------------------
  // EFECTOS INICIALES
  // ---------------------------
  useEffect(() => {
    dispatch(fetchBusinesses());
  }, [dispatch]);

  useEffect(() => {
    if (businesses.length > 0 && !selectedBusinessId) {
      setSelectedBusinessId(businessIdFromAuth || businesses[0].id);
    }
  }, [businesses, businessIdFromAuth, selectedBusinessId]);

  // ---------------------------
  // FETCH DE PRODUCTOS POR NEGOCIO
  // ---------------------------
  const fetchProductsForBusiness = async (businessId: string) => {
    setProductsLoading(true);
    try {
      const pageSize = 1000;
      let page = 0;
      let allProducts: any[] = [];
      let done = false;
      while (!done) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("business_id", businessId)
          .range(from, to);
        if (error) throw error;
        if (data && data.length > 0) {
          allProducts = allProducts.concat(data);
          if (data.length < pageSize) done = true;
          else page++;
        } else {
          done = true;
        }
      }
      const formattedProducts: Product[] = allProducts.map((item: any) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        description: item.description,
        purchasePrice: item.purchase_price,
        sellingPrice: item.selling_price,
        stock: item.stock,
        minStock: item.min_stock,
        businessId: item.business_id,
        salesCount: item.sales_count || 0,
        totalRevenue: item.total_revenue || 0,
      }));
      setProducts(formattedProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBusinessId) {
      fetchProductsForBusiness(selectedBusinessId);
    }
  }, [selectedBusinessId]);

  // ---------------------------
  // FILTROS: BÚSQUEDA y CATEGORÍAS (MultiSelectDropdown)
  // ---------------------------
  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name ?? "").toLowerCase().includes(lowerQuery) ||
          (p.code ?? "").toLowerCase().includes(lowerQuery) ||
          (p.description ?? "").toLowerCase().includes(lowerQuery)
      );
    }
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((p) => {
        // Se toma la primera palabra en mayúsculas
        const firstWord = p.name.trim().split(" ")[0].toUpperCase();
        const tieneCategoria = categories.includes(firstWord);
        return (
          (tieneCategoria && selectedCategories.includes(firstWord)) ||
          (!tieneCategoria && selectedCategories.includes("SIN CATEGORIA"))
        );
      });
    }
    return filtered;
  }, [searchQuery, products, selectedCategories]);

  // ---------------------------
  // ORDENAMIENTO
  // ---------------------------
  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    if (sortField === "stock") {
      arr.sort((a, b) => (sortOrder === "asc" ? a.stock - b.stock : b.stock - a.stock));
    }
    return arr;
  }, [filteredProducts, sortField, sortOrder]);

  // ---------------------------
  // FUNCIONES DE MODALES / ACCIONES (Crear/Editar)
  // ---------------------------
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductFormData({
      name: "",
      code: "",
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0,
      minStock: 0,
      description: "",
      businessId: selectedBusinessId,
      category: "",
    });
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    const { category, baseName } = extractCategory(product.name);
    setEditingProduct(product);
    setProductFormData({
      name: baseName,
      code: product.code,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      minStock: product.minStock,
      description: product.description,
      businessId: product.businessId,
      category: category || "",
    });
    setMarginPercent(
      product.purchasePrice > 0
        ? Number(((product.sellingPrice / product.purchasePrice - 1) * 100).toFixed(2))
        : 0
    );
    setIsProductModalOpen(true);
  };

  const openDeleteModal = (product: Product) => {
    setCurrentProductForDelete(product);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!currentProductForDelete) return;
    try {
      await dispatch(removeProduct(currentProductForDelete.id)).unwrap();
      setIsDeleteModalOpen(false);
      setIsRefreshing(true);
      await fetchProductsForBusiness(selectedBusinessId);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  // Al enviar el formulario se arma el nombre final (si se seleccionó categoría, se antepone con espacio)
  const handleProductFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const finalName =
        productFormData.category !== ""
          ? `${productFormData.category} ${productFormData.name}`
          : productFormData.name;
      const newProductData = {
        ...productFormData,
        name: finalName,
      };
      if (editingProduct) {
        await dispatch(editProduct({ ...editingProduct, ...newProductData })).unwrap();
      } else {
        await dispatch(
          createProduct({
            ...newProductData,
            createdAt: new Date().toISOString(),
            salesCount: 0,
            totalRevenue: 0,
          })
        ).unwrap();
      }
      setIsProductModalOpen(false);
      setIsRefreshing(true);
      await fetchProductsForBusiness(selectedBusinessId);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error creating/updating product:", error);
    }
  };

  const openAddStockModal = (product: Product) => {
    setCurrentProductForStock(product);
    setStockToAdd(0);
    setIsAddStockModalOpen(true);
  };

  const handleAddStock = async () => {
    if (!currentProductForStock || stockToAdd <= 0) return;
    try {
      await dispatch(
        editProduct({
          ...currentProductForStock,
          stock: currentProductForStock.stock + stockToAdd,
        })
      ).unwrap();
      setIsAddStockModalOpen(false);
      setIsRefreshing(true);
      await fetchProductsForBusiness(selectedBusinessId);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error adding stock:", error);
    }
  };

  const handleProductFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setProductFormData((prev) => ({
      ...prev,
      [name]:
        name === "purchasePrice" ||
          name === "sellingPrice" ||
          name === "stock" ||
          name === "minStock"
          ? Number(value)
          : value,
    }));
  };

  const isLoading = productsLoading || businessesLoading;

  return (
    <div className="space-y-8">
      {/* ───────── Header ───────── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Productos
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Gestión de inventario para el negocio seleccionado
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={openAddProductModal}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-full px-4 py-2 shadow focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Plus className="h-5 w-5" />
            Agregar
          </button>
        </div>
      </header>

      {/* ───────── Filtros ───────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700 p-4">
        <div className="flex flex-col md:flex-row flex-wrap gap-4">
          {/* Negocio */}
          <div className="flex-1 min-w-[180px]">
            <select
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Selecciona un negocio</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Categorías multi‑select */}
          <div className="flex-1 min-w-[220px]">
            <MultiSelectDropdown
              options={[...categories, "SIN CATEGORIA"]}
              selectedOptions={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="Categorías"
            />
          </div>

          {/* Search */}
          {selectedBusinessId && (
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full pl-9 pr-3 py-1.5 text-xs shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* ───────── Tabla ───────── */}
      {selectedBusinessId ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700/70 backdrop-blur sticky top-0 z-10 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Producto</th>
                  <th className="px-4 py-3 text-left font-semibold">Precios</th>
                  <th className="px-4 py-3 text-left font-semibold">Margen</th>
                  <th
                    onClick={() =>
                      sortField === "stock"
                        ? setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                        : (setSortField("stock"), setSortOrder("asc"))
                    }
                    className="px-4 py-3 text-left font-semibold cursor-pointer select-none"
                  >
                    Stock {sortField === "stock" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {isRefreshing || isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-600" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          Actualizando datos…
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : sortedProducts.length ? (
                  sortedProducts.map((p) => {
                    const margin = calculateMargin(p.purchasePrice, p.sellingPrice);
                    const marginWarn = margin > 1000;
                    const { category, baseName } = extractCategory(p.name);

                    return (
                      <tr
                        key={p.id}
                        className="group border-l-4 border-transparent hover:border-sky-500 even:bg-slate-50/60 dark:even:bg-slate-800/30"
                      >
                        {/* ───── Producto ───── */}
                        <td className="px-4 py-3 align-top">
                          {category && (
                            <span className="inline-block mb-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] font-semibold px-2">
                              {category}
                            </span>
                          )}
                          <div className="font-medium">{baseName}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Cod. {p.code}
                          </div>
                          {p.description && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {p.description}
                            </div>
                          )}
                        </td>

                        {/* ───── Precios ───── */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-block mr-1 rounded bg-slate-100 dark:bg-slate-700 px-1.5 text-[11px]">
                            Compra
                          </span>
                          ${p.purchasePrice.toFixed(2)}
                          <br />
                          <span className="inline-block mr-1 mt-1 rounded bg-emerald-100 dark:bg-emerald-900/40 px-1.5 text-[11px]">
                            Venta
                          </span>
                          ${p.sellingPrice.toFixed(2)}
                        </td>

                        {/* ───── Margen ───── */}
                        <td className="px-4 py-3">
                          {marginWarn ? (
                            <span className="inline-flex items-center gap-1 bg-yellow-300 text-black px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><circle cx="12" cy="16" r="1" /></svg>
                              Calcular
                            </span>
                          ) : (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${margin < 20
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                                  : margin < 60
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                }`}
                            >
                              {margin.toFixed(1)} %
                            </span>
                          )}
                        </td>

                        {/* ───── Stock ───── */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${p.stock <= p.minStock
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                }`}
                            >
                              {p.stock}
                            </span>
                            <span className="text-[10px] text-slate-400">/ mín. {p.minStock}</span>
                          </div>
                          {/* barra visual */}
                          <div className="mt-1 h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded">
                            <div
                              className={`h-full rounded ${p.stock <= p.minStock ? "bg-rose-500" : "bg-emerald-500"
                                }`}
                              style={{
                                width: `${Math.min((p.stock / (p.minStock || 1)) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </td>

                        {/* ───── Acciones ───── */}
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditProductModal(p)}
                              className="btn btn-primary px-6"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => openDeleteModal(p)}
                              className="btn btn-danger px-6"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>

                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                      {searchQuery
                        ? "Sin coincidencias para la búsqueda."
                        : "Este negocio aún no tiene productos."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-600 dark:text-slate-400 py-12">
          Selecciona un negocio para ver los productos.
        </p>
      )}

      {/* ───────── Modal Agregar / Editar ───────── */}
{isProductModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 animate-scale-in">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold">
          {editingProduct ? "Editar producto" : "Nuevo producto"}
        </h2>
        <button
          onClick={() => setIsProductModalOpen(false)}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        </button>
      </header>

      {/* Formulario */}
      <form onSubmit={handleProductFormSubmit} className="px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Categoría */}
          <div>
            <label className="label">Categoría</label>
            <SingleSelectDropdown
              options={categories}
              selectedOption={productFormData.category}
              onChange={(v) => setProductFormData((p) => ({ ...p, category: v }))}
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="label">Nombre</label>
            <input
              className="input"
              name="name"
              required
              placeholder="Nombre sin categoría"
              value={productFormData.name}
              onChange={handleProductFormChange}
            />
          </div>

          {/* Código */}
          <div>
            <label className="label">Código</label>
            <input
              className="input"
              name="code"
              required
              value={productFormData.code}
              onChange={handleProductFormChange}
            />
          </div>

          {/* Compra */}
          <div>
            <label className="label">Precio compra</label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="purchasePrice"
              className="input"
              value={productFormData.purchasePrice}
              onChange={handleProductFormChange}
            />
          </div>

          {/* Margen % */}
          <div>
            <label className="label">Margen (%)</label>
            <input
              readOnly
              className="input bg-slate-100 dark:bg-slate-700"
              value={marginPercent}
            />
          </div>

          {/* Venta */}
          <div>
            <label className="label">Precio venta</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={productFormData.sellingPrice.toFixed(2)}
              onChange={(e) =>
                setProductFormData((p) => ({ ...p, sellingPrice: +e.target.value }))
              }
            />
          </div>

          {/* Stock */}
          <div>
            <label className="label">Stock actual</label>
            <input
              type="number"
              min="0"
              name="stock"
              className="input"
              required
              value={productFormData.stock}
              onChange={handleProductFormChange}
            />
          </div>

          {/* Stock mínimo */}
          <div>
            <label className="label">Stock mínimo</label>
            <input
              type="number"
              min="0"
              name="minStock"
              className="input"
              required
              value={productFormData.minStock}
              onChange={handleProductFormChange}
            />
          </div>

          {/* Descripción */}
          <div className="md:col-span-2">
            <label className="label">Descripción</label>
            <textarea
              rows={3}
              name="description"
              className="input"
              value={productFormData.description}
              onChange={handleProductFormChange}
            />
          </div>

          {/* Negocio */}
          <div className="md:col-span-2">
            <label className="label">Negocio</label>
            <select
              name="businessId"
              className="input"
              required
              value={productFormData.businessId}
              onChange={handleProductFormChange}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botones */}
        <footer className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsProductModalOpen(false)}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            {editingProduct ? "Actualizar" : "Agregar"}
          </button>
        </footer>
      </form>
    </div>
  </div>
)}

{/* ───────── Modal Agregar stock ───────── */}
{isAddStockModalOpen && currentProductForStock && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="w-full max-w-md rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 animate-scale-in">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold">Agregar stock</h2>
        <button
          onClick={() => setIsAddStockModalOpen(false)}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        </button>
      </header>

      <div className="px-6 py-5 space-y-5">
        <p className="text-sm">
          <span className="font-medium">{currentProductForStock.name}</span>
          <br />
          Stock actual&nbsp;
          <span className="font-semibold">{currentProductForStock.stock}</span>
        </p>

        <div>
          <label className="block text-xs font-medium mb-1">Cantidad</label>
          <input
            type="number"
            min="1"
            className="input"
            value={stockToAdd}
            onChange={(e) => setStockToAdd(parseInt(e.target.value) || 0)}
          />
        </div>

        <footer className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsAddStockModalOpen(false)}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={stockToAdd <= 0}
            onClick={handleAddStock}
            className="btn btn-primary"
          >
            Confirmar
          </button>
        </footer>
      </div>
    </div>
  </div>
)}

{/* ───────── Modal Eliminar ───────── */}
{isDeleteModalOpen && currentProductForDelete && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="w-full max-w-md rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 animate-scale-in">
      <div className="px-6 py-6 space-y-6">
        <h2 className="text-lg font-semibold">Eliminar producto</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          ¿Seguro que deseas eliminar&nbsp;
          <span className="font-medium">
            {currentProductForDelete.name}
          </span>
          ? Esta acción no se puede deshacer.
        </p>

        <footer className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => setIsDeleteModalOpen(false)}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button onClick={handleDelete} className="btn btn-danger">
            Eliminar
          </button>
        </footer>
      </div>
    </div>
  </div>
)}

    </div>
  );
}
