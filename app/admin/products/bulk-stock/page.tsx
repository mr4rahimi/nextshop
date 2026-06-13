"use client";

import { useEffect, useState } from "react";

interface Product {
  id: string;
  title: string;
  slug: string;
  mainImage: string | null;
  stock: number;
  trackStock: boolean;
  lowStockThreshold: number;
  category?: { title: string };
  brand?: { title: string };
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }

export default function BulkStockPage() {
  const [products, setProducts]       = useState<Product[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterCat, setFilterCat]     = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterStock, setFilterStock] = useState("");
  const [categories, setCategories]   = useState<any[]>([]);
  const [brands, setBrands]           = useState<any[]>([]);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [edited, setEdited]           = useState<Record<string, { stock: string; trackStock: boolean; lowStockThreshold: string }>>({});
  const [saving, setSaving]           = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds]       = useState<Record<string, boolean>>({});

  // bulk modal
  const [showBulk, setShowBulk]     = useState(false);
  const [bulkType, setBulkType]     = useState<"set" | "increase" | "decrease">("set");
  const [bulkValue, setBulkValue]   = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  async function fetchData() {
    setLoading(true);
    const [pRes, cRes, bRes] = await Promise.all([
      fetch("/api/admin/products?pageSize=5000"),
      fetch("/api/admin/categories"),
      fetch("/api/admin/brands"),
    ]);
    const data = await pRes.json();
    setProducts(Array.isArray(data) ? data : (data.items ?? []));
    setCategories(await cRes.json());
    setBrands(await bRes.json());
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchS = !q || p.title.toLowerCase().includes(q);
    const matchC = !filterCat || p.category?.title === filterCat;
    const matchB = !filterBrand || p.brand?.title === filterBrand;
    const matchStock =
      filterStock === "" ? true :
      filterStock === "tracked" ? p.trackStock :
      filterStock === "untracked" ? !p.trackStock :
      filterStock === "zero" ? (p.trackStock && p.stock === 0) :
      filterStock === "low" ? (p.trackStock && p.stock > 0 && p.stock <= p.lowStockThreshold) : true;
    return matchS && matchC && matchB && matchStock;
  });

  function toggleSelect(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));
  }

  function getEdited(p: Product) {
    return edited[p.id] ?? {
      stock: String(p.stock ?? 0),
      trackStock: p.trackStock ?? false,
      lowStockThreshold: String(p.lowStockThreshold ?? 3),
    };
  }

  function handleEdit(id: string, field: string, val: any) {
    const p = products.find(x => x.id === id)!;
    setEdited(prev => ({ ...prev, [id]: { ...getEdited(p), [field]: val } }));
  }

  async function saveSingle(p: Product) {
    const vals = getEdited(p);
    setSaving(prev => ({ ...prev, [p.id]: true }));
    await fetch("/api/admin/products/bulk-stock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p.id,
        stock: vals.stock,
        trackStock: vals.trackStock,
        lowStockThreshold: vals.lowStockThreshold,
      }),
    });
    setSaving(prev => ({ ...prev, [p.id]: false }));
    setSavedIds(prev => ({ ...prev, [p.id]: true }));
    setTimeout(() => setSavedIds(prev => ({ ...prev, [p.id]: false })), 2000);
    setProducts(prev => prev.map(pr => pr.id === p.id
      ? { ...pr, stock: parseInt(vals.stock) || 0, trackStock: vals.trackStock, lowStockThreshold: parseInt(vals.lowStockThreshold) || 3 }
      : pr
    ));
    setEdited(prev => { const n = { ...prev }; delete n[p.id]; return n; });
  }

  async function applyBulk() {
    if (!bulkValue || selected.size === 0) return;
    setBulkSaving(true);
    await fetch("/api/admin/products/bulk-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), type: bulkType, value: bulkValue }),
    });
    setBulkSaving(false);
    setShowBulk(false);
    setBulkValue("");
    fetchData();
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;

  function stockStatus(p: Product) {
    if (!p.trackStock) return { label: "ردیابی خاموش", color: "text-gray-400", bg: "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10" };
    if (p.stock === 0) return { label: "ناموجود", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20" };
    if (p.stock <= p.lowStockThreshold) return { label: "کم موجود", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" };
    return { label: "موجود", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" };
  }

  const outOfStock = products.filter(p => p.trackStock && p.stock === 0).length;
  const lowStock = products.filter(p => p.trackStock && p.stock > 0 && p.stock <= p.lowStockThreshold).length;

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      {/* مودال گروهی */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-gray-900 dark:text-white">تغییر گروهی موجودی</h2>
              <button onClick={() => setShowBulk(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* نوع */}
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">نوع عملیات</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "set", l: "تنظیم مقدار", color: "blue" },
                    { v: "increase", l: "افزایش", color: "emerald" },
                    { v: "decrease", l: "کاهش", color: "red" },
                  ].map(t => (
                    <button key={t.v} onClick={() => setBulkType(t.v as any)}
                      className={`py-2 rounded-xl text-xs font-black transition-all border ${
                        bulkType === t.v
                          ? t.color === "blue" ? "bg-blue-600 text-white border-blue-600"
                            : t.color === "emerald" ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-red-500 text-white border-red-500"
                          : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10"
                      }`}>
                      {t.v === "set" ? "= " : t.v === "increase" ? "↑ " : "↓ "}{t.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* مقدار */}
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">تعداد</label>
                <input
                  type="number"
                  min="0"
                  value={bulkValue}
                  onChange={e => setBulkValue(e.target.value)}
                  placeholder="مثلاً: ۱۰"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* خلاصه */}
              <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06] rounded-xl p-3 text-xs text-gray-600 dark:text-gray-400">
                <span className="font-black text-gray-900 dark:text-white">{toFa(selected.size)} محصول</span> انتخاب شده —
                {bulkValue ? (
                  <span className="font-black mr-1 text-blue-600">
                    {bulkType === "set" ? "تنظیم به " : bulkType === "increase" ? "+ " : "- "}{bulkValue} عدد
                  </span>
                ) : " مقدار وارد نشده"}
              </div>

              <div className="flex gap-3">
                <button onClick={applyBulk} disabled={!bulkValue || bulkSaving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all">
                  {bulkSaving ? "در حال اعمال..." : "اعمال تغییرات"}
                </button>
                <button onClick={() => setShowBulk(false)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black transition-all">
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* هدر */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">ویرایش گروهی موجودی</h1>
          <p className="text-xs text-gray-500 mt-0.5">{toFa(products.length)} محصول — {toFa(selected.size)} انتخاب شده</p>
        </div>
        {someSelected && (
          <button onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-500/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            تغییر گروهی ({toFa(selected.size)})
          </button>
        )}
      </div>

      {/* آمار */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "کل محصولات", value: products.length, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10" },
          { label: "ناموجود", value: outOfStock, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" },
          { label: "کم موجود", value: lowStock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10" },
          { label: "ردیابی فعال", value: products.filter(p => p.trackStock).length, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <span className={`text-base font-black ${s.color}`}>{toFa(s.value)}</span>
            </div>
            <span className="text-xs font-bold text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* فیلترها */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی محصول..."
              className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all" />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all">
            <option value="">همه دسته‌بندی‌ها</option>
            {categories.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
          </select>
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all">
            <option value="">همه برندها</option>
            {brands.map(b => <option key={b.id} value={b.title}>{b.title}</option>)}
          </select>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { v: "", l: "همه" },
            { v: "zero", l: "ناموجود" },
            { v: "low", l: "کم موجود" },
            { v: "tracked", l: "ردیابی فعال" },
            { v: "untracked", l: "بدون ردیابی" },
          ].map(f => (
            <button key={f.v} onClick={() => setFilterStock(f.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                filterStock === f.v
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* جدول */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        {/* هدر */}
        <div className="flex items-center gap-4 px-5 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/[0.06]">
          <button onClick={toggleAll}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
              allSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-white/20 hover:border-blue-400"
            }`}>
            {allSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            {someSelected && !allSelected && <div className="w-2 h-0.5 bg-blue-600 rounded" />}
          </button>
          <span className="text-[11px] font-black text-gray-400 flex-1">
            {someSelected ? `${toFa(selected.size)} انتخاب شده` : `${toFa(filtered.length)} محصول`}
          </span>
          <span className="text-[11px] font-black text-gray-400 w-24 text-center hidden lg:block">ردیابی</span>
          <span className="text-[11px] font-black text-gray-400 w-28 text-center hidden lg:block">موجودی</span>
          <span className="text-[11px] font-black text-gray-400 w-24 text-center hidden lg:block">آستانه هشدار</span>
          <span className="text-[11px] font-black text-gray-400 w-20 text-center hidden lg:block">وضعیت</span>
          <span className="text-[11px] font-black text-gray-400 w-16 text-center hidden lg:block">ذخیره</span>
        </div>

        {loading && <div className="py-12 text-center text-sm text-gray-400">در حال بارگذاری...</div>}
        {!loading && filtered.length === 0 && <div className="py-12 text-center text-sm text-gray-400">محصولی یافت نشد</div>}

        {!loading && filtered.map((p, idx) => {
          const vals = getEdited(p);
          const isSelected = selected.has(p.id);
          const isDirty = edited[p.id] !== undefined;
          const isSaving = saving[p.id];
          const isSaved = savedIds[p.id];
          const status = stockStatus({ ...p, stock: parseInt(vals.stock) || 0, trackStock: vals.trackStock, lowStockThreshold: parseInt(vals.lowStockThreshold) || 3 });

          return (
            <div key={p.id}
              className={`group flex items-center gap-4 px-5 py-3 transition-colors ${
                isSelected ? "bg-blue-50/50 dark:bg-blue-500/5" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              } ${idx < filtered.length - 1 ? "border-b border-gray-50 dark:border-white/[0.04]" : ""}`}>

              {/* چک‌باکس */}
              <button onClick={() => toggleSelect(p.id)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                  isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-white/20 hover:border-blue-400"
                }`}>
                {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </button>

              {/* تصویر */}
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/[0.06] flex-shrink-0 flex items-center justify-center">
                {p.mainImage
                  ? <img src={p.mainImage} alt={p.title} className="w-full h-full object-cover" />
                  : <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                }
              </div>

              {/* اطلاعات */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-900 dark:text-white truncate">{p.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {p.category && <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">{p.category.title}</span>}
                  {p.brand && <span className="text-[10px] text-gray-400">{p.brand.title}</span>}
                </div>
              </div>

              {/* ردیابی */}
              <div className="w-24 hidden lg:flex justify-center">
                <button onClick={() => handleEdit(p.id, "trackStock", !vals.trackStock)}
                  className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${vals.trackStock ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${vals.trackStock ? "-translate-x-5" : "-translate-x-1"}`} />
                </button>
              </div>

              {/* موجودی */}
              <div className="w-28 hidden lg:block">
                <input
                  type="number" min="0"
                  value={vals.stock}
                  onChange={e => handleEdit(p.id, "stock", e.target.value)}
                  disabled={!vals.trackStock}
                  dir="ltr"
                  className={`w-full px-3 py-2 rounded-xl border text-sm font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5 focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isDirty ? "border-amber-400 dark:border-amber-500/50" : "border-gray-200 dark:border-white/10 focus:border-blue-500"
                  }`}
                />
              </div>

              {/* آستانه */}
              <div className="w-24 hidden lg:block">
                <input
                  type="number" min="1"
                  value={vals.lowStockThreshold}
                  onChange={e => handleEdit(p.id, "lowStockThreshold", e.target.value)}
                  disabled={!vals.trackStock}
                  dir="ltr"
                  className={`w-full px-3 py-2 rounded-xl border text-sm font-bold text-amber-600 dark:text-amber-400 bg-gray-50 dark:bg-white/5 focus:outline-none transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isDirty ? "border-amber-400 dark:border-amber-500/50" : "border-gray-200 dark:border-white/10 focus:border-blue-500"
                  }`}
                />
              </div>

              {/* وضعیت */}
              <div className="w-20 hidden lg:block">
                <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
              </div>

              {/* ذخیره */}
              <div className="w-16 hidden lg:flex justify-center">
                {isSaved ? (
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <button onClick={() => saveSingle(p)} disabled={isSaving || !isDirty}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      isDirty ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed"
                    }`}>
                    {isSaving ? "..." : "ذخیره"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* راهنما */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl">
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-xs text-amber-600 dark:text-amber-400 leading-6">
          ردیابی را فعال کنید تا موجودی محصول کنترل شود.
          آستانه هشدار: وقتی موجودی به این عدد رسید، هشدار «کم موجود» نمایش داده می‌شود.
        </div>
      </div>
    </div>
  );
}