/* ----------------------------------------------------------------
   src/app/employee/new-sale/page.tsx
   ---------------------------------------------------------------- */

"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/lib/redux/store";
import { editProduct } from "@/lib/redux/slices/productSlice";
import { createSale } from "@/lib/redux/slices/salesSlice";
import { getShifts } from "@/lib/redux/slices/shiftSlice";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ────────────────────────────────────────────────────────── */
/*  Constantes & helpers                                      */
/* ────────────────────────────────────────────────────────── */

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
];

const extractCategory = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length > 1 && CATEGORIES.includes(parts[0].toUpperCase()))
    return { category: parts[0].toUpperCase(), baseName: parts.slice(1).join(" ") };
  return { category: null, baseName: name };
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

function useDebounce<T>(val: T, ms: number) {
  const [deb, setDeb] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setDeb(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return deb;
}

type CartItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  total: number;
  stock: number;
  listID?: any;
};

/* ────────────────────────────────────────────────────────── */
/*  Componente                                                */
/* ────────────────────────────────────────────────────────── */

export default function NewSalePage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { user } = useSelector((s: RootState) => s.auth);
  const { shifts, loading: shiftsLoading } = useSelector((s: RootState) => s.shifts);
  const { employees } = useSelector((s: RootState) => s.employees);

  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "transfer" | "mercadopago" | "rappi"
  >("cash");

  const [confirm, setConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const businessId = user?.businessId;

  /* ─ Fetch productos ─ */
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setProductsLoading(true);
      try {
        const pageSize = 1000;
        let page = 0;
        let acc: any[] = [];
        let done = false;
        while (!done) {
          const { from, to } = { from: page * pageSize, to: page * pageSize + pageSize - 1 };
          const { data, error } = await supabase
            .from("products")
            .select("*")
            .eq("business_id", businessId)
            .range(from, to);
          if (error) throw error;
          if (!data?.length || data.length < pageSize) done = true;
          acc = acc.concat(data ?? []);
          page++;
        }
        /* promos */
        const { data: promos } = await supabase
          .from("promotions")
          .select("*")
          .eq("businesses_id", businessId);
        const promoRows =
          promos?.map((p) => ({
            business_id: p.businesses_id,
            code: "PROMO",
            id: p.id,
            name: p.name,
            selling_price: p.price,
            products: p.products,
            stock: 999,
          })) ?? [];
        setProducts([...promoRows, ...acc]);
      } catch (err) {
        console.error(err);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    })();
  }, [businessId]);

  /* ─ Shifts ─ */
  useEffect(() => {
    dispatch(getShifts());
  }, [dispatch]);

  const currentEmp = useMemo(() => {
    if (!user) return null;
    return (
      employees.find((e) => e.userId === user.id) ||
      employees.find((e) => e.email.toLowerCase() === user.email.toLowerCase())
    );
  }, [employees, user]);

  const activeShift = useMemo(
    () =>
      currentEmp ? shifts.find((s) => s.employeeId === currentEmp.id && s.active) : null,
    [shifts, currentEmp]
  );

  /* ─ Filtro búsqueda ─ */
  const filteredProducts = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const q = debouncedSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [debouncedSearch, products]);

  /* ─ Cart helpers ─ */
  const toastSinStock = () => {
    setToast("Sin stock disponible");
    setTimeout(() => setToast(""), 2000);
  };

  const addToCart = (p: any) => {
    const idx = cart.findIndex((i) => i.productId === p.id);
    if (idx >= 0) {
      if (cart[idx].quantity >= p.stock) return toastSinStock();
      updateQty(idx, cart[idx].quantity + 1);
    } else if (p.stock > 0) {
      setCart([
        ...cart,
        {
          productId: p.id,
          productName: p.name,
          price: p.selling_price || p.sellingPrice,
          quantity: 1,
          total: p.selling_price || p.sellingPrice,
          stock: p.stock - 1,
          listID: p.products,
        },
      ]);
    } else toastSinStock();
  };

  const updateQty = (idx: number, newQ: number) => {
    const prod = products.find((p) => p.id === cart[idx].productId);
    if (!prod || newQ < 1 || newQ > prod.stock) return toastSinStock();
    setCart((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        quantity: newQ,
        total: newQ * next[idx].price,
        stock: prod.stock - newQ,
      };
      return next;
    });
  };

  const removeIdx = (idx: number) => setCart((c) => c.filter((_, i) => i !== idx));

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.total, 0), [cart]);

  const loadProducts = async () => {
    if (!businessId) return;
    setProductsLoading(true);
    try {
      const pageSize = 1000;
      let page = 0;
      let acc: any[] = [];
      let done = false;
      while (!done) {
        const { from, to } = { from: page * pageSize, to: page * pageSize + pageSize - 1 };
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("business_id", businessId)
          .range(from, to);
        if (error) throw error;
        if (!data?.length || data.length < pageSize) done = true;
        acc = acc.concat(data ?? []);
        page++;
      }
      const { data: promos } = await supabase
        .from("promotions")
        .select("*")
        .eq("businesses_id", businessId);
      const promoRows =
        promos?.map((p) => ({
          business_id: p.businesses_id,
          code: "PROMO",
          id: p.id,
          name: p.name,
          selling_price: p.price,
          products: p.products,
          stock: 999,
        })) ?? [];
      setProducts([...promoRows, ...acc]);
    } catch (err) {
      console.error(err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };
  /* ─ Complete sale ─ */
  const handleComplete = async () => {
    if (!activeShift || !cart.length) return;
    setProcessing(true);

    try {
      const saleData = {
        businessId: businessId!,
        businessName: activeShift.businessName,
        employeeId: currentEmp ? currentEmp.id : user!.id,
        employeeName: user!.name,
        items: cart,
        total: cartTotal,
        paymentMethod,
        timestamp: new Date().toISOString(),
        shiftId: activeShift.id,
      };

      // 1. Registrar venta
      const saleResult = await dispatch(createSale(saleData)).unwrap(); // importante: .unwrap() lanza error si falla
      if (!saleResult) throw new Error("No se pudo registrar la venta.");

      // 2. Actualizar stock
      for (const it of cart) {
        if (it.listID) {
          for (const pi of it.listID) {
            const prod = products.find((p) => p.id === pi.id);
            if (!prod) throw new Error(`Producto no encontrado (ID: ${pi.id})`);
            await dispatch(editProduct({ ...prod, stock: prod.stock - pi.qty * it.quantity })).unwrap();
          }
        } else {
          const prod = products.find((p) => p.id === it.productId);
          if (!prod) throw new Error(`Producto no encontrado (ID: ${it.productId})`);
          await dispatch(editProduct({ ...prod, stock: prod.stock - it.quantity })).unwrap();
        }
      }

      await loadProducts();
setSearch("")
      // 3. Éxito
      setToast("Venta registrada ✔︎");
      setCart([]);
      setConfirm(false);
      setTimeout(() => setToast(""), 3000);

    } catch (err: any) {
      console.error("Error al registrar la venta o actualizar el stock:", err);
      setToast("❌ Error: " + (err.message || "algo salió mal"));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setProcessing(false);
    }
  };





  /* ───────────────────────────────────── UI ───────────────────────────────────── */

  if (!activeShift && !shiftsLoading) router.replace("/employee/dashboard");

  const loading = productsLoading || shiftsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nueva Venta</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {activeShift ? `Turno en ${activeShift.businessName}` : "Sin turno activo"}
          </p>
        </div>
        <Link href="/employee/dashboard" className="btn btn-secondary">
          Volver al Dashboard
        </Link>
      </header>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-md px-4 py-3 text-sm font-medium ${toast.includes("✔︎")
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
            }`}
        >
          {toast}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Search & results */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar por nombre o código…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!activeShift}
                className="input pl-11 w-full"
              />
            </div>
          </div>

          {debouncedSearch && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
              <header className="border-b border-slate-200 dark:border-slate-700 px-4 py-2 font-semibold">
                Resultados
              </header>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-700/70">
                    <tr>
                      {["Producto", "Precio", "Acción"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left font-medium text-xs uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center">
                          Cargando…
                        </td>
                      </tr>
                    ) : filteredProducts.length ? (
                      filteredProducts.map((p) => {
                        const { category, baseName } = extractCategory(p.name);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-2">
                              {category && (
                                <span className="block text-[10px] text-sky-500 font-bold">
                                  {category}
                                </span>
                              )}
                              <span className="block">{baseName.toUpperCase()}</span>
                              <span
                                className={`block text-[10px] ${p.code === "PROMO"
                                  ? "text-rose-500"
                                  : "text-slate-500 dark:text-slate-400"
                                  }`}
                              >
                                {p.code.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-2">{formatCurrency(p.selling_price)}</td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => addToCart(p)}
                                disabled={!activeShift || p.stock <= 0}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium ${p.stock <= 0
                                  ? "bg-rose-200 text-rose-800 cursor-not-allowed"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                                  }`}
                              >
                                {p.stock <= 0 ? "SIN STOCK" : "AGREGAR"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center">
                          Sin coincidencias.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Cart */}
        <aside className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
            <header className="flex justify-between items-center">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrito
              </h2>
              <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {cart.length}
              </span>
            </header>

            {cart.length ? (
              <>
                <ul className="space-y-3 mt-4">
                  {cart.map((it, i) => (
                    <li key={i} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded p-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{it.productName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatCurrency(it.price)} c/u
                        </p>
                      </div>

                      {/* qty controls */}
                      <div className="flex items-center gap-1">
                        <Circle onClick={() => updateQty(i, it.quantity - 1)}>
                          <Minus className="h-4 w-4" />
                        </Circle>
                        <span className="w-6 text-center">{it.quantity}</span>
                        <Circle onClick={() => updateQty(i, it.quantity + 1)}>
                          <Plus className="h-4 w-4" />
                        </Circle>
                      </div>

                      {/* stock restante */}
                      <span
                        className={`px-1.5 py-0.5 text-[10px] rounded-full ${it.stock < 0
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}
                      >
                        {it.stock}
                      </span>

                      {/* remove */}
                      <Circle onClick={() => removeIdx(i)}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Circle>

                      {/* total */}
                      <p className="w-20 text-right font-medium">
                        {formatCurrency(it.total)}
                      </p>
                    </li>
                  ))}
                </ul>

                {/* summary */}
                <div className="border-t border-slate-200 dark:border-slate-600 pt-4 mt-4 space-y-3">
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>

                  {/* payment buttons */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(["cash", "card", "transfer", "rappi"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`rounded py-1.5 ${paymentMethod === m
                          ? "ring-2 ring-emerald-500 dark:ring-emerald-400"
                          : "ring-1 ring-slate-300 dark:ring-slate-600"
                          } ${{
                            cash: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                            card: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
                            transfer:
                              "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
                            rappi:
                              "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
                          }[m]
                          }`}
                      >
                        {
                          {
                            cash: "Efectivo",
                            card: "Tarjeta",
                            transfer: "Transferencia",
                            rappi: "Rappi",
                          }[m]
                        }
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setConfirm(true)}
                    className="btn btn-primary w-full"
                    disabled={!activeShift}
                  >
                    Completar venta
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <ShoppingCart className="mx-auto h-12 w-12 text-slate-400" />
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                  El carrito está vacío.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* confirm modal */}
      {confirm && (
        <Modal title="Confirmar venta" onClose={() => setConfirm(false)}>
          <p className="mb-4">¿Deseas confirmar esta venta?</p>
          <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded mb-4 text-sm">
            <div className="flex justify-between mb-1">
              <span>Total:</span>
              <span className="font-semibold">{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Método:</span>
              <span className="font-semibold capitalize">{paymentMethod}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirm(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button onClick={handleComplete} className="btn btn-primary" disabled={processing}>
              {processing ? "Procesando…" : "Confirmar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────────────── small components ───────────────────── */

const Circle = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    className={`p-1 rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 ${props.className ?? ""
      }`}
    type="button"
  />
);

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-800 shadow-lg">
        <header className="flex justify-between items-center border-b border-slate-200 dark:border-slate-600 px-5 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
            <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </button>
        </header>
        <main className="px-5 py-4 text-sm">{children}</main>
      </div>
    </div>
  );
}
