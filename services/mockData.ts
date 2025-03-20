import type { Activity, Business, Employee, Expense, Product, Sale, Shift } from "@/services/types"

// Datos mock para negocios
export const mockBusinesses: Business[] = [
  {
    id: "1",
    name: "Café Aroma",
    address: "Calle Principal 123",
    phone: "555-1234",
    email: "info@cafearoma.com",
    description: "Cafetería especializada en granos de origen único",
    todaySales: 42,
    totalAmount: 8750,
    paymentMethods: {
      cash: 3500,
      card: 4000,
      transfer: 1250,
    },
    inventory: {
      investment: 15000,
      potentialProfit: 25000,
    },
  },
  {
    id: "2",
    name: "Tech Store",
    address: "Av. Tecnología 456",
    phone: "555-5678",
    email: "ventas@techstore.com",
    description: "Tienda de productos electrónicos y accesorios",
    todaySales: 15,
    totalAmount: 45000,
    paymentMethods: {
      cash: 10000,
      card: 30000,
      transfer: 5000,
    },
    inventory: {
      investment: 120000,
      potentialProfit: 180000,
    },
  },
  {
    id: "3",
    name: "Fashion Boutique",
    address: "Plaza Moda 789",
    phone: "555-9012",
    email: "contacto@fashionboutique.com",
    description: "Boutique de ropa y accesorios de diseñador",
    todaySales: 28,
    totalAmount: 22500,
    paymentMethods: {
      cash: 7500,
      card: 12000,
      transfer: 3000,
    },
    inventory: {
      investment: 75000,
      potentialProfit: 120000,
    },
  },
]

// Datos mock para productos
export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Café Espresso",
    code: "ESP001",
    description: "Café espresso premium, intenso y aromático",
    purchasePrice: 50,
    sellingPrice: 120,
    stock: 100,
    minStock: 20,
    businessId: "1",
    salesCount: 350,
    totalRevenue: 42000,
  },
  {
    id: "2",
    name: "Café Latte",
    code: "LAT002",
    description: "Café con leche cremoso y suave",
    purchasePrice: 60,
    sellingPrice: 150,
    stock: 80,
    minStock: 15,
    businessId: "1",
    salesCount: 280,
    totalRevenue: 42000,
  },
  {
    id: "3",
    name: "Smartphone X",
    code: "SPX001",
    description: "Smartphone de última generación con cámara de alta resolución",
    purchasePrice: 5000,
    sellingPrice: 8500,
    stock: 25,
    minStock: 5,
    businessId: "2",
    salesCount: 42,
    totalRevenue: 357000,
  },
  {
    id: "4",
    name: "Tablet Pro",
    code: "TPR002",
    description: "Tablet profesional con pantalla de alta definición",
    purchasePrice: 3500,
    sellingPrice: 6000,
    stock: 15,
    minStock: 3,
    businessId: "2",
    salesCount: 28,
    totalRevenue: 168000,
  },
  {
    id: "5",
    name: "Vestido Elegante",
    code: "VES001",
    description: "Vestido de diseñador para ocasiones especiales",
    purchasePrice: 800,
    sellingPrice: 1500,
    stock: 30,
    minStock: 5,
    businessId: "3",
    salesCount: 85,
    totalRevenue: 127500,
  },
  {
    id: "6",
    name: "Jeans Premium",
    code: "JNS002",
    description: "Jeans de alta calidad con diseño moderno",
    purchasePrice: 500,
    sellingPrice: 950,
    stock: 45,
    minStock: 10,
    businessId: "3",
    salesCount: 120,
    totalRevenue: 114000,
  },
]

// Datos mock para empleados
export const mockEmployees: Employee[] = [
  {
    id: "1",
    name: "Ana García",
    email: "ana@cafearoma.com",
    phone: "555-1111",
    position: "Barista",
    businessId: "1",
    active: true,
    sales: 150,
    performance: 95,
  },
  {
    id: "2",
    name: "Carlos Rodríguez",
    email: "carlos@cafearoma.com",
    phone: "555-2222",
    position: "Cajero",
    businessId: "1",
    active: true,
    sales: 120,
    performance: 88,
  },
  {
    id: "3",
    name: "Miguel Torres",
    email: "miguel@techstore.com",
    phone: "555-3333",
    position: "Vendedor",
    businessId: "2",
    active: true,
    sales: 35,
    performance: 92,
  },
  {
    id: "4",
    name: "Laura Sánchez",
    email: "laura@techstore.com",
    phone: "555-4444",
    position: "Gerente",
    businessId: "2",
    active: true,
    sales: 28,
    performance: 96,
  },
  {
    id: "5",
    name: "Sofía Martínez",
    email: "sofia@fashionboutique.com",
    phone: "555-5555",
    position: "Asesora de Moda",
    businessId: "3",
    active: true,
    sales: 95,
    performance: 94,
  },
  {
    id: "6",
    name: "Javier López",
    email: "javier@fashionboutique.com",
    phone: "555-6666",
    position: "Cajero",
    businessId: "3",
    active: true,
    sales: 85,
    performance: 90,
  },
]

// Datos mock para ventas
export const mockSales: Sale[] = [
  {
    id: "1",
    date: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
    total: 270,
    items: [
      {
        productId: "1",
        productName: "Café Espresso",
        quantity: 2,
        price: 120,
        subtotal: 240,
      },
      {
        productId: "2",
        productName: "Café Latte",
        quantity: 1,
        price: 150,
        subtotal: 150,
      },
    ],
    paymentMethod: "cash",
    businessId: "1",
    employeeId: "1",
    customer: "Cliente Ocasional",
  },
  {
    id: "2",
    date: new Date(Date.now() - 7200000).toISOString(), // 2 horas atrás
    total: 8500,
    items: [
      {
        productId: "3",
        productName: "Smartphone X",
        quantity: 1,
        price: 8500,
        subtotal: 8500,
      },
    ],
    paymentMethod: "card",
    businessId: "2",
    employeeId: "3",
    customer: "Juan Pérez",
    notes: "Garantía extendida por 2 años",
  },
  {
    id: "3",
    date: new Date(Date.now() - 10800000).toISOString(), // 3 horas atrás
    total: 2450,
    items: [
      {
        productId: "5",
        productName: "Vestido Elegante",
        quantity: 1,
        price: 1500,
        subtotal: 1500,
      },
      {
        productId: "6",
        productName: "Jeans Premium",
        quantity: 1,
        price: 950,
        subtotal: 950,
      },
    ],
    paymentMethod: "transfer",
    businessId: "3",
    employeeId: "5",
    customer: "María González",
    notes: "Entrega a domicilio",
  },
]

// Datos mock para turnos
export const mockShifts: Shift[] = [
  {
    id: "1",
    startTime: new Date(Date.now() - 18000000).toISOString(), // 5 horas atrás
    employeeId: "1",
    employeeName: "Ana García",
    businessId: "1",
    businessName: "Café Aroma",
    active: true,
    sales: 15,
    paymentMethods: {
      cash: 1800,
      card: 1200,
      transfer: 600,
    },
  },
  {
    id: "2",
    startTime: new Date(Date.now() - 18000000).toISOString(), // 5 horas atrás
    employeeId: "3",
    employeeName: "Miguel Torres",
    businessId: "2",
    businessName: "Tech Store",
    active: true,
    sales: 5,
    paymentMethods: {
      cash: 8500,
      card: 25500,
      transfer: 8500,
    },
  },
  {
    id: "3",
    startTime: new Date(Date.now() - 18000000).toISOString(), // 5 horas atrás
    employeeId: "5",
    employeeName: "Sofía Martínez",
    businessId: "3",
    businessName: "Fashion Boutique",
    active: true,
    sales: 8,
    paymentMethods: {
      cash: 4500,
      card: 7500,
      transfer: 3000,
    },
  },
]

// Datos mock para gastos
export const mockExpenses: Expense[] = [
  {
    id: "1",
    date: new Date(Date.now() - 86400000).toISOString(), // 1 día atrás
    amount: 2500,
    category: "Insumos",
    description: "Compra de granos de café",
    businessId: "1",
    paymentMethod: "transfer",
  },
  {
    id: "2",
    date: new Date(Date.now() - 172800000).toISOString(), // 2 días atrás
    amount: 35000,
    category: "Inventario",
    description: "Compra de smartphones para stock",
    businessId: "2",
    paymentMethod: "transfer",
  },
  {
    id: "3",
    date: new Date(Date.now() - 259200000).toISOString(), // 3 días atrás
    amount: 15000,
    category: "Inventario",
    description: "Compra de ropa de temporada",
    businessId: "3",
    paymentMethod: "card",
  },
]

// Datos mock para actividades
export const mockActivities: Activity[] = [
  {
    id: "1",
    userId: "1",
    userName: "Ana García",
    userRole: "employee",
    businessId: "1",
    businessName: "Café Aroma",
    action: "login",
    details: "Inicio de sesión en el sistema",
    timestamp: new Date(Date.now() - 18000000).toISOString(), // 5 horas atrás
  },
  {
    id: "2",
    userId: "1",
    userName: "Ana García",
    userRole: "employee",
    businessId: "1",
    businessName: "Café Aroma",
    action: "new sale",
    details: "Venta de 2 Café Espresso y 1 Café Latte",
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
  },
  {
    id: "3",
    userId: "3",
    userName: "Miguel Torres",
    userRole: "employee",
    businessId: "2",
    businessName: "Tech Store",
    action: "login",
    details: "Inicio de sesión en el sistema",
    timestamp: new Date(Date.now() - 18000000).toISOString(), // 5 horas atrás
  },
  {
    id: "4",
    userId: "3",
    userName: "Miguel Torres",
    userRole: "employee",
    businessId: "2",
    businessName: "Tech Store",
    action: "new sale",
    details: "Venta de 1 Smartphone X",
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 horas atrás
  },
  {
    id: "5",
    userId: "5",
    userName: "Sofía Martínez",
    userRole: "employee",
    businessId: "3",
    businessName: "Fashion Boutique",
    action: "login",
    details: "Inicio de sesión en el sistema",
    timestamp: new Date(Date.now() - 18000000).toISOString(), // 5 horas atrás
  },
  {
    id: "6",
    userId: "5",
    userName: "Sofía Martínez",
    userRole: "employee",
    businessId: "3",
    businessName: "Fashion Boutique",
    action: "new sale",
    details: "Venta de 1 Vestido Elegante y 1 Jeans Premium",
    timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 horas atrás
  },
]

// Datos mock para usuarios
export const mockUsers = [
  {
    id: "1",
    email: "admin@example.com",
    password: "admin123",
    name: "Administrador",
    role: "admin",
  },
  {
    id: "2",
    email: "employee@example.com",
    password: "employee123",
    name: "Empleado",
    role: "employee",
    businessId: "1",
  },
]

