"use client";

import React from "react";
import { CalendarDays } from "lucide-react";

const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

// Datos de proveedores por día
const schedule: Record<string, string[]> = {
  Lunes: ["Bebidas", "Quentos", "Lays", "Panchos"],
  Martes: [],
  Miércoles: ["Golosinas", "Puchos", "Cerveza", "Alcohol"],
  Jueves: ["Bebidas", "Pan Lactal", "Pan San Jose", "Fiambres"],
  Viernes: [],
};

export default function ProvidersCalendarPage() {
  return (
    <div className="p-8 min-h-screen">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-md">
          <CalendarDays className="h-6 w-6 text-sky-600 dark:text-sky-400" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
          Calendario de Proveedores
        </h1>
      </header>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {weekdays.map((day) => (
          <div
            key={day}
            className="flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden transform hover:scale-[1.02] transition"
          >
            <div className="px-4 py-2 bg-sky-100 dark:bg-sky-900/30">
              <h2 className="text-sm font-semibold text-sky-800 dark:text-sky-200 uppercase">
                {day}
              </h2>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[300px]">
              {schedule[day] && schedule[day].length ? (
                schedule[day].map((prov, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:shadow-md transition focus:outline-none"
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {prov}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-400 italic">Sin proveedores</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}