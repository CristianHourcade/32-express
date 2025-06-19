// src/app/(tu-ruta)/ActivitiesPage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search } from "lucide-react";

/* ────────── Types ────────── */
type ActivityRow = {
  id: string;
  business_id: string;
  details: string;
  timestamp: string;
  businesses: { name: string } | null;
};

/* ────────── Helper: resaltar “added/removed” ────────── */
function highlight(text: string) {
  return text
    .replace(/\[PERDIDA - \$([\d.]+)\]/gi, (_, monto) => {
      const montoNum = parseFloat(monto);
      return `
        <button
          class="ml-2 inline-block px-2 hover:bg-red-700 py-1 bg-red-500 text-white font-semiboldcursor-pointer"
          data-monto="${montoNum}" style="border-radius:25px">
          [PERDIDA - $${monto}]
        </button>
      `;
    })
    .replace(/(added|removed)/gi, (m) =>
      `<span class="${m.toLowerCase() === "added" ? "text-emerald-600" : "text-rose-600"
      } font-semibold">${m}</span>`
    );
}



export default function ActivitiesPage() {
  /* ---------- state ---------- */
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPerdidas, setTotalPerdidas] = useState(0);

  const [selectedResponsible, setSelectedResponsible] = useState("all");
  const [selectedBusiness, setSelectedBusiness] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" && target.dataset.monto) {
        const monto = parseFloat(target.dataset.monto);
        if (!isNaN(monto)) setTotalPerdidas((prev) => prev + monto);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  /* ---------- fetch ---------- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from<ActivityRow>("activities")
        .select("id, details, timestamp, businesses(name)")
        .order("timestamp", { ascending: false });

      if (error) console.error("Error cargando actividades:", error.message);
      else setActivities(data ?? []);
      setLoading(false);
    })();
  }, []);

  /* ---------- unique lists ---------- */
  const responsibles = useMemo(() => {
    const names = activities.map((a) => a.details.split(" ")[0]);
    return Array.from(new Set(names));
  }, [activities]);

  const businesses = useMemo(() => {
    const names = activities
      .map((a) => a.businesses?.name || "")
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [activities]);

  /* ---------- filtered data ---------- */
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const [resp] = a.details.split(" ");
      const bizName = a.businesses?.name || "";
      const detLower = a.details.toLowerCase();
      const seaLower = search.toLowerCase();
      const datePart = new Date(a.timestamp).toISOString().split("T")[0];

      const okResp =
        selectedResponsible === "all" || resp === selectedResponsible;
      const okBiz =
        selectedBusiness === "all" || bizName === selectedBusiness;
      const okSearch =
        detLower.includes(seaLower) || bizName.toLowerCase().includes(seaLower);
      const okDate = !selectedDate || datePart === selectedDate;

      return okResp && okBiz && okSearch && okDate;
    });
  }, [
    activities,
    selectedResponsible,
    selectedBusiness,
    selectedDate,
    search,
  ]);

  /* ---------- loading splash ---------- */
  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
        <p className="text-slate-600 dark:text-slate-400 uppercase">
          Cargando actividades…
        </p>
      </div>
    );

  /* ---------- UI ---------- */
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase">
          Registro de actividades
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Histórico de acciones de usuarios
        </p>
        <div>
          <div className="py-3 text-sm font-semibold text-red-600 dark:text-red-400">
            Total de pérdidas seleccionadas: ${totalPerdidas.toLocaleString("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          {totalPerdidas > 0 && (
            <button className="bg-white px-3 py-1 border" onClick={() => setTotalPerdidas(0)}>
              Limpiar
            </button>
          )}
        </div>
      </header>

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700">
        <div className="flex flex-col md:flex-row flex-wrap gap-4 p-4">
          {/* Responsable */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium mb-1">Responsable</label>
            <select
              value={selectedResponsible}
              onChange={(e) => setSelectedResponsible(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos</option>
              {responsibles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Negocio */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium mb-1">Negocio</label>
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos</option>
              {businesses.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium mb-1">Fecha</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Buscador */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Detalle o negocio…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full pl-9 pr-3 py-1.5 text-xs shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>


      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10 text-[11px] uppercase tracking-wide">
              <tr className="divide-x divide-slate-200 dark:divide-slate-600">
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Negocio</th>
                <th className="px-4 py-3 text-left font-semibold">Detalle</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filtered.length ? (
                filtered.map((a) => {
                  const fecha = new Date(a.timestamp).toLocaleString();
                  const [resp, ...rest] = a.details.split(" ");
                  const detalle = rest.join(" ");

                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/40 odd:bg-slate-50/40 dark:odd:bg-slate-800/30"
                    >
                      <td className="px-4 py-2 whitespace-nowrap">{fecha}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {a.businesses?.name || "—"}
                      </td>

                      {/* Detalle con highlights */}
                      <td
                        className="px-4 py-2"
                        dangerouslySetInnerHTML={{
                          __html: `
    <span class="font-semibold text-sky-600 dark:text-sky-400 mr-1">${resp}</span>
    ${highlight(detalle, (m) => setTotalPerdidas((prev) => prev + m))}
  `,
                        }}

                      />
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    No se encontraron actividades.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
