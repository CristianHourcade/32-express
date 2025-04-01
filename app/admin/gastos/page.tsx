"use client"

import React, { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import {
  getExpenses,
  createExpense,
  editExpense,
  removeExpense,
  type Expense,
} from "@/lib/redux/slices/expensesSlice"
import { fetchBusinesses } from "@/lib/redux/slices/businessSlice"
import { Plus, Edit, Trash2, X, Search, Calendar } from "lucide-react"

// Helper para formatear fecha local en "YYYY-MM-DD"
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function ExpensesPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { expenses, loading: expensesLoading } = useSelector((state: RootState) => state.expenses)
  const { businesses, loading: businessesLoading } = useSelector((state: RootState) => state.businesses)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null)

  // Filtros
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    end: getLocalDateString(new Date()),
  })

  // Formulario de creación/edición
  const [formData, setFormData] = useState({
    businessId: "",
    category: "",
    amount: 0,
    description: "",
    date: getLocalDateString(new Date()),
  })

  // Categorías únicas en BD + "Proveedores"
  const categoriesInDB = Array.from(new Set(expenses.map((expense) => expense.category)))
  const allCategories = Array.from(new Set([...categoriesInDB, "Proveedores"]))

  useEffect(() => {
    dispatch(getExpenses())
    dispatch(fetchBusinesses())
  }, [dispatch])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: name === "amount" ? Number(value) : value,
    })
  }

  // Abrir modal para crear un nuevo gasto
  const openAddModal = () => {
    setCurrentExpense(null)
    setFormData({
      businessId: businesses.length > 0 ? businesses[0].id : "",
      category: "Alquiler",
      amount: 0,
      description: "",
      date: getLocalDateString(new Date()),
    })
    setIsModalOpen(true)
  }

  // Abrir modal para editar un gasto
  const openEditModal = (expense: Expense) => {
    setCurrentExpense(expense)
    // Se asume que expense.date es algo como "2025-04-10T00:00:00"
    // Tomamos solo la parte de la fecha (antes de la "T")
    const datePart = expense.date.split("T")[0] // "YYYY-MM-DD"
    setFormData({
      businessId: expense.businessId,
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      date: datePart,
    })
    setIsModalOpen(true)
  }

  const openDeleteModal = (expense: Expense) => {
    setCurrentExpense(expense)
    setIsDeleteModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentExpense) {
      // Actualizar
      dispatch(
        editExpense({
          ...currentExpense,
          ...formData,
          // Guardamos date como "YYYY-MM-DD"
          date: formData.date,
        })
      )
    } else {
      // Crear nuevo
      const businessName = businesses.find((b) => b.id === formData.businessId)?.name || ""
      dispatch(
        createExpense({
          ...formData,
          businessName,
          date: formData.date,
        })
      )
    }
    setIsModalOpen(false)
  }

  const handleDelete = () => {
    if (currentExpense) {
      dispatch(removeExpense(currentExpense.id))
      setIsDeleteModalOpen(false)
    }
  }

  // Filtrar gastos
  const filteredExpenses = expenses.filter((expense) => {
    const matchesBusiness = selectedBusinessId === "all" || expense.businessId === selectedBusinessId
    const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory

    // Extraer solo la parte de fecha (YYYY-MM-DD)
    const datePart = expense.date.split("T")[0] // p.ej. "2025-04-10"
    // Forzar T12:00:00 para evitar desfases
    const expenseDate = new Date(`${datePart}T12:00:00`)

    const startDate = new Date(`${dateRange.start}T12:00:00`)
    const endDate = new Date(`${dateRange.end}T12:00:00`)
    endDate.setHours(23, 59, 59, 999)

    const matchesDate = expenseDate >= startDate && expenseDate <= endDate
    return matchesBusiness && matchesCategory && matchesDate
  })

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  const isLoading = expensesLoading || businessesLoading
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Cargando datos de gastos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="app-title">Gastos</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Administra los gastos de todos los negocios
          </p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary flex items-center">
          <Plus className="w-5 h-5 mr-1" />
          Agregar Gasto
        </button>
      </div>

      {/* Filtros */}
      <div className="app-card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="businessFilter" className="label flex items-center gap-2">
              <Search className="h-4 w-4" /> Negocio
            </label>
            <select
              id="businessFilter"
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="input"
            >
              <option value="all">Todos los Negocios</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="categoryFilter" className="label flex items-center gap-2">
              <Search className="h-4 w-4" /> Categoría
            </label>
            <select
              id="categoryFilter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input"
            >
              <option value="all">Todas las Categorías</option>
              {allCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Rango de Fechas
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="input"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="input"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <p className="text-slate-600 dark:text-slate-400">
              Mostrando {filteredExpenses.length} gastos
            </p>
            <p className="font-semibold">
              Total:{" "}
              <span className="text-red-600 dark:text-red-400">
                ${totalExpenses.toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de Gastos */}
      <div className="app-card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Fecha</th>
                <th className="table-header-cell">Negocio</th>
                <th className="table-header-cell">Categoría</th>
                <th className="table-header-cell">Descripción</th>
                <th className="table-header-cell">Monto</th>
                <th className="table-header-cell">Acciones</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {filteredExpenses.map((expense) => {
                // Dividimos la parte de fecha de la parte de hora
                // Supongamos que la BD almacena "YYYY-MM-DDTHH:mm:ss"
                const datePart = expense.date.split("T")[0] // => "YYYY-MM-DD"
                // Forzamos T12 para mostrarlo correctamente
                const displayDate = new Date(datePart + "T12:00:00").toLocaleDateString()

                return (
                  <tr key={expense.id} className="table-row">
                    <td className="table-cell">{displayDate}</td>
                    <td className="table-cell">{expense.businessName}</td>
                    <td className="table-cell">
                      <span className="badge badge-info">{expense.category}</span>
                    </td>
                    <td className="table-cell">{expense.description}</td>
                    <td className="table-cell font-medium text-red-600 dark:text-red-400">
                      ${expense.amount.toFixed(2)}
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(expense)}
                          className="p-1 text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                          aria-label="Editar gasto"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(expense)}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          aria-label="Eliminar gasto"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-8">
                    No se encontraron gastos para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Agregar/Editar Gasto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-md w-full scale-in">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {currentExpense ? "Editar Gasto" : "Agregar Nuevo Gasto"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
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
              <div>
                <label htmlFor="category" className="label">
                  Categoría
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="input"
                >
                  <option value="" disabled>
                    Seleccione una categoría
                  </option>
                  <option value="Alquiler">Alquiler</option>
                  <option value="Servicios">Servicios</option>
                  <option value="Sueldos">Sueldos</option>
                  <option value="Impuestos">Impuestos</option>
                  <option value="Insumos">Insumos</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Proveedores">Proveedores</option>
                  {[...new Set(
                    categoriesInDB.filter((cat) =>
                      ![
                        "Alquiler",
                        "Servicios",
                        "Sueldos",
                        "Impuestos",
                        "Insumos",
                        "Mantenimiento",
                        "Marketing",
                        "Transporte",
                        "Proveedores",
                        "Otros",
                      ].includes(cat)
                    )
                  )].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div>
                <label htmlFor="amount" className="label">
                  Monto
                </label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  required
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="date" className="label">
                  Fecha
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
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
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="input"
                  placeholder="Ingresa una descripción para este gasto"
                ></textarea>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {currentExpense ? "Actualizar Gasto" : "Agregar Gasto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-md w-full scale-in">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">
                Confirmar Eliminación
              </h2>
              <p className="mb-6 text-slate-600 dark:text-slate-400">
                ¿Estás seguro de que deseas eliminar el gasto de{" "}
                <span className="font-semibold text-red-600 dark:text-red-400">
                  ${currentExpense?.amount.toFixed(2)}
                </span>{" "}
                para {currentExpense?.category}? Esta acción no se puede deshacer.
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
  )
}
