import type { Activity } from "@/lib/redux/slices/activitySlice"
import { mockActivities } from "@/services/mockData"

// Función para obtener todas las actividades
export const fetchActivities = async (): Promise<Activity[]> => {
  try {
    // En un entorno real, aquí se haría una llamada a la API
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockActivities)
      }, 500)
    })
  } catch (error) {
    console.error("Error fetching activities:", error)
    return []
  }
}

// Función para obtener actividades por negocio
export const fetchActivitiesByBusiness = async (businessId: string): Promise<Activity[]> => {
  try {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filteredActivities = mockActivities.filter((activity) => activity.businessId === businessId)
        resolve(filteredActivities)
      }, 500)
    })
  } catch (error) {
    console.error(`Error fetching activities for business ${businessId}:`, error)
    return []
  }
}

// Función para obtener actividades por usuario
export const fetchActivitiesByUser = async (userId: string): Promise<Activity[]> => {
  try {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filteredActivities = mockActivities.filter((activity) => activity.userId === userId)
        resolve(filteredActivities)
      }, 500)
    })
  } catch (error) {
    console.error(`Error fetching activities for user ${userId}:`, error)
    return []
  }
}

// Función para registrar una nueva actividad
export const logActivity = async (activityData: Omit<Activity, "id" | "timestamp">): Promise<Activity> => {
  try {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newActivity: Activity = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          ...activityData,
        }
        resolve(newActivity)
      }, 500)
    })
  } catch (error) {
    console.error("Error logging activity:", error)
    throw error
  }
}

