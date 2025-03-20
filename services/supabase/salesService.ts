import { SupabaseService } from "./supabaseService"
import type { Sale } from "@/lib/redux/slices/salesSlice"
import { supabase } from "@/lib/supabase"

export class SalesService extends SupabaseService<Sale> {
  constructor() {
    super("sales")
  }

  /**
   * Obtiene todas las ventas con sus items
   */
  async getAllWithItems(): Promise<Sale[]> {
    console.log("🔍 SalesService (Supabase): Getting all sales with items")

    try {
      // Obtener ventas básicas
      const { data: sales, error } = await supabase
        .from(this.tableName)
        .select(`
          *,
          businesses(name),
          employees(name)
        `)
        .order("timestamp", { ascending: false })

      if (error) {
        console.error("🔍 SalesService (Supabase): Error fetching sales:", error)
        throw error
      }

      console.log("🔍 SalesService (Supabase): Fetched", sales?.length || 0, "sales")

      if (!sales || sales.length === 0) {
        console.log("🔍 SalesService (Supabase): No sales found")
        return []
      }

      // Mostrar los primeros registros para depuración
      console.log("🔍 SalesService (Supabase): First few sales:", sales.slice(0, 2))

      // Para cada venta, obtener sus items
      const salesWithItems = await Promise.all(
        sales.map(async (sale) => {
          // Obtener items de la venta
          const { data: saleItems, error: itemsError } = await supabase
            .from("sale_items")
            .select(`
              *,
              products(name)
            `)
            .eq("sale_id", sale.id)

          if (itemsError) {
            console.error("🔍 SalesService (Supabase): Error fetching sale items for sale", sale.id, ":", itemsError)
          }

          console.log(`🔍 SalesService (Supabase): Fetched ${saleItems?.length || 0} items for sale ${sale.id}`)

          // Transformar items al formato esperado
          const items =
            saleItems?.map((item) => ({
              productId: item.product_id,
              productName: item.products?.name || "Producto desconocido",
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            })) || []

          // Construir objeto de venta completo
          return {
            id: sale.id,
            businessId: sale.business_id,
            businessName: sale.businesses?.name || "Negocio desconocido",
            employeeId: sale.employee_id,
            employeeName: sale.employees?.name || "Empleado desconocido",
            items,
            total: sale.total,
            paymentMethod: sale.payment_method,
            timestamp: sale.timestamp,
            shiftId: sale.shift_id,
          } as Sale
        }),
      )

      console.log("🔍 SalesService (Supabase): Processed", salesWithItems.length, "sales with items")

      // Mostrar los primeros registros procesados para depuración
      if (salesWithItems.length > 0) {
        console.log("🔍 SalesService (Supabase): First processed sale:", {
          id: salesWithItems[0].id,
          businessName: salesWithItems[0].businessName,
          employeeName: salesWithItems[0].employeeName,
          total: salesWithItems[0].total,
          itemsCount: salesWithItems[0].items.length,
        })
      }

      return salesWithItems
    } catch (error) {
      console.error("🔍 SalesService (Supabase): Exception in getAllWithItems:", error)
      throw error
    }
  }

  /**
   * Obtiene ventas por ID de negocio
   */
  async getByBusinessId(businessId: string): Promise<Sale[]> {
    console.log("🔍 SalesService (Supabase): Getting sales for business", businessId)

    try {
      // Obtener ventas directamente con filtro por business_id
      const { data: sales, error } = await supabase
        .from(this.tableName)
        .select(`
          *,
          businesses(name),
          employees(name)
        `)
        .eq("business_id", businessId)
        .order("timestamp", { ascending: false })

      if (error) {
        console.error("🔍 SalesService (Supabase): Error fetching sales for business:", error)
        throw error
      }

      if (!sales || sales.length === 0) {
        console.log("🔍 SalesService (Supabase): No sales found for business", businessId)
        return []
      }

      // Procesar las ventas igual que en getAllWithItems
      const salesWithItems = await Promise.all(
        sales.map(async (sale) => {
          const { data: saleItems, error: itemsError } = await supabase
            .from("sale_items")
            .select(`
              *,
              products(name)
            `)
            .eq("sale_id", sale.id)

          if (itemsError) {
            console.error("Error fetching sale items:", itemsError)
          }

          const items =
            saleItems?.map((item) => ({
              productId: item.product_id,
              productName: item.products?.name || "Producto desconocido",
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            })) || []

          return {
            id: sale.id,
            businessId: sale.business_id,
            businessName: sale.businesses?.name || "Negocio desconocido",
            employeeId: sale.employee_id,
            employeeName: sale.employees?.name || "Empleado desconocido",
            items,
            total: sale.total,
            paymentMethod: sale.payment_method,
            timestamp: sale.timestamp,
            shiftId: sale.shift_id,
          } as Sale
        }),
      )

      return salesWithItems
    } catch (error) {
      console.error("🔍 SalesService (Supabase): Exception in getByBusinessId:", error)
      throw error
    }
  }

  /**
   * Obtiene ventas por ID de empleado
   */
  async getByEmployeeId(employeeId: string): Promise<Sale[]> {
    const sales = await this.getAllWithItems()
    return sales.filter((sale) => sale.employeeId === employeeId)
  }

  /**
   * Obtiene ventas por ID de turno
   */
  async getByShiftId(shiftId: string): Promise<Sale[]> {
    const sales = await this.getAllWithItems()
    return sales.filter((sale) => sale.shiftId === shiftId)
  }

  /**
   * Crea una nueva venta con sus items
   */
  async create(sale: Omit<Sale, "id">): Promise<Sale> {
    console.log("🔍 SalesService (Supabase): Creating sale with data:", {
      businessId: sale.businessId,
      employeeId: sale.employeeId,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      shiftId: sale.shiftId,
      itemsCount: sale.items.length,
    })

    // Verificar los items de la venta
    console.log("🔍 SalesService (Supabase): Sale items:", JSON.stringify(sale.items, null, 2))

    // Verificar si hay algún item con productId nulo o indefinido
    const invalidItems = sale.items.filter((item) => !item.productId)
    if (invalidItems.length > 0) {
      console.error("🔍 SalesService (Supabase): Found items with null or undefined productId:", invalidItems)
      throw new Error("No se pueden procesar items sin ID de producto")
    }

    // Método alternativo: Crear la venta manualmente en lugar de usar el procedimiento almacenado
    try {
      // 1. Iniciar una transacción manual
      console.log("🔍 SalesService (Supabase): Starting manual transaction")

      // 2. Insertar la venta principal
      const { data: newSale, error: saleError } = await supabase
        .from("sales")
        .insert({
          business_id: sale.businessId,
          employee_id: sale.employeeId,
          total: sale.total,
          payment_method: sale.paymentMethod,
          shift_id: sale.shiftId,
          timestamp: new Date().toISOString(),
        })
        .select()
        .single()

      if (saleError) {
        console.error("🔍 SalesService (Supabase): Error creating sale:", saleError)
        throw new Error(`Error creating sale: ${saleError.message}`)
      }

      console.log("🔍 SalesService (Supabase): Sale created successfully:", newSale)

      // 3. Insertar los items de la venta
      const saleItems = sale.items.map((item) => ({
        sale_id: newSale.id,
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price, // Añadir el campo total
      }))

      console.log("🔍 SalesService (Supabase): Inserting sale items:", saleItems)

      const { data: newItems, error: itemsError } = await supabase.from("sale_items").insert(saleItems).select()

      if (itemsError) {
        console.error("🔍 SalesService (Supabase): Error creating sale items:", itemsError)
        // Intentar eliminar la venta para revertir la transacción
        await supabase.from("sales").delete().eq("id", newSale.id)
        throw new Error(`Error creating sale items: ${itemsError.message}`)
      }

      console.log("🔍 SalesService (Supabase): Sale items created successfully:", newItems)

      // 4. Obtener la venta completa con sus items
      return this.getById(newSale.id) as Promise<Sale>
    } catch (error) {
      console.error("🔍 SalesService (Supabase): Exception during manual sale creation:", error)
      throw error
    }
  }

  /**
   * Obtiene una venta por ID con sus items
   */
  async getById(id: string): Promise<Sale | null> {
    console.log("🔍 SalesService (Supabase): Getting sale by ID", id)

    try {
      // Obtener la venta básica
      const { data: sale, error } = await supabase
        .from(this.tableName)
        .select(`
          *,
          businesses(name),
          employees(name)
        `)
        .eq("id", id)
        .single()

      if (error) {
        console.error("🔍 SalesService (Supabase): Error fetching sale by ID:", error)
        return null
      }

      if (!sale) {
        console.log("🔍 SalesService (Supabase): No sale found with ID", id)
        return null
      }

      // Obtener items de la venta
      const { data: saleItems, error: itemsError } = await supabase
        .from("sale_items")
        .select(`
          *,
          products(name)
        `)
        .eq("sale_id", id)

      if (itemsError) {
        console.error("🔍 SalesService (Supabase): Error fetching sale items for sale", id, ":", itemsError)
      }

      // Transformar items al formato esperado
      const items =
        saleItems?.map((item) => ({
          productId: item.product_id,
          productName: item.products?.name || "Producto desconocido",
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })) || []

      // Construir objeto de venta completo
      return {
        id: sale.id,
        businessId: sale.business_id,
        businessName: sale.businesses?.name || "Negocio desconocido",
        employeeId: sale.employee_id,
        employeeName: sale.employees?.name || "Empleado desconocido",
        items,
        total: sale.total,
        paymentMethod: sale.payment_method,
        timestamp: sale.timestamp,
        shiftId: sale.shift_id,
      } as Sale
    } catch (error) {
      console.error("🔍 SalesService (Supabase): Exception in getById:", error)
      return null
    }
  }
}

// Exportar una instancia del servicio para uso directo
export const salesService = new SalesService()

