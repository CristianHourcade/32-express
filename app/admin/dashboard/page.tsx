"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

/* ========= COMPONENTE: MultiSelectDropdown ========= */
function MultiSelectDropdown({
  options,
  selectedOptions,
  onChange,
  placeholder = "Categorias",
}: {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (option: string) => {
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter((o) => o !== option)
      : [...selectedOptions, option];
    onChange(newSelected);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input max-w-[100px] rounded shadow-sm border bg-white text-xs"
      >
        {selectedOptions.length > 0 ? selectedOptions.join(", ") : "Categorias"}
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 shadow-lg border rounded w-full min-w-[200px]">
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
      if (data.length < pageSize) done = true;
      else page++;
    } else {
      done = true;
    }
  }
  return allData;
}

/* ========= FETCH FUNCTIONS ========= */
const loadBusinesses = async () => {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("name");
  if (error) {
    console.error("Error loading businesses:", error);
    return [];
  }
  return data || [];
};

const loadSales = async (businessId: string) =>
  fetchAllPaginated((from, to) =>
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

const loadProducts = async (businessId: string) =>
  fetchAllPaginated((from, to) =>
    supabase.from("products").select("*").eq("business_id", businessId).range(from, to)
  );

const loadExpenses = async (businessId: string) =>
  fetchAllPaginated((from, to) =>
    supabase
      .from("expenses")
      .select("*")
      .eq("business_id", businessId)
      .order("date", { ascending: false })
      .range(from, to)
  );

const loadShifts = async (businessId: string) =>
  fetchAllPaginated((from, to) =>
    supabase
      .from("shifts")
      .select("*")
      .eq("business_id", businessId)
      .order("start_time", { ascending: false })
      .range(from, to)
  );

/* ========= UTILIDADES ========= */
const formatNumberAbbreviation = (num: number) => {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "k";
  return sign + abs.toFixed(0);
};

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

function extractCategory(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length > 1 && categories.includes(parts[0].toUpperCase())) {
    return { category: parts[0].toUpperCase(), baseName: parts.slice(1).join(" ") };
  }
  return { category: null, baseName: name };
}

/* ========= DASHBOARD ========= */
export default function AdminDashboard() {
  /* ---------- ESTADOS ---------- */
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  /* Top productos */
  const [directSales, setDirectSales] = useState<any[]>([]);
  const [directSalesLoading, setDirectSalesLoading] = useState(false);
  const [selectedBusinessForTopProducts, setSelectedBusinessForTopProducts] =
    useState("");
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbProductsLoading, setDbProductsLoading] = useState(false);
  const [daysFilter, setDaysFilter] = useState(7);
  const [itemsLimit, setItemsLimit] = useState(20);

  const allCategoryOptions = [...categories, "SIN CATEGORIA"];
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [sortColumn, setSortColumn] = useState<"salesCount" | "totalRevenue">(
    "salesCount"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [isLoading, setIsLoading] = useState(true);

  const formatPrice = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---------- CARGA INICIAL ---------- */
  useEffect(() => {
    (async () => {
      try {
        const biz = await loadBusinesses();
        setBusinesses(biz);

        let allSales: any[] = [];
        let allExpenses: any[] = [];
        let allShifts: any[] = [];

        await Promise.all(
          biz.map(async (b) => {
            const [s, e, sh] = await Promise.all([
              loadSales(b.id),
              loadExpenses(b.id),
              loadShifts(b.id),
            ]);
            allSales = allSales.concat(s);
            allExpenses = allExpenses.concat(e);
            allShifts = allShifts.concat(sh);
          })
        );

        setSales(allSales);
        setExpenses(allExpenses);
        setShifts(allShifts);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("name");
      if (error) console.error(error);
      else setEmployees(data || []);
    })();
  }, []);

  /* ---------- VENTAS & PRODUCTOS (negocio seleccionado) ---------- */
  useEffect(() => {
    if (!selectedBusinessForTopProducts) return;
    (async () => {
      setDirectSalesLoading(true);
      setDirectSales(await loadSales(selectedBusinessForTopProducts));
      setDirectSalesLoading(false);
    })();
  }, [selectedBusinessForTopProducts]);

  useEffect(() => {
    if (!selectedBusinessForTopProducts) {
      setDbProducts([]);
      return;
    }
    (async () => {
      setDbProductsLoading(true);
      setDbProducts(await loadProducts(selectedBusinessForTopProducts));
      setDbProductsLoading(false);
    })();
  }, [selectedBusinessForTopProducts]);

  /* ---------- TOP PRODUCTOS ---------- */
  const topProducts = useMemo(() => {
    const now = new Date();
    const recentSales = directSales.filter(
      (s) =>
        (now.getTime() - new Date(s.timestamp).getTime()) / (1000 * 3600 * 24) <=
        daysFilter
    );

    const map = new Map<
      string,
      {
        productName: string;
        businessId: string;
        stock: number | null;
        totalQuantity: number;
        unitPrice: number;
        totalRevenue: number;
      }
    >();

    recentSales.forEach((sale) => {
      sale.sale_items?.forEach((item: any) => {
        const prod = dbProducts.find((p) => p.id === item.product_id);
        if (!prod) return;

        const key = `${item.product_id}-${prod.business_id}`;
        if (!map.has(key)) {
          map.set(key, {
            productName: item.products?.name || "Producto desconocido",
            businessId: prod.business_id,
            stock: prod.stock ?? prod.current_stock ?? prod.quantity ?? null,
            unitPrice:prod.selling_price,
            totalQuantity: 0,
            totalRevenue: 0,
          });
        }

        const entry = map.get(key)!;
        entry.totalQuantity += item.quantity;
        entry.totalRevenue += item.total;
      });
    });

    let arr = Array.from(map.values());

    if (selectedCategories.length) {
      arr = arr.filter((p) => {
        const { category } = extractCategory(p.productName);
        return category
          ? selectedCategories.includes(category)
          : selectedCategories.includes("SIN CATEGORIA");
      });
    }

    arr.sort((a, b) => {
      const diff =
        sortColumn === "salesCount"
          ? a.totalQuantity - b.totalQuantity
          : a.totalRevenue - b.totalRevenue;
      return sortDirection === "asc" ? diff : -diff;
    });

    return arr.slice(0, itemsLimit);
  }, [
    directSales,
    dbProducts,
    daysFilter,
    selectedCategories,
    sortColumn,
    sortDirection,
    itemsLimit,
  ]);

  /* ---------- MÉTRICAS MENSUALES NEGOCIOS ---------- */
  const businessesWithMonthlyData = useMemo(() => {
    const map = new Map<
      string,
      {
        tx: number;
        amount: number;
        expense: number;
        payments: Record<
          "cash" | "card" | "transfer" | "mercadopago" | "rappi",
          number
        >;
      }
    >();
    businesses.forEach((b) =>
      map.set(b.id, {
        tx: 0,
        amount: 0,
        expense: 0,
        payments: { cash: 0, card: 0, transfer: 0, mercadopago: 0, rappi: 0 },
      })
    );

    const today = new Date();
    const m = today.getMonth();
    const y = today.getFullYear();

    sales.forEach((s) => {
      const d = new Date(s.timestamp);
      if (d.getMonth() === m && d.getFullYear() === y) {
        const data = map.get(s.business_id);
        if (!data) return;
        data.tx++;
        data.amount += s.total;
        if (s.payment_method in data.payments)
          data.payments[s.payment_method] += s.total;
      }
    });

    expenses.forEach((e) => {
      const d = new Date(e.date);
      if (d.getMonth() === m && d.getFullYear() === y) {
        const data = map.get(e.business_id);
        if (data) data.expense += e.amount;
      }
    });

    return businesses.map((b) => {
      const d = map.get(b.id)!;
      return {
        ...b,
        transactions: d.tx,
        totalAmount: d.amount,
        totalExpense: d.expense,
        profit: d.amount - d.expense,
        avgTicket: d.tx ? d.amount / d.tx : 0,
        paymentMethods: d.payments,
      };
    });
  }, [businesses, sales, expenses]);

  /* ---------- TURNOS & UTIL ---------- */
  const calcShiftTotals = (shift: any) => {
    const sSales = sales.filter((s) => s.shift_id === shift.id);
    const payments = { cash: 0, card: 0, transfer: 0, mercadopago: 0, rappi: 0 };
    sSales.forEach((s) => {
      if (s.payment_method in payments) payments[s.payment_method] += s.total;
    });
    const total = Object.values(payments).reduce((sum, n) => sum + n, 0);
    return { payments, total };
  };

  const pmClass = (m: string) =>
  ({
    cash: "bg-green-100 dark:bg-green-900 p-2 rounded",
    card: "bg-blue-100 dark:bg-blue-900 p-2 rounded",
    transfer: "bg-purple-100 dark:bg-purple-900 p-2 rounded",
    mercadopago: "bg-sky-100 dark:bg-sky-900 p-2 rounded",
    rappi: "bg-orange-100 dark:bg-orange-900 p-2 rounded",
  }[m] || "bg-gray-100 dark:bg-gray-700 p-2 rounded");

  /* ---------- SORTABLE HEADER ---------- */
  const SortableHeader = ({
    column,
    label,
  }: {
    column: "salesCount" | "totalRevenue";
    label: string;
  }) => (
    <th
      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700"
      onClick={() => {
        if (sortColumn === column) {
          setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
          setSortColumn(column);
          setSortDirection("desc");
        }
      }}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortColumn === column && (sortDirection === "asc" ? "↑" : "↓")}
      </span>
    </th>
  );

  /* ---------- LOADING ---------- */
  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Cargando datos del dashboard...
          </p>
        </div>
      </div>
    );

  const activeShifts = (Array.isArray(shifts) ? shifts : [])
    .filter((s) => !s.end_time)
    .sort((a, b) => calcShiftTotals(b).total - calcShiftTotals(a).total);

  /* ---------- RENDER ---------- */
  const currentMonthName = new Date().toLocaleString("es-ES", { month: "long" });
  const monthHeader =
    "Negocios – Mes " +
    currentMonthName.charAt(0).toUpperCase() +
    currentMonthName.slice(1);

  return (
    <div className="space-y-6 p-4">
      {/* ==================== NEGOCIOS ==================== */}
      <section>
        <h1 className="text-2xl font-bold">Negocios</h1>
        <p className="text-slate-600 dark:text-slate-400">{monthHeader}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {businessesWithMonthlyData.map((b) => (
            <div
              key={b.id}
              className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-semibold mb-4 dark:text-white">
                {b.name}
              </h3>

              <div className="mb-2">
                <p className="text-sm text-slate-400">Ventas realizadas</p>
                <p className="font-medium dark:text-white">
                  {formatNumberAbbreviation(b.transactions)}
                </p>
              </div>

              <div className="mb-2">
                <p className="text-sm text-slate-400">Venta acumulada</p>
                <p className="font-medium dark:text-white">
                  $ {formatPrice(b.totalAmount)}
                </p>
              </div>

              <div className="mb-2">
                <p className="text-sm text-slate-400">Gasto acumulado</p>
                <p className="font-medium text-red-400">
                  $ {formatPrice(b.totalExpense)}
                </p>
              </div>

              <div className="mb-2">
                <p className="text-sm text-slate-400">Profit</p>
                <p className="font-bold text-lg text-green-600 dark:text-green-400">
                  $ {formatPrice(b.profit)}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-slate-400">Ticket Promedio</p>
                <p className="font-medium dark:text-white">
                  $ {formatPrice(b.avgTicket)}
                </p>
              </div>

              <hr className="border-slate-700 mb-3" />

              <p className="text-sm text-slate-400 mb-2">Métodos de Pago</p>

              <div className="bg-green-100 dark:bg-green-900 rounded px-2 py-1 text-[12px] mb-2">
                <p className="text-slate-700 dark:text-slate-300">Efectivo</p>
                <p className="font-bold text-slate-800 dark:text-slate-50">
                  $ {b.paymentMethods.cash.toLocaleString("en-US")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(["card", "mercadopago", "rappi", "transfer"] as const).map(
                  (m) => (
                    <div key={m} className={pmClass(m)}>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {m}
                      </p>
                      <p className="font-bold text-slate-800 dark:text-slate-50">
                        $ {formatNumberAbbreviation(b.paymentMethods[m])}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== TOP PRODUCTOS ==================== */}
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold mb-2 sm:mb-0">Más vendidos</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <select
              className="input max-w-[100px] text-xs p-2 rounded shadow-sm border"
              value={selectedBusinessForTopProducts}
              onChange={(e) => {
                setSelectedBusinessForTopProducts(e.target.value);
                setDirectSales([]);
              }}
            >
              <option value="">Negocio</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              className="input w-[200px] text-xs p-2 rounded shadow-sm border"
              value={daysFilter}
              onChange={(e) => setDaysFilter(Number(e.target.value))}
            >
              <option value={3}>Últimos 3 días</option>
              <option value={7}>Últimos 7 días</option>
              <option value={14}>Últimos 14 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>

            <MultiSelectDropdown
              options={allCategoryOptions}
              selectedOptions={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="Filtrar por categorías"
            />

            <select
              className="input max-w-[60px] text-xs p-2 rounded shadow-sm border"
              value={itemsLimit}
              onChange={(e) => setItemsLimit(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={100}>100</option>
            </select>
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
                    Precio
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Stock
                  </th>
                  <SortableHeader column="salesCount" label="Unidades Vendidas" />
                  <SortableHeader column="totalRevenue" label="Monto Facturado" />
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Negocio
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {selectedBusinessForTopProducts === "" ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Selecciona un negocio para ver los productos más vendidos.
                    </td>
                  </tr>
                ) : directSalesLoading || dbProductsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Cargando productos...
                    </td>
                  </tr>
                ) : topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Sin resultados para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((p) => {
                    const biz = businesses.find((b) => b.id === p.businessId);
                    return (
                      <tr
                        key={p.productName + p.businessId}
                        className="hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                          {p.productName}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                          $ {formatPrice(p.unitPrice)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {p.stock ?? "—"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {p.totalQuantity}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          <b className="text-green-700">
                          $ {formatPrice(p.totalRevenue)}
                          </b>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {biz?.name || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ==================== TURNOS ACTIVOS ==================== */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Turnos Activos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeShifts.map((shift) => {
            const { payments, total } = calcShiftTotals(shift);
            const emp = employees.find((e) => e.id === shift.employee_id);
            const hours =
              (Date.now() - new Date(shift.start_time).getTime()) / 36e5;
            const avgHour = hours > 0 ? total / hours : 0;

            return (
              <div
                key={shift.id}
                className="card bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{emp?.name || shift.employee_id}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {shift.business_name}
                    </p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded dark:bg-green-900 dark:text-green-300">
                    Activo
                  </span>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Iniciado:{" "}
                  <span className="font-medium">
                    {new Date(shift.start_time).toLocaleString()}
                  </span>
                </p>

                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ventas Totales:
                  </p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    $ {formatPrice(total)}
                  </p>
                </div>

                {/* Promedio por hora */}
                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Promedio / hora:
                  </p>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    $ {formatPrice(avgHour)}
                  </p>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Métodos de Pago
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`col-span-2 ${pmClass("cash")}`}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Efectivo
                    </p>
                    <p className="font-medium">$ {formatPrice(payments.cash)}</p>
                  </div>
                  {(["card", "mercadopago", "rappi", "transfer"] as const).map(
                    (m) => (
                      <div key={m} className={pmClass(m)}>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {m}
                        </p>
                        <p className="font-medium">$ {formatPrice(payments[m])}</p>
                      </div>
                    )
                  )}
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
      </section>
    </div>
  );
}
