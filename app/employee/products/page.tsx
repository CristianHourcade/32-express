"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/lib/redux/store";
import { Plus, X, Search, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Hook para debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Definición del tipo Product (asegúrate de que coincide con tu esquema en Supabase)
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
}

// LISTA DE CATEGORÍAS PARA CREAR/EDITAR PRODUCTOS
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

// Componente para dropdown multi-select (para filtrar el listado)
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
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter((o) => o !== option)
      : [...selectedOptions, option];
    onChange(newSelected);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input w-full text-left flex items-center justify-between"
      >
        <span>
          {selectedOptions.length > 0 ? selectedOptions.join(", ") : placeholder}
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 shadow-lg border rounded w-full">
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="mr-2"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para dropdown de selección única (para seleccionar categoría en el modal)
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
  const [isOpen, setIsOpen] = useState(false);
  const handleOptionSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input w-full text-left flex items-center justify-between"
      >
        <span>{selectedOption || placeholder}</span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 shadow-lg border rounded w-full">
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionSelect(option)}
                className="w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper para extraer la categoría inicial del nombre (si coincide con alguna conocida)
function extractCategory(name: string): { category: string | null; baseName: string } {
  const parts = name.trim().split(" ");
  if (parts.length > 1 && categories.includes(parts[0].toUpperCase())) {
    return { category: parts[0].toUpperCase(), baseName: parts.slice(1).join(" ") };
  }
  return { category: null, baseName: name };
}

export default function EmployeeProductsPage() {
  // Obtenemos el usuario y negocio desde Redux
  const { user } = useSelector((state: RootState) => state.auth);
  console.log(user)
  const { businesses, loading: businessesLoading } = useSelector(
    (state: RootState) => state.businesses
  );
  const businessId = user?.businessId;

  // Estados para productos y carga
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  // Estados para el modal de agregar/editar producto
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
    businessId: businessId || "",
    category: "",
  });
  const [marginPercent, setMarginPercent] = useState(0);

  // Estados para búsqueda y para agregar/quitar stock
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 150);

  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isSubtractStockModalOpen, setIsSubtractStockModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [stockToAdd, setStockToAdd] = useState(0);
  const [stockToSubtract, setStockToSubtract] = useState(0);

  // Estado para ordenamiento por stock
  const [sortField, setSortField] = useState<"stock" | null>("stock");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Para filtrar el listado con base en la categoría
  const allFilterOptions = [...categories, "SIN CATEGORIA"];
  const [selectedFilterCategories, setSelectedFilterCategories] = useState<string[]>([]);

  // Función para obtener productos según businessId
  const fetchProducts = async () => {
    if (!businessId) return;
    setIsProductsLoading(true);
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

      if (error) {
        console.error("Error fetching products:", error);
        break;
      }
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
    setIsProductsLoading(false);
  };

  // Cargar productos cuando exista businessId
  useEffect(() => {
    if (businessId) {
      fetchProducts();
    }
  }, [businessId]);

  // Calcular productos con bajo stock (para alerta)
  const lowStockProducts = useMemo(
    () => products.filter((product) => product.stock <= product.minStock),
    [products]
  );

  // Filtrar productos a partir del debounce de búsqueda y filtros
  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q)
      );
    }

    if (selectedFilterCategories.length > 0) {
      filtered = filtered.filter((p) => {
        const firstWord = p.name.trim().split(" ")[0].toUpperCase();
        const hasCat = categories.includes(firstWord);
        return hasCat
          ? selectedFilterCategories.includes(firstWord)
          : selectedFilterCategories.includes("SIN CATEGORIA");
      });
    }

    return filtered;
  }, [debouncedSearchQuery, products, selectedFilterCategories]);

  // Ordenar productos
  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    if (sortField === "stock") {
      arr.sort((a, b) =>
        sortOrder === "asc" ? a.stock - b.stock : b.stock - a.stock
      );
    }
    return arr;
  }, [filteredProducts, sortField, sortOrder]);

  // Handlers para search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Abrir modals de stock
  const openAddStockModal = (product: Product) => {
    setCurrentProduct(product);
    setStockToAdd(0);
    setIsAddStockModalOpen(true);
  };
  const openSubtractStockModal = (product: Product) => {
    setCurrentProduct(product);
    setStockToSubtract(0);
    setIsSubtractStockModalOpen(true);
  };

  // Añadir stock y log en activities
  const handleAddStock = async () => {
    if (!currentProduct || stockToAdd <= 0) return;
    const newStock = currentProduct.stock + stockToAdd;
    const { error: prodErr } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", currentProduct.id);
    if (!prodErr) {
      await supabase.from("activities").insert({
        business_id: businessId,
        details: `${user?.name} - Added ${stockToAdd} to ${currentProduct.name}`,
        created_at: new Date().toISOString(),
      });
      setIsAddStockModalOpen(false);
      fetchProducts();
    }
  };

  // Quitar stock y log en activities
  const handleSubtractStock = async () => {
    if (!currentProduct || stockToSubtract == 0 || stockToSubtract > currentProduct.stock) return;
    const newStock = currentProduct.stock - stockToSubtract;
    const { error: prodErr } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", currentProduct.id);
    if (!prodErr) {
      await supabase.from("activities").insert({
        business_id: businessId,
        details: `${user?.name} Removed ${stockToSubtract} from ${currentProduct.name}`,
        created_at: new Date().toISOString(),
      });
      setIsSubtractStockModalOpen(false);
      fetchProducts();
    }
  };

  // Abrir modal de agregar producto
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
      businessId: businessId || "",
      category: "",
    });
    setMarginPercent(0);
    setIsProductModalOpen(true);
  };

  // Cambios en el formulario
  const handleProductFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setProductFormData((prev) => ({
      ...prev,
      [name]:
        name === "purchasePrice" ||
        name === "sellingPrice" ||
        name === "minStock"
          ? Number(value)
          : value,
    }));
  };

  // Calcular margen dinámico
  useEffect(() => {
    if (productFormData.purchasePrice > 0) {
      const m =
        (productFormData.sellingPrice / productFormData.purchasePrice - 1) * 100;
      setMarginPercent(Number(m.toFixed(2)));
    } else {
      setMarginPercent(0);
    }
  }, [productFormData.purchasePrice, productFormData.sellingPrice]);

  // Enviar formulario de producto
  const handleProductFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const finalName =
      productFormData.category !== ""
        ? `${productFormData.category} ${productFormData.name}`
        : productFormData.name;
    const dbData = {
      name: finalName,
      code: productFormData.code,
      purchase_price: productFormData.purchasePrice,
      selling_price: productFormData.sellingPrice,
      stock: productFormData.stock,
      min_stock: productFormData.minStock,
      description: productFormData.description,
      business_id: productFormData.businessId,
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
        await supabase.from("activities").insert({
          business_id: businessId,
          details: `${user?.name} - Created product ${finalName}`,
          created_at: new Date().toISOString(),
        });
      }
      fetchProducts();
      setIsProductModalOpen(false);
    } catch (err) {
      console.error("Error saving product:", err);
    }
  };

  // Abrir modal editar
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

  // Estado general de carga
  const isLoading = isProductsLoading || businessesLoading;
  const currentBusiness = businesses.find((b) => b.id === businessId);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestión de inventario para {currentBusiness?.name || "tu negocio"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total de productos: {filteredProducts.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={openAddProductModal}
            className="btn btn-primary flex items-center"
          >
            <Plus className="w-5 h-5 mr-1" /> Agregar Producto
          </button>
          <Link href="/employee/dashboard" className="btn btn-secondary">
            Volver al Dashboard
          </Link>
        </div>
      </div>

      {/* Alerta de Stock Bajo */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle
                className="h-5 w-5 text-amber-500"
                aria-hidden="true"
              />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Alerta de Stock Bajo
              </h3>
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-200">
                <p>
                  Hay {lowStockProducts.length} productos con stock por debajo
                  del mínimo requerido.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buscador y Filtro por Categorías */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="input pl-10 w-full"
              placeholder="Buscar productos por nombre, código o descripción..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          <div className="w-full md:w-1/3">
            <MultiSelectDropdown
              options={allFilterOptions}
              selectedOptions={selectedFilterCategories}
              onChange={setSelectedFilterCategories}
            />
          </div>
        </div>
      </div>

      {/* Listado de Productos */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
            <colgroup>
              <col className="w-2/5" />
              <col className="w-1/5" />
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {!isLoading && sortedProducts.length > 0 ? (
                sortedProducts.map((product) => {
                  const { category, baseName } = extractCategory(product.name);
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 whitespace-normal break-words">
                        {category && (
                          <div className="text-xs font-bold text-blue-400 dark:text-blue-300">
                            {category}
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {baseName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {product.code}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${product.sellingPrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            product.stock <= product.minStock
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm flex space-x-2">
                        <button
                          onClick={() => openAddStockModal(product)}
                          className="bg-black text-white p-2 rounded"
                        >
                          Agregar Stock
                        </button>
                        <button
                          onClick={() => openSubtractStockModal(product)}
                          className="bg-red-600 text-white p-2 rounded"
                        >
                          Quitar Stock
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {isLoading
                      ? "Cargando productos..."
                      : "No hay productos para mostrar."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Agregar Stock */}
      {isAddStockModalOpen && currentProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Agregar Stock</h2>
              <button
                onClick={() => setIsAddStockModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
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
              <label htmlFor="stockToAdd" className="block text-sm font-medium">
                Cantidad a agregar
              </label>
              <input
                id="stockToAdd"
                type="number"
                min={1}
                value={stockToAdd}
                onChange={(e) => setStockToAdd(Number(e.target.value) || 0)}
                className="input w-full"
              />
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setIsAddStockModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddStock}
                  disabled={stockToAdd <= 0}
                  className="btn btn-primary"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Quitar Stock */}
      {isSubtractStockModalOpen && currentProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Quitar Stock</h2>
              <button
                onClick={() => setIsSubtractStockModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
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
              <label htmlFor="stockToSubtract" className="block text-sm font-medium">
                Cantidad a quitar
              </label>
              <input
                id="stockToSubtract"
                type="number"
                min={1}
                max={currentProduct.stock}
                value={stockToSubtract}
                onChange={(e) => setStockToSubtract(Number(e.target.value) || 0)}
                className="input w-full"
              />
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setIsSubtractStockModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubtractStock}
                  disabled={stockToSubtract < 1 || stockToSubtract > currentProduct.stock}
                  className="btn btn-primary"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Agregar/Editar Producto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                {editingProduct ? "Editar Producto" : "Agregar Nuevo Producto"}
              </h2>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleProductFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Categoría</label>
                  <SingleSelectDropdown
                    options={categories}
                    selectedOption={productFormData.category}
                    onChange={(value) =>
                      setProductFormData((prev) => ({ ...prev, category: value }))
                    }
                  />
                </div>
                <div>
                  <label htmlFor="name" className="label">
                    Nombre del Producto
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={productFormData.name}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                    placeholder="Nombre sin categoría"
                  />
                </div>
                <div>
                  <label htmlFor="code" className="label">
                    Código
                  </label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    value={productFormData.code}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="purchasePrice" className="label">
                    Precio de Compra
                  </label>
                  <input
                    id="purchasePrice"
                    name="purchasePrice"
                    type="number"
                    min={0}
                    step={0.01}
                    value={productFormData.purchasePrice}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="sellingPrice" className="label">
                    Precio de Venta
                  </label>
                  <input
                    id="sellingPrice"
                    name="sellingPrice"
                    type="number"
                    min={0}
                    step={0.01}
                    value={productFormData.sellingPrice}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="minStock" className="label">
                    Stock Mínimo
                  </label>
                  <input
                    id="minStock"
                    name="minStock"
                    type="number"
                    min={0}
                    value={productFormData.minStock}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="label">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={productFormData.description}
                    onChange={handleProductFormChange}
                    className="input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="businessId" className="label">
                    Negocio
                  </label>
                  <select
                    id="businessId"
                    name="businessId"
                    value={productFormData.businessId}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Margen: <strong>{marginPercent}%</strong>
                  </p>
                </div>
                <div className="space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingProduct ? "Actualizar Producto" : "Agregar Producto"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
