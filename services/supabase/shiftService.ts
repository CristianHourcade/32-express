import { SupabaseService } from "./supabaseService"
import type { Shift } from "@/lib/redux/slices/shiftSlice"
import { supabase } from "@/lib/supabase"

export class ShiftService extends SupabaseService<Shift> {
  constructor() {
    super("shifts")
  }

  /**
   * Obtiene todos los turnos con información de ventas
   */
  async getAllWithSales(): Promise<Shift[]> {
    // Obtener turnos básicos
    const { data: shifts, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        businesses(name),
        employees(name)
      `)
      .order("start_time", { ascending: false })

    if (error) {
      this.handleError(error, "fetching")
    }

    if (!shifts) return []

    // Para cada turno, obtener información de ventas
    const shiftsWithSales = await Promise.all(
      shifts.map(async (shift) => {
        // Obtener ventas para este turno
        const { data: shiftSales, error: salesError } = await supabase
          .from("sales")
          .select("*")
          .eq("shift_id", shift.id)

        if (salesError) {
          console.error("Error fetching shift sales:", salesError)
        }

        // Calcular estadísticas de ventas
        const salesCount = shiftSales?.length || 0
        const paymentMethods = {
          cash: 0,
          card: 0,
          transfer: 0,
        }

        shiftSales?.forEach((sale) => {
          paymentMethods[sale.payment_method] += sale.total
        })

        // Construir objeto de turno completo
        return {
          id: shift.id,
          employeeId: shift.employee_id,
          employeeName: shift.employees?.name || "",
          businessId: shift.business_id,
          businessName: shift.businesses?.name || "",
          startTime: shift.start_time,
          endTime: shift.end_time,
          sales: salesCount,
          paymentMethods,
          active: shift.end_time === null,
        } as Shift
      }),
    )

    return shiftsWithSales
  }

  /**
   * Obtiene turnos activos
   */
  async getActiveShifts(): Promise<Shift[]> {
    const shifts = await this.getAllWithSales()
    return shifts.filter((shift) => shift.active)
  }

  /**
   * Obtiene turnos por ID de negocio
   */
  async getByBusinessId(businessId: string): Promise<Shift[]> {
    const shifts = await this.getAllWithSales()
    return shifts.filter((shift) => shift.businessId === businessId)
  }

  /**
   * Obtiene turnos por ID de empleado
   */
  async getByEmployeeId(employeeId: string): Promise<Shift[]> {
    const shifts = await this.getAllWithSales()
    return shifts.filter((shift) => shift.employeeId === employeeId)
  }

  /**
   * Inicia un nuevo turno
   */
  async startShift(data: { employeeId: string; businessId: string }): Promise<Shift> {
    try {
      const { employeeId, businessId } = data

      // Verificar si ya hay un turno activo para este empleado
      const { data: existingShifts, error: checkError } = await supabase
        .from("shifts")
        .select("*")
        .eq("employee_id", employeeId)
        .is("end_time", null)

      if (checkError) {
        console.error("Error al verificar turnos activos:", checkError)
        throw new Error(`Error al verificar turnos activos: ${checkError.message}`)
      }

      if (existingShifts && existingShifts.length > 0) {
        console.warn("El empleado ya tiene un turno activo:", existingShifts[0])
        throw new Error("Ya tienes un turno activo. Finaliza el turno actual antes de iniciar uno nuevo.")
      }

      // Crear un nuevo turno
      const now = new Date().toISOString()
      const { data: newShift, error } = await supabase
        .from("shifts")
        .insert([
          {
            employee_id: employeeId,
            business_id: businessId,
            start_time: now,
            end_time: null,
          },
        ])
        .select()
        .single()

      if (error) {
        console.error("Error al crear turno:", error)
        throw new Error(`Error al crear turno: ${error.message}`)
      }

      if (!newShift) {
        throw new Error("No se pudo crear el turno")
      }

      // Obtener información adicional para el turno
      const { data: employee } = await supabase.from("employees").select("name").eq("id", employeeId).single()

      const { data: business } = await supabase.from("businesses").select("name").eq("id", businessId).single()

      // Formatear y devolver el turno
      return {
        id: newShift.id,
        employeeId: newShift.employee_id,
        employeeName: employee?.name || "Desconocido",
        businessId: newShift.business_id,
        businessName: business?.name || "Desconocido",
        startTime: newShift.start_time,
        endTime: null,
        sales: 0,
        paymentMethods: {
          cash: 0,
          card: 0,
          transfer: 0,
        },
        active: true,
      }
    } catch (error) {
      console.error("Error en shiftService.startShift:", error)
      throw error
    }
  }

  /**
   * Finaliza un turno
   */
  async endShift(shiftId: string): Promise<Shift> {
    // Actualizar turno
    const { data: updatedShift, error } = await supabase
      .from(this.tableName)
      .update({
        end_time: new Date().toISOString(),
      })
      .eq("id", shiftId)
      .select(`
        *,
        businesses(name),
        employees(name)
      `)
      .single()

    if (error) {
      this.handleError(error, "ending shift")
    }

    // Obtener ventas para este turno
    const { data: shiftSales, error: salesError } = await supabase.from("sales").select("*").eq("shift_id", shiftId)

    if (salesError) {
      console.error("Error fetching shift sales:", salesError)
    }

    // Calcular estadísticas de ventas
    const salesCount = shiftSales?.length || 0
    const paymentMethods = {
      cash: 0,
      card: 0,
      transfer: 0,
    }

    shiftSales?.forEach((sale) => {
      paymentMethods[sale.payment_method] += sale.total
    })

    // Transformar la respuesta al formato esperado
    return {
      id: updatedShift.id,
      employeeId: updatedShift.employee_id,
      employeeName: updatedShift.employees?.name || "",
      businessId: updatedShift.business_id,
      businessName: updatedShift.businesses?.name || "",
      startTime: updatedShift.start_time,
      endTime: updatedShift.end_time,
      sales: salesCount,
      paymentMethods,
      active: false,
    }
  }
}

// Exportar una instancia del servicio para uso directo
export const shiftService = new ShiftService()

