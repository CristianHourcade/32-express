"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
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

interface ProductOption { id: string; name: string; }
interface ProductAutocompleteInputProps { value: string; onSelect: (id: string) => void; products: ProductOption[]; }

function ProductAutocompleteInput({ value, onSelect, products }: ProductAutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => setInputValue(value), [value]);
  const filtered = products.filter(p => p.name.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400"
        value={inputValue}
        placeholder="Buscar producto..."
        onChange={e => { setInputValue(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute top-full left-0 w-full bg-white shadow-lg rounded-lg mt-1 max-h-60 overflow-auto">
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => { onSelect(p.id); setInputValue(p.name); setIsOpen(false); }}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >{p.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PromotionsAdminPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);
  const [productsDict, setProductsDict] = useState<Record<string,string>>({});
  const [productsList, setProductsList] = useState<ProductOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion| null>(null);
  const [form, setForm] = useState({ code: "", name: "", price: 0, products: [] as {id:string;qty:number}[] });

  // Fetch products
  useEffect(() => {
    (async () => {
      const pageSize = 1000; let all: any[] = [], from = 0;
      while (true) {
        const { data } = await supabase.from('products_master').select('id,name').range(from, from+pageSize-1);
        if (!data?.length) break; all.push(...data);
        if (data.length < pageSize) break; from += pageSize;
      }
      const dict: any = {};
      all.forEach(p => dict[p.id] = p.name);
      setProductsDict(dict);
      setProductsList(all.map(p => ({ id: p.id, name: p.name })));
    })();
  }, []);

  // Fetch promotions
  const load = async () => {
    setLoading(true);
    const pageSize=1000; let all:any[]=[],from=0;
    while(true){
      const { data, error } = await supabase.from('promos')
        .select('id,code,name,promo_price,is_active,promo_items(product_id,quantity)')
        .range(from,from+pageSize-1);
      if (error) break;
      if (!data?.length) break;
      all.push(...data);
      if (data.length<pageSize) break; from+=pageSize;
    }
    setPromotions(all.map(r=>({
      id: r.id,
      code: r.code,
      name: r.name,
      price: r.promo_price,
      isActive: r.is_active,
      products: r.promo_items.map((pi:any)=>({id:pi.product_id,qty:pi.quantity})),
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => promotions
    .filter(p => showDisabled || p.isActive)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [promotions,showDisabled,search]
  );

  // Handlers
  const openNew = () => { setEditing(null); setForm({code:"",name:"",price:0,products:[]}); setModalOpen(true); };
  const openEdit = (p:Promotion) => { setEditing(p); setForm({code:p.code,name:p.name,price:p.price,products:p.products}); setModalOpen(true); };
  const handle = (e:any) => setForm(f=>({...f,[e.target.name]: e.target.name==='price'?+e.target.value:e.target.value}));
  const addLine = () => setForm(f=>({...f,products:[...f.products,{id:'',qty:1}]}));
  const removeLine = (i:number)=> setForm(f=>{const a=[...f.products];a.splice(i,1);return{...f,products:a}});
  const changeLine = (i:number,field:'id'|'qty',v:any)=> setForm(f=>{const a=[...f.products];if(field==='id')a[i].id=v;else a[i].qty=+v;return{...f,products:a}});

  const submit = async(e:any) => {
    e.preventDefault();
    if (editing) {
      await supabase.from('promos').update({ code:form.code,name:form.name,promo_price:form.price }).eq('id',editing.id);
      await supabase.from('promo_items').delete().eq('promo_id',editing.id);
      if(form.products.length) await supabase.from('promo_items').insert(form.products.map(p=>({promo_id:editing.id,product_id:p.id,quantity:p.qty})));
    } else {
      const {data} = await supabase.from('promos').insert({ code:form.code,name:form.name,promo_price:form.price,is_active:true }).select('id').single();
      if(data) await supabase.from('promo_items').insert(form.products.map(p=>({promo_id:data.id,product_id:p.id,quantity:p.qty})));
    }
    setModalOpen(false); load();
  };

  const toggle = async(p:Promotion) => {
    await supabase.from('promos').update({is_active:!p.isActive}).eq('id',p.id);
    load();
  };

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Promociones Globales</h1>
        <button onClick={openNew} className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
          <Plus className="mr-2"/>Nueva Promo
        </button>
      </div>
      {/* Filters */}
      <div className="flex items-center space-x-4 mb-6">
        <label className="inline-flex items-center space-x-2">
          <input type="checkbox" checked={showDisabled} onChange={()=>setShowDisabled(s=>!s)} className="form-checkbox text-indigo-600"/>
          <span className="text-gray-700 dark:text-gray-300">Mostrar deshabilitadas</span>
        </label>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
          <input
            type="text"
            placeholder="Buscar promociones..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400"/>
        </div>
      </div>
      {/* Table */}
      <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {['Código','Nombre','Precio','Items','Estado','Acciones'].map(h=>
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map(p=>(
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4 whitespace-nowrap">{p.code}</td>
                <td className="px-6 py-4 whitespace-nowrap">{p.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">${p.price.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-normal break-words">
                  {p.products.map((it,i)=><div key={i} className="flex items-center space-x-1 mb-1"><span className="font-medium">{productsDict[it.id]||'—'}</span><span className="text-gray-500">x{it.qty}</span></div>)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${p.isActive?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}> {p.isActive?'Activo':'Deshabilitado'}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-y-2">
                  <button onClick={()=>openEdit(p)} className="w-32 bg-blue-600 hover:bg-blue-700 text-white py-1 rounded-lg">Editar</button>
                  <button onClick={()=>toggle(p)} className={`w-32 ml-2 py-1 rounded-lg ${p.isActive?'bg-yellow-500 hover:bg-yellow-600 text-white':'bg-green-500 hover:bg-green-600 text-white'}`}>{p.isActive?'Deshabilitar':'Habilitar'}</button>
                </td>
              </tr>
            ))}
            {(!loading && !filtered.length) && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">No hay promociones que mostrar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-lg max-h-full overflow-auto">
            <div className="flex justify-between items-center border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{editing?'Editar Promo':'Nueva Promo'}</h2>
              <button onClick={()=>setModalOpen(false)}><X className="text-gray-500"/></button>
            </div>
            <form onSubmit={submit} className="px-6 py-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código</label>
                  <input name="code" value={form.code} onChange={handle} required className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                  <input name="name" value={form.name} onChange={handle} required className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio</label>
                <input name="price" type="number" value={form.price} onChange={handle} required className="w-full px-3 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Items de la promo</label>
                <div className="space-y-3">
                  {form.products.map((it,i)=>(
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1">
                        <ProductAutocompleteInput value={productsDict[it.id]||''} onSelect={v=>changeLine(i,'id',v)} products={productsList} />
                      </div>
                      <input type="number" min={1} value={it.qty} onChange={e=>changeLine(i,'qty',e.target.value)} className="w-20 px-2 py-2 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-400" />
                      <button type="button" onClick={()=>removeLine(i)} className="text-red-500 hover:text-red-700"><X/></button>
                    </div>
                  ))}
                  <button type="button" onClick={addLine} className="flex items-center text-indigo-600 hover:underline">+ Agregar producto</button>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={()=>setModalOpen(false)} className="px-4 py-2 rounded border border-gray-300">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">{editing?'Actualizar':'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
