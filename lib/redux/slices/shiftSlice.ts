import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import { fetchShifts, fetchActiveShifts } from "@/services/admin/shiftService"
import { startShift, endShift } from "@/services/employee/shiftService"

export interface Shift {
  id: string
  employeeId: string
  employeeName: string
  businessId: string
  businessName: string
  startTime: string
  endTime: string | null
  sales: number
  paymentMethods: {
    cash: number
    card: number
    transfer: number
  }
  active: boolean
}

interface ShiftState {
  shifts: Shift[]
  loading: boolean
  error: string | null
}

const initialState: ShiftState = {
  shifts: [],
  loading: false,
  error: null,
}

export const getShifts = createAsyncThunk("shifts/getShifts", async () => {
  const response = await fetchShifts()
  return response
})

export const getActiveShifts = createAsyncThunk("shifts/getActiveShifts", async () => {
  const response = await fetchActiveShifts()
  return response
})

export const beginShift = createAsyncThunk(
  "shifts/beginShift",
  async (data: { employeeId: string; businessId: string }, { rejectWithValue }) => {
    try {
      const response = await startShift(data)
      return response
    } catch (error) {
      console.error("Error en beginShift thunk:", error)
      return rejectWithValue(error instanceof Error ? error.message : "Error desconocido al iniciar turno")
    }
  },
)

export const finishShift = createAsyncThunk("shifts/finishShift", async (shiftId: string) => {
  const response = await endShift(shiftId)
  return response
})

const shiftSlice = createSlice({
  name: "shifts",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getShifts.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getShifts.fulfilled, (state, action: PayloadAction<Shift[]>) => {
        state.loading = false
        state.shifts = action.payload
      })
      .addCase(getShifts.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || "Failed to fetch shifts"
      })
      .addCase(getActiveShifts.fulfilled, (state, action: PayloadAction<Shift[]>) => {
        // Only update active shifts, keep the rest
        const activeShiftIds = action.payload.map((shift) => shift.id)
        state.shifts = state.shifts.filter((shift) => !shift.active || activeShiftIds.includes(shift.id))
        action.payload.forEach((newShift) => {
          const index = state.shifts.findIndex((shift) => shift.id === newShift.id)
          if (index !== -1) {
            state.shifts[index] = newShift
          } else {
            state.shifts.push(newShift)
          }
        })
      })
      .addCase(beginShift.fulfilled, (state, action: PayloadAction<Shift>) => {
        state.shifts.push(action.payload)
      })
      .addCase(finishShift.fulfilled, (state, action: PayloadAction<Shift>) => {
        const index = state.shifts.findIndex((shift) => shift.id === action.payload.id)
        if (index !== -1) {
          state.shifts[index] = action.payload
        }
      })
  },
})

export default shiftSlice.reducer

