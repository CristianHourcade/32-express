import { useMockData } from "@/lib/config"

// Importar servicios mock
import * as mockBusinessService from "@/services/admin/businessService"

// Importar servicios de Supabase
import * as supabaseBusinessService from "@/services/supabase/businessService"

// Log para depuración
console.log(`🔄 Business Service: Using ${useMockData ? "MOCK" : "SUPABASE"} data`)

// Exportar las funciones del servicio apropiado
export const fetchBusinesses = useMockData
  ? mockBusinessService.fetchBusinesses
  : supabaseBusinessService.fetchBusinesses

export const fetchBusinessById = useMockData
  ? mockBusinessService.fetchBusinessById
  : supabaseBusinessService.fetchBusinessById

export const createBusiness = useMockData ? mockBusinessService.createBusiness : supabaseBusinessService.createBusiness

export const updateBusiness = useMockData ? mockBusinessService.updateBusiness : supabaseBusinessService.updateBusiness

export const deleteBusiness = useMockData ? mockBusinessService.deleteBusiness : supabaseBusinessService.deleteBusiness

