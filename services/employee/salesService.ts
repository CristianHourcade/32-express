import type { Sale } from "@/lib/redux/slices/salesSlice"
import { salesService } from "../supabase/salesService"
import { activityService } from "../supabase/activityService"
import { supabase } from "@/lib/supabase"

// Funciones de API para empleados
export const fetchSalesByEmployeeId = async (employeeId: string): Promise<Sale[]> => {
  return salesService.getByEmployeeId(employeeId)
}

// Modificar la función addSale para agregar logs
export const addSale = async (sale: Omit<Sale, "id">): Promise<Sale> => {
  console.log("🔍 SalesService: Adding sale with data:", {
    ...sale,
    employeeId: sale.employeeId,
    businessId: sale.businessId,
    shiftId: sale.shiftId,
  })

  try {
    const newSale = await salesService.create(sale)
    console.log("🔍 SalesService: Sale added successfully:", newSale)

    // Obtener el ID de usuario asociado con el empleado
    let userId = null
    try {
      // Primero intentamos obtener el user_id del empleado
      const { data: employeeData, error: employeeError } = await supabase
        .from("employees")
        .select("user_id")
        .eq("id", sale.employeeId)
        .single()

      if (employeeError) {
        console.error("🔍 SalesService: Error fetching employee user_id:", employeeError)
      } else if (employeeData?.user_id) {
        userId = employeeData.user_id
        console.log("🔍 SalesService: Found user_id from employee:", userId)
      }

      // Si no encontramos un user_id, buscamos un usuario con el mismo email que el empleado
      if (!userId) {
        const { data: employeeWithEmail, error: emailError } = await supabase
          .from("employees")
          .select("email")
          .eq("id", sale.employeeId)
          .single()

        if (emailError) {
          console.error("🔍 SalesService: Error fetching employee email:", emailError)
        } else if (employeeWithEmail?.email) {
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id")
            .ilike("email", employeeWithEmail.email)
            .single()

          if (userError) {
            console.error("🔍 SalesService: Error finding user by email:", userError)
          } else if (userData?.id) {
            userId = userData.id
            console.log("🔍 SalesService: Found user_id by email match:", userId)
          }
        }
      }

      // Si aún no tenemos un userId, buscamos cualquier usuario con el mismo business_id
      if (!userId) {
        const { data: businessUsers, error: businessError } = await supabase
          .from("users")
          .select("id")
          .eq("business_id", sale.businessId)
          .limit(1)

        if (businessError) {
          console.error("🔍 SalesService: Error finding users by business_id:", businessError)
        } else if (businessUsers && businessUsers.length > 0) {
          userId = businessUsers[0].id
          console.log("🔍 SalesService: Using fallback user_id from business:", userId)
        }
      }

      // Si aún no tenemos un userId, no podemos registrar la actividad
      if (!userId) {
        console.error("🔍 SalesService: Could not find a valid user_id for activity logging")
        return newSale
      }

      // Registrar actividad con el userId correcto
      await activityService.logActivity({
        userId: userId, // Usar el ID de usuario en lugar del ID de empleado
        businessId: sale.businessId,
        action: "New Sale",
        details: `Created a new sale for $${sale.total}`,
      })
    } catch (error) {
      console.error("🔍 SalesService: Error during activity logging:", error)
    }

    return newSale
  } catch (error) {
    console.error("🔍 SalesService: Error adding sale:", error)
    throw error
  }
}

// Funciones adicionales para el servicio de ventas de empleados
export const getTodaySalesByEmployee = async (employeeId: string): Promise<Sale[]> => {
  const allSales = await salesService.getByEmployeeId(employeeId)
  const today = new Date().toDateString()

  return allSales.filter((sale) => {
    const saleDate = new Date(sale.timestamp).toDateString()
    return saleDate === today
  })
}

export const getSalesByPaymentMethod = async (employeeId: string): Promise<Record<string, number>> => {
  const employeeSales = await salesService.getByEmployeeId(employeeId)

  const paymentMethods = {
    cash: 0,
    card: 0,
    transfer: 0,
    mercadopago: 0,
    rappi: 0,
  }

  employeeSales.forEach((sale) => {
    if (paymentMethods[sale.paymentMethod] !== undefined) {
      paymentMethods[sale.paymentMethod] += sale.total
    }
  })

  return paymentMethods
}

