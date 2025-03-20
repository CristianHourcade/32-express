export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      activities: {
        Row: {
          id: string
          user_id: string
          business_id: string
          action: string
          details: string | null
          timestamp: string
          user_role?: string // Marcado como opcional
        }
        Insert: {
          id?: string
          user_id: string
          business_id: string
          action: string
          details?: string | null
          timestamp?: string
          user_role?: string // Marcado como opcional
        }
        Update: {
          id?: string
          user_id?: string
          business_id?: string
          action?: string
          details?: string | null
          timestamp?: string
          user_role?: string // Marcado como opcional
        }
        Relationships: [
          {
            foreignKeyName: "activities_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          name: string
          email: string
          business_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          business_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          business_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          id: string
          business_id: string
          category: string
          amount: number
          description: string | null
          date: string
        }
        Insert: {
          id?: string
          business_id: string
          category: string
          amount: number
          description?: string | null
          date?: string
        }
        Update: {
          id?: string
          business_id?: string
          category?: string
          amount?: number
          description?: string | null
          date?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          id: string
          name: string
          code: string
          purchase_price: number
          selling_price: number
          stock: number
          min_stock: number
          description: string | null
          business_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          purchase_price: number
          selling_price: number
          stock?: number
          min_stock?: number
          description?: string | null
          business_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          purchase_price?: number
          selling_price?: number
          stock?: number
          min_stock?: number
          description?: string | null
          business_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          quantity: number
          price: number
          total: number
        }
        Insert: {
          id?: string
          sale_id: string
          product_id: string
          quantity: number
          price: number
          total: number
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string
          quantity?: number
          price?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          id: string
          business_id: string
          employee_id: string
          shift_id: string
          total: number
          payment_method: string
          timestamp: string
        }
        Insert: {
          id?: string
          business_id: string
          employee_id: string
          shift_id: string
          total: number
          payment_method: string
          timestamp?: string
        }
        Update: {
          id?: string
          business_id?: string
          employee_id?: string
          shift_id?: string
          total?: number
          payment_method?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_employee_id_fkey"
            columns: ["employee_id"]
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          id: string
          employee_id: string
          business_id: string
          start_time: string
          end_time: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          business_id: string
          start_time?: string
          end_time?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          business_id?: string
          start_time?: string
          end_time?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          id: string
          auth_id: string | null
          name: string
          email: string
          role: string
          business_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          auth_id?: string | null
          name: string
          email: string
          role: string
          business_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          auth_id?: string | null
          name?: string
          email?: string
          role?: string
          business_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_auth_id_fkey"
            columns: ["auth_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_business_id_fkey"
            columns: ["business_id"]
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_sale: {
        Args: {
          p_business_id: string
          p_employee_id: string
          p_total: number
          p_payment_method: string
          p_shift_id: string
          p_items: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

