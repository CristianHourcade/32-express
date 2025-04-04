"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import {
  getProducts,
  createProduct,
  editProduct,
  removeProduct,
  type Product,
} from "@/lib/redux/slices/productSlice";
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice";
import { Plus, Edit, Trash2, X, Search } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Función para calcular el margen
function calculateMargin(purchasePrice: number, sellingPrice: number): number {
  if (purchasePrice === 0) return 0;
  return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
}

export default function ProductsAdminPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { businesses, loading: businessesLoading } = useSelector(
    (state: RootState) => state.businesses
  );
  // Si tu auth trae un businessId por defecto, úsalo. Si no, lo puedes omitir.
  const businessIdFromAuth = useSelector(
    (state: RootState) => state.auth.user?.businessId
  );

  // ---------------------------
  // STATES LOCALES
  // ---------------------------
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Negocio seleccionado
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");

  // Búsqueda local
  const [searchQuery, setSearchQuery] = useState("");

  // Modales y formularios
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
  });
  const [marginPercent, setMarginPercent] = useState(0);

  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [currentProductForStock, setCurrentProductForStock] = useState<Product | null>(null);
  const [stockToAdd, setStockToAdd] = useState(0);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentProductForDelete, setCurrentProductForDelete] = useState<Product | null>(null);

  // Para mostrar spinner al refrescar
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ordenamiento
  const [sortField, setSortField] = useState<"stock" | null>("stock");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // ---------------------------
  // EFECTOS INICIALES
  // ---------------------------
  useEffect(() => {
    dispatch(fetchBusinesses());
  }, [dispatch]);

  // Si no hay negocio seleccionado, se usa el del auth o el primero
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
          // Si la cantidad de datos recibidos es menor al tamaño del lote, ya no hay más registros
          if (data.length < pageSize) {
            done = true;
          } else {
            page++;
          }
        } else {
          done = true;
        }
      }
  
      // Formateamos los productos de acuerdo al tipo Product
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
  

  // Al cambiar de negocio, se cargan los productos
  useEffect(() => {
    if (selectedBusinessId) {
      fetchProductsForBusiness(selectedBusinessId);
    }
  }, [selectedBusinessId]);

  // ---------------------------
  // BÚSQUEDA LOCAL
  // ---------------------------
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const lowerQuery = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(lowerQuery) ||
        (p.code ?? "").toLowerCase().includes(lowerQuery) ||
        (p.description ?? "").toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery, products]);

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
  // FUNCIONES DE MODALES / ACCIONES
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
    });
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProductFormData({
      name: product.name,
      code: product.code,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      minStock: product.minStock,
      description: product.description,
      businessId: product.businessId,
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

  const handleProductFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await dispatch(editProduct({ ...editingProduct, ...productFormData })).unwrap();
      } else {
        await dispatch(
          createProduct({
            ...productFormData,
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
      console.error("Error updating/creating product:", error);
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
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestión de inventario para el negocio seleccionado
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={openAddProductModal} className="btn btn-primary flex items-center">
            <Plus className="w-5 h-5 mr-1" />
            Agregar Producto
          </button>
          <Link href="/employee/dashboard" className="btn btn-secondary">
            Volver al Dashboard
          </Link>
        </div>
      </div>

      {/* Filtro de Negocio y Buscador */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-1/4">
            <select
              className="input w-full"
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
            >
              <option value="">Selecciona un negocio</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>
          {selectedBusinessId && (
            <div className="relative w-full md:w-1/2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="input pl-10 w-full"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabla de Productos */}
      {selectedBusinessId ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              {/* Definir anchos fijos con colgroup */}
              <colgroup>
                <col className="w-2/5" /> {/* Producto */}
                <col className="w-1/5" /> {/* Precios */}
                <col className="w-1/5" /> {/* Margen */}
                <col className="w-1/5" /> {/* Stock */}
                <col className="w-1/5" /> {/* Acciones */}
              </colgroup>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Precios
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Margen
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
                    Stock {sortField === "stock" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {isRefreshing || isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center">
                        <div className="text-center items-center justify-center flex flex-col">

                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700"></div>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                          Actualizando datos...
                        </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : sortedProducts.length > 0 ? (
                  sortedProducts.map((product) => {
                    const marginNum = calculateMargin(product.purchasePrice, product.sellingPrice);
                    const isExcessiveMargin = marginNum > 1000;

                    return (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        {/* Producto: nombre y código, centrado verticalmente */}
                        <td className="px-6 py-4 align-middle whitespace-normal break-words">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {product.code}
                          </div>
                          {product.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {product.description}
                            </div>
                          )}
                        </td>

                        {/* Precios: Compra arriba, Venta abajo */}
                        <td className="px-6 py-4 align-middle whitespace-nowrap">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Compra:</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            ${product.purchasePrice.toFixed(2)}
                          </div>
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Venta:</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            ${product.sellingPrice.toFixed(2)}
                          </div>
                        </td>

                        {/* Margen */}
                        <td className="px-6 py-4 align-middle whitespace-nowrap">
                          {isExcessiveMargin ? (
                            <span className="inline-block bg-yellow-300 text-black px-2 py-1 text-xs font-medium rounded-full">
                              Calcular MARGEN
                            </span>
                          ) : (
                            <span>{marginNum.toFixed(2)}%</span>
                          )}
                        </td>

                        {/* Stock: Mín arriba, Actual abajo */}
                        <td className="px-6 py-4 align-middle whitespace-nowrap">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Mín: {product.minStock}
                          </div>
                          <div className="mt-1">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${product.stock <= product.minStock
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                  : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                }`}
                            >
                              {product.stock}
                            </span>
                          </div>
                        </td>

                        {/* Acciones (vertical) */}
                        <td className="px-6 py-4 align-middle whitespace-nowrap">
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => openEditProductModal(product)}
                              className="btn btn-primary px-8"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => openDeleteModal(product)}
                              className="btn btn-danger px-8"
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
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      {searchQuery
                        ? "No se encontraron productos que coincidan con la búsqueda."
                        : "No hay productos para este negocio."
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-600 dark:text-gray-400">
          Selecciona un negocio para ver los productos.
        </div>
      )}

      {/* Modal Agregar/Editar */}
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
                <div className="flex flex-col gap-2">
                  <label htmlFor="marginPercent" className="label">
                    Margen de Ganancia (%)
                  </label>
                  <input
                    type="number"
                    id="marginPercent"
                    name="marginPercent"
                    value={marginPercent}
                    onChange={(e) => setMarginPercent(Number(e.target.value))}
                    min="0"
                    step="0.01"
                    readOnly
                    className="input bg-gray-100 dark:bg-gray-700"
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
                    value={productFormData.sellingPrice.toFixed(2)}
                    onChange={(e) =>
                      setProductFormData((prev) => ({
                        ...prev,
                        sellingPrice: Number(e.target.value),
                      }))
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="stock" className="label">
                    Stock Actual
                  </label>
                  <input
                    type="number"
                    id="stock"
                    name="stock"
                    value={productFormData.stock}
                    onChange={handleProductFormChange}
                    min="0"
                    required
                    className="input"
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
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
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

      {/* Modal Agregar Stock */}
      {isAddStockModalOpen && currentProductForStock && (
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
                <p className="font-medium">{currentProductForStock.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Stock Actual</p>
                <p className="font-medium">{currentProductForStock.stock}</p>
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
                  onChange={(e) => setStockToAdd(Number.parseInt(e.target.value) || 0)}
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

      {/* Modal Eliminar */}
      {isDeleteModalOpen && currentProductForDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Confirmar Eliminación</h2>
              <p className="mb-6">
                ¿Estás seguro de que deseas eliminar el producto "
                {currentProductForDelete.name}"? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button onClick={handleDelete} className="btn btn-danger">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
