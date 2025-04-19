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

function parseDateForDisplay(dateStr: string) {
  const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  return new Date(datePart + "T12:00:00");
}

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
    if (error) break;
    if (data) {
      allData = allData.concat(data);
      if (data.length < pageSize) done = true;
      else page++;
    } else done = true;
  }
  return allData;
}

async function loadBusinesses() {
  const { data, error } = await supabase.from("businesses").select("*").order("name");
  if (error) return [];
  return data || [];
}
async function loadSales(businessId: string) {
  return await fetchAllPaginated((from, to) =>
    supabase.from("sales").select("*").eq("business_id", businessId).order("timestamp", { ascending: false }).range(from, to)
  );
}
async function loadExpenses(businessId: string) {
  return await fetchAllPaginated((from, to) =>
    supabase.from("expenses").select("*").eq("business_id", businessId).order("date", { ascending: false }).range(from, to)
  );
}
async function loadShifts(businessId: string) {
  return await fetchAllPaginated((from, to) =>
    supabase.from("shifts").select("*").eq("business_id", businessId).order("start_time", { ascending: false }).range(from, to)
  );
}
async function loadEmployees(businessId: string) {
  const { data, error } = await supabase
    .from("employees")
    .select("id, name")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) return [];
  return data || [];
}

export default function StatisticsPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [selectedWeekday, setSelectedWeekday] = useState("");
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  );

  const weekdayOptions = [
    { value: "", label: "Todos los días" },
    { value: "1", label: "Lunes" },
    { value: "2", label: "Martes" },
    { value: "3", label: "Miércoles" },
    { value: "4", label: "Jueves" },
    { value: "5", label: "Viernes" },
    { value: "6", label: "Sábado" },
    { value: "0", label: "Domingo" },
  ];

  useEffect(() => { loadBusinesses().then(setBusinesses); }, []);
  useEffect(() => {
    if (!selectedBusinessId) return;
    setLoading(true);
    Promise.all([
      loadSales(selectedBusinessId),
      loadExpenses(selectedBusinessId),
      loadShifts(selectedBusinessId),
      loadEmployees(selectedBusinessId),
    ])
      .then(([sal, exp, shi, emp]) => {
        setSales(sal);
        setExpenses(exp);
        setShifts(shi);
        setEmployees(emp);
      })
      .finally(() => setLoading(false));
  }, [selectedBusinessId]);

  const year = selectedMonth.getFullYear();
  const monthIndex = selectedMonth.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => new Date(year, monthIndex, i + 1));
  const isSameDate = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

  const filteredSales = sales.filter(s => {
    const d = new Date(s.timestamp);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
  const filteredExpenses = expenses.filter(e => {
    const d = parseDateForDisplay(e.date);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
  const filteredShifts = shifts.filter(sh => {
    const d = new Date(sh.start_time);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });

  const salesByWeekday = filteredSales.filter(s => selectedWeekday === "" || new Date(s.timestamp).getDay() === Number(selectedWeekday));
  const expensesByWeekday = filteredExpenses.filter(e => selectedWeekday === "" || parseDateForDisplay(e.date).getDay() === Number(selectedWeekday));
  const shiftsByWeekday = filteredShifts.filter(sh => selectedWeekday === "" || new Date(sh.start_time).getDay() === Number(selectedWeekday));

  const dailyStats = daysArray.map(day => {
    const salesDay = filteredSales.filter(s => isSameDate(new Date(s.timestamp), day));
    const expDay = filteredExpenses.filter(e => isSameDate(parseDateForDisplay(e.date), day));
    return {
      date: day,
      totalSales: salesDay.reduce((a, c) => a + c.total, 0),
      totalExpenses: expDay.reduce((a, c) => a + c.amount, 0),
      salesCount: salesDay.length,
    };
  });
  const displayedStats = dailyStats.filter(ds => selectedWeekday === "" || ds.date.getDay() === Number(selectedWeekday));

  const totalSalesSum = displayedStats.reduce((a, c) => a + c.totalSales, 0);
  const totalExpensesSum = displayedStats.reduce((a, c) => a + c.totalExpenses, 0);
  const formatPrice = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    setIsDark(html.classList.contains('dark'));
  
    // Opcional: si tienes un toggler que añade/quita la clase
    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains('dark'));
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  
    return () => observer.disconnect();
  }, []);
  const tickColor = !isDark ? "#000000" : "#ffffff";
  const chartContainerClass = "w-full h-[300px]";

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const data = hours.map(h =>
      salesByWeekday.reduce((a, c) => (new Date(c.timestamp).getHours() === h ? a + c.total : a), 0)
    );
    return { labels: hours.map(h => `${h}:00`), datasets: [{ data, backgroundColor: 'rgba(75,192,192,0.6)', borderColor: 'rgba(75,192,192,1)', borderWidth: 1 }] };
  }, [salesByWeekday]);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false as const,
    plugins: { legend: { display: false, labels: { color: tickColor } } },
    scales: { x: { ticks: { color: tickColor } }, y: { ticks: { color: tickColor } } },
  };

  const ticketData = useMemo(() => ({
    labels: displayedStats.map(d => d.date.getDate().toString()),
    datasets: [
      {
        data: displayedStats.map(d => (d.salesCount > 0 ? d.totalSales / d.salesCount : 0)),
        backgroundColor: 'rgba(54,162,235,0.5)',
        borderColor: 'rgba(54,162,235,1)',
        borderWidth: 2,
        tension: 0.3,
      },
    ],
  }), [displayedStats]);

  const revenueEmpData = useMemo(() => {
    const map: Record<string, number[]> = {};
    shiftsByWeekday.forEach(sh => {
      const sum = salesByWeekday.filter(s => s.shift_id === sh.id).reduce((a, c) => a + c.total, 0);
      map[sh.employee_id] = map[sh.employee_id] || [];
      map[sh.employee_id].push(sum);
    });
    return {
      labels: Object.keys(map).map(id => employees.find(e => e.id === id)?.name || id),
      datasets: [
        {
          data: Object.values(map).map(arr => arr.reduce((a, c) => a + c, 0) / arr.length),
          backgroundColor: 'rgba(153,102,255,0.6)',
          borderColor: 'rgba(153,102,255,1)',
          borderWidth: 1,
        },
      ],
    };
  }, [shiftsByWeekday, salesByWeekday, employees]);

  const prev = () => setSelectedMonth(new Date(year, monthIndex - 1, 1));
  const next = () => {
    const n = new Date(year, monthIndex + 1, 1);
    if (n <= new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)) setSelectedMonth(n);
  };
  const nextDisabled = new Date(year, monthIndex + 1, 1) > new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  return (
    <div className="space-y-6 p-4">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Estadísticas del Mes</h1>
        <p>Flujo neto diario, ventas, gastos y más.</p>
      </header>

      <div className="app-card p-4 rounded-lg shadow bg-white dark:bg-gray-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="font-medium">Negocio:</label>
            <select value={selectedBusinessId} onChange={e => setSelectedBusinessId(e.target.value)} className="input" disabled={loading}>
              <option value="">Selecciona negocio</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prev} className="btn btn-secondary"><ChevronLeft className="w-5 h-5" /></button>
            <span className="font-semibold">{selectedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            <button onClick={next} disabled={nextDisabled} className="btn btn-secondary"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <label className="font-medium">Día semana:</label>
          <select value={selectedWeekday} onChange={e => setSelectedWeekday(e.target.value)} className="input">
            {weekdayOptions.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loading && (
        <div className="flex justify-center py-4 text-slate-600">
          <p>Cargando estadísticas...</p>
        </div>
      )}
      {selectedBusinessId === "" && !loading && (
        <div className="text-center">Selecciona un negocio.</div>
      )}
      {!loading && selectedBusinessId != '' && (

        <>
          <div className="overflow-x-auto shadow rounded bg-white dark:bg-slate-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-blue-100 dark:bg-blue-900">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Ventas</th>
                  <th className="px-4 py-3">Gastos</th>
                  <th className="px-4 py-3">Neto</th>
                </tr>
              </thead>
              <tbody>
                {displayedStats.map((ds, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2">{ds.date.toLocaleDateString()}</td>
                    <td className="px-4 py-2 font-bold text-green-700">${formatPrice(ds.totalSales)}</td>
                    <td className="px-4 py-2 text-orange-600">${formatPrice(ds.totalExpenses)}</td>
                    <td className={`px-4 py-2 ${ds.totalSales - ds.totalExpenses >= 0 ? 'text-green-700' : 'text-red-700'}`}>${formatPrice(ds.totalSales - ds.totalExpenses)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50 dark:bg-blue-800">
                <tr>
                  <td className="px-4 py-2 font-medium">Totales:</td>
                  <td className="px-4 py-2 font-bold text-green-700">${formatPrice(totalSalesSum)}</td>
                  <td className="px-4 py-2 text-orange-600">${formatPrice(totalExpensesSum)}</td>
                  <td className={`px-4 py-2 ${(totalSalesSum - totalExpensesSum) >= 0 ? 'text-green-700' : 'text-red-700'}`}>${formatPrice(totalSalesSum - totalExpensesSum)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-semibold">Ticket Promedio por Día</h2>
            <div className={chartContainerClass}><Line data={ticketData} options={baseOptions} /></div>
          </div>

          <div className="mt-8 space-y-6">
            <h2 className="text-2xl font-semibold">Gráficos de Barra</h2>
            <div>
              <h3 className="text-lg font-medium">Ventas por Horas</h3>
              <div className={chartContainerClass}><Bar data={hourlyData} options={baseOptions} /></div>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full">
                <h3 className="text-lg font-medium">Promedio Facturación por Turno</h3>
                <div className={chartContainerClass}><Bar data={revenueEmpData} options={{ ...baseOptions, indexAxis: 'y' }} /></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
