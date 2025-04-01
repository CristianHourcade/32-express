import { SupabaseService } from "./supabaseService"
import type { Product } from "@/lib/redux/slices/productSlice"
import { supabase } from "@/lib/supabase"

export class ProductService extends SupabaseService<Product> {
  constructor() {
    super("products")
  }

  /**
   * Obtiene todos los productos con estadísticas de ventas
   */
  async getAllWithStats(): Promise<Product[]> {
    // Obtener productos básicos - modificado para recuperar hasta 1000 productos
    const { data: products, error } = await supabase.from(this.tableName).select("*").limit(1000) // Aumentado de 100 (por defecto) a 1000

    if (error) {
      this.handleError(error, "fetching")
    }

    if (!products) return []

    // Para cada producto, obtener estadísticas de ventas
    const productsWithStats = await Promise.all(
      products.map(async (product) => {
        // Obtener items de ventas para este producto
        // const { data: saleItems, error: saleItemsError } = await supabase
        //   .from("sale_items")
        //   .select("quantity, price")
        //   .eq("product_id", product.id)
        //   .limit(1000) // Aseguramos que también se obtengan hasta 1000 items de venta

        // if (saleItemsError) {
        //   console.error("Error fetching sale items:", saleItemsError)
        // }

        // Calcular estadísticas
        let salesCount = 0
        let totalRevenue = 0

        // saleItems?.forEach((item) => {
        //   salesCount += item.quantity
        //   totalRevenue += item.quantity * item.price
        // })

        // Construir objeto de producto con estadísticas
        return {
          id: product.id,
          name: product.name,
          code: product.code,
          purchasePrice: product.purchase_price,
          sellingPrice: product.selling_price,
          stock: product.stock,
          minStock: product.min_stock,
          description: product.description || "",
          createdAt: product.created_at,
          businessId: product.business_id,
          salesCount,
          totalRevenue,
        } as Product
      }),
    )

    return productsWithStats
  }

  /**
   * Obtiene productos por ID de negocio con estadísticas
   */
  async getByBusinessId(businessId: string): Promise<Product[]> {
    // Modificado para consultar directamente con un límite más alto
    const { data: products, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("business_id", businessId)
      .limit(1000) // Recuperar hasta 1000 productos de este negocio

    if (error) {
      this.handleError(error, "fetching")
    }

    if (!products) return []

    // Para cada producto, obtener estadísticas de ventas
    const productsWithStats = await Promise.all(
      products.map(async (product) => {
        // Obtener items de ventas para este producto
        const { data: saleItems, error: saleItemsError } = await supabase
          .from("sale_items")
          .select("quantity, price")
          .eq("product_id", product.id)
          .limit(1000) // Aseguramos que también se obtengan hasta 1000 items de venta

        if (saleItemsError) {
          console.error("Error fetching sale items:", saleItemsError)
        }

        // Calcular estadísticas
        let salesCount = 0
        let totalRevenue = 0

        saleItems?.forEach((item) => {
          salesCount += item.quantity
          totalRevenue += item.quantity * item.price
        })

        // Construir objeto de producto con estadísticas
        return {
          id: product.id,
          name: product.name,
          code: product.code,
          purchasePrice: product.purchase_price,
          sellingPrice: product.selling_price,
          stock: product.stock,
          minStock: product.min_stock,
          description: product.description || "",
          createdAt: product.created_at,
          businessId: product.business_id,
          salesCount,
          totalRevenue,
        } as Product
      }),
    )

    return productsWithStats
  }

  /**
   * Crea un nuevo producto
   */
  async create(product: Omit<Product, "id" | "salesCount" | "totalRevenue">): Promise<Product> {
    // Transformar el objeto al formato de la base de datos
    const dbProduct = {
      name: product.name,
      code: product.code,
      purchase_price: product.purchasePrice,
      selling_price: product.sellingPrice,
      stock: product.stock,
      min_stock: product.minStock,
      description: product.description,
      business_id: product.businessId,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from(this.tableName).insert(dbProduct).select().single()

    if (error) {
      this.handleError(error, "creating")
    }

    // Transformar la respuesta al formato esperado por la aplicación
    return {
      id: data.id,
      name: data.name,
      code: data.code,
      purchasePrice: data.purchase_price,
      sellingPrice: data.selling_price,
      stock: data.stock,
      minStock: data.min_stock,
      description: data.description || "",
      createdAt: data.created_at,
      businessId: data.business_id,
      salesCount: 0,
      totalRevenue: 0,
    }
  }

  /**
   * Actualiza un producto existente
   */
  async update(product: Product): Promise<Product> {
    // Transformar el objeto al formato de la base de datos
    const dbProduct = {
      name: product.name,
      code: product.code,
      purchase_price: product.purchasePrice,
      selling_price: product.sellingPrice,
      stock: product.stock,
      min_stock: product.minStock,
      description: product.description,
      business_id: product.businessId,
    }

    const { data, error } = await supabase.from(this.tableName).update(dbProduct).eq("id", product.id).select().single()

    if (error) {
      this.handleError(error, "updating")
    }

    // Transformar la respuesta al formato esperado por la aplicación
    return {
      id: data.id,
      name: data.name,
      code: data.code,
      purchasePrice: data.purchase_price,
      sellingPrice: data.selling_price,
      stock: data.stock,
      minStock: data.min_stock,
      description: data.description || "",
      createdAt: data.created_at,
      businessId: data.business_id,
      salesCount: product.salesCount,
      totalRevenue: product.totalRevenue,
    }
  }
}

// Exportar una instancia del servicio para uso directo
export const productService = new ProductService()

