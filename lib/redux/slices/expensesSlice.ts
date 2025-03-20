import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import { fetchExpenses, addExpense, updateExpense, deleteExpense } from "@/services/admin/expenseService"

export interface Expense {
  id: string
  businessId: string
  businessName: string
  category: string
  amount: number
  description: string
  date: string
}

interface ExpenseState {
  expenses: Expense[]
  loading: boolean
  error: string | null
}

const initialState: ExpenseState = {
  expenses: [],
  loading: false,
  error: null,
}

export const getExpenses = createAsyncThunk("expenses/getExpenses", async () => {
  const response = await fetchExpenses()
  return response
})

export const createExpense = createAsyncThunk("expenses/createExpense", async (expense: Omit<Expense, "id">) => {
  const response = await addExpense(expense)
  return response
})

export const editExpense = createAsyncThunk("expenses/editExpense", async (expense: Expense) => {
  const response = await updateExpense(expense)
  return response
})

export const removeExpense = createAsyncThunk("expenses/removeExpense", async (id: string) => {
  await deleteExpense(id)
  return id
})

const expensesSlice = createSlice({
  name: "expenses",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getExpenses.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getExpenses.fulfilled, (state, action: PayloadAction<Expense[]>) => {
        state.loading = false
        state.expenses = action.payload
      })
      .addCase(getExpenses.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to fetch expenses"
      })
      .addCase(createExpense.fulfilled, (state, action: PayloadAction<Expense>) => {
        state.expenses.push(action.payload)
      })
      .addCase(editExpense.fulfilled, (state, action: PayloadAction<Expense>) => {
        const index = state.expenses.findIndex((e) => e.id === action.payload.id)
        if (index !== -1) {
          state.expenses[index] = action.payload
        }
      })
      .addCase(removeExpense.fulfilled, (state, action: PayloadAction<string>) => {
        state.expenses = state.expenses.filter((e) => e.id !== action.payload)
      })
  },
})

export default expensesSlice.reducer

