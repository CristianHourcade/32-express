import type { Shift } from "@/lib/redux/slices/shiftSlice"
import { handleServiceError } from "@/services/utils/serviceUtils"
import { shiftService } from "../supabase/shiftService"

// Funciones de API para administradores
export const fetchShifts = async (): Promise<Shift[]> => {
  try {
    return await shiftService.getAllWithSales()
  } catch (error) {
    return handleServiceError(error, "shifts", "fetch")
  }
}

export const fetchActiveShifts = async (): Promise<Shift[]> => {
  try {
    return await shiftService.getActiveShifts()
  } catch (error) {
    return handleServiceError(error, "shifts", "fetch")
  }
}

export const fetchShiftsByBusiness = async (businessId: string): Promise<Shift[]> => {
  try {
    return await shiftService.getByBusinessId(businessId)
  } catch (error) {
    return handleServiceError(error, "shifts", "fetch")
  }
}

export const fetchShiftsByEmployee = async (employeeId: string): Promise<Shift[]> => {
  try {
    return await shiftService.getByEmployeeId(employeeId)
  } catch (error) {
    return handleServiceError(error, "shifts", "fetch")
  }
}

/**
 * Admin Shift Service
 * Handles all shift-related operations for admin users
 */
export const AdminShiftService = {
  /**
   * Get all shifts
   */
  getShifts: async (): Promise<Shift[]> => {
    try {
      return await shiftService.getAll()
    } catch (error) {
      return handleServiceError(error, "shifts", "fetch")
    }
  },

  /**
   * Get active shifts
   */
  getActiveShifts: async (): Promise<Shift[]> => {
    try {
      return await shiftService.getActiveShifts()
    } catch (error) {
      return handleServiceError(error, "shifts", "fetch")
    }
  },

  /**
   * Get shifts by business ID
   */
  getShiftsByBusiness: async (businessId: string): Promise<Shift[]> => {
    try {
      return await shiftService.getByBusinessId(businessId)
    } catch (error) {
      return handleServiceError(error, "shifts", "fetch")
    }
  },

  /**
   * Get shifts by employee ID
   */
  getShiftsByEmployee: async (employeeId: string): Promise<Shift[]> => {
    try {
      return await shiftService.getByEmployeeId(employeeId)
    } catch (error) {
      return handleServiceError(error, "shifts", "fetch")
    }
  },

  /**
   * Start a new shift
   */
  startShift: async (data: { employeeId: string; businessId: string }): Promise<Shift> => {
    try {
      return await shiftService.startShift(data.employeeId, data.businessId)
    } catch (error) {
      return handleServiceError(error, "shift", "start")
    }
  },

  /**
   * End a shift
   */
  endShift: async (shiftId: string): Promise<Shift> => {
    try {
      return await shiftService.endShift(shiftId)
    } catch (error) {
      return handleServiceError(error, "shift", "end")
    }
  },
}

