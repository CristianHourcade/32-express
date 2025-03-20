import type { Product } from "@/lib/redux/slices/productSlice"
import { productService } from "../supabase/productService"

// Funciones de API para administradores
export const fetchProducts = async (): Promise<Product[]> => {
  return productService.getAllWithStats()
}

export const fetchProductsByBusiness = async (businessId: string): Promise<Product[]> => {
  return productService.getByBusinessId(businessId)
}

export const addProduct = async (product: Omit<Product, "id" | "salesCount" | "totalRevenue">): Promise<Product> => {
  return productService.create(product)
}

export const updateProduct = async (product: Product): Promise<Product> => {
  return productService.update(product)
}

export const deleteProduct = async (id: string): Promise<void> => {
  return productService.delete(id)
}

