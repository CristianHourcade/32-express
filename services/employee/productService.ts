import type { Product } from "@/lib/redux/slices/productSlice"
import { productService } from "../supabase/productService"

// Funciones de API para empleados
export const fetchProductsByEmployeeBusiness = async (businessId: string): Promise<Product[]> => {
  return productService.getByBusinessId(businessId)
}

export const updateProductStock = async (productId: string, newStock: number): Promise<Product> => {
  const product = await productService.getById(productId)
  if (!product) {
    throw new Error("Product not found")
  }

  product.stock = newStock
  return productService.update(product)
}

