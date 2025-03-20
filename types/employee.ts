export interface Employee {
  id: string
  name: string
  email: string
  phone?: string
  position?: string
  business_id: string
  auth_id?: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  auth_id: string
  email: string
  name: string
  role: string
  business_id?: string
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string
  user_metadata: {
    name?: string
    role?: string
    businessId?: string
  }
}

export interface EmployeeWithUser {
  employee: Employee
  user: User | null
  authUser: AuthUser | null
}

