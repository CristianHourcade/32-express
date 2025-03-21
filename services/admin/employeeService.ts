import type { Employee } from "@/lib/redux/slices/employeeSlice"
import { employeeService } from "../supabase/employeeService"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { createModuleLogger } from "@/lib/serverLogger"

const logger = createModuleLogger("adminEmployeeService")

// Funciones de API para administradores
export const fetchEmployees = async (): Promise<Employee[]> => {
  return employeeService.getAllWithCurrentShift()
}

export const fetchEmployeesByBusiness = async (businessId: string): Promise<Employee[]> => {
  return employeeService.getByBusinessId(businessId)
}

// Función para crear un empleado con autenticación
export const addEmployee = createAsyncThunk(
  "employees/addEmployee",
  async (
    employeeData: {
      name: string
      email: string
      businessId: string
      password: string
    },
    { rejectWithValue },
  ) => {
    try {
      logger.info("Adding employee with auth", { email: employeeData.email })

      // Llamar al servicio de Supabase para crear el empleado con autenticación
      const employee = await employeeService.createWithAuth(
        {
          name: employeeData.name,
          email: employeeData.email,
          business_id: employeeData.businessId,
        },
        employeeData.password,
      )

      logger.info("Employee added successfully", {
        employeeId: employee.id,
        email: employee.email,
      })

      return employee
    } catch (error) {
      logger.error("Error adding employee", {
        email: employeeData.email,
        error: error instanceof Error ? error.message : String(error),
      })

      return rejectWithValue(error instanceof Error ? error.message : "Error al agregar empleado")
    }
  },
)

// Función para actualizar un empleado
export const updateEmployee = async (employee: Employee): Promise<Employee> => {
  return employeeService.update(employee)
}

// Función para eliminar un empleado
export const deleteEmployee = async (id: string): Promise<void> => {
  return employeeService.delete(id)
}

// Para mantener compatibilidad con el código existente
// Para mantener compatibilidad con el código existente
export { addEmployee as createEmployee, employeeService }

