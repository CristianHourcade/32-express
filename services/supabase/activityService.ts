import { supabase } from "@/lib/supabase"
import type { Activity } from "@/lib/redux/slices/activitySlice"
import { handleServiceError } from "@/services/utils/serviceUtils"

class ActivityService {
  async logActivity(data: {
    userId: string
    businessId: string
    action: string
    details?: string
    userRole?: string
  }): Promise<void> {
    try {
      console.log("Logging activity:", data)

      // Verificar que los datos requeridos estén presentes
      if (!data.userId || !data.businessId || !data.action) {
        console.error("Missing required data for activity logging", data)
        return
      }

      // Siempre proporcionar un valor para user_role
      const userRole = data.userRole || "employee"

      // Inserción simplificada con todos los campos requeridos
      const { error } = await supabase.from("activities").insert({
        user_id: data.userId,
        business_id: data.businessId,
        action: data.action,
        details: data.details || null,
        user_role: userRole, // Siempre incluir user_role
      })

      if (error) {
        console.error("Error logging activity:", error)
      } else {
        console.log("Activity logged successfully")
      }
    } catch (error) {
      handleServiceError(error, "ActivityService", "logActivity")
    }
  }

  async getActivities(): Promise<Activity[]> {
    try {
      console.log("Fetching all activities")

      const { data, error } = await supabase
        .from("activities")
        .select(`
          id,
          action,
          details,
          timestamp,
          user_id,
          user_role,
          business_id,
          users (id, name, email, role),
          businesses (id, name)
        `)
        .order("timestamp", { ascending: false })

      if (error) {
        console.error("Error fetching activities:", error)
        return []
      }

      // Transformar los datos para que coincidan con la interfaz Activity
      return (data || []).map((item) => ({
        id: item.id,
        userId: item.user_id,
        userName: item.users?.name || "Usuario desconocido",
        userRole: item.user_role || item.users?.role || "user",
        businessId: item.business_id,
        businessName: item.businesses?.name || "Negocio desconocido",
        action: item.action,
        details: item.details || "",
        timestamp: item.timestamp,
      }))
    } catch (error) {
      handleServiceError(error, "ActivityService", "getActivities")
      return []
    }
  }

  async getActivitiesByBusiness(businessId: string): Promise<Activity[]> {
    try {
      console.log(`Fetching activities for business: ${businessId}`)

      const { data, error } = await supabase
        .from("activities")
        .select(`
          id,
          action,
          details,
          timestamp,
          user_id,
          user_role,
          users (id, name, email, role),
          businesses (id, name)
        `)
        .eq("business_id", businessId)
        .order("timestamp", { ascending: false })

      if (error) {
        console.error("Error fetching activities:", error)
        return []
      }

      // Transformar los datos
      return (data || []).map((item) => ({
        id: item.id,
        userId: item.user_id,
        userName: item.users?.name || "Usuario desconocido",
        userRole: item.user_role || item.users?.role || "user",
        businessId: businessId,
        businessName: item.businesses?.name || "Negocio desconocido",
        action: item.action,
        details: item.details || "",
        timestamp: item.timestamp,
      }))
    } catch (error) {
      handleServiceError(error, "ActivityService", "getActivitiesByBusiness")
      return []
    }
  }

  async getActivitiesByUser(userId: string): Promise<Activity[]> {
    try {
      console.log(`Fetching activities for user: ${userId}`)

      const { data, error } = await supabase
        .from("activities")
        .select(`
          id,
          action,
          details,
          timestamp,
          user_role,
          business_id,
          businesses (id, name)
        `)
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })

      if (error) {
        console.error("Error fetching user activities:", error)
        return []
      }

      // Obtener información del usuario
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, name, email, role")
        .eq("id", userId)
        .single()

      if (userError) {
        console.error("Error fetching user data:", userError)
      }

      // Transformar los datos
      return (data || []).map((item) => ({
        id: item.id,
        userId: userId,
        userName: userData?.name || "Usuario desconocido",
        userRole: item.user_role || userData?.role || "user",
        businessId: item.business_id,
        businessName: item.businesses?.name || "Negocio desconocido",
        action: item.action,
        details: item.details || "",
        timestamp: item.timestamp,
      }))
    } catch (error) {
      handleServiceError(error, "ActivityService", "getActivitiesByUser")
      return []
    }
  }
}

export const activityService = new ActivityService()

// Exportar funciones individuales para mantener compatibilidad con el código existente
export const fetchActivities = async (): Promise<Activity[]> => {
  return await activityService.getActivities()
}

export const fetchActivitiesByBusiness = async (businessId: string): Promise<Activity[]> => {
  return await activityService.getActivitiesByBusiness(businessId)
}

export const fetchActivitiesByUser = async (userId: string): Promise<Activity[]> => {
  return await activityService.getActivitiesByUser(userId)
}

export const logActivity = async (activityData: Omit<Activity, "id" | "timestamp">): Promise<Activity> => {
  await activityService.logActivity({
    userId: activityData.userId,
    businessId: activityData.businessId,
    action: activityData.action,
    details: activityData.details,
    userRole: activityData.userRole || "employee", // Siempre proporcionar un valor predeterminado
  })

  // Devolver un objeto Activity simulado para mantener compatibilidad
  return {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    ...activityData,
  }
}

