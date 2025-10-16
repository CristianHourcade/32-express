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
  Key,
  Tag
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ANGEL_CRISTIAN_USERTOKEN = process.env.NEXT_PUBLIC_ANGEL_CRISTIAN_USERTOKEN;
const ANGEL_CRISTIAN_APIKEY = process.env.NEXT_PUBLIC_ANGEL_CRISTIAN_APIKEY;
const ANGEL_CRISTIAN_APITOKEN = process.env.NEXT_PUBLIC_ANGEL_CRISTIAN_APITOKEN;
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
/* ====== Ticket Print Helpers (HTML + window.print) ====== */

// Elegí "80mm" o "58mm"
const TICKET_WIDTH_MM = 80;

// arma el HTML del ticket (estético)
function buildReceiptHTML({
  negocio,
  direccion,
  cuit,
  items,
  subtotal,
  total,
  metodoPago,
  pagoCon,
  vuelto,
  footer = "Gracias por su compra!",
}: {
  negocio: string;
  direccion?: string;
  cuit?: string;
  items: { qty: number; name: string; total: number }[];
  subtotal: number;
  total: number;
  metodoPago: string;
  pagoCon?: number | null;
  vuelto?: number | null;
  footer?: string;
}) {
  const cols = TICKET_WIDTH_MM === 80 ? 42 : 32;
  const leftCols = TICKET_WIDTH_MM === 80 ? 28 : 22;
  const rightCols = cols - leftCols;

  const padRight = (s: string, n: number) =>
    (s.length > n ? s.slice(0, n) : s + " ".repeat(n - s.length));
  const padLeft = (s: string, n: number) =>
    (s.length > n ? s.slice(0, n) : " ".repeat(n - s.length) + s);

  const money = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    })
      .format(n)
      .replace("$", "ARS ");

  const lines = items.map((it) => {
    const left = `${it.qty} x ${it.name}`.trim();
    const right = money(it.total);
    return `${padRight(left, leftCols)}${padLeft(right, rightCols)}`;
  });

  const now = new Date();
  const fecha =
    now.toLocaleDateString("es-AR") +
    " " +
    now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Ticket</title>
<style>
  @page { size: ${TICKET_WIDTH_MM}mm auto; margin: 0; }
  @media print { body { margin: 0; } }
  body {
    width: ${TICKET_WIDTH_MM}mm;
    font-family: monospace;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .container { padding: 6px 10px; }
  .center { text-align: center; }
  .muted { color: #222; font-size: 11px; }
  .sep {
    margin: 8px 0;
    border-top: 1px dashed #000;
    height: 0;
  }
  .h1 {
    font-weight: 900;
    font-size: 15px;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .row {
    white-space: pre;
    font-size: 12px;
    line-height: 1.3;
  }
  .big {
    font-weight: 900;
    font-size: 13px;
    margin-top: 5px;
  }
  .total-box {
    border-top: 2px solid #000;
    margin-top: 6px;
    padding-top: 4px;
  }
  .footer {
    margin-top: 12px;
    font-size: 11px;
  }
  .pill {
    display:inline-block;
    padding:2px 6px;
    border-radius:8px;
    background:#000;
    color:#fff;
    font-size:10px;
    margin-top:4px;
  }
  .logo {
    font-weight: 900;
    font-size: 18px;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="center">
      <div class="logo">${negocio}</div>
      <div class="muted">${fecha}</div>
    </div>
    </br>

    <div>====================================</div>
    <div class="sep"></div>
    ${lines.map((l) => `<div class="row">${l}</div>`).join("")}
    <div class="sep"></div>
    <div>====================================</div>
    </br>

    ${pagoCon != null ? `<div class="row">${padRight("Pago con", leftCols)}${padLeft(money(pagoCon), rightCols)}</div>` : ""}
    ${vuelto != null ? `<div class="row">${padRight("Vuelto", leftCols)}${padLeft(money(vuelto), rightCols)}</div>` : ""}

    <div class="total-box">
      <div class="row big">${padRight("TOTAL", leftCols)}${padLeft(money(total), rightCols)}</div>
    </div>
    <div>====================================</div>
    </br>
    <div class="row">${padRight("Metodo: " + metodoPago.toUpperCase(), cols)}</div>

    <div class="">
      <div>${footer}</div>
      <div class>Instagram: @breca.cafe</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}


// abre una ventana y dispara la impresión
async function printHTMLTicket(html: string) {
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) throw new Error("El navegador bloqueó la ventana de impresión");
  w.document.open();
  w.document.write(html);
  w.document.close();
  // esperar a que renderice
  await new Promise((r) => setTimeout(r, 100));
  w.focus();
  w.print();
  // en algunos navegadores conviene cerrar al final
  setTimeout(() => { try { w.close(); } catch { } }, 300);
}

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
  // Para guardar los productos que coinciden con el mismo código
  const [matchingProducts, setMatchingProducts] = useState<any[]>([]);

  // Para controlar la visibilidad del modal de selección
  const [showSelectModal, setShowSelectModal] = useState(false);

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
        const stockMap: Record<string, number> = {};

        // 1. Cargar stock actual
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

        // 2. Cargar productos master
        page = 0;
        done = false;
        let acc: any[] = [];
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

        const prodsWithStock = acc.map((p) => ({
          ...p,
          stock: stockMap[p.id.toString()] ?? 0,
        }));

        // 3. Cargar promociones activas
        const { data: promosRaw, error: promosError } = await supabase
          .from("promos")
          .select("*, promo_items (product_id, quantity)")
          .eq("is_active", true);

        if (promosError) throw promosError;

        const promosFormatted = (promosRaw ?? []).map((promo) => ({
          ...promo,
          code: promo.code,
          name: promo.name,
          default_selling: promo.promo_price,
          stock: 999,
          products: promo.promo_items.map((pi) => ({
            id: pi.product_id,
            qty: pi.quantity,
          })),
        }));

        // 4. Guardar ambos
        setProducts([...promosFormatted, ...prodsWithStock]);
      } catch (err) {
        console.error("❌ Error al cargar productos + promos:", err);
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
      const { data: promosRaw, error: promosError } = await supabase
        .from("promos")
        .select("*, promo_items (product_id, quantity)")
        .eq("is_active", true);

      if (promosError) throw promosError;

      const promosFormatted = (promosRaw ?? []).map((promo) => ({
        ...promo,
        code: promo.code,
        name: promo.name,
        default_selling: promo.promo_price,
        stock: 999,
        products: promo.promo_items.map((pi) => ({
          id: pi.product_id,
          qty: pi.quantity,
        })),
      }));

      setProducts([...promosFormatted, ...prodsWithStock]);
    } catch (err) {
      console.error("Error al cargar productos:", err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  // Llama a esto cuando quieras imprimir (usa tu estado actual)
  async function handlePrintTicket() {
    // armo los ítems desde tu carrito
    const items = cart.map(i => ({
      qty: i.quantity,
      name: i.productName,
      total: i.total,
    }));

    const html = buildReceiptHTML({
      negocio: activeShift?.businessName || " - Breca Cafe",
      direccion: "",       // opcional
      cuit: "",            // opcional
      items,
      subtotal: cartTotal, // ajustá si tenés descuentos/IVA
      total: cartTotal,
      metodoPago: paymentMethod, // "cash" | "card" | "transfer" | "rappi"
      pagoCon: typeof amountGiven === "number" ? amountGiven : null,
      vuelto: typeof change === "number" ? change : null,
      footer: "¡Gracias por confiar en nosotros! ♡",  // personalizable
    });

    await printHTMLTicket(html);
  }


  /* ─ Complete sale ─ */
  const handleComplete = async () => {
    if (!activeShift || !cart.length) return;
    setProcessing(true);

    try {
      // 1. Armar datos de la venta
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

      // 2. Registrar venta
      const saleResult = await dispatch(createSale(saleData)).unwrap();
      if (!saleResult) throw new Error("No se pudo registrar la venta.");

      // 3. Traer stock actual del negocio
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
          stockMap[r.product_id] = r.stock;
        });

        if (!data?.length || data.length < pageSize) done = true;
        page++;
      }

      // 4. Agrupar cantidades a descontar por producto
      const stockToUpdate: Record<string, number> = {};
      for (const it of cart) {
        if (Array.isArray(it.listID) && it.listID.length > 0) {
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

      // 5. Actualizar stock
      for (const productId in stockToUpdate) {
        const qtyToDiscount = stockToUpdate[productId] ?? 0;
        const currentStock = stockMap[productId] ?? 0;
        const newStock = Math.max(0, currentStock - qtyToDiscount);

        const { error } = await supabase
          .from("business_inventory")
          .update({ stock: newStock })
          .eq("business_id", businessId)
          .eq("product_id", productId);

        if (error) throw error;
      }

      // 6. Refrescar productos
      await loadProducts();

      // 7. Facturación (solo tarjeta o transferencia)
      if (paymentMethod === "card" || paymentMethod === "transfer") {
        try {
          const formatDate = (date: Date) => {
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
          };

          const today = new Date();
          const dueDate = new Date();
          dueDate.setDate(today.getDate() + 2);

          const facturaPayload = {
            cliente: {
              documento_tipo: "OTRO",
              condicion_iva: "CF",
              condicion_iva_operacion: "CF",
              domicilio: "No especifica",
              condicion_pago: "201",
              documento_nro: "0",
              reclama_deuda: "N",
              razon_social: "Consumidor final",
              provincia: "2",
              email: "email@dominio.com",
              envia_por_mail: "N",
              rg5329: "N"
            },
            comprobante: {
              tipo: "FACTURA C",
              operacion: "V",
              moneda: "PES",
              detalle: [
                {
                  cantidad: 1,
                  producto: {
                    descripcion: "Venta de kiosko",
                    unidad_bulto: 1,
                    lista_precios: "standard",
                    precio_unitario_sin_iva: cartTotal,
                    alicuota: 0,
                  }
                }
              ],
              fecha: formatDate(today),
              vencimiento: formatDate(dueDate),
              total: cartTotal,
              pagos: {
                formas_pago: [
                  { descripcion: "MercadoPago", importe: cartTotal }
                ],
                total: cartTotal
              },
              punto_venta: 32,
              tributos: []
            }
          };

          if (businessId === "7050459b-b342-4e66-ab11-ab856b7f11f1") {
            const FacturaConFACTURADOR = {
              apitoken: ANGEL_CRISTIAN_APITOKEN,
              usertoken: ANGEL_CRISTIAN_USERTOKEN,
              apikey: ANGEL_CRISTIAN_APIKEY,
              ...facturaPayload,
            };
            fetch("https://32express-factura.vercel.app/api/facturar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(FacturaConFACTURADOR),
            });
          }
        } catch (err) {
          console.error("❌ Error al facturar:", err);
        }
      }

      // 8. Limpiar y mostrar éxito
      setToast("Venta registrada ✔︎");
      // 👉 Imprimir ticket (no bloquea, pero esperá un tick por seguridad)
      setTimeout(() => {
        handlePrintTicket().catch(err => console.error("Print error:", err));
      }, 150);

      // luego tu limpieza actual:
      setCart([]);
      setConfirm(false);
      setAmountGiven("");
      setSearch("");
      setTimeout(() => setToast(""), 3000);
    } catch (err: any) {
      console.error("❌ Error al completar venta:", err);
      setToast("❌ Error: " + (err.message || "algo salió mal"));
      setTimeout(() => setToast(""), 4000);
    } finally {
      setProcessing(false);
    }
  };



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowManualSearch(true);
      }
      if (e.key === "F4") {
        e.preventDefault();
        setCart([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const change = useMemo(() => {
    if (typeof amountGiven !== "number") return null;
    return amountGiven - cartTotal;
  }, [amountGiven, cartTotal]);

  console.log(businessId)
  /* ───────────────────────────────────── UI ───────────────────────────────────── */
  const [showManualSearch, setShowManualSearch] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [scannerValue, setScannerValue] = useState("");
  const debouncedScannerValue = useDebounce(scannerValue, 250);
  const amountGivenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleBlur = () => {
      if (!showManualSearch) {
        setTimeout(() => {
          scannerInputRef.current?.focus();
        }, 10);
      }
    };

    const input = scannerInputRef.current;
    if (input) input.addEventListener("blur", handleBlur);

    return () => {
      if (input) input.removeEventListener("blur", handleBlur);
    };
  }, [showManualSearch]);

  useEffect(() => {
    if (!debouncedScannerValue || showManualSearch) return;

    // 1. Buscamos **todos** los productos con ese código
    const matches = products.filter(
      p => p.code?.toLowerCase() === debouncedScannerValue.toLowerCase()
    );

    // 2. Limpiamos siempre el input del scanner
    setScannerValue("");

    // 3. Si sólo hay uno, lo agregamos al carrito
    if (matches.length === 1) {
      addToCart(matches[0]);

      // 4. Si hay más de uno, abrimos el modal de selección
    } else if (matches.length > 1) {
      setMatchingProducts(matches);
      setShowSelectModal(true);
    }

    // 5. Dependencias: vuelve a ejecutarse en cada cambio de scanner, productos o manual search
  }, [debouncedScannerValue, products, showManualSearch]);

  // Cuando el cajero elija uno de los productos duplicados:
  const handleSelectProduct = (p: any) => {
    // 1. Lo agregamos al carrito como siempre
    addToCart(p);

    // 2. Cerramos el modal de selección
    setShowSelectModal(false);

    // 3. Volvemos a enfocar el scanner para seguir escaneando
    scannerInputRef.current?.focus();
  };

  useEffect(() => {
    // Si **ningún** modal está abierto, enfocamos el scanner
    if (!showManualSearch && !showSelectModal) {
      // pequeño delay para asegurarnos de que el input ya existe
      setTimeout(() => scannerInputRef.current?.focus(), 10);
    }
  }, [showManualSearch, showSelectModal]);

  useEffect(() => {
    const input = scannerInputRef.current;
    if (!input) return;

    const handleBlur = () => {
      // Si NO hay ningún modal abierto, refocus
      if (!showManualSearch && !showSelectModal) {
        // lo hacemos en un tick para no interferir con el evento actual
        setTimeout(() => input.focus(), 0);
      }
    };

    input.addEventListener("blur", handleBlur);
    return () => {
      input.removeEventListener("blur", handleBlur);
    };
  }, [showManualSearch, showSelectModal]);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Si no hay ningún modal abierto
      if (!showManualSearch && !showSelectModal) {
        scannerInputRef.current?.focus();
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showManualSearch, showSelectModal]);
  const changeInputRef = useRef<HTMLInputElement>(null);


  if (loadingShifts) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <LoadingSpinner />
        </div>
      </div>
    )
  }


  if (!activeShift) {
    return (
      <div className="p-6">
        <NoShiftBanner />
      </div>
    )
  }
  const PAYMENT_METHOD_LABELS = {
    cash: "💵 Efectivo",
    card: "💳 Tarjeta",
    transfer: "🏦 Transferencia",
    rappi: "📲 Rappi",
  };


  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <input
        ref={scannerInputRef}
        type="text"
        inputMode="numeric"
        autoFocus
        onChange={(e) => setScannerValue(e.target.value)}
        value={scannerValue}
        // className=""
        className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
      />

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 h-[75vh]">

          {/* Panel izquierdo */}
          <div className="flex flex-col border-r">
            {/* Barra superior */}
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowManualSearch(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-md shadow transition"
                >
                  <Search className="w-4 h-4" />
                  Buscar <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1">F2</span>
                </button>

                <button
                  onClick={() => setCart([])}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-md shadow transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpiar <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded ml-1">F4</span>
                </button>
              </div>

            </div>

            {/* Área de escaneo */}
            <div className="flex-1 overflow-y-auto bg-gray-100 px-6 py-4 max-h-[calc(100vh-11.5rem)]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center text-gray-500">
                  <h2 className="text-xl font-bold text-gray-700 mb-2">SCANEA UN PRODUCTO</h2>
                  <p>Scaneando el producto se agrega automáticamente acá</p>
                </div>
              ) : (
                cart.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId);
                  const isPromo = Array.isArray(item.listID) && item.listID.length > 0;

                  return (
                    <div
                      key={item.productId}
                      className={`rounded-xl border shadow-sm mb-3 px-4 py-2 transition
    ${isPromo ? "bg-yellow-50 border-yellow-300 hover:ring-yellow-200" : "bg-white hover:ring-indigo-200"}
    hover:ring-2`}
                    >
                      {/* Nombre + Código */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-semibold  leading-tight flex items-center gap-2">
                            {item.productName}
                            {isPromo && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                                🎉 PROMO
                              </Badge>
                            )}
                          </p>

                          <p className="text-xs text-gray-400 mb-1">{product?.code || "–"}</p>
                          {isPromo && item.listID && (
                            <div className="mt-1 ml-1 text-sm text-yellow-800">
                              <p className="font-semibold mb-1">Incluye:</p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {item.listID.map((pi: any, i: number) => {
                                  const prod = products.find(p => p.id === pi.id);
                                  return (
                                    <li key={i}>
                                      {pi.qty} × {prod?.name || "Producto eliminado"}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                        </div>
                        <button
                          onClick={() => removeIdx(idx)}
                          className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full hover:bg-red-200"
                        >
                          Borrar
                        </button>
                      </div>

                      {/* Contenido principal */}
                      <div className="flex justify-between items-end gap-2 mt-1">
                        {/* Controles cantidad */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => item.quantity > 1 ? updateQty(idx, item.quantity - 1) : null}
                            className="w-8 h-8 bg-gray-900 text-white rounded-full text-sm flex items-center justify-center hover:scale-105"
                          >
                            -
                          </button>
                          <span className="font-bold text-base w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => {
                              if (item.quantity < item.stock) {
                                updateQty(idx, item.quantity + 1);
                              } else {
                                setToast("No hay más stock disponible");
                                setTimeout(() => setToast(""), 2000);
                              }
                            }}
                            className="w-8 h-8 bg-gray-900 text-white rounded-full text-sm flex items-center justify-center hover:scale-105"
                          >
                            +
                          </button>

                        </div>

                        {/* Precios + Botón borrar */}
                        <div className="text-right leading-tight min-w-[120px]">
                          <p className="text-[11px] text-gray-400">Unitario</p>
                          <p className="text-[13px] font-medium text-gray-700">{formatCurrency(item.price)}</p>
                          <p className="text-[11px] text-gray-400 mt-1">Total</p>
                          <div className="flex items-center justify-end gap-2 mt-0.5">
                            <p className="text-[15px] font-bold text-green-600">{formatCurrency(item.total)}</p>

                          </div>
                        </div>
                      </div>
                    </div>


                  );
                })

              )}
            </div>

          </div>

          {/* Panel derecho */}
          <div className="p-6 flex flex-col justify-between overflow-auto">
            {/* Banner superior */}
            <div className="bg-yellow-100 text-yellow-800 border border-yellow-300 text-center py-3 px-4 rounded-xl font-semibold text-sm mb-6 flex items-center justify-center gap-2">
              🛍️ ¡Ofrece más productos y aumentá el ticket!
            </div>


            {/* Métodos de pago */}
            <div>
              <h3 className="text-xl font-bold text-center mb-4">MÉTODO DE PAGO</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {(["cash", "card", "transfer", "rappi"] as const).map((m) => {
                  const isActive = paymentMethod === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-200
          ${isActive
                          ? "bg-black text-white border-black shadow-md"
                          : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"}
        `}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {PAYMENT_METHOD_LABELS[m].split(" ")[0]}
                        </span>
                        <span className="text-[15px] font-semibold">
                          {PAYMENT_METHOD_LABELS[m].split(" ").slice(1).join(" ")}
                        </span>
                      </div>
                      {isActive && (
                        <span className="text-green-400 text-xl ml-2">✅</span>
                      )}
                    </button>
                  );
                })}



              </div>

              {/* Contenedor reservado siempre */}
              <div className="mt-4 min-h-[120px] transition-all duration-300">
                {paymentMethod === "cash" && (
                  <>
                    {/* Label */}
                    <label className="mb-1 block text-sm font-semibold text-gray-700 flex items-center gap-2">
                      💰 ¿Con cuánto paga el cliente?
                    </label>

                    {/* Input */}
                    <input
                      ref={amountGivenRef}
                      type="number"
                      placeholder="Ej: 5000"
                      className={`w-full border px-4 py-3 rounded-lg text-lg shadow-sm focus:outline-none focus:ring-2 ${typeof change === "number" && change < 0
                        ? "border-red-400 focus:ring-red-500"
                        : "border-gray-300 focus:ring-emerald-500"
                        }`}
                      value={amountGiven}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setAmountGiven(isNaN(val) ? "" : val);
                      }}
                      onFocus={() => {
                        // ❌ Quitar foco del input del escáner
                        scannerInputRef.current?.blur();
                      }}
                      onBlur={() => {
                        // ✅ Volver a enfocar el input del escáner después de un pequeño delay
                        setTimeout(() => {
                          scannerInputRef.current?.focus();
                        }, 100);
                      }}
                    />

                    {/* Mensaje de vuelto */}
                    {typeof change === "number" && (
                      <p
                        className={`mt-2 text-center font-semibold text-base ${change < 0 ? "text-red-600" : "text-green-600"
                          }`}
                      >
                        {change < 0
                          ? "❌ Monto insuficiente"
                          : `💵 Vuelto: ${formatCurrency(change)}`}
                      </p>
                    )}
                  </>
                )}
              </div>


            </div>

            {/* Total final */}
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                🧾 Ítems: <span className="font-medium">{cart.length}</span> | 🧊 Unidades: <span className="font-medium">{cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
              </p>

              <h2 className="text-3xl font-bold mt-1">
                TOTAL {formatCurrency(cartTotal)}
              </h2>

              <button
                onClick={() => setConfirm(true)}
                className="mt-4 w-full bg-emerald-500 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 shadow-md transition"
              >
                Completar venta
              </button>

            </div>
          </div>
        </div>
      </div>
      {showManualSearch && (
        <Modal title="Buscar producto" onClose={() => setShowManualSearch(false)}>
          <input
            type="text"
            placeholder="Buscar por nombre o código"
            className="w-full border px-3 py-2 rounded mb-4"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filteredProducts.length === 0 && (
            <p className="text-center text-gray-500">No hay resultados</p>
          )}
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {filteredProducts
              .sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0)) // Stock primero
              .map((p) => {
                const isOutOfStock = p.stock === 0;
                return (
                  <li
                    key={p.id}
                    className={`flex justify-between items-center p-2 border rounded cursor-pointer ${isOutOfStock
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "hover:bg-gray-100"
                      }`}
                    onClick={() => {
                      if (isOutOfStock) return;
                      addToCart(p);
                      setSearch("");
                      setShowManualSearch(false);
                    }}
                  >
                    <div>
                      <p className={`font-semibold ${isOutOfStock ? "text-gray-400" : ""}`}>{p.name}</p>
                      <p className={`text-sm ${isOutOfStock ? "text-gray-300" : "text-gray-600"}`}>{p.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOutOfStock && (
                        <span className="bg-red-200 text-red-800 text-xs font-semibold px-2 py-1 rounded">
                          SIN STOCK
                        </span>
                      )}
                      <span className={`font-bold ${isOutOfStock ? "text-gray-400" : ""}`}>
                        {formatCurrency(p.default_selling)}
                      </span>
                    </div>
                  </li>
                );
              })}
          </ul>

        </Modal>
      )}

      {confirm && (
        <Modal title="Confirmar venta" onClose={() => setConfirm(false)}>
          <p className="text-center text-lg font-medium mb-4">
            ¿Confirmás completar la venta por {formatCurrency(cartTotal)}?
          </p>
          <div className="flex justify-center gap-4">
            <button
              className="px-5 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
              onClick={() => setConfirm(false)}
              disabled={processing}
            >
              Cancelar
            </button>
            <button
              className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow"
              onClick={handleComplete}
              disabled={processing}
            >
              {processing ? "Procesando..." : "Confirmar venta"}
            </button>
          </div>
        </Modal>
      )}
      {showSelectModal && (
        <SelectProductModal matchingProducts={matchingProducts} onSelect={handleSelectProduct} onClose={() => setShowSelectModal(false)} />
      )}
    </div>
  );


}

/* ───────────────────── small components ───────────────────── */

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



export function SelectProductModal({ matchingProducts, onClose, onSelect }) {
  const [filter, setFilter] = useState("");

  const filtered = matchingProducts
    .filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      const aIsPromo = Array.isArray(a.products) && a.products.length > 0;
      const bIsPromo = Array.isArray(b.products) && b.products.length > 0;
      return bIsPromo - aIsPromo; // Promo arriba
    });


  return (
    <Modal title="👀 Ese código tiene una promo, ¡ofrecela!" onClose={onClose}>
      {/* Contador */}
      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {filtered.length} producto{filtered.length !== 1 && "s"} encontrado{filtered.length !== 1 && "s"}
        </p>
      </div>

      {/* Lista scrollable */}
      <ul className="space-y-3 h-[25vh] overflow-y-auto pr-1 will-change-transform overflow-anchor-none mx-3">
        {filtered.map((p) => {
          const isPromo = Array.isArray(p.products) && p.products.length > 0;
          return (
            <li key={p.id}>
              <button
                onClick={() => onSelect(p)}
                className={`w-full h-[10vh] flex items-center justify-between p-4 rounded-lg transition-transform transform
  ${isPromo
                    ? "bg-yellow-100 border-2 border-yellow-500 shadow-[0_0_0_2px_rgba(234,179,8,0.6)] hover:shadow-yellow-400 hover:scale-[1.015]"
                    : "bg-white border hover:shadow-md hover:scale-[1.01]"}
  cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}

              >
                {/* Texto y badge */}
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    {isPromo && (
                      <Badge className="bg-yellow-500 text-white font-bold px-2 py-1 rounded-full mt-2 text-xs shadow">
                        🎯 PROMO DESTACADA
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Precio + icono carrito */}
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">{formatCurrency(p.default_selling)}</span>
                </div>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="text-center text-gray-500 py-4">No hay productos que coincidan.</li>
        )}
      </ul>
    </Modal>
  );
}
