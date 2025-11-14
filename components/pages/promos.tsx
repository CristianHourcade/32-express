"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, X, Search } from "lucide-react";

// === Interfaces ===
export interface Promotion {
  id: string;
  code: string;
  name: string;
  price: number;
  isActive: boolean;
  createdAt?: string;
  products: Array<{ id: string; qty: number }>;
}

interface ProductOption {
  id: string;
  name: string;
}

interface ProductAutocompleteInputProps {
  value: string;
  onSelect: (id: string) => void;
  products: ProductOption[];
}

function ProductAutocompleteInput({
  value,
  onSelect,
  products,
}: ProductAutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => setInputValue(value), [value]);

  const filtered = useMemo(
    () =>
      products.filter((p) =>
        p.name.toLowerCase().includes(inputValue.toLowerCase())
      ),
    [products, inputValue]
  );

  return (
    <div className="relative w-full">
      <input
        type="text"
        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
        value={inputValue}
        placeholder="Buscar producto..."
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 w-full bg-white shadow-lg rounded-lg mt-1 max-h-60 overflow-auto border border-gray-200 text-sm">
          {filtered.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                onSelect(p.id);
                setInputValue(p.name);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 10;

export const PromotionsAdminPage = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);

  const [productsDict, setProductsDict] = useState<Record<string, string>>({});
  const [productsList, setProductsList] = useState<ProductOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<{
    code: string;
    name: string;
    price: number;
    products: { id: string; qty: number }[];
  }>({ code: "", name: "", price: 0, products: [] });

  const [currentPage, setCurrentPage] = useState(1);

  // Fetch products
  useEffect(() => {
    (async () => {
      const pageSize = 1000;
      let all: any[] = [];
      let from = 0;
      // Paginación simple sobre tabla products_master
      while (true) {
        const { data, error } = await supabase
          .from("products_master")
          .select("id,name")
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Error cargando productos:", error);
          break;
        }

        if (!data?.length) break;
        all.push(...data);

        if (data.length < pageSize) break;
        from += pageSize;
      }

      const dict: Record<string, string> = {};
      all.forEach((p) => (dict[p.id] = p.name));

      setProductsDict(dict);
      setProductsList(all.map((p) => ({ id: p.id, name: p.name })));
    })();
  }, []);

  // Fetch promotions
  const load = async () => {
    setLoading(true);
    const pageSize = 1000;
    let all: any[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("promos")
        .select("id,code,name,promo_price,is_active,promo_items(product_id,quantity)")
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Error cargando promos:", error);
        break;
      }
      if (!data?.length) break;

      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    setPromotions(
      all.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        price: r.promo_price,
        isActive: r.is_active,
        products: r.promo_items?.map((pi: any) => ({
          id: pi.product_id,
          qty: pi.quantity,
        })) || [],
      }))
    );
    setLoading(false);
    setCurrentPage(1); // reset paginación al recargar
  };

  useEffect(() => {
    load();
  }, []);

  // Filtro + paginación
  const filtered = useMemo(
    () =>
      promotions
        .filter((p) => showDisabled || p.isActive)
        .filter(
          (p) =>
            !search ||
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.code.toLowerCase().includes(search.toLowerCase())
        ),
    [promotions, showDisabled, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Handlers
  const openNew = () => {
    setEditing(null);
    setForm({ code: "", name: "", price: 0, products: [] });
    setModalOpen(true);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      code: p.code,
      name: p.name,
      price: p.price,
      products: p.products,
    });
    setModalOpen(true);
  };

  const handleChangeForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: name === "price" ? +value : value,
    }));
  };

  const addLine = () =>
    setForm((f) => ({
      ...f,
      products: [...f.products, { id: "", qty: 1 }],
    }));

  const removeLine = (i: number) =>
    setForm((f) => {
      const a = [...f.products];
      a.splice(i, 1);
      return { ...f, products: a };
    });

  const changeLine = (i: number, field: "id" | "qty", v: any) =>
    setForm((f) => {
      const a = [...f.products];
      if (field === "id") a[i].id = v;
      else a[i].qty = +v || 1;
      return { ...f, products: a };
    });

  const handlePrint = () => {
    const htmlContent = `
    <html>
      <head>
        <title>Promos Estilo Góndola</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }

          @media print {
            html, body {
              margin: 0;
              padding: 0;
              width: 210mm;
              height: 297mm;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }

          body {
            font-family: 'Arial Black', sans-serif;
            background: white;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(4, 1fr);
            gap: 0;
            width: 210mm;
            height: 297mm;
            box-sizing: border-box;
            padding: 0;
          }

          .promo {
            box-sizing: border-box;
            width: 105mm;
            height: 74.25mm;
            border: 5mm solid #FF3333;
            background: white;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 10mm 6mm 6mm;
            box-shadow: inset 0 0 0 2mm rgba(0, 0, 0, 0.04);
          }

          .promo-header {
            position: absolute;
            top: -3mm;
            left: 50%;
            transform: translateX(-50%);
            background-color: #FF3333;
            color: white;
            font-size: 15pt;
            font-weight: bold;
            padding: 3mm 8mm;
            text-transform: uppercase;
            line-height: 1.2;
            z-index: 2;
            border-radius: 0mm 0mm 6mm 6mm;
            text-align: center;
            width: 80mm;
            word-break: break-word;
          }

          .badge {
            position: absolute;
            bottom: 1mm;
            right: 1mm;
            background: gold;
            color: black;
            font-size: 14pt;
            font-weight: bold;
            padding: 1mm 4mm;
            border-radius: 6mm;
            box-shadow: 0 1mm 2mm rgba(0,0,0,0.2);
            z-index: 993;
          }

          .promo-price {
            margin-top: 0mm;
            font-weight: bold;
            color: black;
            text-align: center;
            font-size: clamp(28pt, 7vw, 60pt);
            max-width: 90mm;
            word-break: break-word;
            line-height: 1.1;
          }
        </style>
      </head>
      <body>
        ${filtered
          .map((p) => {
            return `
              <div class="promo">
                <div class="promo-header">${p.name}</div>
                <div class="promo-price">$${p.price.toLocaleString(
                  "es-AR",
                  { minimumFractionDigits: 0 }
                )}</div>
                <div class="badge">🔥 OFERTA</div>
              </div>
            `;
          })
          .join("")}
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Opcional: validar que haya al menos 1 producto
    const nonEmptyProducts = form.products.filter((p) => p.id && p.qty > 0);

    if (editing) {
      await supabase
        .from("promos")
        .update({
          code: form.code,
          name: form.name,
          promo_price: form.price,
        })
        .eq("id", editing.id);

      await supabase.from("promo_items").delete().eq("promo_id", editing.id);

      if (nonEmptyProducts.length) {
        await supabase.from("promo_items").insert(
          nonEmptyProducts.map((p) => ({
            promo_id: editing.id,
            product_id: p.id,
            quantity: p.qty,
          }))
        );
      }
    } else {
      const { data } = await supabase
        .from("promos")
        .insert({
          code: form.code,
          name: form.name,
          promo_price: form.price,
          is_active: true,
        })
        .select("id")
        .single();

      if (data && nonEmptyProducts.length) {
        await supabase.from("promo_items").insert(
          nonEmptyProducts.map((p) => ({
            promo_id: data.id,
            product_id: p.id,
            quantity: p.qty,
          }))
        );
      }
    }

    setModalOpen(false);
    await load();
  };

  const toggle = async (p: Promotion) => {
    await supabase
      .from("promos")
      .update({ is_active: !p.isActive })
      .eq("id", p.id);
    await load();
  };

  // Productos de la promo (no eliminados) para el resumen del modal
  const formProductsWithNames = useMemo(
    () =>
      form.products
        .filter((p) => p.id)
        .map((p) => ({
          id: p.id,
          name: productsDict[p.id] || "—",
          qty: p.qty,
        })),
    [form.products, productsDict]
  );

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Promociones Globales
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Administra las promos que se aplican en todos tus negocios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
          >
            🖨️ Imprimir Promos
          </button>
          <button
            onClick={openNew}
            className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva Promo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-[auto,1fr,auto] gap-3 items-center">
        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showDisabled}
            onChange={() => setShowDisabled((s) => !s)}
            className="form-checkbox text-indigo-600 rounded"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Mostrar deshabilitadas
          </span>
        </label>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Buscar por código o nombre..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
          />
        </div>

        <div className="text-right text-xs md:text-sm text-gray-500 dark:text-gray-400">
          {filtered.length} promo(s) encontrada(s)
        </div>
      </div>

      {/* Tabla con paginación */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                {["Código", "Nombre", "Precio", "Items", "Estado", "Acciones"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-6 text-center text-gray-500 text-sm"
                  >
                    Cargando promociones...
                  </td>
                </tr>
              )}

              {!loading && paginated.length > 0 && (
                <>
                  {paginated.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs md:text-sm">
                        {p.code}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs md:text-sm">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">
                        ${p.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-normal break-words">
                        {p.products.length === 0 && (
                          <span className="text-xs text-gray-400">
                            Sin productos
                          </span>
                        )}
                        {p.products.map((it, i) => (
                          <div
                            key={`${p.id}-${i}`}
                            className="flex items-center gap-1 mb-1 text-xs md:text-sm"
                          >
                            <span className="font-medium">
                              {productsDict[it.id] || "—"}
                            </span>
                            <span className="text-gray-500">x{it.qty}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            p.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {p.isActive ? "Activo" : "Deshabilitado"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="w-28 md:w-32 bg-blue-600 hover:bg-blue-700 text-white py-1 rounded-lg text-xs md:text-sm"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => toggle(p)}
                            className={`w-28 md:w-32 py-1 rounded-lg text-xs md:text-sm ${
                              p.isActive
                                ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                : "bg-green-500 hover:bg-green-600 text-white"
                            }`}
                          >
                            {p.isActive ? "Deshabilitar" : "Habilitar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {!loading && paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-gray-500 text-sm"
                  >
                    No hay promociones que mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs md:text-sm">
            <div className="text-gray-500">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40"
              >
                {"<<"}
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) => (p > 1 ? p - 1 : p))
                }
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    p < totalPages ? p + 1 : p
                  )
                }
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40"
              >
                Siguiente
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40"
              >
                {">>"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header modal */}
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {editing ? "Editar Promo" : "Nueva Promo"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Configurá el código, nombre, precio y productos incluidos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Contenido modal */}
            <form
              onSubmit={submit}
              className="flex-1 overflow-auto px-6 py-4 space-y-6"
            >
              {/* Datos básicos + resumen */}
              <div className="grid grid-cols-1 lg:grid-cols-[2fr,1.5fr] gap-6">
                {/* Datos básicos */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Código
                      </label>
                      <input
                        name="code"
                        value={form.code}
                        onChange={handleChangeForm}
                        required
                        className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre
                      </label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChangeForm}
                        required
                        className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Precio
                    </label>
                    <input
                      name="price"
                      type="number"
                      value={form.price}
                      onChange={handleChangeForm}
                      required
                      className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Resumen de productos NO eliminados */}
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-sm">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 text-sm">
                    Productos actuales en la promo
                  </h3>
                  {formProductsWithNames.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      Todavía no agregaste productos o los eliminaste todos.
                    </p>
                  ) : (
                    <ul className="space-y-1 max-h-40 overflow-auto">
                      {formProductsWithNames.map((p) => (
                        <li
                          key={p.id}
                          className="flex justify-between items-center bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded px-2 py-1"
                        >
                          <span className="truncate mr-2">{p.name}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            x{p.qty}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[11px] text-gray-400">
                    Este listado se actualiza en tiempo real. Solo ves los
                    productos que no fueron eliminados de la promo.
                  </p>
                </div>
              </div>

              {/* Items de la promo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Items de la promo
                </label>
                <div className="space-y-3">
                  {form.products.map((it, i) => (
                    <div
                      key={i}
                      className="flex flex-col md:flex-row gap-2 items-stretch md:items-center"
                    >
                      <div className="flex-1">
                        <ProductAutocompleteInput
                          value={productsDict[it.id] || ""}
                          onSelect={(v) => changeLine(i, "id", v)}
                          products={productsList}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) =>
                            changeLine(i, "qty", e.target.value)
                          }
                          className="w-20 px-2 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-400 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addLine}
                    className="flex items-center text-indigo-600 hover:underline text-sm"
                  >
                    + Agregar producto
                  </button>
                </div>
              </div>

              {/* Footer modal */}
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded border border-gray-300 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium"
                >
                  {editing ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
