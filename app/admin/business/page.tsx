"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Building2, PlusCircle, Edit, Trash2, Save, Search, Users } from "lucide-react";

type BusinessRow = {
  id: string;
  name: string;
  alquiler: number | null;
  expensas: number | null;
  servicios: number | null;
  updated_at: string | null;
};

type EmployeeRow = {
  business_id: string;
  sueldo: number | null;
};

const currencyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function parseMoney(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const clean = v.toString().replace(/[^0-9\-]/g, "");
  const n = Number(clean);
  return isNaN(n) ? 0 : n;
}

function formatMoney(n: number | null | undefined) {
  const v = typeof n === "number" ? n : 0;
  return currencyFmt.format(v);
}

export default function BusinessMainTable() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [empleados, setEmpleados] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState<Partial<BusinessRow>>({});
  const [moneyDraft, setMoneyDraft] = useState({
    alquiler: "",
    expensas: "",
    servicios: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // === CARGA DE DATOS ===
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [businessRes, empRes] = await Promise.all([
        supabase.from("businesses").select("id, name, alquiler, expensas, servicios, updated_at"),
        supabase.from("employees").select("business_id, sueldo").eq("status", true),
      ]);

      if (businessRes.error) setError(businessRes.error.message);
      else if (empRes.error) setError(empRes.error.message);
      else {
        const mapped: BusinessRow[] = (businessRes.data || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          alquiler: parseMoney(r.alquiler),
          expensas: parseMoney(r.expensas),
          servicios: parseMoney(r.servicios),
          updated_at: r.updated_at ?? null,
        }));
        setRows(mapped);
        setEmpleados(empRes.data || []);
      }
      setLoading(false);
    })();
  }, []);

  // === GASTOS DE EMPLEADOS AGRUPADOS POR LOCAL ===
  const gastosEmpleados = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of empleados) {
      if (!e.business_id) continue;
      if (!map[e.business_id]) map[e.business_id] = 0;
      map[e.business_id] += e.sueldo || 0;
    }
    return map;
  }, [empleados]);

  const filtered = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );

  // === FUNCIONES DE MODAL ===
  function openCreate() {
    setModal("create");
    setDraft({ name: "" });
    setMoneyDraft({ alquiler: "", expensas: "", servicios: "" });
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  function openEdit(row: BusinessRow) {
    setModal("edit");
    setSelectedId(row.id);
    setDraft({ id: row.id, name: row.name });
    setMoneyDraft({
      alquiler: (row.alquiler ?? "").toString(),
      expensas: (row.expensas ?? "").toString(),
      servicios: (row.servicios ?? "").toString(),
    });
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  async function handleSave() {
    const payload = {
      name: draft.name?.trim() || "",
      alquiler: parseMoney(moneyDraft.alquiler),
      expensas: parseMoney(moneyDraft.expensas),
      servicios: parseMoney(moneyDraft.servicios),
    };

    if (modal === "create") {
      const { data, error } = await supabase.from("businesses").insert(payload).select("*").single();
      if (error) return setError(error.message);
      setRows((prev) => [...prev, data]);
    }

    if (modal === "edit" && selectedId) {
      const { data, error } = await supabase
        .from("businesses")
        .update(payload)
        .eq("id", selectedId)
        .select()
        .single();
    
      if (error) return setError(error.message);
      if (data) {
        const patched = {
          ...data,
          alquiler: parseMoney(data.alquiler),
          expensas: parseMoney(data.expensas),
          servicios: parseMoney(data.servicios),
        };
        setRows((prev) => prev.map((r) => (r.id === selectedId ? patched : r)));
      }
    }
    

    closeModal();
  }

  function closeModal() {
    setModal(null);
    setSelectedId(null);
  }

  // === RENDER ===
  return (
    <div className="p-6 mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="flex items-center bg-white border rounded-xl px-3 py-2 w-full md:w-auto shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar local..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="ml-2 flex-1 outline-none text-sm"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
        >
          <PlusCircle className="h-4 w-4" /> Nuevo local
        </button>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white shadow-lg rounded-2xl divide-y divide-slate-100">
        {loading ? (
          <div className="p-6 text-center text-slate-500">Cargando...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">Error: {error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No hay locales aún.</div>
        ) : (
          filtered.map((r) => {
            const gastoEmpleados = gastosEmpleados[r.id] || 0;
            const total =
              (r.alquiler || 0) + (r.expensas || 0) + (r.servicios || 0) + gastoEmpleados;

            return (
              <div
                key={r.id}
                className="px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                {/* HEADER DEL LOCAL */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-indigo-50 rounded-full grid place-items-center">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{r.name}</div>
                      <div className="text-xs text-slate-500">
                        Total mensual: {formatMoney(total)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(r)}
                      className="border border-slate-200 hover:bg-indigo-50 px-3 py-1.5 rounded-xl"
                    >
                      <Edit className="h-4 w-4 text-indigo-600" />
                    </button>
                    <button
                      onClick={() => alert(`Eliminar ${r.name}`)}
                      className="border border-slate-200 hover:bg-red-50 px-3 py-1.5 rounded-xl"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>

                {/* DESGLOSE DE GASTOS */}
                <div className="mt-3 ml-12 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg">
                    <span className="text-blue-600 font-medium">Alquiler</span>
                    <span className="text-slate-700">{formatMoney(r.alquiler)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-amber-50 px-3 py-2 rounded-lg">
                    <span className="text-amber-600 font-medium">Expensas</span>
                    <span className="text-slate-700">{formatMoney(r.expensas)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
                    <span className="text-green-600 font-medium">Servicios</span>
                    <span className="text-slate-700">{formatMoney(r.servicios)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-indigo-50 px-3 py-2 rounded-lg">
                    <span className="text-indigo-600 font-medium flex items-center gap-1">
                      <Users className="h-4 w-4" /> Empleados
                    </span>
                    <span className="text-slate-700">{formatMoney(gastoEmpleados)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL CUSTOM */}
      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              {modal === "create" ? "Crear nuevo local" : "Editar local"}
            </h2>

            {/* FORM */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600">Nombre</label>
                <input
                  ref={nameInputRef}
                  value={draft.name || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Ej: Av. Belgrano 1919"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {["alquiler", "expensas", "servicios"].map((key) => (
                  <div key={key}>
                    <label className="text-sm text-slate-600 capitalize">{key}</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        ARS
                      </span>
                      <input
                        value={moneyDraft[key as keyof typeof moneyDraft]}
                        onChange={(e) =>
                          setMoneyDraft((d) => ({
                            ...d,
                            [key]: e.target.value,
                          }))
                        }
                        className="pl-10 w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"
              >
                <Save className="h-4 w-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
