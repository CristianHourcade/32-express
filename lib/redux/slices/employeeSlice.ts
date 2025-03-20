import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import type { PayloadAction } from "@reduxjs/toolkit"
import { fetchEmployees, updateEmployee, deleteEmployee } from "@/services/admin/employeeService"

// Definir la interfaz para un empleado
export interface Employee {
  id: string
  name: string
  email: string
  businessId: string
  businessName?: string
  userId?: string
  currentShift?: {
    id: string
    startTime: string
  } | null
}

// Definir el estado inicial
interface EmployeeState {
  employees: Employee[]
  loading: boolean
  error: string | null
}

const initialState: EmployeeState = {
  employees: [],
  loading: false,
  error: null,
}

// Thunk para obtener todos los empleados
export const getEmployees = createAsyncThunk("employees/getEmployees", async (_, { rejectWithValue }) => {
  try {
    return await fetchEmployees()
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : "Error al obtener empleados")
  }
})

// Thunk para editar un empleado
export const editEmployee = createAsyncThunk(
  "employees/editEmployee",
  async (employee: Employee, { rejectWithValue }) => {
    try {
      return await updateEmployee(employee)
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : "Error al actualizar empleado")
    }
  },
)

// Thunk para eliminar un empleado
export const removeEmployee = createAsyncThunk("employees/removeEmployee", async (id: string, { rejectWithValue }) => {
  try {
    await deleteEmployee(id)
    return id
  } catch (error) {
    return rejectWithValue(error instanceof Error ? error.message : "Error al eliminar empleado")
  }
})

// Crear el slice
const employeeSlice = createSlice({
  name: "employees",
  initialState,
  reducers: {
    // Reducers adicionales si son necesarios
  },
  extraReducers: (builder) => {
    builder
      // Manejar getEmployees
      .addCase(getEmployees.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getEmployees.fulfilled, (state, action: PayloadAction<Employee[]>) => {
        state.loading = false
        state.employees = action.payload
      })
      .addCase(getEmployees.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Manejar editEmployee
      .addCase(editEmployee.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(editEmployee.fulfilled, (state, action: PayloadAction<Employee>) => {
        state.loading = false
        const index = state.employees.findIndex((emp) => emp.id === action.payload.id)
        if (index !== -1) {
          state.employees[index] = action.payload
        }
      })
      .addCase(editEmployee.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Manejar removeEmployee
      .addCase(removeEmployee.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(removeEmployee.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false
        state.employees = state.employees.filter((emp) => emp.id !== action.payload)
      })
      .addCase(removeEmployee.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export default employeeSlice.reducer

