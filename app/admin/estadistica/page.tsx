"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { supabase } from "@/lib/supabase";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

// Helper: Formato local "YYYY-MM-DD"
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: Extraer fecha y forzar T12:00:00 para evitar desfases horarios
function parseDateForDisplay(dateStr: string) {
  const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  return new Date(datePart + "T12:00:00");
}

/**
 * Función genérica para traer datos paginados.
 */
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

// Cargar lista de negocios
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

// Cargar ventas, gastos, turnos y empleados para un negocio
async function loadSales(businessId: string): Promise<any[]> {
  return await fetchAllPaginated((from, to) =>
    supabase
      .from("sales")
      .select("*")
      .eq("business_id", businessId)
      .order("timestamp", { ascending: false })
      .range(from, to)
  );
}

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

async function loadEmployees(businessId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, name")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) {
    console.error("Error loading employees:", error);
    return [];
  }
  return data || [];
}

export default function StatisticsPage() {
  // Estados generales
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Filtros locales
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<Date>(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  );

  // Cargar negocios al montar el componente
  useEffect(() => {
    const loadData = async () => {
      const biz = await loadBusinesses();
      setBusinesses(biz);
    };
    loadData();
  }, []);

  // Al cambiar el negocio seleccionado, cargar datos
  useEffect(() => {
    const loadBusinessData = async () => {
      if (!selectedBusinessId) return;
      setLoading(true);
      try {
        const [sal, exp, shi, emp] = await Promise.all([
          loadSales(selectedBusinessId),
          loadExpenses(selectedBusinessId),
          loadShifts(selectedBusinessId),
          loadEmployees(selectedBusinessId),
        ]);
        setSales(sal);
        setExpenses(exp);
        setShifts(shi);
        setEmployees(emp);
      } catch (error) {
        console.error("Error al cargar datos para el negocio seleccionado:", error);
      } finally {
        setLoading(false);
      }
    };
    loadBusinessData();
  }, [selectedBusinessId]);

  // Cálculos para el mes seleccionado
  const selectedYear = selectedMonth.getFullYear();
  const selectedMonthIndex = selectedMonth.getMonth();
  const daysInMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) =>
    new Date(selectedYear, selectedMonthIndex, i + 1)
  );

  const isSameDate = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  // Filtrado de datos para el mes actual
  const filteredSales = sales.filter((sale) => {
    const saleDate = new Date(sale.timestamp);
    return (
      saleDate.getFullYear() === selectedYear &&
      saleDate.getMonth() === selectedMonthIndex
    );
  });

  const filteredExpenses = expenses.filter((expense) => {
    const expenseDate = parseDateForDisplay(expense.date);
    return (
      expenseDate.getFullYear() === selectedYear &&
      expenseDate.getMonth() === selectedMonthIndex
    );
  });

  const filteredShifts = shifts.filter((shift) => {
    const shiftDate = new Date(shift.start_time);
    return (
      shiftDate.getFullYear() === selectedYear &&
      shiftDate.getMonth() === selectedMonthIndex
    );
  });

  // Estadísticas diarias
  const dailyStats = daysArray.map((day) => {
    const salesForDay = filteredSales.filter((sale) =>
      isSameDate(new Date(sale.timestamp), day)
    );
    const expensesForDay = filteredExpenses.filter((expense) =>
      isSameDate(parseDateForDisplay(expense.date), day)
    );
    const totalSales = salesForDay.reduce((sum, sale) => sum + sale.total, 0);
    const totalExpenses = expensesForDay.reduce((sum, expense) => sum + expense.amount, 0);
    return {
      date: day,
      salesCount: salesForDay.length,
      totalSales,
      totalExpenses,
      net: totalSales - totalExpenses,
    };
  });

  const formatPrice = (num: number): string =>
    num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const totalSalesSum = dailyStats.reduce((sum, stat) => sum + stat.totalSales, 0);

  // Configuración común para ejes en dark mode
  const axisTickColorDark = "#f9fafb";

  // Gráfico: Ventas por Horas (barra vertical)
  const chartData = useMemo(() => {
    const hoursArray = Array.from({ length: 24 }, (_, i) => i);
    const hourlySales = hoursArray.map((hour) =>
      filteredSales.reduce((sum, sale) => {
        const saleDate = new Date(sale.timestamp);
        return saleDate.getHours() === hour ? sum + sale.total : sum;
      }, 0)
    );
    return {
      labels: hoursArray.map((h) => `${h}:00`),
      datasets: [
        {
          label: "Ventas por Hora",
          data: hourlySales,
          backgroundColor: "rgba(16, 185, 129, 0.6)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1,
        },
      ],
    };
  }, [filteredSales]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: false, labels: { color: axisTickColorDark } },
        title: { display: false },
      },
      scales: {
        x: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
        y: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
      },
    }),
    [axisTickColorDark]
  );

  // Gráfico: Ticket Promedio por Día (line chart) – se mantiene en su lugar
  const ticketChartData = useMemo(() => {
    const labels = daysArray.map((day) => day.getDate().toString());
    const avgTicket = dailyStats.map((stat) =>
      stat.salesCount > 0 ? stat.totalSales / stat.salesCount : 0
    );
    return {
      labels,
      datasets: [
        {
          label: "Ticket Promedio por Día",
          data: avgTicket,
          backgroundColor: "rgba(59, 130, 246, 0.5)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    };
  }, [daysArray, dailyStats]);

  const ticketChartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: false, labels: { color: axisTickColorDark } },
        title: { display: false },
      },
      scales: {
        x: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
        y: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
      },
    }),
    [axisTickColorDark]
  );

  // Gráfico: Facturación Promedio por Día (del Mes Actual) – vertical
  const avgRevenueByDayChart = useMemo(() => {
    // Agrupamos las ventas de cada día (tomando dailyStats) según el día de la semana
    const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const revenueByDay: { [key: string]: { total: number; count: number } } = {
      Lunes: { total: 0, count: 0 },
      Martes: { total: 0, count: 0 },
      Miércoles: { total: 0, count: 0 },
      Jueves: { total: 0, count: 0 },
      Viernes: { total: 0, count: 0 },
      Sábado: { total: 0, count: 0 },
      Domingo: { total: 0, count: 0 },
    };

    dailyStats.forEach((stat) => {
      const dayNumber = stat.date.getDay(); // 0 = Domingo, 1 = Lunes, etc.
      let dayLabel = "";
      switch (dayNumber) {
        case 0:
          dayLabel = "Domingo";
          break;
        case 1:
          dayLabel = "Lunes";
          break;
        case 2:
          dayLabel = "Martes";
          break;
        case 3:
          dayLabel = "Miércoles";
          break;
        case 4:
          dayLabel = "Jueves";
          break;
        case 5:
          dayLabel = "Viernes";
          break;
        case 6:
          dayLabel = "Sábado";
          break;
        default:
          dayLabel = "Desconocido";
      }
      revenueByDay[dayLabel].total += stat.totalSales;
      revenueByDay[dayLabel].count++;
    });

    const labels = daysOfWeek;
    const avgRevenue = labels.map((day) => {
      const { total, count } = revenueByDay[day];
      return count > 0 ? total / count : 0;
    });

    return {
      labels,
      datasets: [
        {
          label: "Facturación Promedio",
          data: avgRevenue,
          backgroundColor: "rgba(255, 99, 132, 0.6)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
        },
      ],
    };
  }, [dailyStats]);

  const avgRevenueByDayOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: false, labels: { color: axisTickColorDark } },
        title: { display: false },
      },
      scales: {
        x: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
        y: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
      },
    }),
    [axisTickColorDark]
  );

  // Gráfico: Promedio de Facturación por Turno (por empleado) – barras horizontales  
  // Se agrupa por employee_id y se calcula el promedio de las ventas totales en cada turno.
  const avgRevenueByEmployeeChart = useMemo(() => {
    const revenueByEmployee: { [key: string]: number[] } = {};
    filteredShifts.forEach((shift) => {
      const shiftSales = filteredSales.filter((sale) => sale.shift_id === shift.id);
      const shiftTotalSales = shiftSales.reduce((sum, sale) => sum + sale.total, 0);
      const empId = shift.employee_id;
      if (!revenueByEmployee[empId]) {
        revenueByEmployee[empId] = [];
      }
      revenueByEmployee[empId].push(shiftTotalSales);
    });
    const labels: string[] = [];
    const avgRevenueData: number[] = [];
    for (const empId in revenueByEmployee) {
      const empRecord = employees.find((e) => e.id === empId);
      const employeeName = empRecord ? empRecord.name : empId;
      labels.push(employeeName);
      const revenues = revenueByEmployee[empId];
      const avg = revenues.reduce((a, b) => a + b, 0) / revenues.length;
      avgRevenueData.push(avg);
    }
    return {
      labels,
      datasets: [
        {
          label: "Promedio de Facturación",
          data: avgRevenueData,
          backgroundColor: "rgba(75, 192, 192, 0.6)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
        },
      ],
    };
  }, [filteredShifts, filteredSales, employees]);

  const avgRevenueByEmployeeOptionsHorizontal = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false, labels: { color: axisTickColorDark } },
        title: { display: false },
      },
      scales: {
        x: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
        y: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
      },
    }),
    [axisTickColorDark]
  );

  // Navegación entre meses
  const handlePrevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(selectedYear, selectedMonthIndex + 1, 1);
    if (nextMonth <= new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)) {
      setSelectedMonth(nextMonth);
    }
  };

  const isNextDisabled =
    new Date(selectedYear, selectedMonthIndex + 1, 1) >
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  const handleBusinessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBusinessId(e.target.value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Cargando estadísticas para el negocio...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          Estadísticas del Mes
        </h1>
        <p className="text-slate-600 dark:text-slate-300">
          Revisa el flujo neto diario, las ventas y gastos, y otros indicadores.
        </p>
      </header>

      {/* Filtros: Negocio y navegación de mes */}
      <div className="app-card p-4 rounded-lg shadow bg-white dark:bg-gray-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="businessSelect" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Selecciona un Negocio:
            </label>
            <select
              id="businessSelect"
              className="input"
              value={selectedBusinessId}
              onChange={handleBusinessChange}
            >
              <option value="">Selecciona un negocio</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="btn btn-secondary" title="Mes Anterior">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              {selectedMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
            <button onClick={handleNextMonth} className="btn btn-secondary" title="Mes Siguiente" disabled={isNextDisabled}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {selectedBusinessId === "" ? (
        <div className="p-4 text-center text-lg text-slate-600 dark:text-slate-300">
          No hay estadísticas hasta que selecciones un negocio.
        </div>
      ) : (
        <>
          {/* Primera Tabla: Fecha, Ventas, Costo de Reposición Aproximado y Neto Proyectado */}
          <div className="w-full overflow-x-auto shadow-lg rounded-lg bg-white dark:bg-slate-800 mb-8">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-blue-100 dark:bg-blue-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium border text-slate-800 dark:text-slate-200">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-medium border text-slate-800 dark:text-slate-200">Ventas</th>
                  <th className="px-4 py-3 text-left text-sm font-medium border text-slate-800 dark:text-slate-200">Costo de Reposición Aproximado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium border text-slate-800 dark:text-slate-200">Neto Proyectado</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-600 text-slate-800 dark:text-slate-200">
                {dailyStats.map((stat, index) => {
                  const reposicionCost = stat.salesCount > 0 ? stat.totalSales / 1.5 : 0;
                  const netoProyectado = stat.totalSales - reposicionCost;
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2 border">{stat.date.toLocaleDateString()}</td>
                      <td className="px-4 py-2 border">
                        <span className="font-bold text-green-700">${formatPrice(stat.totalSales)}</span>
                      </td>
                      <td className="px-4 py-2 border">
                        <span className="text-orange-600">${formatPrice(reposicionCost)}</span>
                      </td>
                      <td className="px-4 py-2 border">
                        <span className={netoProyectado >= 0 ? "text-green-700" : "text-red-700"}>
                          ${formatPrice(netoProyectado)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-blue-50 dark:bg-blue-800 text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="px-4 py-2 font-medium border">Totales:</td>
                  <td className="px-4 py-2 font-medium border">
                    <span className="font-bold text-green-700">${formatPrice(totalSalesSum)}</span>
                  </td>
                  <td className="px-4 py-2 font-medium border">
                    <span className="text-orange-600">${formatPrice(totalSalesSum / 1.5)}</span>
                  </td>
                  <td className="px-4 py-2 font-medium border">
                    <span className={totalSalesSum - (totalSalesSum / 1.5) >= 0 ? "text-green-700" : "text-red-700"}>
                      ${formatPrice(totalSalesSum - (totalSalesSum / 1.5))}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Segunda Tabla: Ventas y Gastos (detalle por día) */}
          <div className="w-full overflow-x-auto shadow-lg rounded-lg bg-white dark:bg-slate-800 mb-8">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-blue-100 dark:bg-blue-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium border text-slate-800 dark:text-slate-200">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-medium border text-slate-800 dark:text-slate-200">Ventas</th>
                  <th className="px-4 py-3 text-left text-sm font-medium border text-slate-800 dark:text-slate-200">Gastos (detallado por ítem)</th>
                  <th className="px-4 py-3 text-left text-sm font-medium border text-slate-800 dark:text-slate-200">Neto</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-600 text-slate-800 dark:text-slate-200">
                {daysArray.map((day, index) => {
                  const salesForDay = filteredSales.filter((sale) => isSameDate(new Date(sale.timestamp), day));
                  const totalSales = salesForDay.reduce((sum, sale) => sum + sale.total, 0);
                  const expensesForDay = filteredExpenses.filter((expense) => isSameDate(parseDateForDisplay(expense.date), day));
                  const totalExpenses = expensesForDay.reduce((sum, expense) => sum + expense.amount, 0);
                  const neto = totalSales - totalExpenses;
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2 border">{day.toLocaleDateString()}</td>
                      <td className="px-4 py-2 border">
                        <span className="font-bold text-green-700">${formatPrice(totalSales)}</span>
                      </td>
                      <td className="px-4 py-2 border">
                        {expensesForDay.length > 0 ? (
                          <ul className="list-disc pl-4 text-xs">
                            {expensesForDay.map((expense) => (
                              <li key={expense.id}>
                                {expense.description ? expense.description : "Sin descripción"}: ${formatPrice(expense.amount)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-sm italic">Sin gastos</span>
                        )}
                      </td>
                      <td className="px-4 py-2 border">
                        <span className={neto >= 0 ? "text-green-700" : "text-red-700"}>
                          ${formatPrice(neto)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-blue-50 dark:bg-blue-800 text-slate-800 dark:text-slate-200">
                {(() => {
                  const globalSales = daysArray.reduce((acc, day) => {
                    const daySales = filteredSales
                      .filter((sale) => isSameDate(new Date(sale.timestamp), day))
                      .reduce((sum, sale) => sum + sale.total, 0);
                    return acc + daySales;
                  }, 0);
                  const globalExpenses = daysArray.reduce((acc, day) => {
                    const dayExpenses = filteredExpenses
                      .filter((expense) => isSameDate(parseDateForDisplay(expense.date), day))
                      .reduce((sum, expense) => sum + expense.amount, 0);
                    return acc + dayExpenses;
                  }, 0);
                  const globalNeto = globalSales - globalExpenses;
                  return (
                    <tr>
                      <td className="px-4 py-2 font-medium border">Totales:</td>
                      <td className="px-4 py-2 font-medium border">
                        <span className="font-bold text-green-700">${formatPrice(globalSales)}</span>
                      </td>
                      <td className="px-4 py-2 font-medium border">
                        <span className="text-orange-600">${formatPrice(globalExpenses)}</span>
                      </td>
                      <td className="px-4 py-2 font-medium border">
                        <span className={globalNeto >= 0 ? "text-green-700" : "text-red-700"}>
                          ${formatPrice(globalNeto)}
                        </span>
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>

          {/* Gráfico de Ticket Promedio por Día (line chart) – se mantiene donde estaba */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Ticket Promedio por Día
            </h2>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <Line data={ticketChartData} options={ticketChartOptions} />
            </div>
          </div>

          {/* Sección: Todos los Gráficos de Barra al final */}
          <div className="mt-8 space-y-6">
            <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Gráficos de Barra</h2>

            {/* Gráfico: Ventas por Horas */}
            <div>
              <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-2">Ventas por Horas</h3>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Fila con dos gráficos en paralelo */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Izquierda: Facturación Promedio por Día (del Mes Actual) */}
              <div className="w-full md:w-1/2">
                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-2">
                  Facturación Promedio por Día (del Mes Actual)
                </h3>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                  <Bar data={avgRevenueByDayChart} options={avgRevenueByDayOptions} />
                </div>
              </div>
              {/* Derecha: Promedio de Facturación por Turno (por empleado) en barras horizontales */}
              <div className="w-full md:w-1/2">
                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-2">
                  Promedio de Facturación por Turno (por empleado)
                </h3>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                  <Bar data={avgRevenueByEmployeeChart} options={avgRevenueByEmployeeOptionsHorizontal} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
