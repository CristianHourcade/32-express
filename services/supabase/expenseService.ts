import { SupabaseService } from "./supabaseService"
import type { Expense } from "@/lib/redux/slices/expensesSlice"
import { supabase } from "@/lib/supabase"

export class ExpenseService extends SupabaseService<Expense> {
  constructor() {
    super("expenses")
  }

  /**
   * Obtiene todos los gastos con nombre de negocio
   
    super("expenses")
  }

  /**
   * Obtiene todos los gastos con nombre de negocio
   */
  async getAllWithBusinessName(): Promise<Expense[]> {
    // Obtener gastos con información de negocio
    const { data: expenses, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        businesses(name)
      `)
      .order("date", { ascending: false })

    if (error) {
      this.handleError(error, "fetching")
    }

    if (!expenses) return []

    // Transformar los datos al formato esperado por la aplicación
    return expenses.map((expense) => ({
      id: expense.id,
      businessId: expense.business_id,
      businessName: expense.businesses?.name || "",
      category: expense.category,
      amount: expense.amount,
      description: expense.description || "",
      date: expense.date,
    }))
  }

  /**
   * Obtiene gastos por ID de negocio
   */
  async getByBusinessId(businessId: string): Promise<Expense[]> {
    const expenses = await this.getAllWithBusinessName()
    return expenses.filter((expense) => expense.businessId === businessId)
  }

  /**
   * Crea un nuevo gasto
   */
  async create(expense: Omit<Expense, "id">): Promise<Expense> {
    // Transformar el objeto al formato de la base de datos
    const dbExpense = {
      business_id: expense.businessId,
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      date: expense.date,
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(dbExpense)
      .select(`
        *,
        businesses(name)
      `)
      .single()

    if (error) {
      this.handleError(error, "creating")
    }

    // Transformar la respuesta al formato esperado por la aplicación
    return {
      id: data.id,
      businessId: data.business_id,
      businessName: data.businesses?.name || "",
      category: data.category,
      amount: data.amount,
      description: data.description || "",
      date: data.date,
    }
  }

  /**
   * Actualiza un gasto existente
   */
  async update(expense: Expense): Promise<Expense> {
    // Transformar el objeto al formato de la base de datos
    const dbExpense = {
      business_id: expense.businessId,
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      date: expense.date,
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .update(dbExpense)
      .eq("id", expense.id)
      .select(`
        *,
        businesses(name)
      `)
      .single()

    if (error) {
      this.handleError(error, "updating")
    }

    // Transformar la respuesta al formato esperado por la aplicación
    return {
      id: data.id,
      businessId: data.business_id,
      businessName: data.businesses?.name || "",
      category: data.category,
      amount: data.amount,
      description: data.description || "",
      date: data.date,
    }
  }
}

// Exportar una instancia del servicio para uso directo
export const expenseService = new ExpenseService()

