"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import {
    format,
    startOfWeek,
    startOfMonth,
    addWeeks,
    addDays,
    isBefore,
    isAfter,
    addMonths,
} from "date-fns";

// Devuelve un array con 4 objetos { label, start, end }
function getLastNWeeks(n, dateTo) {
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const weeks = [];
    let endOfCurrentWeek = startOfWeek(endDate, { weekStartsOn: 1 }); // Lunes actual
    for (let i = n - 1; i >= 0; i--) {
        const weekStart = addWeeks(endOfCurrentWeek, -i);
        const weekEnd = addDays(weekStart, 6);
        weeks.push({
            label: `${format(weekStart, "dd/MM")}–${format(weekEnd, "dd/MM")}`,
            start: weekStart,
            end: weekEnd,
        });
    }
    return weeks;
}

function getWeeklyLossesLastN(data, dateTo) {
    const weeks = getLastNWeeks(4, dateTo);
    return weeks.map(({ label, start, end }) => {
        // Sumo todo lo que cae en ese rango
        const loss = data
            .filter(l => {
                const d = new Date(l.created_at);
                return !isBefore(d, start) && !isAfter(d, end);
            })
            .reduce((acc, l) => acc + (l.lost_cash || 0), 0);
        return { week: label, loss };
    });
}
// Helpers para weeks/months/top productos
function getWeeksOfMonth(date) {
    const first = startOfMonth(date);
    let weeks = [];
    for (let i = 0; i < 4; i++) {
        weeks.push(format(addWeeks(first, i), "yyyy-MM-dd"));
    }
    return weeks;
}
function getMonthsOfYear(year) {
    let months = [];
    for (let i = 0; i < 12; i++) {
        months.push(format(new Date(year, i, 1), "yyyy-MM"));
    }
    return months;
}
function getWeeklyLossesCompleted(data, dateTo) {
    const now = dateTo ? new Date(dateTo) : new Date();
    const weeks = getWeeksOfMonth(now);
    const map = {};
    data.forEach((l) => {
        const week = format(
            startOfWeek(new Date(l.created_at), { weekStartsOn: 1 }),
            "yyyy-MM-dd"
        );
        map[week] = (map[week] || 0) + (l.lost_cash || 0);
    });
    return weeks.map((week) => ({
        week,
        loss: map[week] || 0,
    }));
}
function getMonthlyLossesCompleted(data, dateTo) {
    const now = dateTo ? new Date(dateTo) : new Date();
    const year = now.getFullYear();
    const months = getMonthsOfYear(year);
    const map = {};
    data.forEach((l) => {
        const month = format(startOfMonth(new Date(l.created_at)), "yyyy-MM");
        map[month] = (map[month] || 0) + (l.lost_cash || 0);
    });
    return months.map((month) => ({
        month,
        loss: map[month] || 0,
    }));
}
function getTopLostProducts(data) {
    const map = {};
    data.forEach((l) => {
        const name = l.products_master?.name || l.product_id;
        map[name] = (map[name] || 0) + (l.lost_cash || 0);
    });
    return Object.entries(map)
        .map(([name, loss]) => ({ name, loss }))
        .sort((a, b) => b.loss - a.loss)
        .slice(0, 5);
}

export default function LossesPage() {
    const [losses, setLosses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [businesses, setBusinesses] = useState([]);
    const [activeBusiness, setActiveBusiness] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Traer negocios
    useEffect(() => {
        async function fetchBusinesses() {
            const { data } = await supabase.from("businesses").select("id, name");
            if (data) {
                setBusinesses(data);
                if (!activeBusiness && data.length > 0) setActiveBusiness(data[0].id);
            }
        }
        fetchBusinesses();
        // eslint-disable-next-line
    }, []);

    // Traer losses con join
    useEffect(() => {
        async function fetchLosses() {
            setLoading(true);
            let query = supabase
                .from("activities")
                .select(
                    `
        id,
        business_id,
        details,
        motivo,
        lost_cash,
        created_at,
        product_id,
        products_master:product_id (id, name),
        businesses:business_id (id, name)
      `
                )
                .eq("motivo", "Perdida");
            if (dateFrom) query = query.gte("created_at", dateFrom);
            if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
            const { data } = await query;
            if (data) setLosses(data);
            setLoading(false);
        }
        fetchLosses();
    }, [dateFrom, dateTo]);

    // Datos filtrados por sucursal activa
    const filtered = losses.filter((l) => l.business_id === activeBusiness);
    const totalLost = filtered.reduce(
        (acc, curr) => acc + (curr.lost_cash ?? 0),
        0
    );

    const weeklyData = getWeeklyLossesLastN(filtered, dateTo);
    const monthlyData = getMonthlyLossesCompleted(filtered, dateTo);
    const topProducts = getTopLostProducts(filtered);

    return (
        <div className="min-h-screen">
            <div className="mx-auto">
                <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 space-y-10 border border-slate-100">
                    <h1 className="text-3xl font-bold mb-2 text-indigo-900 tracking-tight">Reporte de Pérdidas</h1>

                    {/* Filtros y Tabs */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                        <div className="flex gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="border rounded-lg px-3 py-1 text-sm bg-slate-50 shadow focus:ring-1 focus:ring-indigo-300"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="border rounded-lg px-3 py-1 text-sm bg-slate-50 shadow focus:ring-1 focus:ring-indigo-300"
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 md:ml-auto border-b">
                            {businesses.map(b => (
                                <button
                                    key={b.id}
                                    className={`px-4 py-2 font-semibold border-b-2 rounded-t-lg transition-all duration-150 ${activeBusiness === b.id
                                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                        : "border-transparent bg-slate-100 text-slate-600 hover:bg-indigo-50"
                                        }`}
                                    onClick={() => setActiveBusiness(b.id)}
                                >
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-lg mt-8 text-center text-slate-600">Cargando…</div>
                    ) : (
                        <div className="space-y-10">
                            {/* MÉTRICAS */}
                            <div className="flex flex-col md:flex-row md:items-end md:gap-10 gap-3">
                                <div className="flex-1">
                                    <div className="text-lg font-semibold text-slate-700">Sucursal seleccionada:</div>
                                    <div className="text-2xl font-bold text-indigo-800 mb-1">
                                        {businesses.find(b => b.id === activeBusiness)?.name}
                                    </div>
                                </div>
                                <div className="flex gap-5">
                                    <div className="rounded-2xl bg-slate-100 px-6 py-4 flex flex-col items-center shadow text-center">
                                        <span className="text-xs text-slate-500">Total perdido</span>
                                        <span className="text-2xl font-bold text-rose-600">
                                            ${totalLost.toLocaleString("es-AR")}
                                        </span>
                                    </div>
                                    <div className="rounded-2xl bg-slate-100 px-6 py-4 flex flex-col items-center shadow text-center">
                                        <span className="text-xs text-slate-500">Registros</span>
                                        <span className="text-2xl font-bold text-indigo-600">
                                            {filtered.length}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* GRÁFICOS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="bg-slate-50 rounded-2xl p-5 shadow-sm">
                                    <h3 className="text-base font-semibold mb-3 text-slate-700">Pérdidas por Semana</h3>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={weeklyData}>
                                            <XAxis dataKey="week" fontSize={12} />
                                            <YAxis fontSize={12} />
                                            <Tooltip formatter={v => `$${v.toLocaleString("es-AR")}`} />
                                            <Bar dataKey="loss" fill="#fb7185" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-5 shadow-sm">
                                    <h3 className="text-base font-semibold mb-3 text-slate-700">Pérdidas por Mes</h3>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={monthlyData}>
                                            <XAxis dataKey="month" fontSize={12} />
                                            <YAxis fontSize={12} />
                                            <Tooltip formatter={v => `$${v.toLocaleString("es-AR")}`} />
                                            <Bar dataKey="loss" fill="#6366f1" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* TOP PRODUCTOS */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-slate-700">Productos con más pérdidas</h3>
                                {topProducts.length === 0 ? (
                                    <div className="italic text-slate-400">Sin datos.</div>
                                ) : (
                                    <table className="min-w-[300px] text-sm bg-white rounded-xl shadow">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-2 text-left">Producto</th>
                                                <th className="px-4 py-2 text-right">Total perdido $</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topProducts.map(p => (
                                                <tr key={p.name}>
                                                    <td className="px-4 py-2">{p.name}</td>
                                                    <td className="px-4 py-2 text-right">{p.loss.toLocaleString("es-AR")}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* TABLA DETALLE */}
                            <div className="bg-slate-50 rounded-2xl p-5 shadow-sm">
                                <h3 className="text-base font-semibold mb-3 text-slate-700">Detalle de pérdidas</h3>
                                <div className="overflow-x-auto">
                                    {filtered.length === 0 ? (
                                        <div className="text-slate-400 italic">No hay registros de pérdida en este período.</div>
                                    ) : (
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="px-4 py-2 text-left">Fecha</th>
                                                    <th className="px-4 py-2 text-left">Producto</th>
                                                    <th className="px-4 py-2 text-left">Detalle</th>
                                                    <th className="px-4 py-2 text-right">Pérdida $</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filtered.map(l => (
                                                    <tr key={l.id} className="border-b last:border-none">
                                                        <td className="px-4 py-2">{new Date(l.created_at).toLocaleDateString()}</td>
                                                        <td className="px-4 py-2">{l.products_master?.name || l.product_id}</td>
                                                        <td className="px-4 py-2">{l.details}</td>
                                                        <td className="px-4 py-2 text-right">{l.lost_cash?.toLocaleString("es-AR")}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
