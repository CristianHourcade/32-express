// src/app/(tu-ruta)/ActivitiesPage.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Search } from "lucide-react";

type ActivityRow = {
  id: string;
  business_id: string;
  details: string;
  timestamp: string;
  businesses: { name: string } | null;
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [selectedResponsible, setSelectedResponsible] = useState("all");
  const [selectedBusiness, setSelectedBusiness] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    setLoading(true);
    const { data, error } = await supabase
      .from<ActivityRow>("activities")
      .select("id, details, timestamp, businesses(name)")
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("Error cargando actividades:", error.message);
    } else if (data) {
      setActivities(data);
    }
    setLoading(false);
  }

  // listas únicas para selects
  const responsibles = useMemo(() => {
    const names = activities.map((a) => a.details.split(" ")[0]);
    return Array.from(new Set(names));
  }, [activities]);

  const businesses = useMemo(() => {
    const names = activities
      .map((a) => a.businesses?.name || "")
      .filter((n) => n);
    return Array.from(new Set(names));
  }, [activities]);

  // actividades filtradas
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const [resp] = a.details.split(" ");
      const businessName = a.businesses?.name || "";
      const detLower = a.details.toLowerCase();
      const searchLower = search.toLowerCase();

      const okResp =
        selectedResponsible === "all" || resp === selectedResponsible;
      const okBus =
        selectedBusiness === "all" || businessName === selectedBusiness;
      const okSearch =
        detLower.includes(searchLower) ||
        businessName.toLowerCase().includes(searchLower);

      // extraer fecha YYYY-MM-DD de timestamp
      const datePart = new Date(a.timestamp).toISOString().split("T")[0];
      const okDate = !selectedDate || datePart === selectedDate;

      return okResp && okBus && okSearch && okDate;
    });
  }, [activities, selectedResponsible, selectedBusiness, search, selectedDate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto" />
          <p className="mt-4 text-slate-600 dark:text-slate-400 uppercase">
            Cargando actividades...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 uppercase">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="app-title uppercase">Registro de Actividades</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Histórico de acciones de usuarios
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="app-card">
        <div className="flex flex-col md:flex-row gap-4 p-4">
          {/* Responsable */}
          <div className="flex-1">
            <label htmlFor="responsibleFilter" className="label mb-1">
              Responsable
            </label>
            <select
              id="responsibleFilter"
              className="input w-full"
              value={selectedResponsible}
              onChange={(e) => setSelectedResponsible(e.target.value)}
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
          <div className="flex-1">
            <label htmlFor="businessFilter" className="label mb-1">
              Negocio
            </label>
            <select
              id="businessFilter"
              className="input w-full"
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
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
          <div className="flex-1">
            <label htmlFor="dateFilter" className="label mb-1">
              Fecha
            </label>
            <input
              type="date"
              id="dateFilter"
              className="input w-full"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Buscador */}
          <div className="flex-1">
            <label htmlFor="search" className="label mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                id="search"
                type="text"
                placeholder="Detalle o negocio..."
                className="input pl-10 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="app-card p-0 overflow-hidden">
        <div className="table-container">
          <table className="table w-full">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell uppercase">Fecha</th>
                <th className="table-header-cell uppercase">Negocio</th>
                <th className="table-header-cell uppercase">Detalle</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {filtered.length > 0 ? (
                filtered.map((a) => {
                  const fecha = new Date(a.timestamp).toLocaleString();
                  const [resp, ...rest] = a.details.split(" ");
                  const resto = rest.join(" ");
                  return (
                    <tr key={a.id} className="table-row">
                      <td className="table-cell">{fecha}</td>
                      <td className="table-cell">
                        {a.businesses?.name || "–"}
                      </td>
                      <td className="table-cell">
                        <span className="font-semibold mr-1 text-sky-600 dark:text-sky-400">
                          {resp}
                        </span>
                        {resto}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="table-cell text-center py-8 text-slate-600 dark:text-slate-400"
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
