"use client"

import type React from "react"
import { useEffect, useState, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getProducts, editProduct, type Product } from "@/lib/redux/slices/productSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice"
import { Search, X, AlertTriangle, Plus, Edit } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default function EmployeeProductsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [selectedBusinessId, setSelectedBusinessId] = useState("")

  // Estados para modal de Agregar Stock
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false)
  const [currentProductForStock, setCurrentProductForStock] = useState<Product | null>(null)
  const [stockToAdd, setStockToAdd] = useState(0)

  // Estados para modal de Agregar/Editar Producto
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productFormData, setProductFormData] = useState({
    name: "",
    code: "",
    purchasePrice: 0,
    sellingPrice: 0,
    stock: 0,
    minStock: 0,
    description: "",
    businessId: "",
  })

  const businessId = user?.businessId

  useEffect(() => {
    dispatch(getProducts())
    dispatch(fetchBusinesses())
  }, [dispatch])

  // Productos con stock bajo (alerta)
  const lowStockProducts = useMemo(() => {
    if (!products || !businessId) return []
    return products.filter((product) => product.stock <= product.minStock).slice(0, 10)
  }, [products, businessId])

  // Búsqueda remota con Supabase
  const searchProductsInDB = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .or(`name.ilike.%${query}%,code.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(20)

      if (error) throw error

      const formattedResults: Product[] = data.map((item) => ({
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
      }))

      setSearchResults(formattedResults)
    } catch (error) {
      console.error("Error searching products:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Manejar cambios en la búsqueda
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    if (query.trim()) {
      searchProductsInDB(query)
    } else {
      setSearchResults([])
    }
  }

  // Handler para el filtro por negocio (en el listado)
  const handleBusinessFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBusinessId(e.target.value)
  }

  // Funciones para el modal de Agregar Stock
  const openAddStockModal = (product: Product) => {
    setCurrentProductForStock(product)
    setStockToAdd(0)
    setIsAddStockModalOpen(true)
  }

  const handleAddStock = async () => {
    if (!currentProductForStock || stockToAdd <= 0) return
    try {
      await dispatch(
        editProduct({
          ...currentProductForStock,
          stock: currentProductForStock.stock + stockToAdd,
        }),
      )
      setIsAddStockModalOpen(false)
      // Actualizar búsqueda si es necesario
      if (searchResults.length > 0) {
        setSearchResults((prev) =>
          prev.map((p) =>
            p.id === currentProductForStock.id ? { ...p, stock: p.stock + stockToAdd } : p,
          ),
        )
      }
    } catch (error) {
      console.error("Error adding stock:", error)
    }
  }

  // Funciones para el modal de Agregar/Editar Producto
  const openAddProductModal = () => {
    setEditingProduct(null)
    setProductFormData({
      name: "",
      code: "",
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0,
      minStock: 0,
      description: "",
      businessId: businesses.length > 0 ? businesses[0].id : "",
    })
    setIsProductModalOpen(true)
  }

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product)
    setProductFormData({
      name: product.name,
      code: product.code,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      minStock: product.minStock,
      description: product.description,
      businessId: product.businessId,
    })
    setIsProductModalOpen(true)
  }

  const handleProductFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setProductFormData({
      ...productFormData,
      [name]:
        name === "purchasePrice" ||
        name === "sellingPrice" ||
        name === "stock" ||
        name === "minStock"
          ? Number(value)
          : value,
    })
  }

  const handleProductFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (editingProduct) {
      dispatch(editProduct({ ...editingProduct, ...productFormData }))
    } else {
      dispatch(
        createProduct({
          ...productFormData,
          createdAt: new Date().toISOString(),
          salesCount: 0,
          totalRevenue: 0,
        }),
      )
    }
    setIsProductModalOpen(false)
  }

  const isLoading = productsLoading || businessesLoading

  // Aunque estemos en loading, ya se han ejecutado todos los hooks.
  const currentBusiness = businesses.find((business) => business.id === businessId)

  // Seleccionar lista de productos según búsqueda o estado
  const displayProducts = searchQuery
    ? searchResults
    : showAllProducts
      ? products
      : lowStockProducts

  // Aplicar filtro por negocio (si se selecciona alguno)
  const filteredProducts = useMemo(() => {
    return displayProducts.filter((product) =>
      selectedBusinessId ? product.businessId === selectedBusinessId : true,
    )
  }, [displayProducts, selectedBusinessId])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando productos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestión de inventario para {currentBusiness?.name || "tu negocio"}
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

      {/* Low Stock Alert */}
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

      {/* Search, Filtro y Botón para cambiar listado */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Input de búsqueda */}
          <div className="relative w-full md:w-1/2">
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

          {/* Select para filtrar por negocio */}
          <div className="w-full md:w-1/4">
            <select
              className="input w-full"
              value={selectedBusinessId}
              onChange={handleBusinessFilterChange}
            >
              <option value="">Todos los negocios</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => setShowAllProducts(!showAllProducts)}
              className="btn btn-outline"
              disabled={searchQuery.trim() !== ""}
            >
              {showAllProducts
                ? "Mostrar solo productos con stock bajo"
                : "Mostrar todos los productos"}
            </button>
          </div>
        </div>
      </div>

      {/* Search Status */}
      {isSearching && (
        <div className="text-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Buscando productos...</p>
        </div>
      )}

      {/* Products Table */}
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
                  Precio de Venta
                </th>
                {/* Nueva columna: Precio de Compra */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Precio de Compra
                </th>
                {/* Nueva columna: Margen de Ganancia */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Margen de Ganancia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Stock Actual
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
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{product.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {product.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${product.sellingPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${product.purchasePrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-green-600">
                        {product.purchasePrice > 0
                          ? (
                              ((product.sellingPrice - product.purchasePrice) / product.purchasePrice) *
                              100
                            ).toFixed(2)
                          : "0.00"}
                        %
                      </span>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => openEditProductModal(product)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Editar Producto"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openAddStockModal(product)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Agregar Stock"
                      >
                        Agregar Stock
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {searchQuery
                      ? "No se encontraron productos que coincidan con la búsqueda."
                      : "No hay productos con stock bajo en este momento."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Modal para Agregar Stock */}
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
    </div>
  )
}
