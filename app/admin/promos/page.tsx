"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Plus, X, Search } from "lucide-react";

export interface Promotion {
  id: string;
  name: string;
  price: number;
  businessId: string;
  createdAt?: string;
  products: Array<{ id: string; qty: number }>;
}

// Subcomponente para input de autocompletado que permite buscar productos por nombre
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
  const [inputValue, setInputValue] = useState<string>(value);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filtrar productos por el input
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="relative">
      <input
        type="text"
        className="input w-full"
        value={inputValue}
        placeholder="Buscar producto..."
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 shadow-lg border rounded w-full max-h-60 overflow-y-auto">
          {filtered.map((prod) => (
            <button
              key={prod.id}
              type="button"
              onClick={() => {
                onSelect(prod.id);
                setInputValue(prod.name);
                setIsOpen(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {prod.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Función para obtener todos los productos (con paginación) y devolver un diccionario { id: name }
const fetchProductsDictionary = async (businessId: string) => {
  const pageSize = 1000;
  let page = 0;
  let allProducts: any[] = [];
  let done = false;
  while (!done) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("products_master")
      .select("*")
      .range(from, to);
    if (error) throw error;
    if (data && data.length > 0) {
      allProducts = allProducts.concat(data);
      if (data.length < pageSize) done = true;
      else page++;
    } else {
      done = true;
    }
  }
  const dict: Record<string, string> = {};
  allProducts.forEach((item) => {
    dict[item.id] = item.name;
  });
  return dict;
};

export default function PromotionsAdminPage() {
  // ---------------------------
  // ESTADOS LOCALES
  // ---------------------------
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Estado para el diccionario de productos (id -> name)
  const [productsDict, setProductsDict] = useState<Record<string, string>>({});

  // Estado para tener un array de productos {id, name} que usaremos en el autocomplete
  const [productsList, setProductsList] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Estados para el modal de creación/edición
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(
    null
  );
  const [promotionFormData, setPromotionFormData] = useState({
    name: "",
    text: "",
    price: 0,
    businessId: "",
    products: [] as Array<{ id: string; qty: number }>,
  });

  // Estados para el modal de eliminación
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentPromotionForDelete, setCurrentPromotionForDelete] =
    useState<Promotion | null>(null);

  // ---------------------------
  // FUNCIONES DE PETICIONES A SUPABASE
  // ---------------------------

  // Obtener la lista de negocios
  const fetchBusinesses = async () => {
    const { data, error } = await supabase.from("businesses").select("*");
    if (error) {
      console.error("Error fetching businesses:", error);
      return;
    }
    setBusinesses(data || []);
    if (data && data.length > 0 && !selectedBusinessId) {
      setSelectedBusinessId(data[0].id);
    }
  };

  // Obtener promociones para un negocio (con paginación)
  const fetchPromotionsForBusiness = async (businessId: string) => {
    setPromotionsLoading(true);
    try {
      const pageSize = 1000;
      let page = 0;
      let allPromotions: any[] = [];
      let done = false;
      while (!done) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("promotions")
          .select("*")
          // Nota: el filtro utiliza "businesses_id" según tu indicación
          .eq("businesses_id", businessId)
          .range(from, to);
        if (error) throw error;
        if (data && data.length > 0) {
          allPromotions = allPromotions.concat(data);
          if (data.length < pageSize) done = true;
          else page++;
        } else {
          done = true;
        }
      }
      const formattedPromotions: Promotion[] = allPromotions.map(
        (item: any) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          businessId: item.business_id,
          createdAt: item.created_at,
          products: item.products || [],
        })
      );
      setPromotions(formattedPromotions);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      setPromotions([]);
    } finally {
      setPromotionsLoading(false);
    }
  };

  // Crear una nueva promoción
  const createPromotion = async (newData: Omit<Promotion, "id">) => {
    const { data, error } = await supabase
      .from("promotions")
      .insert({
        name: newData.name,
        price: newData.price,
        businesses_id: newData.businessId,
        products: newData.products,
      })
      .single();
    if (error) throw error;
    return data;
  };

  // Actualizar una promoción existente
  const updatePromotion = async (updatedData: Promotion) => {
    const { data, error } = await supabase
      .from("promotions")
      .update({
        name: updatedData.name,
        price: updatedData.price,
        businesses_id: updatedData.businessId,
        products: updatedData.products,
      })
      .eq("id", updatedData.id)
      .single();
    if (error) throw error;
    return data;
  };

  // Eliminar una promoción
  const deletePromotion = async (promotionId: string) => {
    const { data, error } = await supabase
      .from("promotions")
      .delete()
      .eq("id", promotionId)
      .single();
    if (error) throw error;
    return data;
  };

  // ---------------------------
  // EFECTOS INICIALES
  // ---------------------------
  useEffect(() => {
    fetchBusinesses();
  }, []);

  // Cuando se seleccione un negocio, se cargan promociones y el diccionario y listado de productos
  useEffect(() => {
    if (selectedBusinessId) {
      fetchPromotionsForBusiness(selectedBusinessId);
      const loadProductsData = async () => {
        try {
          const dict = await fetchProductsDictionary(selectedBusinessId);
          setProductsDict(dict);
          // Convertir el diccionario a un array con la forma { id, name }
          const list = Object.keys(dict).map((key) => ({
            id: key,
            name: dict[key],
          }));
          setProductsList(list);
        } catch (error) {
          console.error("Error fetching products dictionary:", error);
        }
      };
      loadProductsData();
    }
  }, [selectedBusinessId]);

  // ---------------------------
  // FILTRO POR BÚSQUEDA
  // ---------------------------
  const filteredPromotions = useMemo(() => {
    if (!searchQuery.trim()) return promotions;
    const lowerQuery = searchQuery.toLowerCase();
    return promotions.filter((promo) =>
      promo.name.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery, promotions]);

  // ---------------------------
  // MODALES: ABRIR/EDITAR/ELIMINAR
  // ---------------------------
  const openAddPromotionModal = () => {
    setEditingPromotion(null);
    setPromotionFormData({
      name: "",
      text: "",
      price: 0,
      businessId: selectedBusinessId,
      products: [],
    });
    setIsPromotionModalOpen(true);
  };

  const openEditPromotionModal = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setPromotionFormData({
      name: promotion.name,
      price: promotion.price,
      businessId: promotion.businessId,
      products: [...promotion.products],
    });
    setIsPromotionModalOpen(true);
  };

  const openDeleteModal = (promotion: Promotion) => {
    setCurrentPromotionForDelete(promotion);
    setIsDeleteModalOpen(true);
  };

  // ---------------------------
  // MANEJO DEL FORMULARIO
  // ---------------------------
  const handlePromotionFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setPromotionFormData((prev) => ({
      ...prev,
      [name]: name === "price" ? Number(value) : value,
    }));
  };

  // Manejo del array de productos en la promoción (cada item: { id, qty })
  const handleAddProductToPromotion = () => {
    setPromotionFormData((prev) => ({
      ...prev,
      products: [...prev.products, { id: "", qty: 1 }],
    }));
  };

  const handleRemoveProductFromPromotion = (index: number) => {
    setPromotionFormData((prev) => {
      const newProducts = [...prev.products];
      newProducts.splice(index, 1);
      return { ...prev, products: newProducts };
    });
  };

  const handleChangeProductField = (
    index: number,
    field: "id" | "qty",
    value: string | number
  ) => {
    setPromotionFormData((prev) => {
      const newProducts = [...prev.products];
      if (field === "qty") {
        newProducts[index].qty = Number(value);
      } else {
        newProducts[index].id = String(value);
      }
      return { ...prev, products: newProducts };
    });
  };

  const handlePromotionFormSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    try {
      if (editingPromotion) {
        await updatePromotion({
          id: editingPromotion.id,
          ...promotionFormData,
        });
      } else {
        await createPromotion(promotionFormData);
      }
      setIsPromotionModalOpen(false);
      setIsRefreshing(true);
      await fetchPromotionsForBusiness(selectedBusinessId);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error al guardar la promoción:", error);
    }
  };

  const handleDelete = async () => {
    if (!currentPromotionForDelete) return;
    try {
      await deletePromotion(currentPromotionForDelete.id);
      setIsDeleteModalOpen(false);
      setIsRefreshing(true);
      await fetchPromotionsForBusiness(selectedBusinessId);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error al eliminar la promoción:", error);
    }
  };

  // ---------------------------
  // RENDERIZADO DEL COMPONENTE
  // ---------------------------
  const isLoading = promotionsLoading;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Promociones</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestión de promociones para el negocio seleccionado
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={openAddPromotionModal}
            className="btn btn-primary flex items-center"
          >
            <Plus className="w-5 h-5 mr-1" />
            Agregar Promoción
          </button>
          <Link href="/employee/dashboard" className="btn btn-secondary">
            Volver al Dashboard
          </Link>
        </div>
      </div>

      {/* Filtros: Negocio y Búsqueda */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:w-1/2">
            <select
              className="input w-full"
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
            >
              <option value="">Selecciona un negocio</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>
          {selectedBusinessId && (
            <div className="relative w-full md:w-1/2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="input pl-10 w-full"
                placeholder="Buscar promociones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabla de Promociones */}
      {selectedBusinessId ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <colgroup>
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/5" />
                <col className="w-2/5" />
                <col className="w-1/5" />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Precio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Productos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {isRefreshing || isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center">
                        <div className="text-center flex flex-col">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700"></div>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            Cargando datos...
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredPromotions.length > 0 ? (
                  filteredPromotions.map((promo) => (
                    <tr
                      key={promo.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 whitespace-normal break-words">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {promo.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ${promo.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-normal break-words text-sm">
                        {promo.products && promo.products.length > 0 ? (
                          promo.products.map((prod, idx) => {
                            const productName =
                              productsDict[prod.id] || "Producto desconocido";
                            return (
                              <div
                                key={`${promo.id}-prod-${idx}`}
                                className="mb-1"
                              >
                                <span className="font-medium text-gray-800 dark:text-gray-100">
                                  {productName}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 ml-2">
                                  (Qty: {prod.qty})
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-gray-400">Sin productos</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => openEditPromotionModal(promo)}
                            className="btn btn-primary px-6"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => openDeleteModal(promo)}
                            className="btn btn-danger px-6"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {searchQuery
                        ? "No se encontraron promociones que coincidan con la búsqueda."
                        : "No hay promociones para este negocio."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-600 dark:text-gray-400">
          Selecciona un negocio para ver las promociones.
        </div>
      )}

      {/* Modal Agregar/Editar Promoción */}
      {isPromotionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                {editingPromotion
                  ? "Editar Promoción"
                  : "Agregar Nueva Promoción"}
              </h2>
              <button
                onClick={() => setIsPromotionModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form
              onSubmit={handlePromotionFormSubmit}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="label">
                    Nombre de la Promoción
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={promotionFormData.name}
                    onChange={handlePromotionFormChange}
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="price" className="label">
                    Precio
                  </label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={promotionFormData.price}
                    onChange={handlePromotionFormChange}
                    min="0"
                    step="0.01"
                    required
                    className="input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="businessId" className="label">
                    Negocio
                  </label>
                  <select
                    id="businessId"
                    name="businessId"
                    value={promotionFormData.businessId}
                    onChange={handlePromotionFormChange}
                    required
                    className="input"
                  >
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Sección para manejar el array de productos */}
                <div className="md:col-span-2">
                  <label className="label">
                    Productos en la Promo (Selecciona producto y cantidad)
                  </label>
                  {promotionFormData.products.map((prod, idx) => (
                    <div key={idx} className="flex items-center gap-4 mb-2">
                      <div className="w-2/3">
                        <ProductAutocompleteInput
                          value={productsDict[prod.id] || ""}
                          onSelect={(selectedId) =>
                            handleChangeProductField(idx, "id", selectedId)
                          }
                          products={productsList}
                        />
                      </div>
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={prod.qty}
                        onChange={(e) =>
                          handleChangeProductField(
                            idx,
                            "qty",
                            Number(e.target.value)
                          )
                        }
                        className="input w-1/3"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveProductFromPromotion(idx)}
                        className="btn btn-danger"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddProductToPromotion}
                    className="btn btn-secondary"
                  >
                    + Agregar producto
                  </button>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsPromotionModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPromotion
                    ? "Actualizar Promoción"
                    : "Agregar Promoción"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Eliminación */}
      {isDeleteModalOpen && currentPromotionForDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                Confirmar Eliminación
              </h2>
              <p className="mb-6">
                ¿Estás seguro de que deseas eliminar la promoción "
                {currentPromotionForDelete.name}"? Esta acción no se puede
                deshacer.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button onClick={handleDelete} className="btn btn-danger">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
