"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

/* ========= COMPONENTE: MultiSelectDropdown ========= */
function MultiSelectDropdown({
  options,
  selectedOptions,
  onChange,
  placeholder = "Selecciona categorías",
}: {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (option: string) => {
    let newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter((o) => o !== option)
      : [...selectedOptions, option];
    onChange(newSelected);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input w-full text-left flex items-center justify-between"
      >
        <span>
          {selectedOptions.length > 0
            ? selectedOptions.join(", ")
            : placeholder}
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 shadow-lg border rounded w-full">
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="mr-2"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========= FETCH HELPERS ========= */
async function fetchAllPaginated(
  queryFn: (
    from: number,
    to: number
  ) => Promise<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const pageSize = 1000;
  let page = 0;
  let allData: any[] = [];
  let done = false;
  while (!done) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryFn(from, to);
    if (error) {
      console.error("Error fetching paginated data:", error);
      break;
    }
    if (data) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        done = true;
      } else {
        page++;
      }
    } else {
      done = true;
    }
  }
  return allData;
}

/* ========= FETCH FUNCTIONS ========= */
// Negocios
async function loadBusinesses(): Promise<any[]> {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("name");
  if (error) {
    console.error("Error loading businesses:", error);
    return [];
  }
  return data || [];
}

// Ventas (paginado)
async function loadSales(businessId: string): Promise<any[]> {
  return await fetchAllPaginated((from, to) =>
    supabase
      .from("sales")
      .select(
        `
        *,
        sale_items (
          *,
          products(name)
        )
      `
      )
      .eq("business_id", businessId)
      .order("timestamp", { ascending: false })
      .range(from, to)
  );
}

// Productos (paginado)
async function loadProducts(businessId: string): Promise<any[]> {
  return await fetchAllPaginated((from, to) =>
    supabase
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .range(from, to)
  );
}

// Gastos (paginado)
async function loadExpenses(businessId: string): Promise<any[]> {
  return await fetchAllPaginated((from, to) =>
    supabase
      .from("expenses")
      .select("*")
      .eq("business_id", businessId)
      .order("date", { ascending: false })
      .range(from, to)
  );
}

// Turnos (paginado)
async function loadShifts(businessId: string): Promise<any[]> {
  return await fetchAllPaginated((from, to) =>
    supabase
      .from("shifts")
      .select("*")
      .eq("business_id", businessId)
      .order("start_time", { ascending: false })
      .range(from, to)
  );
}

/* ========= OTRAS FUNCIONES DE UTILIDAD ========= */
function formatNumberAbbreviation(num: number): string {
  const sign = num < 0 ? "-" : "";
  const absNum = Math.abs(num);
  if (absNum >= 1.0e6) {
    return sign + (absNum / 1.0e6).toFixed(1) + "M";
  } else if (absNum >= 1.0e3) {
    return sign + (absNum / 1.0e3).toFixed(1) + "k";
  } else {
    return sign + absNum.toFixed(0);
  }
}

/* ========= FILTRADO POR CATEGORÍAS ========= */
// Arreglo de categorías conocidas
const categories = [
  "ALMACEN",
  "CIGARRILLOS",
  "GOLOSINAS",
  "BEBIDA",
  "CERVEZA",
  "FIAMBRES",
  "TABACO",
  "HUEVOS",
  "HIGIENE",
  "ALCOHOL",
];

// Función para extraer la categoría a partir del nombre de producto.
// Si el nombre inicia con alguna de las categorías definidas (sin importar mayúsculas/minúsculas),
// se retorna esa categoría; de lo contrario, retorna null.
function extractCategory(name: string): {
  category: string | null;
  baseName: string;
} {
  const parts = name.trim().split(" ");
  if (parts.length > 1 && categories.includes(parts[0].toUpperCase())) {
    return {
      category: parts[0].toUpperCase(),
      baseName: parts.slice(1).join(" "),
    };
  }
  return { category: null, baseName: name };
}

/* ========= COMPONENTE: AdminDashboard ========= */
export default function AdminDashboard() {
  // Estados globales
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Estados para la sección "Top Productos"
  const [directSales, setDirectSales] = useState<any[]>([]);
  const [directSalesLoading, setDirectSalesLoading] = useState<boolean>(false);
  const [selectedBusinessForTopProducts, setSelectedBusinessForTopProducts] =
    useState<string>("");
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbProductsLoading, setDbProductsLoading] = useState<boolean>(false);
  const [daysFilter, setDaysFilter] = useState<number>(7);

  // Estado para el filtro por categorías.
  const allCategoryOptions = [...categories, "SIN CATEGORIA"];
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Estados para ordenación de Top Productos
  const [sortColumn, setSortColumn] = useState<"salesCount" | "totalRevenue">(
    "salesCount"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Estado de carga global
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Función para formatear precios
  const formatPrice = (num: number): string =>
    num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Obtener el nombre del mes actual en español
  const currentMonthName = new Date().toLocaleString("es-ES", {
    month: "long",
  });
  const monthHeader = `Negocios – Mes ${
    currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)
  }`;

  /* ========= CARGA GLOBAL DE DATOS ========= */
  useEffect(() => {
    async function loadGlobalData() {
      try {
        const businessesData = await loadBusinesses();
        setBusinesses(businessesData);

        // Concatenar datos para cada negocio.
        let allSales: any[] = [];
        let allExpenses: any[] = [];
        let allShifts: any[] = [];

        await Promise.all(
          businessesData.map(async (business) => {
            const [salesData, expensesData, shiftsData] = await Promise.all([
              loadSales(business.id),
              loadExpenses(business.id),
              loadShifts(business.id),
            ]);
            allSales = allSales.concat(salesData);
            allExpenses = allExpenses.concat(expensesData);
            allShifts = allShifts.concat(shiftsData);
          })
        );
        setSales(allSales);
        setExpenses(allExpenses);
        setShifts(allShifts);
      } catch (error) {
        console.error("Error loading global data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadGlobalData();
  }, []);

  // Cargar empleados
  useEffect(() => {
    async function loadEmployees() {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("name");
      if (error) {
        console.error("Error loading employees:", error);
        return;
      }
      setEmployees(data || []);
    }
    loadEmployees();
  }, []);

  // Cargar directSales para el negocio seleccionado en "Top Productos"
  useEffect(() => {
    const fetchDirectSales = async () => {
      if (!selectedBusinessForTopProducts) return;
      setDirectSalesLoading(true);
      const salesData = await loadSales(selectedBusinessForTopProducts);
      setDirectSales(salesData);
      setDirectSalesLoading(false);
    };
    fetchDirectSales();
  }, [selectedBusinessForTopProducts]);

  // Cargar productos para el negocio seleccionado en "Top Productos"
  useEffect(() => {
    const fetchProductsForBusiness = async () => {
      if (!selectedBusinessForTopProducts) {
        setDbProducts([]);
        return;
      }
      setDbProductsLoading(true);
      const productsData = await loadProducts(selectedBusinessForTopProducts);
      setDbProducts(productsData);
      setDbProductsLoading(false);
    };
    fetchProductsForBusiness();
  }, [selectedBusinessForTopProducts]);

  /* ========= CÁLCULO DE TOP PRODUCTOS CON FILTRO DE FECHAS Y CATEGORÍAS ========= */
  const topProducts = useMemo(() => {
    const now = new Date();
    // Filtra las ventas según el rango de días seleccionado.
    const filteredSales = directSales.filter((sale) => {
      const saleDate = new Date(sale.timestamp);
      const diffDays =
        (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= daysFilter;
    });

    const productMap = new Map<
      string,
      {
        productName: string;
        businessId: string;
        purchasePrice: number;
        sellingPrice: number;
        totalQuantity: number;
        totalRevenue: number;
      }
    >();

    // Agrupar las ventas filtradas.
    for (const sale of filteredSales) {
      if (!sale.sale_items) continue;
      for (const item of sale.sale_items) {
        // Buscar el producto en los productos del negocio seleccionado.
        const prod = dbProducts.find((p) => p.id === item.product_id);
        if (!prod) continue;
        const key = `${item.product_id}-${prod.business_id}`;
        if (!productMap.has(key)) {
          productMap.set(key, {
            productName: item.products?.name || "Producto desconocido",
            businessId: prod.business_id,
            purchasePrice: prod.purchasePrice,
            sellingPrice: prod.sellingPrice,
            totalQuantity: 0,
            totalRevenue: 0,
          });
        }
        const data = productMap.get(key)!;
        data.totalQuantity += item.quantity;
        data.totalRevenue += item.total;
      }
    }

    let arr = Array.from(productMap.values());

    // Aplicar filtro por categorías
    if (selectedCategories.length > 0) {
      arr = arr.filter((item) => {
        const { category } = extractCategory(item.productName);
        return category
          ? selectedCategories.includes(category)
          : selectedCategories.includes("SIN CATEGORIA");
      });
    }

    // Ordenar según la columna y dirección de ordenación seleccionada.
    arr.sort((a, b) => {
      if (sortColumn === "salesCount") {
        return sortDirection === "asc"
          ? a.totalQuantity - b.totalQuantity
          : b.totalQuantity - a.totalQuantity;
      } else if (sortColumn === "totalRevenue") {
        return sortDirection === "asc"
          ? a.totalRevenue - b.totalRevenue
          : b.totalRevenue - a.totalRevenue;
      }
      return 0;
    });

    return arr.slice(0, 15);
  }, [
    directSales,
    dbProducts,
    sortColumn,
    sortDirection,
    daysFilter,
    selectedCategories,
  ]);

  /* ========= CÁLCULO DE DATOS MENSUALES POR NEGOCIO ========= */
  const calculateBusinessMonthlyData = () => {
    const businessDataMap = new Map<
      string,
      {
        transactions: number;
        totalAmount: number;
        totalExpense: number;
        profit: number;
        paymentMethods: {
          cash: number;
          card: number;
          transfer: number;
          mercadopago: number;
          rappi: number;
        };
      }
    >();

    businesses.forEach((business) => {
      businessDataMap.set(business.id, {
        transactions: 0,
        totalAmount: 0,
        totalExpense: 0,
        profit: 0,
        paymentMethods: {
          cash: 0,
          card: 0,
          transfer: 0,
          mercadopago: 0,
          rappi: 0,
        },
      });
    });

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    sales.forEach((sale) => {
      const saleDate = new Date(sale.timestamp);
      if (
        saleDate.getMonth() === currentMonth &&
        saleDate.getFullYear() === currentYear
      ) {
        const businessData = businessDataMap.get(sale.business_id);
        if (businessData) {
          businessData.transactions += 1;
          businessData.totalAmount += sale.total;
          if (sale.payment_method in businessData.paymentMethods) {
            businessData.paymentMethods[sale.payment_method] += sale.total;
          }
        }
      }
    });

    expenses.forEach((expense) => {
      const expenseDate = new Date(expense.date);
      if (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      ) {
        const businessData = businessDataMap.get(expense.business_id);
        if (businessData) {
          businessData.totalExpense += expense.amount;
        }
      }
    });

    return businesses.map((business) => {
      const data = businessDataMap.get(business.id) || {
        transactions: 0,
        totalAmount: 0,
        totalExpense: 0,
        profit: 0,
        paymentMethods: {
          cash: 0,
          card: 0,
          transfer: 0,
          mercadopago: 0,
          rappi: 0,
        },
      };
      data.profit = data.totalAmount - data.totalExpense;
      return {
        ...business,
        transactions: data.transactions,
        totalAmount: data.totalAmount,
        totalExpense: data.totalExpense,
        profit: data.profit,
        avgTicket:
          data.transactions > 0 ? data.totalAmount / data.transactions : 0,
        paymentMethods: data.paymentMethods,
      };
    });
  };

  const businessesWithMonthlyData = calculateBusinessMonthlyData();

  /* ========= CÁLCULO DE TURNOS ACTIVOS ========= */
  const calculateShiftTotals = (shift: any) => {
    const shiftSales = sales.filter((sale) => sale.shift_id === shift.id);
    const paymentMethods = {
      cash: 0,
      card: 0,
      transfer: 0,
      mercadopago: 0,
      rappi: 0,
    };
    shiftSales.forEach((sale) => {
      const method = sale.payment_method;
      if (method in paymentMethods) {
        paymentMethods[method] += sale.total;
      }
    });
    const totalSales = Object.values(paymentMethods).reduce(
      (sum, val) => sum + val,
      0
    );
    return { paymentMethods, totalSales };
  };

  const translatePaymentMethod = (method: string) => {
    const translations: { [key: string]: string } = {
      cash: "Efectivo",
      card: "Tarjetas",
      transfer: "Transferencia",
      mercadopago: "Mercadopago",
      rappi: "Rappi",
    };
    return translations[method] || method;
  };

  const getPaymentMethodClass = (method: string) => {
    const classes: { [key: string]: string } = {
      cash: "bg-green-100 dark:bg-green-900 p-2 rounded",
      card: "bg-blue-100 dark:bg-blue-900 p-2 rounded",
      transfer: "bg-purple-100 dark:bg-purple-900 p-2 rounded",
      mercadopago: "bg-sky-100 dark:bg-sky-900 p-2 rounded",
      rappi: "bg-orange-100 dark:bg-orange-900 p-2 rounded",
    };
    return classes[method] || "bg-gray-100 dark:bg-gray-700 p-2 rounded";
  };

  /* ========= COMPONENTE: SortableHeader para Top Productos ========= */
  const SortableHeader = ({
    column,
    label,
  }: {
    column: "salesCount" | "totalRevenue";
    label: string;
  }) => (
    <th
      className="table-header-cell cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
      onClick={() => {
        if (sortColumn === column) {
          setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
          setSortColumn(column);
          setSortDirection("desc");
        }
      }}
    >
      <div className="flex items-center">
        {label}
        {sortColumn === column && (
          <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
        )}
      </div>
    </th>
  );

  /* ========= RENDER DEL DASHBOARD ========= */
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Cargando datos del dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Filtrar turnos activos
  const activeShifts = Array.isArray(shifts)
    ? shifts
        .filter((shift) => !shift.end_time)
        .sort((a, b) => {
          const totalsA = calculateShiftTotals(a).totalSales;
          const totalsB = calculateShiftTotals(b).totalSales;
          return totalsB - totalsA;
        })
    : [];

  return (
    <div className="space-y-6 p-4">
      {/* Encabezado global */}
      <div>
        <h1 className="text-2xl font-bold">Negocios</h1>
        <p className="text-slate-600 dark:text-slate-400">{monthHeader}</p>
      </div>

      {/* Sección de Negocios */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {businessesWithMonthlyData.map((business) => (
            <div
              key={business.id}
              className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-semibold mb-4 dark:text-white">
                {business.name}
              </h3>
              <div className="mb-2">
                <p className="text-sm text-slate-400">Ventas realizadas</p>
                <p className="dark:text-white font-medium">
                  {formatNumberAbbreviation(business.transactions)}
                </p>
              </div>
              <div className="mb-2">
                <p className="text-sm text-slate-400">Venta acumulada</p>
                <p className="dark:text-white font-medium">
                  $ {formatPrice(business.totalAmount)}
                </p>
              </div>
              <div className="mb-2">
                <p className="text-sm text-slate-400">Gasto acumulado</p>
                <p className="text-red-400 font-medium">
                  $ {formatPrice(business.totalExpense)}
                </p>
              </div>
              <div className="mb-2">
                <p className="text-sm text-slate-400">Profit</p>
                <p className="font-bold text-lg text-green-600 dark:text-green-400">
                  $ {formatPrice(business.profit)}
                </p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-slate-400">Ticket Promedio</p>
                <p className="dark:text-white font-medium">
                  $ {formatPrice(business.avgTicket)}
                </p>
              </div>
              <hr className="border-slate-700 mb-3" />
              <p className="text-sm text-slate-400 mb-2">Métodos de Pago</p>
              <div className="bg-green-100 dark:bg-green-900 rounded px-2 py-1 text-[12px] mb-2">
                <p className="text-slate-700 dark:text-slate-300">Efectivo</p>
                <p className="font-bold text-slate-800 dark:text-slate-50">
                  $ {business.paymentMethods.cash.toLocaleString("en-US")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-100 dark:bg-blue-900 rounded px-2 py-1 text-[12px]">
                  <p className="text-slate-700 dark:text-slate-300">Tarjetas</p>
                  <p className="font-bold text-slate-800 dark:text-slate-50">
                    $ {formatNumberAbbreviation(business.paymentMethods.card)}
                  </p>
                </div>
                <div className="bg-sky-100 dark:bg-sky-900 rounded px-2 py-1 text-[12px]">
                  <p className="text-slate-700 dark:text-slate-300">
                    Mercadopago
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-50">
                    ${" "}
                    {formatNumberAbbreviation(
                      business.paymentMethods.mercadopago
                    )}
                  </p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900 rounded px-2 py-1 text-[12px]">
                  <p className="text-slate-700 dark:text-slate-300">Rappi</p>
                  <p className="font-bold text-slate-800 dark:text-slate-50">
                    $ {formatNumberAbbreviation(business.paymentMethods.rappi)}
                  </p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900 rounded px-2 py-1 text-[12px]">
                  <p className="text-slate-700 dark:text-slate-300">
                    Transferencia
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-50">
                    ${" "}
                    {formatNumberAbbreviation(business.paymentMethods.transfer)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sección Top Productos */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold mb-2 sm:mb-0">Más vendidos</h2>
          <div className="flex gap-4">
            <select
              className="input max-w-xs p-2 rounded shadow-sm border"
              value={selectedBusinessForTopProducts}
              onChange={(e) => {
                setSelectedBusinessForTopProducts(e.target.value);
                setDirectSales([]); // Reiniciar ventas al cambiar negocio
              }}
            >
              <option value="">Selecciona un negocio</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
            <select
              className="input max-w-xs p-2 rounded shadow-sm border"
              value={daysFilter}
              onChange={(e) => setDaysFilter(Number(e.target.value))}
            >
              <option value={3}>Últimos 3 días</option>
              <option value={7}>Últimos 7 días</option>
              <option value={14}>Últimos 14 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
            <div className="w-[500px]">
              <MultiSelectDropdown
                options={allCategoryOptions}
                selectedOptions={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="Filtrar por categorías"
              />
            </div>
          </div>
        </div>

        <div className="card bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md">
          <div className="table-container overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Producto
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Negocio
                  </th>
                  <SortableHeader
                    column="salesCount"
                    label="Unidades Vendidas"
                  />
                  <SortableHeader
                    column="totalRevenue"
                    label="Monto Facturado"
                  />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {selectedBusinessForTopProducts === "" ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Por favor, selecciona un negocio para ver los productos
                      más vendidos.
                    </td>
                  </tr>
                ) : directSalesLoading || dbProductsLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Cargando productos...
                    </td>
                  </tr>
                ) : topProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No se encontraron productos en este rango de fechas con
                      los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((item, idx) => {
                    const business = businesses.find(
                      (b) => b.id === item.businessId
                    );
                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                          {item.productName}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {business?.name || "Desconocido"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {item.totalQuantity}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          ${" "}
                          {Number(item.totalRevenue).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sección Turnos Activos */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Turnos Activos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeShifts.map((shift) => {
            const shiftTotals = calculateShiftTotals(shift);
            const employee = employees.find(
              (emp) => emp.id === shift.employee_id
            );
            return (
              <div
                key={shift.id}
                className="card bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {employee ? employee.name : shift.employee_id}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {shift.business_name}
                    </p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded dark:bg-green-900 dark:text-green-300">
                    Activo
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Iniciado:{" "}
                    <span className="font-medium">
                      {new Date(shift.start_time).toLocaleString()}
                    </span>
                  </p>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ventas Totales:
                  </p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    $ {formatPrice(shiftTotals.totalSales)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Métodos de Pago
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className={`col-span-2 ${getPaymentMethodClass("cash")}`}
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Efectivo
                      </p>
                      <p className="font-medium">
                        ${formatPrice(shiftTotals.paymentMethods.cash)}
                      </p>
                    </div>
                    <div className={getPaymentMethodClass("card")}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Tarjetas
                      </p>
                      <p className="font-medium">
                        ${formatPrice(shiftTotals.paymentMethods.card)}
                      </p>
                    </div>
                    <div className={getPaymentMethodClass("mercadopago")}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Mercadopago
                      </p>
                      <p className="font-medium">
                        ${formatPrice(shiftTotals.paymentMethods.mercadopago)}
                      </p>
                    </div>
                    <div className={getPaymentMethodClass("rappi")}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Rappi
                      </p>
                      <p className="font-medium">
                        ${formatPrice(shiftTotals.paymentMethods.rappi)}
                      </p>
                    </div>
                    <div className={getPaymentMethodClass("transfer")}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Transferencia
                      </p>
                      <p className="font-medium">
                        ${formatPrice(shiftTotals.paymentMethods.transfer)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {activeShifts.length === 0 && (
            <div className="col-span-full text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No hay turnos activos en este momento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
