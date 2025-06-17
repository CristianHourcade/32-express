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
import LoadingSpinner from "@/components/LoadingSpinner";

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

function NoShiftBanner() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg space-y-2">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-300">
        ¡Estás sin turno activo!
      </h2>
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Para poder registrar ventas, primero inicia tu turno desde el Dashboard.
      </p>
      <Link href="/employee/dashboard" className="mt-4 btn btn-amber">
        Ir al Dashboard
      </Link>
    </div>
  )
}

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
type Shift = {
  id: string
  employee_id: string
  business_id: string
  start_time: string
  end_time: string | null
  start_cash: number
  end_cash: number | null
  active: boolean
  businessName: string
}

type Employee = {
  id: string
  userId: string
  email: string
  name: string
}
/* ────────────────────────────────────────────────────────── */
/*  Componente                                                */
/* ────────────────────────────────────────────────────────── */

export default function NewSalePage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [amountGiven, setAmountGiven] = useState<number | "">("");
  const { user } = useSelector((state: RootState) => state.auth)
  const [employees, setEmployees] = useState([]);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, user_id, email, name");
    setLoadingEmployees(false);
    if (error) {
      console.error("Error al cargar empleados:", error);
      return;
    }
    setEmployees(data);
  };
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
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

  useEffect(() => {
    fetchEmployees();
  }, []);
  /* ─ Fetch productos ─ */
  /* ─────────────── useEffect de carga inicial ─────────────── */
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setProductsLoading(true);
      try {
        // 1. Traigo stock del negocio paginado
        const stockMap: Record<string, number> = {};
        const pageSize = 1000;
        let page = 0;
        let done = false;

        while (!done) {
          const { from, to } = {
            from: page * pageSize,
            to: page * pageSize + pageSize - 1,
          };
          const { data, error } = await supabase
            .from("business_inventory")
            .select("product_id, stock")
            .eq("business_id", businessId)
            .range(from, to);

          if (error) throw error;

          (data ?? []).forEach((r: any) => {
            stockMap[r.product_id?.toString()] = r.stock;
          });

          if (!data?.length || data.length < pageSize) done = true;
          page++;
        }

        console.log("📦 Inventario cargado:", stockMap);

        // 2. Traigo todos los productos master en páginas de 1000
        let acc: any[] = [];
        page = 0;
        done = false;

        while (!done) {
          const { from, to } = {
            from: page * pageSize,
            to: page * pageSize + pageSize - 1,
          };
          const { data, error } = await supabase
            .from("products_master")
            .select("*")
            .range(from, to);
          if (error) throw error;
          acc = acc.concat(data ?? []);
          if (!data?.length || data.length < pageSize) done = true;
          page++;
        }

        // 3. Mapeo stock en cada producto master
        const prodsWithStock = acc.map((p) => ({
          ...p,
          stock: stockMap[p.id.toString()] ?? 0,
        }));

        // 4. Traigo promociones y les asigno stock "ilimitado"
        const { data: promos } = await supabase
          .from("promotions")
          .select("*")
          .eq("businesses_id", businessId);
        const promoRows =
          promos?.map((p) => ({
            ...p,
            code: "PROMO",
            selling_price: p.price,
            products: p.products,
            stock: 999,
          })) ?? [];

        // 5. Seteo productos con stock + promos
        setProducts([...promoRows, ...prodsWithStock]);
      } catch (err) {
        console.error(err);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    })();
  }, [businessId]);


  /* ─ Shifts ─ */
  // useEffect(() => {
  //   dispatch(getShifts());
  // }, [dispatch]);

  const currentEmp = useMemo(() => {
    if (!user) return null;
    return (
      employees.find((e) => e.userId === user.id) ||
      employees.find((e) => e.email.toLowerCase() === user.email.toLowerCase())
    );
  }, [employees, user]);

  const activeShift = useMemo(() => {
    if (!currentEmp) return null;
    return shifts.find((s) => s.end_time === null);
  }, [shifts, currentEmp]);

  // 2. Función para traer shifts desde Supabase
  const fetchShifts = async () => {
    if (!currentEmp) return;
    setLoadingShifts(true);
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("employee_id", currentEmp.id)
      .order("start_time", { ascending: false });
    setLoadingShifts(false);
    if (error) {
      console.error("Error al cargar shifts:", error);
      return;
    }
    setShifts(data);
  };

  useEffect(() => {
    fetchShifts();
  }, [currentEmp]);
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
    const currentInCart = cart.find((item) => item.productId === p.id);
    const quantityInCart = currentInCart?.quantity || 0;

    if (quantityInCart >= p.stock) {
      toastSinStock();
      return;
    }

    if (currentInCart) {
      updateQty(cart.indexOf(currentInCart), quantityInCart + 1);
    } else {
      setCart([
        ...cart,
        {
          productId: p.id,
          productName: p.name,
          price: p.default_selling || p.default_selling,
          quantity: 1,
          total: p.default_selling || p.default_selling,
          stock: p.stock, // ← stock real, sin restar
          listID: p.products,
        },
      ]);
    }
  };



  const updateQty = (idx: number, newQ: number) => {
    const prod = products.find((p) => p.id === cart[idx].productId);
    setCart((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        quantity: newQ,
        total: newQ * next[idx].price,
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
      // 1. Traigo stock del negocio paginado
      const stockMap: Record<string, number> = {};
      const pageSize = 1000;
      let page = 0;
      let done = false;

      while (!done) {
        const { from, to } = {
          from: page * pageSize,
          to: page * pageSize + pageSize - 1,
        };
        const { data, error } = await supabase
          .from("business_inventory")
          .select("product_id, stock")
          .eq("business_id", businessId)
          .range(from, to);

        if (error) throw error;

        (data ?? []).forEach((r: any) => {
          stockMap[r.product_id?.toString()] = r.stock;
        });

        if (!data?.length || data.length < pageSize) done = true;
        page++;
      }

      // 2. Traigo productos paginados
      let acc: any[] = [];
      page = 0;
      done = false;

      while (!done) {
        const { from, to } = {
          from: page * pageSize,
          to: page * pageSize + pageSize - 1,
        };
        const { data, error } = await supabase
          .from("products_master")
          .select("*")
          .range(from, to);
        if (error) throw error;
        acc = acc.concat(data ?? []);
        if (!data?.length || data.length < pageSize) done = true;
        page++;
      }

      // 3. Mapeo stock en productos
      const prodsWithStock = acc.map((p) => ({
        ...p,
        stock: stockMap[p.id.toString()] ?? 0,
      }));

      // 4. Promos
      const { data: promos } = await supabase
        .from("promotions")
        .select("*")
        .eq("businesses_id", businessId);
      const promoRows =
        promos?.map((p) => ({
          ...p,
          code: "PROMO",
          selling_price: p.price,
          products: p.products,
          stock: 999,
        })) ?? [];

      // 5. Seteo todo
      setProducts([...promoRows, ...prodsWithStock]);
    } catch (err) {
      console.error("Error al cargar productos:", err);
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
      // 1. Armo los datos de la venta
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

      // 2. Registro la venta en Redux / backend
      const saleResult = await dispatch(createSale(saleData)).unwrap();
      if (!saleResult) throw new Error("No se pudo registrar la venta.");

      // 3. Traigo stock actual de business_inventory para calcular descuentos
      const { data: invRows, error: invErr } = await supabase
        .from("business_inventory")
        .select("product_id, stock")
        .eq("business_id", businessId);
      if (invErr) throw invErr;

      const stockMap: Record<string, number> = {};
      invRows?.forEach((r: any) => {
        stockMap[r.product_id] = r.stock;
      });

      // 4. Agrupo cantidades a descontar por productId
      const stockToUpdate: Record<string, number> = {};
      for (const it of cart) {
        if (it.listID && Array.isArray(it.listID)) {
          for (const pi of it.listID) {
            if (!pi.id || typeof pi.qty !== "number") continue;
            const qty = pi.qty * it.quantity;
            stockToUpdate[pi.id] = (stockToUpdate[pi.id] || 0) + qty;
          }
        } else {
          const qty = it.quantity;
          stockToUpdate[it.productId] = (stockToUpdate[it.productId] || 0) + qty;
        }
      }


      // 5. Actualizo stock en business_inventory
      for (const productId in stockToUpdate) {
        const currentStock = stockMap[productId] ?? 0;
        const newStock = Math.max(0, currentStock - stockToUpdate[productId]);

        const { error } = await supabase
          .from("business_inventory")
          .update({ stock: newStock })
          .eq("business_id", businessId)
          .eq("product_id", productId);

        if (error) throw error;
      }

      // 6. Refresco productos (trae nuevamente stock + promos)
      await loadProducts();

      // 7. Éxito: limpio carrito, cierro modal, muestro toast
      setToast("Venta registrada ✔︎");
      setCart([]);
      setConfirm(false);
      setAmountGiven("");
      setSearch("");
      setTimeout(() => setToast(""), 3000);
    } catch (err: any) {
      console.error("Error al completar venta:", err);
      setToast("❌ Error: " + (err.message || "algo salió mal"));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setProcessing(false);
    }
  };



  const change = useMemo(() => {
    if (typeof amountGiven !== "number") return null;
    return amountGiven - cartTotal;
  }, [amountGiven, cartTotal]);

  console.log(businessId)
  /* ───────────────────────────────────── UI ───────────────────────────────────── */
  if (loadingShifts) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <LoadingSpinner />
        </div>
      </div>
    )
  }


  const loading = productsLoading || loadingShifts || loadingEmployees;

  if (!activeShift) {
    return (
      <div className="p-6">
        <NoShiftBanner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nueva Venta</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {activeShift ? `Turno de ${currentEmp.name}` : "Sin turno activo"}
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Search & results */}
        <section className="cols-6 space-y-4">
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
                  <thead className="bg-slate-100 dark:bg-slate-700/70 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Producto</th>
                      <th className="px-4 py-2 text-left">Precio</th>
                      <th className="px-4 py-2 text-left">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center">
                          Cargando…
                        </td>
                      </tr>
                    ) : filteredProducts.length ? (
                      filteredProducts.map((p) => {
                        const { category, baseName } = extractCategory(p.name);
                        const badgeColor = p.code === "PROMO"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                          : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";

                        return (
                          <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                {category && (
                                  <span className={`text-[10px] font-semibold mt-1 w-fit px-2 py-0.5 rounded-full ${badgeColor}`}>
                                    {category}
                                  </span>
                                )}
                                <span className="font-medium">{baseName}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">{p.code.toUpperCase()}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{formatCurrency(p.default_selling)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => addToCart(p)}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md ${p.stock <= 0
                                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  }`}
                                disabled={p.stock <= 0}
                              >
                                <Plus className="h-4 w-4" />
                                Agregar
                              </button>

                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center">
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
        <aside className="w-full  space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md p-5">
            <header className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrito

              </h2>

              <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">

                {cart.length} items
              </span>
            </header>
            <div>
              {cart.length > 1 && (
                <button
                  onClick={() => setCart([])}
                  className="text-sm text-rose-500 hover:underline  mb-3"
                >
                  Vaciar carrito
                </button>
              )}
            </div>
            {cart.length ? (
              <>
                <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {cart.map((it, i) => (
                    <li key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-4 flex flex-col space-y-2 shadow-sm">
                      {/* Nombre y eliminar */}
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{it.productName}
                            <span className="text-xs ml-3 font-normal bg-blue-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded px-2 py-0.5">
                              {formatCurrency(it.price)} c/u
                            </span></p>
                        </div>

                        <button onClick={() => removeIdx(i)} className="text-rose-500 hover:text-rose-700">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Controles de cantidad y total */}
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (it.quantity == 1) return;
                              updateQty(i, it.quantity - 1)
                            }}
                            disabled={it.quantity == 1}
                            className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center "
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span
                            className="text-sm w-8 text-center font-semibold transition-transform duration-150 ease-in-out scale-100 group-hover:scale-110"
                          >
                            {it.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(i, it.quantity + 1)}
                            disabled={it.quantity >= it.stock}
                            className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-4 h-4" />
                          </button>


                        </div>

                        <p className="text-right text-base font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-200">
                          {formatCurrency(it.total)}
                        </p>
                      </div>
                    </li>

                  ))}
                </ul>

                {/* Resumen y pago */}
                <div className="border-t border-slate-300 dark:border-slate-600 pt-4 mt-4 space-y-4">
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>

                  {/* Método de pago */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {(["cash", "card", "transfer", "rappi"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`rounded-md py-2 font-semibold transition-all ${paymentMethod === m
                          ? "ring-2 ring-red-500 dark:ring-red-400"
                          : "ring-1 ring-slate-300 dark:ring-slate-600"
                          } ${{
                            cash: "bg-emerald-100 dark:bg-emerald-900/30",
                            card: "bg-indigo-100 dark:bg-indigo-900/30",
                            transfer: "bg-purple-100 dark:bg-purple-900/30",
                            rappi: "bg-orange-100 dark:bg-orange-900/30",
                          }[m]}`}
                      >
                        {{
                          cash: "Efectivo",
                          card: "Tarjeta",
                          transfer: "Transferencia",
                          rappi: "Rappi",
                        }[m]}
                      </button>
                    ))}
                  </div>

                  {/* Input efectivo */}
                  {paymentMethod === "cash" && (
                    <div>
                      <label htmlFor="amountGiven" className="block font-medium mb-1">
                        ¿Con cuánto paga el cliente?
                      </label>
                      <input
                        id="amountGiven"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        className="w-full text-lg px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-300 dark:border-gray-700"
                        value={amountGiven}
                        onChange={(e) =>
                          setAmountGiven(e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value)))
                        }
                      />
                      {typeof change === "number" && (
                        <p className={`mt-2 font-semibold ${change < 0 ? "text-red-600" : "text-green-600"}`}>
                          {change < 0 ? "Monto insuficiente" : `Vuelto: ${formatCurrency(change)}`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Botón confirmar */}
                  <button
                    onClick={() => setConfirm(true)}
                    className="w-full mt-2 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition"
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
