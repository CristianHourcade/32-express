"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/lib/redux/store";
import { Plus, X, Search, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

export default function EmployeeProductsPage() {
  // Obtenemos el usuario y el negocio desde Redux (para auth y datos del negocio)
  const { user } = useSelector((state: RootState) => state.auth);
  const { businesses, loading: businessesLoading } = useSelector(
    (state: RootState) => state.businesses
  );

  const businessId = user?.businessId;

  // Estado local para los productos obtenidos desde la base de datos
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  // Estados para el modal de Agregar/Editar Producto
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState({
    name: "",
    code: "",
    purchasePrice: 0,
    sellingPrice: 0,
    stock: 0, // siempre en 0 para el empleado
    minStock: 0,
    description: "",
    businessId: businessId || "",
  });
  const [marginPercent, setMarginPercent] = useState(0);

  // Otros estados (búsqueda, agregar stock, etc.)
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [stockToAdd, setStockToAdd] = useState(0);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estados para ordenamiento por stock
  const [sortField, setSortField] = useState<"stock" | null>("stock");
  // Cambiamos el valor inicial a "desc" para que muestre primero el mayor stock
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Función para obtener los productos filtrados por business_id
  const fetchProducts = async () => {
    if (!businessId) return;
    setIsProductsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("business_id", businessId);
    if (error) {
      console.error("Error fetching products:", error);
      setIsProductsLoading(false);
      return;
    }
    // Formateamos los datos para que coincidan con nuestro tipo Product
    const formattedProducts: Product[] = (data || []).map((item: any) => ({
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

  // Llamamos a fetchProducts cuando el businessId esté disponible
  useEffect(() => {
    if (businessId) {
      fetchProducts();
    }
  }, [businessId]);

  // Calculamos los productos con bajo stock para la alerta
  const lowStockProducts = useMemo(() => {
    return products.filter((product) => product.stock <= product.minStock);
  }, [products]);

  // Función para buscar productos en la base de datos (filtrados por businessId)
  const searchProductsInDB = async (query: string) => {
    if (!query.trim() || !businessId) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId)
        .or(
          `name.ilike.%${query}%,code.ilike.%${query}%,description.ilike.%${query}%`
        )
        .limit(20);
      if (error) throw error;
      const formattedResults: Product[] = (data || []).map((item: any) => ({
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
      setSearchResults(formattedResults);
    } catch (error) {
      console.error("Error searching products:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim()) {
      searchProductsInDB(query);
    } else {
      setSearchResults([]);
    }
  };

  // Funcionalidad para agregar stock a un producto
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
      if(searchQuery) searchProductsInDB(searchQuery);
    } catch (error) {
      console.error("Error adding stock:", error);
    }
  };

  // Abrir el modal para agregar un nuevo producto
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductFormData({
      name: "",
      code: "",
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0, // siempre en 0 para el empleado
      minStock: 0,
      description: "",
      businessId: businessId || "",
    });
    setIsProductModalOpen(true);
  };

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

  useEffect(() => {
    if (productFormData.purchasePrice > 0) {
      const computedMargin =
        (productFormData.sellingPrice / productFormData.purchasePrice - 1) * 100;
      setMarginPercent(Number(computedMargin.toFixed(2)));
    } else {
      setMarginPercent(0);
    }
  }, [productFormData.purchasePrice, productFormData.sellingPrice]);

  const handleProductFormSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    // Transformamos los nombres de los campos para que coincidan con la base de datos
    const dbProductData = {
      name: productFormData.name,
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
          .update(dbProductData)
          .eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .insert({
            ...dbProductData,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
      fetchProducts();
      setIsProductModalOpen(false);
    } catch (error) {
      console.error("Error updating/creating product:", error);
    }
  };

  // Si hay búsqueda se muestran esos resultados; de lo contrario, los productos obtenidos de la DB
  const displayProducts = searchQuery ? searchResults : products;

  // Ordenar los productos por stock actual
  const sortedProducts = useMemo(() => {
    const productsToSort = [...displayProducts];
    if (sortField === "stock") {
      productsToSort.sort((a, b) =>
        sortOrder === "asc" ? a.stock - b.stock : b.stock - a.stock
      );
    }
    return productsToSort;
  }, [displayProducts, sortField, sortOrder]);

  const isLoading = isProductsLoading || businessesLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Cargando productos...
          </p>
        </div>
      </div>
    );
  }

  const currentBusiness = businesses.find(
    (business) => business.id === businessId
  );

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
            Total de productos: {displayProducts.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={openAddProductModal}
            className="btn btn-primary flex items-center"
          >
            <Plus className="w-5 h-5 mr-1" />
            Agregar Producto
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
                <p>
                  Hay {lowStockProducts.length} productos con stock por debajo del mínimo requerido.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buscador */}
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
        </div>
      </div>

      {/* Indicador de búsqueda */}
      {isSearching && (
        <div className="text-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Buscando productos...
          </p>
        </div>
      )}

      {/* Tabla de Productos */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Precio
                </th>
                <th
                  onClick={() => {
                    if (sortField === "stock") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortField("stock");
                      setSortOrder("asc");
                    }
                  }}
                  className="cursor-pointer px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Stock Actual {sortField === "stock" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Stock Mínimo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedProducts.length > 0 ? (
                sortedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {product.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {product.code}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {product.minStock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openAddStockModal(product)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Agregar Stock
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {searchQuery
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
                <label
                  htmlFor="stockToAdd"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Cantidad a Agregar
                </label>
                <input
                  type="number"
                  id="stockToAdd"
                  min="1"
                  value={stockToAdd}
                  onChange={(e) =>
                    setStockToAdd(Number.parseInt(e.target.value) || 0)
                  }
                  className="input mt-1"
                />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddStockModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
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
                  <label htmlFor="name" className="label">
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={productFormData.name}
                    onChange={handleProductFormChange}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="code" className="label">
                    Código
                  </label>
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
                  <label htmlFor="purchasePrice" className="label">
                    Precio de Compra
                  </label>
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
                  <label htmlFor="sellingPrice" className="label">
                    Precio de Venta
                  </label>
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
                  <label htmlFor="stock" className="label">
                    Stock
                  </label>
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
                  <label htmlFor="minStock" className="label">
                    Stock Mínimo
                  </label>
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
                  <label htmlFor="description" className="label">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={productFormData.description}
                    onChange={handleProductFormChange}
                    rows={3}
                    className="input"
                  ></textarea>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
