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

// Helper para obtener la fecha en formato "YYYY-MM-DD" (local)
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper para extraer la parte de la fecha y forzar una hora intermedia (T12:00:00)
function parseDateForDisplay(dateStr: string) {
  const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  return new Date(datePart + "T12:00:00");
}

/**
 * Función genérica para traer todos los datos paginados.
 * queryFn debe aceptar (from, to) y retornar una promesa con { data, error }.
 */
async function fetchAllPaginated(
  queryFn: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>
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

// Función para cargar la lista de negocios (normalmente de pocos registros)
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

// Funciones para cargar datos filtrados por el negocio seleccionado
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

// Función para obtener los empleados de un negocio (solo id y name)
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
  // Estados para almacenar datos desde Supabase
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Estados para los filtros locales
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<Date>(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  );

  // Cargar la lista de negocios al montar el componente
  useEffect(() => {
    const loadData = async () => {
      const biz = await loadBusinesses();
      setBusinesses(biz);
    };

    loadData();
  }, []);

  // Cada vez que se cambie el negocio seleccionado, se cargan ventas, gastos, turnos y empleados
  useEffect(() => {
    const loadBusinessData = async () => {
      if (!selectedBusinessId) return;
      setLoading(true);
      try {
        const [sal, exp, shi, emp] = await Promise.all([
          loadSales(selectedBusinessId),
          loadExpenses(selectedBusinessId),
          loadShifts(selectedBusinessId),
          loadEmployees(selectedBusinessId)
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

  // Filtrar los datos según el mes seleccionado
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
    const shiftsForDay = filteredShifts.filter((shift) =>
      isSameDate(new Date(shift.start_time), day)
    );
    const totalSales = salesForDay.reduce((sum, sale) => sum + sale.total, 0);
    const totalExpenses = expensesForDay.reduce((sum, expense) => sum + expense.amount, 0);
    return {
      date: day,
      salesCount: salesForDay.length,
      totalSales,
      totalExpenses,
      net: totalSales - totalExpenses,
      shifts: shiftsForDay,
    };
  });

  const formatPrice = (num: number): string =>
    num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const totalSalesSum = dailyStats.reduce((sum, stat) => sum + stat.totalSales, 0);
  const totalExpensesSum = dailyStats.reduce((sum, stat) => sum + stat.totalExpenses, 0);
  const totalNetSum = dailyStats.reduce((sum, stat) => sum + stat.net, 0);
  const totalSalesCount = dailyStats.reduce((sum, stat) => sum + stat.salesCount, 0);

  // Configuración de colores para dark mode
  const axisTickColorDark = "#f9fafb";

  // Gráfico: Ventas por Horas
  const chartData = useMemo(() => {
    const hoursArray = Array.from({ length: 24 }, (_, i) => i);
    const hourlySales = hoursArray.map((hour) => {
      const totalForHour = filteredSales.reduce((sum, sale) => {
        const saleDate = new Date(sale.timestamp);
        return saleDate.getHours() === hour ? sum + sale.total : sum;
      }, 0);
      return totalForHour;
    });
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

  const chartOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        display: false,
        labels: { color: axisTickColorDark },
      },
      title: { display: false },
    },
    scales: {
      x: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
      y: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
    },
  }), [axisTickColorDark]);

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

  const ticketChartOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: { display: false, labels: { color: axisTickColorDark } },
      title: { display: false },
    },
    scales: {
      x: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
      y: { ticks: { color: axisTickColorDark }, grid: { color: "rgba(156, 163, 175, 0.2)" } },
    },
  }), [axisTickColorDark]);

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

  // Cambio de negocio: actualiza estado
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
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Estadísticas del Mes</h1>
        <p className="text-slate-600 dark:text-slate-300">
          Revisa el flujo neto diario (Ventas – Gastos), la cantidad de ventas y los turnos involucrados.
        </p>
      </header>

      {/* Filtros: Negocio y navegación de mes */}
      <div className="app-card p-4 rounded-lg shadow bg-white dark:bg-gray-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="businessSelect" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Selecciona un Negocio:
            </label>
            <select id="businessSelect" className="input" value={selectedBusinessId} onChange={handleBusinessChange}>
              <option value="">Selecciona un negocio</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
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
          {/* Tabla de Estadísticas Diarias */}
          <div className="overflow-x-auto shadow rounded-lg bg-slate-50 dark:bg-slate-800">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300 border border-gray-300 dark:border-gray-600">
                    Día
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300 border border-gray-300 dark:border-gray-600">
                    Ventas Totales
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300 border border-gray-300 dark:border-gray-600">
                    Gastos Totales
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300 border border-gray-300 dark:border-gray-600">
                    Cantidad de Ventas
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300 border border-gray-300 dark:border-gray-600">
                    Neto
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300 border border-gray-300 dark:border-gray-600">
                    Turnos (Empleado)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600 text-slate-800 dark:text-slate-200">
                {dailyStats.map((stat, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">{stat.date.toLocaleDateString()}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">${formatPrice(stat.totalSales)}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">${formatPrice(stat.totalExpenses)}</td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">{stat.salesCount}</td>
                    <td className={`px-4 py-2 border border-gray-300 dark:border-gray-600 font-semibold ${stat.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ${formatPrice(stat.net)}
                    </td>
                    <td className="px-4 py-2 border border-gray-300 dark:border-gray-600">
                      {stat.shifts.length > 0 ? (
                        <ul className="list-disc pl-4 text-xs">
                          {stat.shifts.map((shift) => {
                            // Buscamos el empleado correspondiente usando el employee_id
                            const emp = employees.find((e) => e.id === shift.employee_id);
                            return (
                              <li key={shift.id}>
                                {emp ? emp.name : shift.employee_id} (
                                {new Date(shift.start_time).toLocaleTimeString()} –{" "}
                                {shift.end_time ? new Date(shift.end_time).toLocaleTimeString() : "Activo"})
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        "Sin turnos"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 dark:bg-gray-700 text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="px-4 py-2 font-medium border border-gray-300 dark:border-gray-600">Totales:</td>
                  <td className="px-4 py-2 font-medium border border-gray-300 dark:border-gray-600">${formatPrice(totalSalesSum)}</td>
                  <td className="px-4 py-2 font-medium border border-gray-300 dark:border-gray-600">${formatPrice(totalExpensesSum)}</td>
                  <td className="px-4 py-2 font-medium border border-gray-300 dark:border-gray-600">{totalSalesCount}</td>
                  <td className="px-4 py-2 font-medium border border-gray-300 dark:border-gray-600">${formatPrice(totalNetSum)}</td>
                  <td className="px-4 py-2 border border-gray-300 dark:border-gray-600"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Gráfico: Ventas por Horas */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">Ventas por Horas</h2>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Gráfico: Ticket Promedio por Día */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">Ticket Promedio por Día</h2>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <Line data={ticketChartData} options={ticketChartOptions} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
