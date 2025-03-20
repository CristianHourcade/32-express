import { supabase } from "@/lib/supabase"
import type { Business } from "@/lib/redux/slices/businessSlice"
import { generateMockData } from "@/services/utils/serviceUtils"

// Función para obtener todos los negocios
export const fetchBusinesses = async (): Promise<Business[]> => {
  try {
    // Intentar obtener datos de Supabase
    const { data, error } = await supabase.from("businesses").select("*").order("name")

    if (error) {
      console.error("Error fetching businesses from Supabase:", error)
      // Fallback a datos mock en caso de error
      return generateMockData().businesses
    }

    if (!data || data.length === 0) {
      console.warn("No businesses found in Supabase, using mock data")
      return generateMockData().businesses
    }

    // Transformar los datos de Supabase al formato esperado por la aplicación
    return data.map((business) => ({
      id: business.id,
      name: business.name,
      address: business.address || "",
      phone: business.phone || "",
      email: business.email || "",
      description: business.description || "",
      // Estos campos podrían no existir en la base de datos, así que generamos datos mock
      todaySales: Math.floor(Math.random() * 100),
      totalAmount: Math.floor(Math.random() * 10000),
      paymentMethods: {
        cash: Math.floor(Math.random() * 5000),
        card: Math.floor(Math.random() * 3000),
        transfer: Math.floor(Math.random() * 2000),
      },
      inventory: {
        investment: Math.floor(Math.random() * 20000),
        potentialProfit: Math.floor(Math.random() * 30000),
      },
    }))
  } catch (error) {
    console.error("Unexpected error in fetchBusinesses:", error)
    return generateMockData().businesses
  }
}

// Función para obtener un negocio por ID
export const fetchBusinessById = async (id: string): Promise<Business> => {
  try {
    const { data, error } = await supabase.from("businesses").select("*").eq("id", id).single()

    if (error) {
      console.error(`Error fetching business with ID ${id}:`, error)
      // Fallback a datos mock
      const mockBusiness = generateMockData().businesses.find((b) => b.id === id)
      if (mockBusiness) return mockBusiness
      throw new Error(`Business with ID ${id} not found`)
    }

    return {
      id: data.id,
      name: data.name,
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
      description: data.description || "",
      // Datos mock para campos que podrían no existir
      todaySales: Math.floor(Math.random() * 100),
      totalAmount: Math.floor(Math.random() * 10000),
      paymentMethods: {
        cash: Math.floor(Math.random() * 5000),
        card: Math.floor(Math.random() * 3000),
        transfer: Math.floor(Math.random() * 2000),
      },
      inventory: {
        investment: Math.floor(Math.random() * 20000),
        potentialProfit: Math.floor(Math.random() * 30000),
      },
    }
  } catch (error) {
    console.error(`Unexpected error in fetchBusinessById for ID ${id}:`, error)
    throw error
  }
}

// Función para crear un nuevo negocio
export const createBusiness = async (businessData: Omit<Business, "id">): Promise<Business> => {
  try {
    console.log("Creating business with data:", businessData)

    // Extraer solo los campos que existen en la tabla de Supabase
    const { name, address, phone, email, description } = businessData

    const { data, error } = await supabase
      .from("businesses")
      .insert({
        name,
        address,
        phone,
        email,
        description,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating business:", error)
      throw new Error(`Failed to create business: ${error.message}`)
    }

    console.log("Business created successfully:", data)

    // Devolver el negocio creado con los campos adicionales
    return {
      id: data.id,
      name: data.name,
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
      description: data.description || "",
      // Datos mock para campos que no existen en la base de datos
      todaySales: Math.floor(Math.random() * 100),
      totalAmount: Math.floor(Math.random() * 10000),
      paymentMethods: {
        cash: Math.floor(Math.random() * 5000),
        card: Math.floor(Math.random() * 3000),
        transfer: Math.floor(Math.random() * 2000),
      },
      inventory: {
        investment: Math.floor(Math.random() * 20000),
        potentialProfit: Math.floor(Math.random() * 30000),
      },
    }
  } catch (error) {
    console.error("Unexpected error in createBusiness:", error)
    throw error
  }
}

// Función para actualizar un negocio existente
export const updateBusiness = async (businessData: Business): Promise<Business> => {
  try {
    // Extraer solo los campos que existen en la tabla de Supabase
    const { id, name, address, phone, email, description } = businessData

    const { data, error } = await supabase
      .from("businesses")
      .update({
        name,
        address,
        phone,
        email,
        description,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error(`Error updating business with ID ${id}:`, error)
      throw new Error(`Failed to update business: ${error.message}`)
    }

    // Devolver el negocio actualizado con los campos adicionales
    return {
      id: data.id,
      name: data.name,
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
      description: data.description || "",
      // Mantener los datos originales para campos que no existen en la base de datos
      todaySales: businessData.todaySales,
      totalAmount: businessData.totalAmount,
      paymentMethods: businessData.paymentMethods,
      inventory: businessData.inventory,
    }
  } catch (error) {
    console.error(`Unexpected error in updateBusiness for ID ${businessData.id}:`, error)
    throw error
  }
}

// Función para eliminar un negocio
export const deleteBusiness = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from("businesses").delete().eq("id", id)

    if (error) {
      console.error(`Error deleting business with ID ${id}:`, error)
      throw new Error(`Failed to delete business: ${error.message}`)
    }
  } catch (error) {
    console.error(`Unexpected error in deleteBusiness for ID ${id}:`, error)
    throw error
  }
}

