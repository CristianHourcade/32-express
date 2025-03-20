import type { Shift } from "@/lib/redux/slices/shiftSlice"
import { shiftService } from "../supabase/shiftService"
import { activityService } from "../supabase/activityService"

// Funciones de API para empleados
export const startShift = async (data: { employeeId: string; businessId: string }): Promise<Shift> => {
  try {
    console.log("Llamando a shiftService.startShift con:", data)
    const newShift = await shiftService.startShift(data)
    console.log("Turno creado:", newShift)

    // Registrar actividad
    await activityService.logActivity({
      userId: data.employeeId,
      businessId: data.businessId,
      action: "Start Shift",
      details: "Employee started a new shift",
    })

    return newShift
  } catch (error) {
    console.error("Error en startShift:", error)
    throw error // Re-lanzar el error para que pueda ser manejado por el llamador
  }
}

export const endShift = async (shiftId: string): Promise<Shift> => {
  const shift = await shiftService.getById(shiftId)
  if (!shift) {
    throw new Error("Shift not found")
  }

  const endedShift = await shiftService.endShift(shiftId)

  // Registrar actividad
  await activityService.logActivity({
    userId: shift.employeeId,
    businessId: shift.businessId,
    action: "End Shift",
    details: "Employee ended their shift",
  })

  return endedShift
}

export const getCurrentShift = async (employeeId: string): Promise<Shift | null> => {
  const activeShifts = await shiftService.getActiveShifts()
  return activeShifts.find((shift) => shift.employeeId === employeeId) || null
}

