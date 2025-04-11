"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CartItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  total: number;
};

// LISTA DE CATEGORÍAS PARA CREAR/EDITAR PRODUCTOS
const categories = [
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

// Helper que extrae la categoría al inicio del nombre
function extractCategory(name: string): { category: string | null; baseName: string } {
  const parts = name.trim().split(" ");
  if (parts.length > 1 && categories.includes(parts[0].toUpperCase())) {
    return { category: parts[0].toUpperCase(), baseName: parts.slice(1).join(" ") };
  }
  return { category: null, baseName: name };
}

// Hook para debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function NewSalePage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { shifts, loading: shiftsLoading } = useSelector((state: RootState) => state.shifts);
  const { employees } = useSelector((state: RootState) => state.employees);

  // Estado para guardar productos del negocio actual
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Estado para el término de búsqueda y usamos debounce de 300ms
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Estados para el carrito y la venta
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer" | "mercadopago" | "rappi">("cash");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const businessId = user?.businessId;

  // Ref para mantener siempre el foco en el input de búsqueda
  const inputRef = useRef<HTMLInputElement>(null);

  // Función para cargar productos
  const fetchProducts = async () => {
    if (!businessId) return;
    setProductsLoading(true);
    try {
      const pageSize = 1000;
      let page = 0;
      let allProducts: any[] = [];
      let done = false;
      while (!done) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("business_id", businessId)
          .range(from, to);
        if (error) throw error;
        if (data && data.length > 0) {
          allProducts = allProducts.concat(data);
          if (data.length < pageSize) {
            done = true;
          } else {
            page++;
          }
        } else {
          done = true;
        }
      }
      setProducts(allProducts);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  // Cargar productos al montar el componente
  useEffect(() => {
    if (businessId) {
      fetchProducts();
    }
  }, [businessId]);

  // Cargar turnos
  useEffect(() => {
    dispatch(getShifts());
  }, [dispatch, user]);

  // Listener global para capturar entrada desde el escáner (incluso si el input no tiene foco)
  useEffect(() => {
    let barcodeBuffer = "";
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Reinicia el timeout
      clearTimeout(timeoutId);
      // Siempre se mantiene el foco en el input
      inputRef.current?.focus();

      if (event.key === "Enter") {
        // Al presionar Enter se asume que se terminó de escanear
        const scannedCode = barcodeBuffer;
        setSearchQuery(scannedCode);
        // Permite que el debounce capte el código, luego limpia el input después de 500ms
        setTimeout(() => {
          setSearchQuery("");
          inputRef.current?.focus();
        }, 500);
        barcodeBuffer = "";
      } else {
        barcodeBuffer += event.key;
      }
      // Si no se reciben teclas por 150ms, se limpia el buffer
      timeoutId = setTimeout(() => {
        barcodeBuffer = "";
      }, 150);
    };

    document.addEventListener("keypress", handleKeyPress);
    return () => {
      document.removeEventListener("keypress", handleKeyPress);
    };
  }, []);

  // Enfoque inicial en el input al montar el componente
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Obtener empleado actual
  const currentEmployee = useMemo(() => {
    if (!user) return null;
    const empById = employees.find((emp) => emp.userId === user.id);
    const empByEmail = !empById
      ? employees.find((emp) => emp.email.toLowerCase() === user.email.toLowerCase())
      : null;
    return empById || empByEmail;
  }, [employees, user]);

  // Obtener turno activo
  const activeShift = useMemo(() => {
    if (!currentEmployee) return null;
    return shifts.find(
      (shift) => shift.employeeId === currentEmployee.id && shift.active
    );
  }, [shifts, currentEmployee]);

  // Filtrado de productos usando el término debounced
  const filteredProducts = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];
    const lowerQuery = debouncedSearchQuery.toLowerCase();
    return products.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(lowerQuery) ||
        (p.code ?? "").toLowerCase().includes(lowerQuery) ||
        (p.description ?? "").toLowerCase().includes(lowerQuery)
    );
  }, [debouncedSearchQuery, products]);

  // Funciones para el carrito
  const addToCart = (product: any) => {
    const existingItemIndex = cart.findIndex((item) => item.productId === product.id);
    if (existingItemIndex >= 0) {
      if (cart[existingItemIndex].quantity >= product.stock) return;
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += 1;
      updatedCart[existingItemIndex].total = updatedCart[existingItemIndex].quantity * updatedCart[existingItemIndex].price;
      setCart(updatedCart);
    } else {
      if (product.stock > 0) {
        setCart([
          ...cart,
          {
            productId: product.id,
            productName: product.name,
            price: product.selling_price || product.sellingPrice,
            quantity: 1,
            total: product.selling_price || product.sellingPrice,
          },
        ]);
      }
    }
  };

  const updateCartItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    const product = products.find((p) => p.id === cart[index].productId);
    if (!product) return;
    if (newQuantity > product.stock) newQuantity = product.stock;
    const updatedCart = [...cart];
    updatedCart[index].quantity = newQuantity;
    updatedCart[index].total = newQuantity * updatedCart[index].price;
    setCart(updatedCart);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount);
  };

  // Completar la venta
  const handleCompleteSale = async () => {
    if (!activeShift || !user || cart.length === 0) return;
    setIsProcessing(true);
    try {
      const saleData = {
        businessId: businessId!,
        businessName: activeShift.businessName,
        employeeId: currentEmployee ? currentEmployee.id : user.id,
        employeeName: user.name,
        items: cart,
        total: cartTotal,
        paymentMethod,
        timestamp: new Date().toISOString(),
        shiftId: activeShift.id,
      };
      await dispatch(createSale(saleData));

      // Actualiza stock de cada producto vendido
      for (const item of cart) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          await dispatch(
            editProduct({
              ...product,
              stock: product.stock - item.quantity,
              salesCount: product.salesCount + item.quantity,
              totalRevenue: product.totalRevenue + item.total,
            })
          );
        }
      }

      setSuccessMessage("Venta registrada correctamente");
      setCart([]);
      setPaymentMethod("cash");
      setIsConfirmModalOpen(false);
      // Refetchea productos para actualizar stock
      await fetchProducts();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error completing sale:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading = productsLoading || shiftsLoading;
  if (!activeShift) {
    location.href = "/employee/dashboard";
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nueva Venta</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Registra una nueva venta para {activeShift?.businessName || "tu negocio"}
          </p>
        </div>
        <Link href="/employee/dashboard" className="btn btn-secondary">
          Volver al Dashboard
        </Link>
      </div>

      {/* Advertencia si no hay turno activo */}
      {!activeShift && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">No hay un turno activo</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-200">
                <p>
                  Debes iniciar un turno antes de poder registrar ventas.
                  <Link href="/employee/dashboard" className="ml-2 font-medium underline">
                    Ir al Dashboard
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de éxito */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <Check className="h-5 w-5 text-green-500" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Buscador y listado de productos filtrados */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                ref={inputRef}
                type="text"
                className="input pl-10 w-full"
                placeholder="Buscar productos por nombre o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={!activeShift}
              />
              <button
                onClick={() => {
                  setSearchQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                style={{
                  backgroundColor: "gainsboro",
                  padding: "0px 30px",
                  color: "black",
                }}
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Se muestra el listado solo si hay término de búsqueda */}
          {debouncedSearchQuery.trim() && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold">Resultados de la búsqueda</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                  <colgroup>
                    <col className="w-2/5" /> {/* Producto: Nombre y Código */}
                    <col className="w-1/5" /> {/* Precio */}
                    <col className="w-1/5" /> {/* Acciones */}
                  </colgroup>
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Precio</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredProducts.length > 0 && !isLoading ? (
                      filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-normal break-words">
                            {(() => {
                              const { category, baseName } = extractCategory(product.name);
                              return (
                                <>
                                  {category && (
                                    <div className="text-xs font-bold text-blue-400 dark:text-blue-300">
                                      {category}
                                    </div>
                                  )}
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">{baseName}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {product.code}
                                  </div>
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatCurrency(product.selling_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => addToCart(product)}
                              disabled={product.stock <= 0 || !activeShift}
                              style={{
                                backgroundColor: product.stock <= 0 ? "red" : "green",
                                padding: "10px 0px",
                                width: 100,
                                borderRadius: 5,
                                color: product.stock <= 0 ? "black" : "white",
                              }}
                            >
                              {product.stock <= 0 ? "SIN STOCK" : "AGREGAR"}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : isLoading ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex justify-center items-center h-64">
                            <div className="text-center">
                              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
                              <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando datos...</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          No se encontraron productos. Intenta con otra búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Carrito de compras */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" /> Carrito
              </h2>
              <span className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                {cart.length} {cart.length === 1 ? "producto" : "productos"}
              </span>
            </div>

            {cart.length > 0 ? (
              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCurrency(item.price)} c/u
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateCartItemQuantity(index, item.quantity - 1)}
                        className="p-1 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartItemQuantity(index, item.quantity + 1)}
                        className="p-1 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeFromCart(index)}
                        className="p-1 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-medium">{formatCurrency(item.total)}</p>
                    </div>
                  </div>
                ))}

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <div className="flex justify-between items-center font-medium text-lg mb-4">
                    <span>Total</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Método de Pago
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`py-2 px-4 rounded-md text-sm font-medium ${
                          paymentMethod === "cash"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-2 border-green-500"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        Efectivo
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("card")}
                        className={`py-2 px-4 rounded-md text-sm font-medium ${
                          paymentMethod === "card"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-2 border-blue-500"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        Tarjeta
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("transfer")}
                        className={`py-2 px-4 rounded-md text-sm font-medium ${
                          paymentMethod === "transfer"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 border-2 border-purple-500"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        Transferencia
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("mercadopago")}
                        className={`py-2 px-4 rounded-md text-sm font-medium ${
                          paymentMethod === "mercadopago"
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300 border-2 border-sky-500"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        MercadoPago
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("rappi")}
                        className={`py-2 px-4 rounded-md text-sm font-medium ${
                          paymentMethod === "rappi"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border-2 border-orange-500"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        Rappi
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsConfirmModalOpen(true)}
                    disabled={!activeShift}
                    className="w-full mt-4 btn btn-primary"
                  >
                    Completar Venta
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-gray-400" />
                <p className="mt-2 text-gray-500 dark:text-gray-400">El carrito está vacío</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Busca productos y agrégalos al carrito</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de confirmación de venta */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Confirmar Venta</h2>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">¿Estás seguro de que deseas completar esta venta?</p>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Total:</span>
                  <span className="font-medium">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Método de Pago:</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      paymentMethod === "cash"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                        : paymentMethod === "card"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                        : paymentMethod === "transfer"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                        : paymentMethod === "mercadopago"
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300"
                        : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
                    }`}
                  >
                    {paymentMethod === "cash"
                      ? "Efectivo"
                      : paymentMethod === "card"
                      ? "Tarjeta"
                      : paymentMethod === "transfer"
                      ? "Transferencia"
                      : paymentMethod === "mercadopago"
                      ? "MercadoPago"
                      : "Rappi"}
                  </span>
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsConfirmModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="button" onClick={handleCompleteSale} disabled={isProcessing} className="btn btn-primary">
                  {isProcessing ? "Procesando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
