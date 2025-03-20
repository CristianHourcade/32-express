import { supabase } from "@/lib/supabase"
import type { PostgrestError } from "@supabase/supabase-js"

/**
 * Servicio base para interactuar con Supabase
 * Proporciona métodos genéricos para operaciones CRUD
 */
export class SupabaseService<T extends { id: string }> {
  protected tableName: string

  constructor(tableName: string) {
    this.tableName = tableName
  }

  /**
   * Obtiene todos los registros de la tabla
   */
  async getAll(): Promise<T[]> {
    const { data, error } = await supabase.from(this.tableName).select("*")

    if (error) {
      console.error(`Error fetching ${this.tableName}:`, error)
      throw new Error(`Error fetching ${this.tableName}: ${error.message}`)
    }

    return data as T[]
  }

  /**
   * Obtiene un registro por su ID
   */
  async getById(id: string): Promise<T | null> {
    const { data, error } = await supabase.from(this.tableName).select("*").eq("id", id).single()

    if (error && error.code !== "PGRST116") {
      console.error(`Error fetching ${this.tableName} by ID:`, error)
      throw new Error(`Error fetching ${this.tableName} by ID: ${error.message}`)
    }

    return data as T | null
  }

  /**
   * Crea un nuevo registro
   */
  async create(item: Omit<T, "id">): Promise<T> {
    const { data, error } = await supabase.from(this.tableName).insert(item).select().single()

    if (error) {
      console.error(`Error creating ${this.tableName}:`, error)
      throw new Error(`Error creating ${this.tableName}: ${error.message}`)
    }

    return data as T
  }

  /**
   * Actualiza un registro existente
   */
  async update(id: string, item: Partial<T>): Promise<T> {
    const { data, error } = await supabase.from(this.tableName).update(item).eq("id", id).select().single()

    if (error) {
      console.error(`Error updating ${this.tableName}:`, error)
      throw new Error(`Error updating ${this.tableName}: ${error.message}`)
    }

    return data as T
  }

  /**
   * Elimina un registro
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(this.tableName).delete().eq("id", id)

    if (error) {
      console.error(`Error deleting ${this.tableName}:`, error)
      throw new Error(`Error deleting ${this.tableName}: ${error.message}`)
    }
  }

  /**
   * Obtiene registros por un campo específico
   */
  async getByField(field: string, value: any): Promise<T[]> {
    const { data, error } = await supabase.from(this.tableName).select("*").eq(field, value)

    if (error) {
      console.error(`Error fetching ${this.tableName} by ${field}:`, error)
      throw new Error(`Error fetching ${this.tableName} by ${field}: ${error.message}`)
    }

    return data as T[]
  }

  /**
   * Maneja errores de Supabase de manera consistente
   */
  protected handleError(error: PostgrestError | null, operation: string): never {
    if (error) {
      console.error(`Error ${operation} ${this.tableName}:`, error)
      throw new Error(`Error ${operation} ${this.tableName}: ${error.message}`)
    }
    throw new Error(`Unknown error ${operation} ${this.tableName}`)
  }
}

