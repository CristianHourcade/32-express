import type { Sale } from "@/lib/redux/slices/salesSlice"
import { salesService } from "../supabase/salesService"

// Funciones de API para administradores
export const fetchSales = async (): Promise<Sale[]> => {
  console.log("🔍 Admin SalesService: Fetching all sales")
  try {
    const sales = await salesService.getAllWithItems()
    console.log("🔍 Admin SalesService: Fetched", sales.length, "sales")
    return sales
  } catch (error) {
    console.error("🔍 Admin SalesService: Error fetching sales:", error)
    // En caso de error, devolver un array vacío en lugar de propagar el error
    // Esto evita que la UI se rompa si hay un problema con la base de datos
    return []
  }
}

export const fetchSalesByBusiness = async (businessId: string): Promise<Sale[]> => {
  console.log("🔍 Admin SalesService: Fetching sales for business", businessId)
  try {
    const sales = await salesService.getByBusinessId(businessId)
    console.log("🔍 Admin SalesService: Fetched", sales.length, "sales for business", businessId)
    return sales
  } catch (error) {
    console.error("🔍 Admin SalesService: Error fetching sales for business:", error)
    return []
  }
}

export const fetchSalesByEmployee = async (employeeId: string): Promise<Sale[]> => {
  console.log("🔍 Admin SalesService: Fetching sales for employee", employeeId)
  try {
    const sales = await salesService.getByEmployeeId(employeeId)
    console.log("🔍 Admin SalesService: Fetched", sales.length, "sales for employee", employeeId)
    return sales
  } catch (error) {
    console.error("🔍 Admin SalesService: Error fetching sales for employee:", error)
    return []
  }
}

export const fetchSalesByShift = async (shiftId: string): Promise<Sale[]> => {
  console.log("🔍 Admin SalesService: Fetching sales for shift", shiftId)
  try {
    const sales = await salesService.getByShiftId(shiftId)
    console.log("🔍 Admin SalesService: Fetched", sales.length, "sales for shift", shiftId)
    return sales
  } catch (error) {
    console.error("🔍 Admin SalesService: Error fetching sales for shift:", error)
    return []
  }
}

