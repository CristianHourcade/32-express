"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Banknote, Building2, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, Flame, Wallet } from "lucide-react";

/* ========= HELPERS DE FECHA ========= */
function monthRange(offset = 0) {
  // hoy (hora local)
  const today = new Date();

  // inicio del mes en hora **local**
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1, 0, 0, 0, 0);

  // fin exclusivo (primer día del mes siguiente, hora local)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);

  return { start, end };
}

const paymentColors = {
  Efectivo: "bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  Tarjeta: "bg-indigo-100/70 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100",
  Rappi: "bg-orange-100/70 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
  Transferencia: "bg-yellow-100/70 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100",
};

// Reemplazá la función actual
const formatPrice = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });


// Paleta por método de pago
const pmStyle: Record<"cash" | "card" | "rappi" | "transfer", string> = {
  cash: "bg-emerald-100/60 dark:bg-emerald-900/40",
  card: "bg-indigo-100/60 dark:bg-indigo-900/40",
  rappi: "bg-orange-100/60 dark:bg-orange-900/40",
  transfer: "bg-yellow-100/60 dark:bg-yellow-900/40",
};
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
    const next = selectedOptions.includes(option)
      ? selectedOptions.filter((o) => o !== option)
      : [...selectedOptions, option];
    onChange(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input max-w-[100px] rounded shadow-sm border bg-white text-xs"
      >
        {selectedOptions.length ? selectedOptions.join(", ") : placeholder}
      </button>

      {isOpen && (
        <div className="absolute z-[1990] mt-1 bg-white dark:bg-gray-800 shadow-lg border rounded w-full min-w-[200px]">
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <label
                key={opt}
                className="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(opt)}
                  onChange={() => toggleOption(opt)}
                  className="mr-2"
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ======== Utils locales ======== */
const fmtMoney = (n: number) => `$ ${formatPrice(n || 0)}`;
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const clamp = (v: number) => Math.max(0, Math.min(100, v));

const METHOD_META: Record<
  "cash" | "card" | "rappi" | "transfer" | "mercadopago" | "consumo",
  { label: string; short: string; barClass: string; dotClass: string }
> = {
  cash: { label: "Efectivo", short: "EF", barClass: "bg-emerald-500", dotClass: "bg-emerald-500" },
  card: { label: "Tarjeta", short: "TJ", barClass: "bg-indigo-500", dotClass: "bg-indigo-500" },
  rappi: { label: "Rappi", short: "RP", barClass: "bg-orange-500", dotClass: "bg-orange-500" },
  transfer: { label: "Transfer/MP", short: "TR", barClass: "bg-yellow-500", dotClass: "bg-yellow-500" },
  mercadopago: { label: "MP", short: "MP", barClass: "bg-sky-500", dotClass: "bg-sky-500" },
  consumo: { label: "Consumo", short: "CI", barClass: "bg-slate-400", dotClass: "bg-slate-400" },
};

function marginSemaforo(m: number) {
  if (m >= 40) return { pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", text: "🟢 Margen" };
  if (m >= 20) return { pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", text: "🟡 Margen" };
  return { pill: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", text: "🔴 Margen" };
}

/* ======== BusinessCard – Compacta + Expandible ======== */
function BusinessCard({
  b,
  open,
  onToggle,
}: { b: any; open: boolean; onToggle: () => void }) {

  // Totales
  const total = b.totalAmount ?? 0;
  const gastos = b.totalExpense ?? 0;
  const profit = total - gastos;
  const margin = total > 0 ? (profit / total) * 100 : 0;
  const tx = b.transactions ?? 0;
  const ticket = b.avgTicket ?? 0;

  // Combinar transferencia+MP para visual principal
  const payments = {
    cash: b.paymentMethods?.cash ?? 0,
    card: b.paymentMethods?.card ?? 0,
    rappi: b.paymentMethods?.rappi ?? 0,
    transfer: (b.paymentMethods?.transfer ?? 0) + (b.paymentMethods?.mercadopago ?? 0),
    consumo: b.paymentMethods?.consumo ?? 0,
  };
  const expensesByMethod = {
    cash: b.expensesByMethod?.cash ?? 0,
    card: b.expensesByMethod?.card ?? 0,
    rappi: b.expensesByMethod?.rappi ?? 0,
    transfer: (b.expensesByMethod?.transfer ?? 0) + (b.expensesByMethod?.mercadopago ?? 0),
    consumo: b.expensesByMethod?.consumo ?? 0,
  };

  // Barra apilada (solo proporción de ventas)
  const stackedKeys = ["cash", "card", "rappi", "transfer", "consumo"] as const;
  const segments = stackedKeys.map(k => ({
    key: k,
    value: payments[k],
    pct: clamp(pct(payments[k], total)),
    ...METHOD_META[k],
  }));

  // Método top para el detalle
  const top = stackedKeys
    .map(k => ({ k, label: METHOD_META[k].label, ventas: payments[k], gastos: expensesByMethod[k], profit: payments[k] - expensesByMethod[k] }))
    .sort((a, b) => b.ventas - a.ventas)[0];

  const profitColor = profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  const { pill, text } = marginSemaforo(margin);
  /* ——— KPIs – lectura de un golpe (ANTI-COLAPSE) ——— */
  function KPI({
    label,
    value,
    className = "",
  }: { label: string; value: React.ReactNode; className?: string }) {
    return (
      <div className="min-w-[150px]">
        <div className="text-[11px] text-slate-500 leading-none">{label}</div>
        <div className={`mt-1 text-sm font-semibold tabular-nums whitespace-nowrap leading-tight ${className}`}>
          {value}
        </div>
      </div>
    );
  }



  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
    >
      {/* Header compacto */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{b.name}</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${pill}`}>
            {text} {margin.toFixed(1)}%
          </span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} /* ... */>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* KPIs – lectura de un golpe */}
      <div className="mt-3 grid [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-2 items-end">
        <KPI label="Ventas" value={fmtMoney(total)} />
        <KPI label="Gastos" value={fmtMoney(gastos)} className="text-red-600 dark:text-red-400" />
        <KPI label="Profit" value={fmtMoney(profit)} className={profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
        <KPI label="Ticket" value={fmtMoney(ticket)} className="opacity-80" />
        <KPI label="N. Ventas" value={tx} className="opacity-80" />
        <KPI label="Rentab." value={`${margin.toFixed(1)}%`} className="opacity-80" />
      </div>

      {/* Barra apilada por método */}
      <div className="mt-4">
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {segments.map(s => s.pct > 0 && (
            <div
              key={s.key}
              className={`${s.barClass} h-full`}
              style={{ width: `${s.pct}%` }}
              title={`${s.label}: ${fmtMoney(s.value)} (${s.pct.toFixed(0)}%)`}
            />
          ))}
        </div>

        {/* Leyenda mínima */}
        <div className="mt-2 flex flex-wrap gap-2">
          {segments.filter(s => s.value > 0).map(s => (
            <span key={`legend-${s.key}`} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              <span className={`inline-block w-2 h-2 rounded ${s.dotClass}`} />
              {s.short}: {fmtMoney(s.value)}
            </span>
          ))}
        </div>
      </div>

      {/* ===== Detalle expandible ===== */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} mt-3`}>
        <div className="overflow-hidden">
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Método destacado */}
            <div className="sm:col-span-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Método destacado</span>
              <span className="text-xs font-medium">{top?.label ?? "—"}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
              <div className="text-[11px] text-slate-500">Ventas</div>
              <div className="font-semibold tabular-nums">{fmtMoney(top?.ventas ?? 0)}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
              <div className="text-[11px] text-slate-500">Gastos</div>
              <div className="font-semibold tabular-nums text-red-600 dark:text-red-400">{fmtMoney(top?.gastos ?? 0)}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
              <div className="text-[11px] text-slate-500">Profit</div>
              <div className={`font-semibold tabular-nums ${((top?.profit ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}`}>
                {fmtMoney(top?.profit ?? 0)}
              </div>
            </div>

            {/* Tabla mini por método */}
            <div className="sm:col-span-3 mt-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-slate-500">
                  <tr>
                    <th className="text-left py-1">Método</th>
                    <th className="text-right py-1">Ventas</th>
                    <th className="text-right py-1">Gastos</th>
                    <th className="text-right py-1">Profit</th>
                    <th className="text-right py-1">% Part.</th>
                  </tr>
                </thead>
                <tbody>
                  {stackedKeys.map(k => {
                    const ventas = payments[k];
                    const egres = expensesByMethod[k];
                    const pft = ventas - egres;
                    return (
                      <tr key={`row-${k}`} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="py-1">
                          <span className="inline-flex items-center gap-2">
                            <span className={`w-2 h-2 rounded ${METHOD_META[k].dotClass}`} />
                            {METHOD_META[k].label}
                          </span>
                        </td>
                        <td className="py-1 text-right tabular-nums">{fmtMoney(ventas)}</td>
                        <td className="py-1 text-right tabular-nums text-red-600 dark:text-red-400">{fmtMoney(egres)}</td>
                        <td className={`py-1 text-right tabular-nums ${pft >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{fmtMoney(pft)}</td>
                        <td className="py-1 text-right tabular-nums">{pct(ventas, total).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}



/* ========= FETCH HELPERS ========= */
async function fetchAllPaginated(
  queryFn: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const pageSize = 1000;
  let page = 0;
  let acc: any[] = [];
  for (; ;) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryFn(from, to);
    if (error) {
      console.error(error);
      break;
    }
    if (!data?.length) break;
    acc = acc.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return acc;
}

/* ========= QUERIES ========= */
const loadBusinesses = async () => {
  const { data, error } = await supabase.from("businesses").select("*").order("name");
  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
};

const loadSales = async (businessId: string, from: Date, to: Date) =>
  fetchAllPaginated((lo, hi) =>
    supabase
      .from("sales")
      .select("*") // sin joins
      .eq("business_id", businessId)
      .gte("timestamp", from.toISOString())
      .lt("timestamp", to.toISOString())
      .order("timestamp", { ascending: false })
      .range(lo, hi)
  );
const loadSaleItemsPorSaleIds = async (saleIds: string[]) => {
  const pageSize = 1000;
  const batches = [];

  for (let i = 0; i < saleIds.length; i += pageSize) {
    const batchIds = saleIds.slice(i, i + pageSize);
    batches.push(
      supabase
        .from("sale_items")
        .select("*, products(name)")
        .in("sale_id", batchIds)
    );
  }

  const results = await Promise.all(batches);
  return results.flatMap((r) => r.data || []);
};

const loadProducts = async (businessId: string) =>
  fetchAllPaginated((lo, hi) =>
    supabase.from("products").select("*").eq("business_id", businessId).range(lo, hi)
  );

const loadExpenses = async (businessId: string, from: Date, to: Date) =>
  fetchAllPaginated((lo, hi) =>
    supabase
      .from("expenses")
      .select("*")
      .eq("business_id", businessId)
      .gte("date", from.toISOString())
      .lt("date", to.toISOString())
      .order("date", { ascending: false })
      .range(lo, hi)
  );

const loadShifts = async (businessId: string, from: Date, to: Date) =>
  fetchAllPaginated((lo, hi) =>
    supabase
      .from("shifts")
      .select("*")
      .eq("business_id", businessId)
      .gte("start_time", from.toISOString())
      .lt("start_time", to.toISOString())
      .order("start_time", { ascending: false })
      .range(lo, hi)
  );

/* ========= OTRAS UTILIDADES ========= */
const formatNumberAbbrev = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : n.toFixed(0);

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
  "PROMO",
  "SIN CATEGORIA",
  "BRECA",
];

function extractCategory(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length > 1 && categories.includes(parts[0].toUpperCase()))
    return { category: parts[0].toUpperCase(), baseName: parts.slice(1).join(" ") };
  return { category: null, baseName: name };
}

/* ========= DASHBOARD ========= */
export default function AdminDashboard() {
  /* -------- MES SELECCIONADO -------- */
  const [monthOffset, setMonthOffset] = useState(0);
  const { start: monthStart, end: monthEnd } = useMemo(
    () => monthRange(monthOffset),
    [monthOffset]
  );
  // arriba, junto con otros estados
  const [allExpanded, setAllExpanded] = useState(false);

  /* -------- ESTADOS -------- */
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  /* Top productos */
  const [directSales, setDirectSales] = useState<any[]>([]);
  const [directSalesLoading, setDirectSalesLoading] = useState(false);
  const [selectedBusinessForTop, setSelectedBusinessForTop] = useState("");
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbProductsLoading, setDbProductsLoading] = useState(false);
  const [daysFilter, setDaysFilter] = useState(7);
  const [itemsLimit, setItemsLimit] = useState(20);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<"salesCount" | "totalRevenue">("salesCount");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);



  /* -------- CARGA GLOBAL DEL MES -------- */
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const biz = await loadBusinesses();
        setBusinesses(biz);

        let allSales: any[] = [];
        let allExpenses: any[] = [];
        let allShifts: any[] = [];

        await Promise.all(
          biz.map(async (b) => {
            const [s, e, sh] = await Promise.all([
              loadSales(b.id, monthStart, monthEnd),
              loadExpenses(b.id, monthStart, monthEnd),
              loadShifts(b.id, monthStart, monthEnd),
            ]);
            allSales = allSales.concat(s);
            allExpenses = allExpenses.concat(e);
            allShifts = allShifts.concat(sh);
          })
        );

        setSales(allSales);
        setExpenses(allExpenses);
        setShifts(allShifts);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [monthStart, monthEnd]);

  /* ---- EMPLEADOS (estático, no depende de mes) ---- */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) console.error(error);
      else setEmployees(data ?? []);
    })();
  }, []);

  /* -------- VENTAS & PRODUCTOS DEL NEGOCIO SELECCIONADO -------- */
  useEffect(() => {
    if (!selectedBusinessForTop) return;
    (async () => {
      setDirectSalesLoading(true);
      const sales = await loadSales(selectedBusinessForTop, monthStart, monthEnd);
      setDirectSales(sales);

      const saleIds = sales.map((s: any) => s.id);
      const items = await loadSaleItemsPorSaleIds(saleIds);

      // Merge: agregamos los items a su venta correspondiente
      const salesConItems = sales.map((s: any) => ({
        ...s,
        sale_items: items.filter((it) => it.sale_id === s.id),
      }));

      setDirectSales(salesConItems);
      setDirectSalesLoading(false);
    })();
  }, [selectedBusinessForTop, monthStart, monthEnd]);


  useEffect(() => {
    if (!selectedBusinessForTop) {
      setDbProducts([]);
      return;
    }
    (async () => {
      setDbProductsLoading(true);
      setDbProducts(await loadProducts(selectedBusinessForTop));
      setDbProductsLoading(false);
    })();
  }, [selectedBusinessForTop]);

  /* -------- TOP PRODUCTOS (memo) -------- */
  const topProducts = useMemo(() => {
    const now = Date.now();
    const recent = directSales.filter(
      (s) => (now - new Date(s.timestamp).getTime()) / 86400000 <= daysFilter
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

    recent.forEach((sale) => {
      sale.sale_items?.forEach((it: any) => {
        const prod = dbProducts.find((p) => p.id === it.product_id);
        if (!prod) return;
        const key = `${it.product_id}-${prod.business_id}`;
        if (!map.has(key)) {
          map.set(key, {
            productName: it.products?.name || "Sin nombre",
            businessId: prod.business_id,
            stock: prod.stock ?? prod.current_stock ?? prod.quantity ?? null,
            unitPrice: prod.selling_price,
            totalQuantity: 0,
            totalRevenue: 0,
          });
        }
        const entry = map.get(key)!;
        entry.totalQuantity += it.quantity;
        entry.totalRevenue += it.total;
      });
    });

    let arr = [...map.values()];

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

  /* -------- MÉTRICAS MENSUALES POR NEGOCIO -------- */
  const businessesWithMonthlyData = useMemo(() => {
    const base = new Map<
      string,
      {
        tx: number;
        amount: number;
        expense: number;
        payments: Record<"cash" | "card" | "transfer" | "mercadopago" | "rappi" | "consumo", number>;
        expensesByMethod: Record<"cash" | "card" | "transfer" | "mercadopago" | "rappi" | "consumo", number>;
      }
    >();

    businesses.forEach((b) =>
      base.set(b.id, {
        tx: 0,
        amount: 0,
        expense: 0,
        payments: { cash: 0, card: 0, transfer: 0, mercadopago: 0, rappi: 0, consumo: 0 },
        expensesByMethod: { cash: 0, card: 0, transfer: 0, mercadopago: 0, rappi: 0, consumo: 0 },
      })
    );


    sales.forEach((s) => {
      const d = base.get(s.business_id);
      if (!d) return;
      d.tx++;
      d.amount += s.total;
      if (s.payment_method in d.payments) d.payments[s.payment_method] += s.total;
    });

    expenses.forEach((e) => {
      const d = base.get(e.business_id);
      if (d) d.expense += e.amount;

      if (e.method && e.method in d.expensesByMethod)
        d.expensesByMethod[e.method] += e.amount;

    });

    return businesses.map((b) => {
      const d = base.get(b.id)!;
      return {
        ...b,
        transactions: d.tx,
        totalAmount: d.amount,
        totalExpense: d.expense,
        profit: d.amount - d.expense,
        avgTicket: d.tx ? d.amount / d.tx : 0,
        paymentMethods: d.payments,
        expensesByMethod: d.expensesByMethod,
      };
    });
  }, [businesses, sales, expenses]);

  /* -------- TURNOS -------- */
  const calcShiftTotals = (sh: any) => {
    const ss = sales.filter((s) => s.shift_id === sh.id);
    const pm = { cash: 0, card: 0, transfer: 0, mercadopago: 0, rappi: 0, consumo: 0 };
    ss.forEach((s) => {
      if (s.payment_method in pm) pm[s.payment_method] += s.total;
    });
    const total = Object.values(pm).reduce((a, n) => a + n, 0);
    return { payments: pm, total };
  };

  const pmClass = (m: string) =>
  ({
    cash: "bg-emerald-50 dark:bg-emerald-900/30 rounded-md",
    card: "bg-indigo-50 dark:bg-indigo-900/30 rounded-md",
    transfer: "bg-yellow-50 dark:bg-yellow-900/30 rounded-md",
    mercadopago: "bg-sky-50 dark:bg-sky-900/30 rounded-md",
    rappi: "bg-orange-50 dark:bg-orange-900/30 rounded-md",
    consumo: "",
  }[m] || "bg-gray-50 dark:bg-gray-800 rounded-md");


  const selectBase =
    "appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-full";
  /* -------- SORTABLE HEADER -------- */
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
        if (sortColumn === column) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        else {
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

  const activeShifts = shifts
    .filter((sh: any) => !sh.end_time)
    .sort((a: any, b: any) => calcShiftTotals(b).total - calcShiftTotals(a).total);

  /* -------- RENDER -------- */
  const monthLabel = monthStart.toLocaleString("es-ES", {
    month: "long",
    year: "numeric",
  });



  return (
    <div className="space-y-6 p-4">
      {/* =========== NEGOCIOS =========== */}

      <section className="mt-8">

        {/* —— Navegación de meses —— */}
        <header className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
                Resumen financiero
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ventas, gastos y rentabilidad de cada sucursal este mes.
              </p>
            </div>

            <div className="items-center gap-2">
              <button
                aria-label="Mes anterior"
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                onClick={() => setMonthOffset((o) => o - 1)}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {monthLabel}
              </span>

              <button
                aria-label="Mes siguiente"
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                onClick={() => setMonthOffset((o) => o + 1)}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

        </header>



        {/* —— Grid de negocios —— */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-2xl bg-slate-200/60 dark:bg-slate-700/30 animate-pulse"
              />
            ))}
          </div>
        ) : (
          // grilla de negocios (agregá key y pasá props open/onToggle)
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {businessesWithMonthlyData.map((b: any) => (
              <BusinessCard
                key={b.id}
                b={b}
                open={allExpanded}
                onToggle={() => setAllExpanded(v => !v)}
              />
            ))}
          </div>

        )}
      </section>

      {/* =========== TURNOS ACTIVOS =========== */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Turnos activos</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeShifts.map((sh) => {
            const { payments, total } = calcShiftTotals(sh);
            const emp = employees.find((e) => e.id === sh.employee_id);
            const hours = (Date.now() - new Date(sh.start_time).getTime()) / 36e5;
            const avgHr = hours > 0 ? total / hours : 0;

            // ► transfer + mercadopago
            const transferTotal =
              (payments.transfer ?? 0) + (payments.mercadopago ?? 0);

            return (
              <div
                key={sh.id}
                className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4 min-h-[260px]"
              >
                {/* — Header — */}
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {emp?.name || sh.employee_id}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{sh.business_name}</p>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                    Activo
                  </span>
                </div>

                {/* — Hora de inicio — */}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Iniciado:{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {new Date(sh.start_time).toLocaleString()}
                  </span>
                </p>

                {/* — Métricas — */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ventas totales</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      $ {formatPrice(total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Promedio / hora</p>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      $ {formatPrice(avgHr)}
                    </p>
                  </div>
                </div>

                {/* — Métodos de pago — */}
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Métodos de pago</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Efectivo", value: payments.cash, class: pmClass("cash") },
                      { label: "Tarjeta", value: payments.card, class: pmClass("card") },
                      { label: "Rappi", value: payments.rappi, class: pmClass("rappi") },
                      { label: "CONSUMO INTERNO", value: payments.consumo, class: pmClass("consumo") },
                      {
                        label: "Transferencia",
                        value: (payments.transfer ?? 0) + (payments.mercadopago ?? 0),
                        class: pmClass("transfer"),
                      },
                    ].map(({ label, value, class: cls }) => (
                      <div key={label} className={`${cls} flex justify-between items-center px-3 py-2 text-sm font-medium`}>
                        <span className="text-slate-700 dark:text-slate-300">{label}</span>
                        <span className="tabular-nums text-right text-slate-800 dark:text-white font-semibold">
                          $ {formatPrice(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            );
          })}

          {!activeShifts.length && (
            <div className="col-span-full text-center py-10 rounded-xl bg-slate-100/50 dark:bg-slate-800/40">
              <p className="text-slate-500 dark:text-slate-400">
                No hay turnos activos.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
