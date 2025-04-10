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
    let newSelected;
    if (selectedOptions.includes(option)) {
      newSelected = selectedOptions.filter((o) => o !== option);
    } else {
      newSelected = [...selectedOptions, option];
    }
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

// Función para calcular el margen
function calculateMargin(purchasePrice: number, sellingPrice: number): number {
  if (purchasePrice === 0) return 0;
  return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
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
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses);
  const businessId = user?.businessId;

  // Estados para productos y carga
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  // Estados para el modal de agregar/editar producto
  // Se añade la propiedad "category" y se almacenará el nombre base sin categoría
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

  // Estados para búsqueda y para agregar stock
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 150);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [stockToAdd, setStockToAdd] = useState(0);

  // Estado para ordenamiento por stock
  const [sortField, setSortField] = useState<"stock" | null>("stock");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Para filtrar el listado con base en la categoría
  // Se usan las categorías conocidas más la opción "SIN CATEGORIA"
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
  const lowStockProducts = useMemo(() => {
    return products.filter((product) => product.stock <= product.minStock);
  }, [products]);

  // Filtrar productos a partir del debounce de búsqueda
  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (debouncedSearchQuery.trim()) {
      const lowerQuery = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name ?? "").toLowerCase().includes(lowerQuery) ||
          (p.code ?? "").toLowerCase().includes(lowerQuery) ||
          (p.description ?? "").toLowerCase().includes(lowerQuery)
      );
    }
    // Si se han seleccionado opciones de filtro, se filtran según la categoría que aparezca al inicio
    if (selectedFilterCategories.length > 0) {
      filtered = filtered.filter((p) => {
        const firstWord = p.name.trim().split(" ")[0].toUpperCase();
        const tieneCategoria = categories.includes(firstWord);
        return (
          (tieneCategoria && selectedFilterCategories.includes(firstWord)) ||
          (!tieneCategoria && selectedFilterCategories.includes("SIN CATEGORIA"))
        );
      });
    }
    return filtered;
  }, [debouncedSearchQuery, products, selectedFilterCategories]);

  // Ordenar productos (por stock en este ejemplo)
  const sortedProducts = useMemo(() => {
    const productsToSort = [...filteredProducts];
    if (sortField === "stock") {
      productsToSort.sort((a, b) =>
        sortOrder === "asc" ? a.stock - b.stock : b.stock - a.stock
      );
    }
    return productsToSort;
  }, [filteredProducts, sortField, sortOrder]);

  // Manejador de búsqueda
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Funcionalidad para agregar stock
  const openAddStockModal = (product: Product) => {
    setCurrentProduct(product);
    setStockToAdd(0);
    setIsAddStockModalOpen(true);
  };

  const handleAddStock = async () => {
    if (!currentProduct || stockToAdd <= 0) return;
    try {
      const { error } = await supabase
        .from("products")
        .update({ stock: currentProduct.stock + stockToAdd })
        .eq("id", currentProduct.id);
      if (error) throw error;
      setIsAddStockModalOpen(false);
      fetchProducts();
    } catch (error) {
      console.error("Error adding stock:", error);
    }
  };

  // Abrir modal para agregar nuevo producto
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
    setIsProductModalOpen(true);
  };

  // Manejador del formulario de creación/edición
  const handleProductFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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

  // Actualizar margen dinámico
  useEffect(() => {
    if (productFormData.purchasePrice > 0) {
      const computedMargin =
        (productFormData.sellingPrice / productFormData.purchasePrice - 1) * 100;
      setMarginPercent(Number(computedMargin.toFixed(2)));
    } else {
      setMarginPercent(0);
    }
  }, [productFormData.purchasePrice, productFormData.sellingPrice]);

  // Enviar el formulario de creación/edición: se arma el nombre final anteponiendo la categoría (si existe)
  const handleProductFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const finalName =
        productFormData.category !== ""
          ? `${productFormData.category} ${productFormData.name}`
          : productFormData.name;
      const dbProductData = {
        name: finalName,
        code: productFormData.code,
        purchase_price: productFormData.purchasePrice,
        selling_price: productFormData.sellingPrice,
        stock: productFormData.stock,
        min_stock: productFormData.minStock,
        description: productFormData.description,
        business_id: productFormData.businessId,
      };
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(dbProductData)
          .eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .insert({ ...dbProductData, created_at: new Date().toISOString() });
        if (error) throw error;
      }
      fetchProducts();
      setIsProductModalOpen(false);
    } catch (error) {
      console.error("Error updating/creating product:", error);
    }
  };

  // Al editar producto, extraer la categoría (si ya está incluida en el nombre)
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
          <button onClick={openAddProductModal} className="btn btn-primary flex items-center">
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
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Alerta de Stock Bajo
              </h3>
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-200">
                <p>Hay {lowStockProducts.length} productos con stock por debajo del mínimo requerido.</p>
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
              placeholder="Filtrar por categoría"
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
              {sortedProducts.length > 0 && !isLoading ? (
                sortedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-normal break-words">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {product.name}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openAddStockModal(product)}
                        className="bg-black text-white p-3"
                      >
                        Agregar Stock
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {isLoading
                      ? "Cargando productos..."
                      : searchQuery
                      ? "No se encontraron productos que coincidan con la búsqueda."
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
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Producto</p>
                <p className="font-medium">{currentProduct.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Stock Actual</p>
                <p className="font-medium">{currentProduct.stock}</p>
              </div>
              <div>
                <label htmlFor="stockToAdd" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cantidad a Agregar
                </label>
                <input
                  type="number"
                  id="stockToAdd"
                  min="1"
                  value={stockToAdd}
                  onChange={(e) => setStockToAdd(Number.parseInt(e.target.value) || 0)}
                  className="input mt-1"
                />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsAddStockModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="button" onClick={handleAddStock} disabled={stockToAdd <= 0} className="btn btn-primary">
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
                {/* Dropdown para seleccionar categoría */}
                <div>
                  <label className="label">Categoría</label>
                  <SingleSelectDropdown
                    options={categories}
                    selectedOption={productFormData.category}
                    onChange={(value) =>
                      setProductFormData((prev) => ({ ...prev, category: value }))
                    }
                    placeholder="Selecciona categoría"
                  />
                </div>
                {/* Campo para el nombre base sin categoría */}
                <div>
                  <label htmlFor="name" className="label">Nombre del Producto</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={productFormData.name}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                    placeholder="Nombre sin categoría"
                  />
                </div>
                <div>
                  <label htmlFor="code" className="label">Código</label>
                  <input
                    type="text"
                    id="code"
                    name="code"
                    value={productFormData.code}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="purchasePrice" className="label">Precio de Compra</label>
                  <input
                    type="number"
                    id="purchasePrice"
                    name="purchasePrice"
                    value={productFormData.purchasePrice}
                    onChange={handleProductFormChange}
                    min="0"
                    step="0.01"
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="sellingPrice" className="label">Precio de Venta</label>
                  <input
                    type="number"
                    id="sellingPrice"
                    name="sellingPrice"
                    value={productFormData.sellingPrice}
                    onChange={handleProductFormChange}
                    min="0"
                    step="0.01"
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="stock" className="label">Stock</label>
                  <input
                    type="number"
                    id="stock"
                    name="stock"
                    value={productFormData.stock}
                    readOnly
                    className="input bg-gray-100 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label htmlFor="minStock" className="label">Stock Mínimo</label>
                  <input
                    type="number"
                    id="minStock"
                    name="minStock"
                    value={productFormData.minStock}
                    onChange={handleProductFormChange}
                    min="0"
                    required
                    className="input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="description" className="label">Descripción</label>
                  <textarea
                    id="description"
                    name="description"
                    value={productFormData.description}
                    onChange={handleProductFormChange}
                    rows={3}
                    className="input"
                  ></textarea>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="businessId" className="label">Negocio</label>
                  <select
                    id="businessId"
                    name="businessId"
                    value={productFormData.businessId}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                  >
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
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
