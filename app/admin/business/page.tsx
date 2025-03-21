"use client"

import { useEffect, useState, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import {
  fetchBusinesses,
  addBusiness,
  editBusiness,
  removeBusiness,
} from "@/lib/redux/slices/businessSlice"
import { getProducts } from "@/lib/redux/slices/productSlice"
import { Button } from "@/components/ui/button"
import { PlusCircle, Search, Edit, Trash2, Building2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import BusinessForm from "@/components/admin/BusinessForm"
import type { Business, CreateBusinessData, UpdateBusinessData } from "@/services/types"

export default function BusinessPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { businesses, loading, error } = useSelector((state: RootState) => state.businesses)
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products)

  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)

  useEffect(() => {
    dispatch(fetchBusinesses())
    dispatch(getProducts())
  }, [dispatch])

  function formatNumber(num: number) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  // Filtrar negocios según la búsqueda
  const filteredBusinesses = businesses.filter((business) =>
    business.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Calcula para cada negocio:
  // - Mercadería Invertida: suma de (purchasePrice * stock)
  // - Venta Potencial: suma de (sellingPrice * stock)
  // - Ganancia Proyectada: Venta Potencial - Mercadería Invertida
  const businessFinancials = useMemo(() => {
    const map = new Map<
      string,
      {
        merchandiseInvested: number
        potentialSale: number
        projectedProfit: number
      }
    >()

    businesses.forEach((business) => {
      // Filtrar los productos que pertenecen a este negocio
      const businessProducts = products.filter((p) => p.businessId === business.id)

      // LOG: imprimir el nombre del negocio y la cantidad de productos
      console.log("🔍 [DEBUG] Negocio:", business.name, "| Productos:", businessProducts.length)

      // LOG: imprimir detalles de cada producto
      businessProducts.forEach((prod) => {
        console.log(
          "   → Producto:",
          prod.name,
          "| Compra:",
          prod.purchasePrice,
          "| Venta:",
          prod.sellingPrice,
          "| Stock:",
          prod.stock
        )
      })

      // Calcular Mercadería Invertida
      const merchandiseInvested = businessProducts.reduce(
        (sum, p) => sum + p.purchasePrice * p.stock,
        0,
      )
      // Calcular Venta Potencial
      const potentialSale = businessProducts.reduce(
        (sum, p) => sum + p.sellingPrice * p.stock,
        0,
      )
      // Calcular Ganancia Proyectada
      const projectedProfit = potentialSale - merchandiseInvested

      // LOG: imprimir los totales
      console.log(
        "🔍 [DEBUG] Negocio:",
        business.name,
        "| Invertida:",
        merchandiseInvested,
        "| Potencial:",
        potentialSale,
        "| Ganancia Proy:",
        projectedProfit
      )

      map.set(business.id, {
        merchandiseInvested,
        potentialSale,
        projectedProfit,
      })
    })

    return map
  }, [businesses, products])

  // Handlers para creación, edición y eliminación
  const handleCreateBusiness = async (data: CreateBusinessData) => {
    try {
      await dispatch(addBusiness(data)).unwrap()
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error("Error creating business:", error)
    }
  }

  const handleEditBusiness = async (data: UpdateBusinessData) => {
    if (!selectedBusiness) return
    try {
      await dispatch(editBusiness({ id: selectedBusiness.id, data })).unwrap()
      setIsEditDialogOpen(false)
      setSelectedBusiness(null)
    } catch (error) {
      console.error("Error updating business:", error)
    }
  }

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return
    try {
      await dispatch(removeBusiness(selectedBusiness.id)).unwrap()
      setIsDeleteDialogOpen(false)
      setSelectedBusiness(null)
    } catch (error) {
      console.error("Error deleting business:", error)
    }
  }

  if (loading || productsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Cargando negocios...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-red-700 dark:text-red-400">
              Error al cargar los negocios: {error}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Negocios</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Administra los negocios de tu empresa
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar negocios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <Button className="flex items-center gap-1" onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            <span>Nuevo Negocio</span>
          </Button>
        </div>
      </div>

      {/* Lista de Negocios */}
      <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Mercadería Invertida
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Venta Potencial
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Ganancia Proyectada
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredBusinesses.length > 0 ? (
                filteredBusinesses.map((business) => {
                  const financials = businessFinancials.get(business.id) || {
                    merchandiseInvested: 0,
                    potentialSale: 0,
                    projectedProfit: 0,
                  }
                  return (
                    <tr key={business.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {business.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700 dark:text-slate-300">
                        ${formatNumber(financials.merchandiseInvested)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700 dark:text-slate-300">
                        ${formatNumber(financials.potentialSale)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600">
                        ${formatNumber(financials.projectedProfit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedBusiness(business)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                            onClick={() => {
                              setSelectedBusiness(business)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-slate-500 dark:text-slate-400">
                    No se encontraron negocios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diálogo de Creación */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Negocio</DialogTitle>
          </DialogHeader>
          <BusinessForm onSubmit={handleCreateBusiness} />
        </DialogContent>
      </Dialog>

      {/* Diálogo de Edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Negocio</DialogTitle>
          </DialogHeader>
          {selectedBusiness && (
            <BusinessForm
              initialData={{
                name: selectedBusiness.name,
              }}
              onSubmit={handleEditBusiness}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Eliminación */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 dark:text-slate-400">
              ¿Estás seguro de que deseas eliminar el negocio <strong>{selectedBusiness?.name}</strong>? Esta acción no
              se puede deshacer.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteBusiness}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
