export interface Business {
  id: string
  name: string
  address: string
  phone: string
  email: string
  description: string
  createdAt?: string
  updatedAt?: string
  todaySales: number
  totalAmount: number
  paymentMethods: {
    cash: number
    card: number
    transfer: number
  }
  inventory: {
    investment: number
    potentialProfit: number
  }
}

export type CreateBusinessData = Omit<
  Business,
  "id" | "createdAt" | "updatedAt" | "todaySales" | "totalAmount" | "paymentMethods" | "inventory"
>
export type UpdateBusinessData = Partial<CreateBusinessData>

// Interfaces para productos
export interface Product {
  id: string
  name: string
  code: string
  description: string
  purchasePrice: number
  sellingPrice: number
  stock: number
  minStock: number
  businessId: string
  createdAt?: string
  updatedAt?: string
  salesCount: number
  totalRevenue: number
}

export type CreateProductData = Omit<Product, "id" | "createdAt" | "updatedAt" | "salesCount" | "totalRevenue">
export type UpdateProductData = Partial<CreateProductData>

// Interfaces para empleados
export interface Employee {
  id: string
  name: string
  email: string
  phone: string
  position: string
  businessId: string
  createdAt?: string
  updatedAt?: string
  active: boolean
  sales: number
  performance: number
}

export type CreateEmployeeData = Omit<Employee, "id" | "createdAt" | "updatedAt" | "sales" | "performance">
export type UpdateEmployeeData = Partial<CreateEmployeeData>

// Interfaces para ventas
export interface Sale {
  id: string
  date: string
  total: number
  items: SaleItem[]
  paymentMethod: "cash" | "card" | "transfer"
  businessId: string
  employeeId: string
  createdAt?: string
  updatedAt?: string
  customer?: string
  notes?: string
}

export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
  subtotal: number
}

export type CreateSaleData = Omit<Sale, "id" | "createdAt" | "updatedAt">
export type UpdateSaleData = Partial<Omit<Sale, "id" | "createdAt" | "updatedAt" | "businessId" | "employeeId">>

// Interfaces para turnos
export interface Shift {
  id: string
  startTime: string
  endTime?: string
  employeeId: string
  employeeName: string
  businessId: string
  businessName: string
  active: boolean
  sales: number
  paymentMethods: {
    cash: number
    card: number
    transfer: number
  }
  createdAt?: string
  updatedAt?: string
}

export type CreateShiftData = Omit<
  Shift,
  "id" | "createdAt" | "updatedAt" | "active" | "sales" | "paymentMethods" | "employeeName" | "businessName"
>
export type UpdateShiftData = Partial<Omit<Shift, "id" | "createdAt" | "updatedAt" | "employeeId" | "businessId">>

// Interfaces para gastos
export interface Expense {
  id: string
  date: string
  amount: number
  category: string
  description: string
  businessId: string
  createdAt?: string
  updatedAt?: string
  paymentMethod: "cash" | "card" | "transfer"
  receipt?: string
}

export type CreateExpenseData = Omit<Expense, "id" | "createdAt" | "updatedAt">
export type UpdateExpenseData = Partial<Omit<Expense, "id" | "createdAt" | "updatedAt" | "businessId">>

// Interfaces para actividades
export interface Activity {
  id: string
  userId: string
  userName: string
  userRole: string
  businessId: string
  businessName: string
  action: string
  details: string
  timestamp: string
}

export type CreateActivityData = Omit<Activity, "id" | "timestamp">

