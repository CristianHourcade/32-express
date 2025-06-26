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
    method: "cash",
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
      method: "cash", // nuevo campo
    });

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
      method: expense.method ?? "cash", // fallback por seguridad
    });

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
          date: formData.date,
        })
      );

    } else {
      // Crear nuevo
      const businessName = businesses.find((b) => b.id === formData.businessId)?.name || ""
      dispatch(
        createExpense({
          ...formData,
          businessName,
          date: formData.date,
        })
      );
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
  /* ────────── helper global ────────── */
  const formatCurrency = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isLoading = expensesLoading || businessesLoading
  /* ╔═════════ LOADING  ─── igual que antes ═════════ */

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
        <p className="text-slate-600 dark:text-slate-400 uppercase">
          Cargando gastos…
        </p>
      </div>
    );
  }

  const efectivoTotal = filteredExpenses
    .filter((e) => e.method === "cash")
    .reduce((sum, e) => sum + e.amount, 0);

  const transferenciaTotal = filteredExpenses
    .filter((e) => e.method === "transfer")
    .reduce((sum, e) => sum + e.amount, 0);

  /* ╔═════════ COMIENZA EL RETURN PRINCIPAL ═════════ */
  return (
    <div className="space-y-8">
      {/* ───── Encabezado ───── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Gastos
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Administra los gastos de todos los negocios
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-full px-4 py-2 shadow focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <Plus className="h-5 w-5" />
          Agregar gasto
        </button>
      </header>

      {/* ───── Filtros ───── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700">
        <div className="flex flex-col md:flex-row flex-wrap gap-4 p-4">
          {/* Negocio */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium mb-1">Negocio</label>
            <select
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos los negocios</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Categoría */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium mb-1">Categoría</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Rango fechas */}
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium mb-1">Rango de fechas</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="flex-1 appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="flex-1 appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4">
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Mostrando {filteredExpenses.length} gastos
          </p>
          <div className="text-sm font-semibold space-x-4 text-right">
            <span>
              Efectivo:{" "}
              <span className="text-emerald-600 dark:text-emerald-400">
                ${formatCurrency(efectivoTotal)}
              </span>
            </span>
            <span>
              Transferencia:{" "}
              <span className="text-sky-600 dark:text-sky-400">
                ${formatCurrency(transferenciaTotal)}
              </span>
            </span>
            <span>
              Total:{" "}
              <span className="text-red-600 dark:text-red-400">
                ${formatCurrency(totalExpenses)}
              </span>
            </span>
          </div>
        </div>

      </div>

      {/* ───── Tabla Gastos ───── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-700/70 backdrop-blur sticky top-0 z-10 text-[11px] uppercase tracking-wide">
              <tr>
                {["Fecha", "Negocio", "Categoría", "Descripción", "Método", "Monto", "Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredExpenses.map((ex) => {
                const displayDate = new Date(ex.date.split("T")[0] + "T12:00:00").toLocaleDateString();
                return (
                  <tr
                    key={ex.id}
                    className="border-l-4 border-transparent hover:border-sky-500 even:bg-slate-50/60 dark:even:bg-slate-800/30"
                  >
                    <td className="px-4 py-2 whitespace-nowrap">{displayDate}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{ex.businessName}</td>
                    <td className="px-4 py-2">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[11px] font-semibold">
                        {ex.category}
                      </span>
                    </td>
                    <td className="px-4 py-2">{ex.description}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {ex.method ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold
        ${ex.method === "cash"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"}
      `}
                        >
                          {ex.method === "cash" ? "Efectivo" : "Transferencia"}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 text-xs italic">Sin método</span>
                      )}
                    </td>


                    <td className="px-4 py-2 font-semibold text-red-600 dark:text-red-400">
                      ${formatCurrency(ex.amount)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(ex)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                          aria-label="Editar"
                        >
                          <Edit className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(ex)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredExpenses.length && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    No se encontraron gastos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  ${formatCurrency(currentExpense?.amount ?? 0)}
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
      {/* ───── Modal Agregar / Editar ───── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-md w-full animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold">
                {currentExpense ? "Editar gasto" : "Nuevo gasto"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Negocio */}
              <div>
                <label className="block text-xs font-medium mb-1">Negocio</label>
                <select
                  name="businessId"
                  value={formData.businessId}
                  onChange={handleInputChange}
                  required
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-medium mb-1">Categoría</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[
                    "Alquiler",
                    "Servicios",
                    "Sueldos",
                    "Impuestos",
                    "Insumos",
                    "Mantenimiento",
                    "Marketing",
                    "Transporte",
                    "Proveedores",
                    ...categoriesInDB.filter(
                      (c) =>
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
                        ].includes(c)
                    ),
                    "Otros",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-xs font-medium mb-1">Monto</label>
                <input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {/* Método de pago */}
              <div>
                <label className="block text-xs font-medium mb-1">Método de pago</label>
                <select
                  name="method"
                  value={formData.method}
                  onChange={handleInputChange}
                  required
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium mb-1">Fecha</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-medium mb-1">Descripción</label>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Descripción del gasto…"
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {currentExpense ? "Actualizar" : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

}
