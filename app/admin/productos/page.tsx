"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getProducts, createProduct, editProduct, removeProduct, type Product } from "@/lib/redux/slices/productSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice" // Changed from getBusinesses
import { Plus, Edit, Trash2, X } from "lucide-react"

export default function ProductsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("") // Nuevo estado para el filtro
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    purchasePrice: 0,
    sellingPrice: 0,
    stock: 0,
    minStock: 0,
    description: "",
    businessId: "",
  })

  useEffect(() => {
    dispatch(getProducts())
    dispatch(fetchBusinesses()) // Changed from getBusinesses
  }, [dispatch])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const updatedFormData = {
      ...formData,
      [name]:
        name === "purchasePrice" || name === "sellingPrice" || name === "stock" || name === "minStock"
          ? Number.parseFloat(value)
          : value,
    }
    setFormData(updatedFormData)
  }

  const handleBusinessFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBusinessId(e.target.value)
  }

  const openAddModal = () => {
    setCurrentProduct(null)
    setFormData({
      name: "",
      code: "",
      purchasePrice: 0,
      sellingPrice: 0,
      stock: 0,
      minStock: 0,
      description: "",
      businessId: businesses.length > 0 ? businesses[0].id : "",
    })
    setIsModalOpen(true)
  }

  const openEditModal = (product: Product) => {
    setCurrentProduct(product)
    setFormData({
      name: product.name,
      code: product.code,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
      minStock: product.minStock,
      description: product.description,
      businessId: product.businessId,
    })
    setIsModalOpen(true)
  }

  const openDeleteModal = (product: Product) => {
    setCurrentProduct(product)
    setIsDeleteModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (currentProduct) {
      dispatch(
        editProduct({
          ...currentProduct,
          ...formData,
        }),
      )
    } else {
      dispatch(
        createProduct({
          ...formData,
          createdAt: new Date().toISOString(),
          salesCount: 0,
          totalRevenue: 0,
        }),
      )
    }

    setIsModalOpen(false)
  }

  const handleDelete = () => {
    if (currentProduct) {
      dispatch(removeProduct(currentProduct.id))
      setIsDeleteModalOpen(false)
    }
  }

  const calculateProfitMargin = (purchasePrice: number, sellingPrice: number) => {
    if (purchasePrice === 0) return 0
    return (((sellingPrice - purchasePrice) / purchasePrice) * 100).toFixed(2)
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

  const filteredProducts = selectedBusinessId
    ? products.filter((product) => product.businessId === selectedBusinessId)
    : products

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <label htmlFor="businessFilter" className="mr-2 text-sm font-medium">
              Filtrar por negocio:
            </label>
            <select
              id="businessFilter"
              value={selectedBusinessId}
              onChange={handleBusinessFilterChange}
              className="input max-w-xs"
            >
              <option value="">Todos los negocios</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>
          <button onClick={openAddModal} className="btn btn-primary flex items-center">
            <Plus className="w-5 h-5 mr-1" />
            Agregar Producto
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-grow"></div>
          <div>
            <select
              onChange={handleBusinessFilterChange}
              value={selectedBusinessId}
              className="select select-bordered select-sm w-full max-w-xs"
            >
              <option value="">Todos los negocios</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Nombre</th>
                <th className="table-header-cell">Código</th>
                <th className="table-header-cell">Negocio</th>
                <th className="table-header-cell">Precio de Compra</th>
                <th className="table-header-cell">Precio de Venta</th>
                <th className="table-header-cell">Margen de Ganancia</th>
                <th className="table-header-cell">Stock Actual</th>
                <th className="table-header-cell">Stock Mínimo</th>
                <th className="table-header-cell">Ventas</th>
                <th className="table-header-cell">Ingresos Totales</th>
                <th className="table-header-cell">Acciones</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {filteredProducts.map((product) => {
                const business = businesses.find((b) => b.id === product.businessId)
                return (
                  <tr key={product.id} className="table-row">
                    <td className="table-cell font-medium">{product.name}</td>
                    <td className="table-cell">{product.code}</td>
                    <td className="table-cell">{business?.name || "Desconocido"}</td>
                    <td className="table-cell">${product.purchasePrice.toFixed(2)}</td>
                    <td className="table-cell">${product.sellingPrice.toFixed(2)}</td>
                    <td className="table-cell">
                      {calculateProfitMargin(product.purchasePrice, product.sellingPrice)}%
                    </td>
                    <td
                      className={`table-cell ${product.stock <= product.minStock ? "text-red-600 dark:text-red-400 font-medium" : ""}`}
                    >
                      {product.stock}
                    </td>
                    <td className="table-cell">{product.minStock}</td>
                    <td className="table-cell">{product.salesCount}</td>
                    <td className="table-cell">${product.totalRevenue.toFixed(2)}</td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(product)}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-cell text-center py-8">
                    {selectedBusinessId
                      ? "No se encontraron productos para este negocio."
                      : "No se encontraron productos. ¡Agrega tu primer producto!"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Agregar/Editar Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">{currentProduct ? "Editar Producto" : "Agregar Nuevo Producto"}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="label">
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
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
                    value={formData.code}
                    onChange={handleInputChange}
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
                    value={formData.purchasePrice}
                    onChange={handleInputChange}
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
                    value={formData.sellingPrice}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Margen de Ganancia</label>
                  <div className="flex items-center h-10 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-md border border-slate-300 dark:border-slate-700">
                    <span className="text-slate-700 dark:text-slate-300">
                      {calculateProfitMargin(formData.purchasePrice, formData.sellingPrice)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Calculado automáticamente según los precios
                  </p>
                </div>
                <div>
                  <label htmlFor="stock" className="label">
                    Stock Actual
                  </label>
                  <input
                    type="number"
                    id="stock"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
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
                    value={formData.minStock}
                    onChange={handleInputChange}
                    min="0"
                    required
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
                    value={formData.businessId}
                    onChange={handleInputChange}
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
                <div className="md:col-span-2">
                  <label htmlFor="description" className="label">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="input"
                  ></textarea>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {currentProduct ? "Actualizar Producto" : "Agregar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Confirmar Eliminación</h2>
              <p className="mb-6">
                ¿Estás seguro de que deseas eliminar el producto "{currentProduct?.name}"? Esta acción no se puede
                deshacer.
              </p>
              <div className="flex justify-end space-x-3">
                <button onClick={() => setIsDeleteModalOpen(false)} className="btn btn-secondary">
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
  )
}

