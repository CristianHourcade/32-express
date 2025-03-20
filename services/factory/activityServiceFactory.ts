import { useMockData } from "@/lib/config"

// Importar servicios mock
import * as mockActivityService from "@/services/admin/activityService"

// Importar servicios de Supabase
import * as supabaseActivityService from "@/services/supabase/activityService"

// Log para depuración
console.log(`🔄 Activity Service: Using ${useMockData ? "MOCK" : "SUPABASE"} data`)

// Exportar las funciones del servicio apropiado
export const fetchActivities = useMockData
  ? mockActivityService.fetchActivities
  : supabaseActivityService.fetchActivities

export const fetchActivitiesByBusiness = useMockData
  ? mockActivityService.fetchActivitiesByBusiness
  : supabaseActivityService.fetchActivitiesByBusiness

export const fetchActivitiesByUser = useMockData
  ? mockActivityService.fetchActivitiesByUser
  : supabaseActivityService.fetchActivitiesByUser

export const logActivity = useMockData ? mockActivityService.logActivity : supabaseActivityService.logActivity

