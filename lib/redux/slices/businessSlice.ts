import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import {
  fetchBusinesses as fetchBusinessesService,
  fetchBusinessById as fetchBusinessByIdService,
  createBusiness as createBusinessService,
  updateBusiness as updateBusinessService,
  deleteBusiness as deleteBusinessService,
} from "@/services/factory/businessServiceFactory"

export interface Business {
  id: string
  name: string
  address: string
  phone: string
  email: string
  description: string
  todaySales: number
  totalAmount: number
  paymentMethods: {
    cash: number
    card: number
    transfer: number
  }
  inventory: {
    investment: number
    potentialProfit: number
  }
}

interface BusinessState {
  businesses: Business[]
  selectedBusiness: Business | null
  loading: boolean
  error: string | null
}

const initialState: BusinessState = {
  businesses: [],
  selectedBusiness: null,
  loading: false,
  error: null,
}

// Thunks
export const fetchBusinesses = createAsyncThunk("business/fetchBusinesses", async () => {
  console.log("Dispatching fetchBusinesses thunk")
  const response = await fetchBusinessesService()
  return response
})

export const fetchBusinessById = createAsyncThunk("business/fetchBusinessById", async (id: string) => {
  console.log(`Dispatching fetchBusinessById thunk for business: ${id}`)
  const response = await fetchBusinessByIdService(id)
  return response
})

export const addBusiness = createAsyncThunk(
  "business/addBusiness",
  async (businessData: Omit<Business, "id" | "todaySales" | "totalAmount" | "paymentMethods" | "inventory">) => {
    console.log("Dispatching addBusiness thunk with data:", businessData)
    const response = await createBusinessService(businessData as any)
    return response
  },
)

export const editBusiness = createAsyncThunk(
  "business/editBusiness",
  async ({ id, data }: { id: string; data: Partial<Business> }) => {
    console.log(`Dispatching editBusiness thunk for business: ${id} with data:`, data)
    const response = await updateBusinessService({ id, ...data } as any)
    return response
  },
)

export const removeBusiness = createAsyncThunk("business/removeBusiness", async (id: string) => {
  console.log(`Dispatching removeBusiness thunk for business: ${id}`)
  await deleteBusinessService(id)
  return id
})

// Slice
const businessSlice = createSlice({
  name: "business",
  initialState,
  reducers: {
    selectBusiness: (state, action: PayloadAction<string>) => {
      state.selectedBusiness = state.businesses.find((b) => b.id === action.payload) || null
    },
    clearSelectedBusiness: (state) => {
      state.selectedBusiness = null
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchBusinesses
      .addCase(fetchBusinesses.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBusinesses.fulfilled, (state, action: PayloadAction<Business[]>) => {
        state.loading = false
        state.businesses = action.payload
      })
      .addCase(fetchBusinesses.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to fetch businesses"
      })

      // fetchBusinessById
      .addCase(fetchBusinessById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBusinessById.fulfilled, (state, action: PayloadAction<Business>) => {
        state.loading = false
        state.selectedBusiness = action.payload
      })
      .addCase(fetchBusinessById.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to fetch business"
      })

      // addBusiness
      .addCase(addBusiness.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addBusiness.fulfilled, (state, action: PayloadAction<Business>) => {
        state.loading = false
        state.businesses.push(action.payload)
      })
      .addCase(addBusiness.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to add business"
      })

      // editBusiness
      .addCase(editBusiness.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(editBusiness.fulfilled, (state, action: PayloadAction<Business>) => {
        state.loading = false
        const index = state.businesses.findIndex((b) => b.id === action.payload.id)
        if (index !== -1) {
          state.businesses[index] = action.payload
        }
        if (state.selectedBusiness && state.selectedBusiness.id === action.payload.id) {
          state.selectedBusiness = action.payload
        }
      })
      .addCase(editBusiness.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to update business"
      })

      // removeBusiness
      .addCase(removeBusiness.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(removeBusiness.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false
        state.businesses = state.businesses.filter((b) => b.id !== action.payload)
        if (state.selectedBusiness && state.selectedBusiness.id === action.payload) {
          state.selectedBusiness = null
        }
      })
      .addCase(removeBusiness.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to delete business"
      })
  },
})

export const { selectBusiness, clearSelectedBusiness } = businessSlice.actions
export default businessSlice.reducer

