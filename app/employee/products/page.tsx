"use client"

import type React from "react"

import { useEffect, useState, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getProducts, editProduct, type Product } from "@/lib/redux/slices/productSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice"
import { Search, X, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase" // Agregar este import

// Reemplazar la función del componente con esta versión actualizada:
export default function EmployeeProductsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useSelector((state: RootState) => state.auth)
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)

  const [searchQuery, setSearchQuery] = useState("")
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [stockToAdd, setStockToAdd] = useState(0)
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showAllProducts, setShowAllProducts] = useState(false)

  const businessId = user?.businessId

  useEffect(() => {
    dispatch(getProducts())
    dispatch(fetchBusinesses())
  }, [dispatch])

  // Obtener productos con bajo stock
  const lowStockProducts = useMemo(() => {
    if (!products || !businessId) return []
    return products
      .filter((product) => product.businessId === businessId && product.stock <= product.minStock)
      .slice(0, 10)
  }, [products, businessId])

  // Función para buscar productos en la base de datos
  const searchProductsInDB = async (query: string) => {
    if (!query.trim() || !businessId) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId)
        .or(`name.ilike.%${query}%,code.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(20)

      if (error) throw error

      // Convertir los datos de la base de datos al formato de Product
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

  const openAddStockModal = (product: Product) => {
    setCurrentProduct(product)
    setStockToAdd(0)
    setIsAddStockModalOpen(true)
  }

  const handleAddStock = async () => {
    if (!currentProduct || stockToAdd <= 0) return

    try {
      await dispatch(
        editProduct({
          ...currentProduct,
          stock: currentProduct.stock + stockToAdd,
        }),
      )
      setIsAddStockModalOpen(false)

      // Actualizar los resultados de búsqueda si es necesario
      if (searchResults.length > 0) {
        setSearchResults((prev) =>
          prev.map((p) => (p.id === currentProduct.id ? { ...p, stock: p.stock + stockToAdd } : p)),
        )
      }
    } catch (error) {
      console.error("Error adding stock:", error)
    }
  }

  const isLoading = productsLoading || businessesLoading

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

  const currentBusiness = businesses.find((business) => business.id === businessId)
  const displayProducts = searchQuery
    ? searchResults
    : showAllProducts
      ? products.filter((p) => p.businessId === businessId)
      : lowStockProducts

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestión de inventario para {currentBusiness?.name || "tu negocio"}
          </p>
        </div>
        <Link href="/employee/dashboard" className="btn btn-secondary">
          Volver al Dashboard
        </Link>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">Alerta de Stock Bajo</h3>
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-200">
                <p>Hay {lowStockProducts.length} productos con stock por debajo del mínimo requerido.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
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
          <div className="flex items-center">
            <button
              onClick={() => setShowAllProducts(!showAllProducts)}
              className="btn btn-outline"
              disabled={searchQuery.trim() !== ""}
            >
              {showAllProducts ? "Mostrar solo productos con stock bajo" : "Mostrar todos los productos"}
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
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Producto
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Código
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Precio
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Stock Actual
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Stock Mínimo
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {displayProducts.length > 0 ? (
                displayProducts.map((product) => (
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
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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

      {/* Add Stock Modal */}
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
    </div>
  )
}

