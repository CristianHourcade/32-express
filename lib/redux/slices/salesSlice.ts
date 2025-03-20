import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import { fetchSales as fetchAdminSales } from "@/services/admin/salesService"
import { addSale } from "@/services/employee/salesService"

export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
  total: number
}

export interface Sale {
  id: string
  businessId: string
  businessName: string
  employeeId: string
  employeeName: string
  items: SaleItem[]
  total: number
  paymentMethod: string
  timestamp: string
  shiftId: string
}

interface SalesState {
  sales: Sale[]
  loading: boolean
  error: string | null
  lastFetched: number | null
}

const initialState: SalesState = {
  sales: [],
  loading: false,
  error: null,
  lastFetched: null,
}

// Agregar logs en la acción getSales
export const getSales = createAsyncThunk("sales/getSales", async (_, { rejectWithValue, getState }) => {
  try {
    console.log("🔍 SalesSlice: Fetching sales...")

    // Obtener el estado actual
    const state = getState() as { sales: SalesState }

    // Si ya se han cargado ventas en los últimos 5 minutos, no volver a cargarlas
    const now = Date.now()
    const fiveMinutesAgo = now - 5 * 60 * 1000

    if (state.sales.lastFetched && state.sales.lastFetched > fiveMinutesAgo && state.sales.sales.length > 0) {
      console.log("🔍 SalesSlice: Using cached sales data from", new Date(state.sales.lastFetched).toLocaleTimeString())
      return state.sales.sales
    }

    const response = await fetchAdminSales()
    console.log("🔍 SalesSlice: Fetched", response.length, "sales")

    // Si no hay ventas, intentar una vez más
    if (response.length === 0) {
      console.log("🔍 SalesSlice: No sales found, retrying...")
      const retryResponse = await fetchAdminSales()
      console.log("🔍 SalesSlice: Retry fetched", retryResponse.length, "sales")
      return retryResponse
    }

    return response
  } catch (error) {
    console.error("🔍 SalesSlice: Error fetching sales:", error)
    return rejectWithValue(error instanceof Error ? error.message : "Failed to fetch sales")
  }
})

export const createSale = createAsyncThunk("sales/createSale", async (sale: Omit<Sale, "id">, { rejectWithValue }) => {
  try {
    console.log("🔍 SalesSlice: Creating sale with data:", {
      ...sale,
      employeeId: sale.employeeId,
      businessId: sale.businessId,
      shiftId: sale.shiftId,
    })

    const newSale = await addSale(sale)
    console.log("🔍 SalesSlice: Sale created successfully:", newSale)
    return newSale
  } catch (error) {
    console.error("🔍 SalesSlice: Error creating sale:", error)
    return rejectWithValue(error instanceof Error ? error.message : "Error creating sale")
  }
})

const salesSlice = createSlice({
  name: "sales",
  initialState,
  reducers: {
    clearSalesCache: (state) => {
      state.lastFetched = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getSales.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getSales.fulfilled, (state, action: PayloadAction<Sale[]>) => {
        state.loading = false
        state.sales = action.payload
        state.lastFetched = Date.now()
        console.log("🔍 SalesSlice: Updated state with", action.payload.length, "sales")
      })
      .addCase(getSales.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to fetch sales"
        console.error("🔍 SalesSlice: Failed to fetch sales:", action.error.message)
      })
      .addCase(createSale.fulfilled, (state, action: PayloadAction<Sale>) => {
        state.sales.push(action.payload)
      })
  },
})

export const { clearSalesCache } = salesSlice.actions
export default salesSlice.reducer

