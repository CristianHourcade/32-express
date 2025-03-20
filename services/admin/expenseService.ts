import type { Expense } from "@/lib/redux/slices/expensesSlice"
import { expenseService } from "../supabase/expenseService"

// Funciones de API para administradores
export const fetchExpenses = async (): Promise<Expense[]> => {
  return expenseService.getAllWithBusinessName()
}

export const fetchExpensesByBusiness = async (businessId: string): Promise<Expense[]> => {
  return expenseService.getByBusinessId(businessId)
}

export const addExpense = async (expense: Omit<Expense, "id">): Promise<Expense> => {
  return expenseService.create(expense)
}

export const updateExpense = async (expense: Expense): Promise<Expense> => {
  return expenseService.update(expense)
}

export const deleteExpense = async (id: string): Promise<void> => {
  return expenseService.delete(id)
}

