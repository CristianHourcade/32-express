"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

/* ========= HELPERS ========= */
function monthRange(offset = 0) {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end };
}
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kmb = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : n.toFixed(0));

/* ========= QUERIES ========= */
const paged = async (
    run: (lo: number, hi: number) => Promise<{ data: any[] | null; error: any }>
) => {
    const size = 1000;
    let page = 0, out: any[] = [];
    for (; ;) {
        const { data, error } = await run(page * size, page * size + size - 1);
        if (error) { console.error(error); break; }
        if (!data?.length) break;
        out = out.concat(data);
        if (data.length < size) break;
        page++;
    }
    return out;
};

const loadBusinesses = async () => {
    const { data, error } = await supabase.from("businesses").select("*").order("name");
    if (error) { console.error(error); return []; }
    return data ?? [];
};

const loadMoves = async (bizId: string, from: Date, to: Date) =>
    paged((lo, hi) =>
        supabase
            .from("savings_transactions")
            .select("*")
            .eq("business_id", bizId)
            .gte("created_at", from.toISOString())
            .lt("created_at", to.toISOString())
            .order("created_at", { ascending: false })
            .range(lo, hi)
    );

const addMove = async (bizId: string, amount: number, note = "") =>
    supabase.from("savings_transactions").insert({ business_id: bizId, amount, note });

/* ========= PAGE ========= */
export default function SavingsPage() {
    const [offset, setOffset] = useState(0);
    const { start, end } = useMemo(() => monthRange(offset), [offset]);
    const monthLabel = start.toLocaleString("es-ES", { month: "long", year: "numeric" });

    const [biz, setBiz] = useState<any[]>([]);
    const [moves, setMoves] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const businesses = await loadBusinesses();
            setBiz(businesses);

            let all: any[] = [];
            for (const b of businesses) all = all.concat(await loadMoves(b.id, start, end));
            setMoves(all);

            setLoading(false);
        })();
    }, [start, end]);

    /* helpers -------------------------------------------------- */
    const refreshBiz = async (id: string) => {
        const fresh = await loadMoves(id, start, end);   // <— FIX aquí
        setMoves((prev) => prev.filter((m) => m.business_id !== id).concat(fresh));
    };

    const ask = (msg: string) => {
        const raw = prompt(msg);
        if (!raw) return null;
        const n = Number(raw.replace(",", "."));
        return isNaN(n) || n <= 0 ? null : n;
    };

    const reserve = async (id: string) => {
        const val = ask("Monto a reservar (USD):");
        if (val == null) return alert("Monto inválido");
        const { error } = await addMove(id, val);
        if (error) return alert("Error guardando");
        refreshBiz(id);
    };

    const withdraw = async (id: string) => {
        const val = ask("Monto a retirar (USD):");
        if (val == null) return alert("Monto inválido");
        const { error } = await addMove(id, -val);
        if (error) return alert("Error guardando");
        refreshBiz(id);
    };

    /* métricas ------------------------------------------------- */
    const rows = biz.map((b) => {
        const list = moves.filter((m) => m.business_id === b.id);
        const monthTotal = list.reduce((a, n) => a + n.amount, 0);
        return { ...b, monthTotal, list };
    });

    /* UI ------------------------------------------------------- */
    return (
        <div className="space-y-6 p-4">
            {/* Header */}
            <header className="flex items-center gap-4 flex-wrap mt-4">
                <button aria-label="Mes anterior" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
                    onClick={() => setOffset((o) => o - 1)} disabled={loading}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <h1 className="text-[clamp(1.5rem,2.5vw,2rem)] font-bold capitalize">{monthLabel}</h1>

                <button aria-label="Mes siguiente" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
                    onClick={() => setOffset((o) => o + 1)} disabled={loading}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </header>

            {/* Grid */}
            <section className="mt-6">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-48 rounded-2xl bg-slate-200/60 dark:bg-slate-700/30 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rows.map((b) => (
                            <div key={b.id}
                                className="rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur p-6 border border-slate-200 dark:border-slate-700
                           transform-gpu transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-semibold truncate dark:text-white">{b.name}</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => reserve(b.id)}
                                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-3 py-1.5 shadow">
                                            + Reserva
                                        </button>
                                        <button onClick={() => withdraw(b.id)}
                                            className="text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-full px-3 py-1.5 shadow">
                                            – Retiro
                                        </button>
                                    </div>
                                </div>

                                {/* Saldo mes */}
                                <p className="text-sm text-slate-500 dark:text-slate-400">Saldo mes</p>
                                <p className={`text-2xl font-bold ${b.monthTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-rose-500"} mb-4`}>
                                    $ {fmt(Math.abs(b.monthTotal))} {b.monthTotal < 0 && "(–)"}
                                </p>

                                <hr className="border-slate-300 dark:border-slate-600 my-3" />

                                {/* Movimientos */}
                                {b.list.length ? (
                                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                        {b.list.map((m: any) => (
                                            <div key={m.id} className="text-xs flex justify-between">
                                                <span>{new Date(m.created_at).toLocaleDateString()}</span>
                                                <span className={m.amount >= 0 ? "text-green-600" : "text-rose-500"}>
                                                    {m.amount >= 0 ? "+ " : "– "} $ {kmb(Math.abs(m.amount))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500">Sin movimientos este mes.</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
