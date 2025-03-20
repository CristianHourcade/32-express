import type { Business } from "@/lib/redux/slices/businessSlice"
import { generateMockData } from "@/services/utils/serviceUtils"

// Obtener datos mock
const mockData = generateMockData()
let mockBusinesses = [...mockData.businesses]

// Función para obtener todos los negocios
export const fetchBusinesses = async (): Promise<Business[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...mockBusinesses])
    }, 500)
  })
}

// Función para obtener un negocio por ID
export const fetchBusinessById = async (id: string): Promise<Business> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const business = mockBusinesses.find((b) => b.id === id)
      if (business) {
        resolve({ ...business })
      } else {
        reject(new Error(`Business with ID ${id} not found`))
      }
    }, 500)
  })
}

// Función para crear un nuevo negocio
export const createBusiness = async (businessData: Omit<Business, "id">): Promise<Business> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newBusiness: Business = {
        id: `mock-${Date.now()}`,
        ...businessData,
      }
      mockBusinesses.push(newBusiness)
      resolve({ ...newBusiness })
    }, 500)
  })
}

// Función para actualizar un negocio existente
export const updateBusiness = async (businessData: Business): Promise<Business> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const index = mockBusinesses.findIndex((b) => b.id === businessData.id)
      if (index !== -1) {
        mockBusinesses[index] = { ...businessData }
        resolve({ ...mockBusinesses[index] })
      } else {
        reject(new Error(`Business with ID ${businessData.id} not found`))
      }
    }, 500)
  })
}

// Función para eliminar un negocio
export const deleteBusiness = async (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const index = mockBusinesses.findIndex((b) => b.id === id)
      if (index !== -1) {
        mockBusinesses = mockBusinesses.filter((b) => b.id !== id)
        resolve()
      } else {
        reject(new Error(`Business with ID ${id} not found`))
      }
    }, 500)
  })
}

