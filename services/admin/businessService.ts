import type { Business, CreateBusinessData, UpdateBusinessData } from "@/services/types"
import { mockBusinesses } from "@/services/mockData"

// Función para obtener todos los negocios
export const fetchBusinesses = async (): Promise<Business[]> => {
  // En un entorno real, aquí se haría una llamada a la API
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockBusinesses)
    }, 500)
  })
}

// Función para obtener un negocio por ID
export const fetchBusinessById = async (id: string): Promise<Business> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const business = mockBusinesses.find((b) => b.id === id)
      if (business) {
        resolve(business)
      } else {
        reject(new Error(`Business with ID ${id} not found`))
      }
    }, 500)
  })
}

// Función para crear un nuevo negocio
export const createBusiness = async (businessData: CreateBusinessData): Promise<Business> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newBusiness: Business = {
        id: Math.random().toString(36).substring(2, 9),
        ...businessData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      resolve(newBusiness)
    }, 500)
  })
}

// Función para actualizar un negocio existente
export const updateBusiness = async (id: string, businessData: UpdateBusinessData): Promise<Business> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const businessIndex = mockBusinesses.findIndex((b) => b.id === id)
      if (businessIndex !== -1) {
        const updatedBusiness: Business = {
          ...mockBusinesses[businessIndex],
          ...businessData,
          updatedAt: new Date().toISOString(),
        }
        resolve(updatedBusiness)
      } else {
        reject(new Error(`Business with ID ${id} not found`))
      }
    }, 500)
  })
}

// Función para eliminar un negocio
export const deleteBusiness = async (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const businessIndex = mockBusinesses.findIndex((b) => b.id === id)
      if (businessIndex !== -1) {
        resolve()
      } else {
        reject(new Error(`Business with ID ${id} not found`))
      }
    }, 500)
  })
}

