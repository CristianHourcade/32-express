"use client";
import { useEffect, useMemo, useState, useRef } from "react";
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
  subMonths,
} from "date-fns";

/*********************************
 * Constantes & helpers
 *********************************/
const CATEGORIES = [
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
const ORDER_WITH_OTHERS = [...CATEGORIES, "OTROS"];
const money = (n: number) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;

function getCategoryFromName(name?: string) {
  const token = String(name || "").trim().split(/\s+/)[0]?.toUpperCase();
  return CATEGORIES.includes(token) ? token : "OTROS";
}

// Semanas recientes (labels dd/MM–dd/MM)
function getLastNWeeks(n: number, dateTo?: string) {
  const endDate = dateTo ? new Date(dateTo) : new Date();
  const weeks: { label: string; start: Date; end: Date }[] = [];
  let endOfCurrentWeek = startOfWeek(endDate, { weekStartsOn: 1 });
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

function getWeeklyLossesLastN(data: any[], dateTo?: string) {
  const weeks = getLastNWeeks(4, dateTo);
  return weeks.map(({ label, start, end }) => {
    const loss = data
      .filter((l) => {
        const d = new Date(l.created_at);
        return !isBefore(d, start) && !isAfter(d, end);
      })
      .reduce((acc, l) => acc + (l.lost_cash || 0), 0);
    return { week: label, loss };
  });
}

function getMonthsOfYear(year: number) {
  const months: string[] = [];
  for (let i = 0; i < 12; i++) months.push(format(new Date(year, i, 1), "yyyy-MM"));
  return months;
}

function getMonthlyLossesCompleted(data: any[], dateTo?: string) {
  const now = dateTo ? new Date(dateTo) : new Date();
  const year = now.getFullYear();
  const months = getMonthsOfYear(year);
  const map: Record<string, number> = {};
  data.forEach((l) => {
    const month = format(startOfMonth(new Date(l.created_at)), "yyyy-MM");
    map[month] = (map[month] || 0) + (l.lost_cash || 0);
  });
  return months.map((month) => ({ month, loss: map[month] || 0 }));
}

function getTopLostProducts(data: any[]) {
  const map: Record<string, number> = {};
  data.forEach((l) => {
    const name = l.products_master?.name || l.product_id;
    map[name] = (map[name] || 0) + (l.lost_cash || 0);
  });
  return Object.entries(map)
    .map(([name, loss]) => ({ name, loss }))
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 5);
}

function sum<T>(arr: T[], sel?: (x: T) => number) {
  return arr.reduce((a: number, x: any) => a + (sel ? sel(x) : x), 0);
}

function toCSV(rows: any[]) {
  const header = ["Fecha", "Negocio", "Producto", "Detalle", "Motivo", "Pérdida $", "ProductoID"];
  const lines = rows.map((r) => [
    new Date(r.created_at).toLocaleDateString(),
    r.businesses?.name ?? r.business_id ?? "",
    r.products_master?.name ?? r.product_id ?? "",
    String(r.details ?? "").replaceAll("\n", " "),
    r.motivo ?? "",
    Number(r.lost_cash || 0).toString().replace(".", ","),
    r.product_id ?? "",
  ]);
  return [header, ...lines]
    .map((line) => line.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function download(filename: string, text: string) {
  const el = document.createElement("a");
  el.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
  el.setAttribute("download", filename);
  el.style.display = "none";
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
}

/*********************************
 * Página principal
 *********************************/
export default function LossesPagePro() {
  const [losses, setLosses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [businesses, setBusinesses] = useState<any[]>([]);
  const [activeBusiness, setActiveBusiness] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [search, setSearch] = useState("");
  const [showExecutive, setShowExecutive] = useState(true);
  const [showCharts, setShowCharts] = useState(true);
  const [showTables, setShowTables] = useState(true);

  // filtro de motivos (incluye “Perdida” y “Vencimiento”)
  const [motivos, setMotivos] = useState<string[]>(["Perdida", "Vencimiento"]);

  // Cargar negocios
  useEffect(() => {
    (async function fetchBusinesses() {
      const { data } = await supabase.from("businesses").select("id, name").order("name");
      if (data) {
        setBusinesses(data);
        if (!activeBusiness && data.length > 0) setActiveBusiness(data[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar pérdidas
  useEffect(() => {
    (async function fetchLosses() {
      if (!activeBusiness) return;
      setLoading(true);

      let query = supabase
        .from("activities")
        .select(
          `id, business_id, details, motivo, lost_cash, created_at, product_id,
           products_master:product_id(id, name),
           businesses:business_id(id, name)`
        )
        .in("motivo", motivos) // 👈 trae Perdida + Vencimiento
        .eq("business_id", activeBusiness);

      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data } = await query;
      if (data) setLosses(data);
      setLoading(false);
    })();
  }, [activeBusiness, dateFrom, dateTo, motivos]);

  /*********************************
   * Derivados
   *********************************/
  const activeName = useMemo(
    () => businesses.find((b) => b.id === activeBusiness)?.name || "—",
    [businesses, activeBusiness]
  );

  const base = losses; // ya viene filtrado por business + motivos

  const searchQ = search.trim().toLowerCase();
  const matchesSearch = (l: any) => {
    if (!searchQ) return true;
    const name = (l.products_master?.name || "").toLowerCase();
    const details = String(l.details || "").toLowerCase();
    const pid = String(l.product_id || "").toLowerCase();
    const motivo = String(l.motivo || "").toLowerCase();
    return name.includes(searchQ) || details.includes(searchQ) || pid.includes(searchQ) || motivo.includes(searchQ);
  };

  const filtered = useMemo(() => base.filter(matchesSearch), [base, searchQ]);
  const totalLost = useMemo(() => sum(filtered, (x: any) => x.lost_cash || 0), [filtered]);

  // Tendencias
  const weeklyData = useMemo(() => getWeeklyLossesLastN(filtered, dateTo), [filtered, dateTo]);
  const monthlyData = useMemo(() => getMonthlyLossesCompleted(filtered, dateTo), [filtered, dateTo]);
  const topProducts = useMemo(() => getTopLostProducts(filtered), [filtered]);

  // Por categoría
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const l of filtered) {
      const cat = getCategoryFromName(l.products_master?.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(l);
    }
    return groups;
  }, [filtered]);

  const categoryMetrics = useMemo(() => {
    return ORDER_WITH_OTHERS.map((cat) => {
      const arr = groupedByCategory[cat] || [];
      const loss = sum(arr, (x: any) => x.lost_cash || 0);
      return { cat, count: arr.length, loss };
    }).filter((m) => m.count > 0 || m.loss > 0);
  }, [groupedByCategory]);

  // Métricas auxiliares (variación vs último período)
  const lastWeekRange = useMemo(() => {
    const to = dateTo ? new Date(dateTo) : new Date();
    const end = startOfWeek(to, { weekStartsOn: 1 });
    const start = addDays(end, -7);
    const prevStart = addDays(start, -7);
    const prevEnd = addDays(start, -1);
    return { start, end: addDays(end, -1), prevStart, prevEnd };
  }, [dateTo]);

  const weekChange = useMemo(() => {
    const cur = sum(
      filtered.filter((l) => {
        const d = new Date(l.created_at);
        return d >= lastWeekRange.start && d <= lastWeekRange.end;
      }),
      (x: any) => x.lost_cash || 0
    );
    const prev = sum(
      filtered.filter((l) => {
        const d = new Date(l.created_at);
        return d >= lastWeekRange.prevStart && d <= lastWeekRange.prevEnd;
      }),
      (x: any) => x.lost_cash || 0
    );
    const diff = cur - prev;
    const pct = prev === 0 ? null : (diff / prev) * 100;
    return { cur, prev, diff, pct };
  }, [filtered, lastWeekRange]);

  const lastMonthRange = useMemo(() => {
    const to = dateTo ? new Date(dateTo) : new Date();
    const end = startOfMonth(to);
    const start = addDays(end, -1 * new Date(end.getFullYear(), end.getMonth(), 0).getDate()); // aprox
    const prevStart = subMonths(start, 1);
    const prevEnd = addDays(start, -1);
    return { start, end: addDays(end, -1), prevStart, prevEnd };
  }, [dateTo]);

  const monthChange = useMemo(() => {
    const cur = sum(
      filtered.filter((l) => {
        const d = new Date(l.created_at);
        return d >= lastMonthRange.start && d <= lastMonthRange.end;
      }),
      (x: any) => x.lost_cash || 0
    );
    const prev = sum(
      filtered.filter((l) => {
        const d = new Date(l.created_at);
        return d >= lastMonthRange.prevStart && d <= lastMonthRange.prevEnd;
      }),
      (x: any) => x.lost_cash || 0
    );
    const diff = cur - prev;
    const pct = prev === 0 ? null : (diff / prev) * 100;
    return { cur, prev, diff, pct };
  }, [filtered, lastMonthRange]);

  /*********************************
   * Acciones (export, reportes)
   *********************************/
  function handleExportCSV() {
    const csv = toCSV(filtered);
    const filename = `perdidas_${activeName.replaceAll(" ", "_")}_${dateFrom || "ini"}_${dateTo || "hoy"}.csv`;
    download(filename, csv);
  }

  function copySummaryToClipboard() {
    const top = topProducts.map((p, i) => `${i + 1}. ${p.name}: ${money(p.loss)}`).join("\n");
    const cat = categoryMetrics
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 5)
      .map((c, i) => `${i + 1}. ${c.cat}: ${money(c.loss)} (${c.count} regs)`)
      .join("\n");
    const txt = `📍 Reporte de pérdidas — ${activeName}\nPeriodo: ${dateFrom || "(sin inicio)"} al ${dateTo || "(hoy)"}\nTotal: ${money(
      totalLost
    )}\n\nTOP productos:\n${top || "—"}\n\nTOP categorías:\n${cat || "—"}`;
    navigator.clipboard?.writeText(txt);
  }

  function openPrintableReport() {
    const now = new Date();
    const rows = filtered
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
      .map(
        (l) => `
          <tr>
            <td>${new Date(l.created_at).toLocaleDateString()}</td>
            <td>${(l.products_master?.name || l.product_id || "").replaceAll("<", "&lt;")}</td>
            <td>${String(l.details || "").replaceAll("<", "&lt;")}</td>
            <td>${String(l.motivo || "").replaceAll("<", "&lt;")}</td>
            <td style="text-align:right">${(l.lost_cash || 0).toLocaleString("es-AR")}</td>
          </tr>`
      )
      .join("");

    const body = `
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Reporte de Pérdidas</title>
        <style>
          body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; margin: 32px; }
          h1 { margin: 0 0 4px; font-size: 20px; }
          h2 { margin: 24px 0 8px; font-size: 16px; }
          .muted { color: #64748b; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .card { background: #f8fafc; padding: 12px 14px; border-radius: 12px; border: 1px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
          tfoot td { font-weight: 700; }
          @media print { .noprint { display: none; } }
        </style>
      </head>
      <body>
        <div class="noprint" style="text-align:right"><button onclick="window.print()">Imprimir</button></div>
        <h1>Reporte de pérdidas — ${activeName}</h1>
        <div class="muted">Periodo: ${dateFrom || "(sin inicio)"} al ${dateTo || "(hoy)"} · Generado: ${now.toLocaleString()}</div>

        <div class="grid" style="margin:18px 0 22px">
          <div class="card"><div class="muted">Total perdido</div><div style="font-weight:700; font-size:18px">${money(totalLost)}</div></div>
          <div class="card"><div class="muted">Registros</div><div style="font-weight:700; font-size:18px">${filtered.length}</div></div>
          <div class="card"><div class="muted">Top producto</div><div style="font-weight:700; font-size:14px">${(topProducts[0]?.name || "—")
            .toString()
            .replaceAll("<", "&lt;")}</div></div>
        </div>

        <h2>Detalle</h2>
        <table>
          <thead>
            <tr><th>Fecha</th><th>Producto</th><th>Detalle</th><th>Motivo</th><th style="text-align:right">Pérdida $</th></tr>
          </thead>
          <tbody>
            ${rows || ""}
          </tbody>
          <tfoot>
            <tr><td></td><td></td><td></td><td style="text-align:right">TOTAL</td><td style="text-align:right">${totalLost.toLocaleString("es-AR")}</td></tr>
          </tfoot>
        </table>
      </body></html>`;

    const w = window.open("", "_blank");
    w?.document.write(body);
    w?.document.close();
  }

  /*********************************
   * Render
   *********************************/
  return (
    <div className="min-h-screen p-6 from-slate-50 to-white">
      <div className="mx-auto max-w-7xl">
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 space-y-8 border border-slate-100">
          {/* Header */}
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
            <div className="flex-1 space-y-1">
              <h1 className="text-2xl font-bold text-slate-900">Pérdidas</h1>
              <p className="text-slate-500 text-sm">
                Controla pérdidas por negocio, filtra por rango de fechas y genera reportes ejecutivos.
              </p>
            </div>

            {/* Rango de fechas */}
            <div className="flex gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm bg-slate-50 shadow focus:ring-1 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm bg-slate-50 shadow focus:ring-1 focus:ring-indigo-300"
                />
              </div>
            </div>
          </header>

          {/* Selector de negocios */}
          <div className="flex flex-wrap gap-2">
            {businesses.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBusiness(b.id)}
                className={
                  `px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 border ` +
                  (activeBusiness === b.id
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
                }
              >
                {b.name}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar (producto, detalle, motivo o ID)…"
                className="pl-3 pr-3 py-2 text-sm rounded-lg border w-72 bg-slate-50"
              />
              <button
                onClick={() => {
                  setSearch("");
                }}
                className="px-3 py-2 rounded-lg text-sm border border-slate-200 hover:bg-slate-50"
              >
                Limpiar
              </button>
            </div>

            {/* Filtros de motivo */}
            <div className="flex flex-wrap gap-2">
              {["Perdida", "Vencimiento"].map((m) => {
                const active = motivos.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() =>
                      setMotivos((prev) => (active ? prev.filter((x) => x !== m) : [...prev, m]))
                    }
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                    title={`Filtrar motivo: ${m}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:opacity-90"
              >
                Exportar CSV
              </button>
              <button
                onClick={copySummaryToClipboard}
                className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 hover:bg-slate-50"
              >
                Copiar resumen
              </button>
              <button
                onClick={openPrintableReport}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Generar Reporte
              </button>
            </div>
          </div>

          {loading ? (
            <SkeletonDashboard />
          ) : (
            <>
              {/* Métricas principales */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Sucursal" value={activeName} subtle />
                <MetricCard label="Total perdido" value={money(totalLost)} accent="rose" />
                <MetricCard label="Registros" value={filtered.length} accent="indigo" />
                <MetricDelta label="Vs. semana previa" value={weekChange} />
              </section>

              {/* Conmutadores de secciones */}
              <div className="flex flex-wrap items-center gap-3">
                <Toggle value={showExecutive} onChange={setShowExecutive} label="Resumen ejecutivo" />
                <Toggle value={showCharts} onChange={setShowCharts} label="Gráficos" />
                <Toggle value={showTables} onChange={setShowTables} label="Tablas por categoría" />
              </div>

              {showExecutive && (
                <ExecutiveSummary topProducts={topProducts} categoryMetrics={categoryMetrics} totalLost={totalLost} />
              )}

              {showCharts && (
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <ChartCard title="Pérdidas por Semana">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={weeklyData}>
                        <XAxis dataKey="week" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString("es-AR")}`} />
                        <Bar dataKey="loss" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Pérdidas por Mes">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={monthlyData}>
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString("es-AR")}`} />
                        <Bar dataKey="loss" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </section>
              )}

              {showTables && (
                <section className="space-y-6">
                  {ORDER_WITH_OTHERS.map((cat) => {
                    const arr = groupedByCategory[cat] || [];
                    if (!arr.length) return null;
                    const subtotal = sum(arr, (x: any) => x.lost_cash || 0);
                    return (
                      <div key={cat} className="bg-slate-50 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-semibold text-slate-700">{cat}</h3>
                          <div className="text-sm text-slate-600">
                            Subtotal: <span className="font-semibold">{money(subtotal)}</span>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr>
                                <th className="px-4 py-2 text-left">Fecha</th>
                                <th className="px-4 py-2 text-left">Producto</th>
                                <th className="px-4 py-2 text-left">Detalle</th>
                                <th className="px-4 py-2 text-left">Motivo</th>
                                <th className="px-4 py-2 text-right">Pérdida $</th>
                              </tr>
                            </thead>
                            <tbody>
                              {arr.map((l: any) => (
                                <tr key={l.id} className="border-b last:border-none">
                                  <td className="px-4 py-2">{new Date(l.created_at).toLocaleDateString()}</td>
                                  <td className="px-4 py-2">{l.products_master?.name || l.product_id}</td>
                                  <td className="px-4 py-2">{l.details}</td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={
                                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " +
                                        (l.motivo === "Perdida"
                                          ? "bg-rose-50 text-rose-700 border border-rose-100"
                                          : "bg-amber-50 text-amber-700 border border-amber-100")
                                      }
                                    >
                                      {l.motivo}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {(l.lost_cash || 0).toLocaleString("es-AR")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td className="px-4 py-2"></td>
                                <td className="px-4 py-2"></td>
                                <td className="px-4 py-2"></td>
                                <td className="px-4 py-2 text-right font-semibold">Total categoría</td>
                                <td className="px-4 py-2 text-right font-semibold">
                                  {subtotal.toLocaleString("es-AR")}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/*********************************
 * Subcomponentes UI
 *********************************/
function MetricCard({ label, value, accent = "", subtle = false }: { label: string; value: any; accent?: string; subtle?: boolean }) {
  const accentMap: Record<string, string> = {
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
  };
  const cls = subtle
    ? "bg-slate-50 text-slate-700 border-slate-100"
    : accentMap[accent] || "bg-slate-100 text-slate-800 border-slate-200";
  return (
    <div className={`rounded-2xl px-5 py-4 flex flex-col gap-1 shadow-sm border ${cls}`}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

function MetricDelta({ label, value }: { label: string; value: { pct: number | null } }) {
  const text = value.pct == null ? "s/datos" : `${value.pct >= 0 ? "+" : ""}${value.pct.toFixed(1)}%`;
  return <MetricCard label={label} value={text} accent={value.pct == null ? "" : value.pct >= 0 ? "rose" : "indigo"} />;
}

function ChartCard({ title, children }: { title: string; children: any }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 className="text-base font-semibold mb-3 text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
        value ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {value ? `✓ ${label}` : label}
    </button>
  );
}

function ExecutiveSummary({
  topProducts,
  categoryMetrics,
  totalLost,
}: {
  topProducts: { name: string; loss: number }[];
  categoryMetrics: { cat: string; count: number; loss: number }[];
  totalLost: number;
}) {
  const topCats = [...categoryMetrics].sort((a, b) => b.loss - a.loss).slice(0, 5);
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-base font-semibold text-slate-700 mb-3">Top productos con pérdidas</h3>
        {topProducts.length === 0 ? (
          <div className="italic text-slate-400">Sin datos.</div>
        ) : (
          <ul className="space-y-2">
            {topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">#{i + 1}</span>
                  <span>{p.name}</span>
                </div>
                <div className="font-semibold">{money(p.loss)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-base font-semibold text-slate-700 mb-3">Top categorías por pérdida</h3>
        {topCats.length === 0 ? (
          <div className="italic text-slate-400">Sin datos.</div>
        ) : (
          <ul className="space-y-2">
            {topCats.map((c, i) => (
              <li key={c.cat} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">#{i + 1}</span>
                  <span>{c.cat}</span>
                </div>
                <div className="font-semibold">
                  {money(c.loss)} <span className="text-xs text-slate-400">({c.count})</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 text-sm text-slate-500">
          Total pérdidas del período: <span className="font-semibold text-slate-700">{money(totalLost)}</span>
        </div>
      </div>
    </section>
  );
}

function SkeletonDashboard() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-slate-100 rounded w-1/3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="h-64 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
      <div className="h-96 bg-slate-100 rounded-2xl" />
    </div>
  );
}
