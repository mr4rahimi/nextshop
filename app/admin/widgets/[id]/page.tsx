"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Widget {
  id: string;
  type: string;
  title: string;
  isActive: boolean;
  config: Record<string, any>;
}

interface Category {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
}

interface Brand {
  id: string;
  title: string;
  slug: string;
  logoUrl: string | null;
}

interface Product {
  id: string;
  title: string;
  slug: string;
  price: string;
  salePrice: string | null;
  image: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(val: string | null | undefined): string {
  if (!val) return "۰";
  const n = Number(val);
  return isNaN(n) ? "۰" : n.toLocaleString("fa-IR");
}

function discountPercent(price: string, salePrice: string | null): number | null {
  if (!salePrice) return null;
  const p = Number(price), s = Number(salePrice);
  if (!p || s >= p) return null;
  return Math.round(((p - s) / p) * 100);
}

// ─── CategoryEditor ───────────────────────────────────────────────────────────
function CategoryEditor({
  widget, categories, selectedIds, setSelectedIds, perCategory, setPerCategory,
}: {
  widget: Widget;
  categories: Category[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  perCategory: number;
  setPerCategory: (n: number) => void;
}) {
  const [search, setSearch] = useState("");

  function toggle(id: string) {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  }
  function moveUp(i: number) {
    if (i === 0) return;
    const a = [...selectedIds]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setSelectedIds(a);
  }
  function moveDown(i: number) {
    if (i === selectedIds.length - 1) return;
    const a = [...selectedIds]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; setSelectedIds(a);
  }

  const filtered = categories.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">همه دسته‌بندی‌ها</h3>
            <input type="text" placeholder="جستجو..." className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
            {filtered.map(cat => {
              const sel = selectedIds.includes(cat.id);
              return (
                <li key={cat.id}>
                  <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${sel ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                    {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.title} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{cat.title}</p>
                      <p className="text-[10px] text-gray-400">{cat.slug}</p>
                    </div>
                    <div className="relative flex-shrink-0">
                      <input type="checkbox" className="peer appearance-none w-5 h-5 rounded-lg border-2 border-gray-300 dark:border-gray-600 checked:bg-blue-500 checked:border-blue-500 transition-all cursor-pointer"
                        checked={sel} onChange={() => toggle(cat.id)} />
                      <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 left-1 top-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </label>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-400">دسته‌بندی‌ای یافت نشد</li>}
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-sm text-gray-900 dark:text-white">
              دسته‌های انتخاب‌شده
              <span className="mr-2 text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">{selectedIds.length} مورد</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">با دکمه‌های ↑↓ ترتیب نمایش را تغییر دهید</p>
          </div>
          {selectedIds.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">هیچ دسته‌بندی‌ای انتخاب نشده</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
              {selectedIds.map((catId, i) => {
                const cat = categories.find(c => c.id === catId);
                if (!cat) return null;
                return (
                  <li key={catId} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 h-6 rounded-lg bg-blue-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.title} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                    <p className="flex-1 text-sm font-bold text-gray-900 dark:text-white truncate">{cat.title}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => moveUp(i)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-30 flex items-center justify-center text-gray-500 transition-all text-xs">↑</button>
                      <button onClick={() => moveDown(i)} disabled={i === selectedIds.length - 1} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-30 flex items-center justify-center text-gray-500 transition-all text-xs">↓</button>
                      <button onClick={() => toggle(catId)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all text-xs">×</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {widget.type === "NEWEST_PRODUCTS" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">تعداد محصول از هر دسته‌بندی</h3>
          <div className="flex items-center gap-4">
            {[1, 2, 3, 4, 6].map(n => (
              <button key={n} onClick={() => setPerCategory(n)}
                className={`w-12 h-12 rounded-xl font-black text-sm transition-all ${perCategory === n ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"}`}>
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {selectedIds.length > 0 ? `مجموع ${selectedIds.length * perCategory} محصول نمایش داده می‌شود` : "ابتدا دسته‌بندی انتخاب کنید"}
          </p>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-bold">
            {selectedIds.length} دسته‌بندی انتخاب شده — در صفحه اصلی به همین ترتیب نمایش داده می‌شوند
          </p>
        </div>
      )}
    </div>
  );
}

// ─── ProductsByCategoryEditor ─────────────────────────────────────────────────
function ProductsByCategoryEditor({
  categories, categoryId, setCategoryId, count, setCount,
}: {
  categories: Category[];
  categoryId: string;
  setCategoryId: (id: string, title: string, slug: string) => void;
  count: number;
  setCount: (n: number) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = categories.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const selectedCat = categories.find(c => c.id === categoryId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">انتخاب دسته‌بندی</h3>
            <input type="text" placeholder="جستجو..." className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
            {filtered.map(cat => {
              const sel = categoryId === cat.id;
              return (
                <li key={cat.id}>
                  <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${sel ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                    {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.title} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{cat.title}</p>
                      <p className="text-[10px] text-gray-400">{cat.slug}</p>
                    </div>
                    <input type="radio" name="pbcCat" className="w-4 h-4 accent-blue-600"
                      checked={sel} onChange={() => setCategoryId(cat.id, cat.title, cat.slug)} />
                  </label>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-400">دسته‌بندی‌ای یافت نشد</li>}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">دسته انتخاب‌شده</h3>
            {selectedCat ? (
              <div className="flex items-center gap-3">
                {selectedCat.imageUrl ? <img src={selectedCat.imageUrl} alt={selectedCat.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" /> : (
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-black text-sm text-gray-900 dark:text-white">{selectedCat.title}</p>
                  <p className="text-[10px] text-gray-400">{selectedCat.slug}</p>
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">هیچ دسته‌ای انتخاب نشده</p>}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">تعداد محصولات نمایشی</h3>
            <div className="flex items-center gap-3 flex-wrap">
              {[4, 6, 8, 10, 12].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className={`w-12 h-12 rounded-xl font-black text-sm transition-all ${count === n ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {selectedCat ? `${count} محصول از دسته «${selectedCat.title}» در اسلایدر نمایش داده می‌شود` : "ابتدا دسته‌بندی انتخاب کنید"}
            </p>
          </div>
        </div>
      </div>

      {selectedCat && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-bold">
            💡 {count} محصول از دسته «{selectedCat.title}» در قالب اسلایدر نمایش داده می‌شود
          </p>
        </div>
      )}
    </div>
  );
}

// ─── ProductsByBrandEditor ────────────────────────────────────────────────────
function ProductsByBrandEditor({
  brands, brandId, onSelect, count, setCount,
}: {
  brands: Brand[];
  brandId: string;
  onSelect: (id: string, title: string, slug: string, logoUrl: string | null) => void;
  count: number;
  setCount: (n: number) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = brands.filter(b => b.title.toLowerCase().includes(search.toLowerCase()));
  const selectedBrand = brands.find(b => b.id === brandId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">انتخاب برند</h3>
            <input type="text" placeholder="جستجوی برند..."
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
            {filtered.map(brand => {
              const sel = brandId === brand.id;
              return (
                <li key={brand.id}>
                  <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${sel ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt={brand.title} className="w-9 h-9 rounded-xl object-contain flex-shrink-0 bg-gray-50 dark:bg-gray-800 p-1" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{brand.title}</p>
                      <p className="text-[10px] text-gray-400">{brand.slug}</p>
                    </div>
                    <input type="radio" name="pbbBrand" className="w-4 h-4 accent-indigo-600"
                      checked={sel} onChange={() => onSelect(brand.id, brand.title, brand.slug, brand.logoUrl)} />
                  </label>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-400">برندی یافت نشد</li>}
          </ul>
        </div>

        {}
        <div className="space-y-4">
          {}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">برند انتخاب‌شده</h3>
            {selectedBrand ? (
              <div className="flex items-center gap-3">
                {selectedBrand.logoUrl ? (
                  <img src={selectedBrand.logoUrl} alt={selectedBrand.title} className="w-14 h-14 rounded-xl object-contain flex-shrink-0 bg-gray-50 dark:bg-gray-800 p-2 border border-gray-100 dark:border-gray-700" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="font-black text-sm text-gray-900 dark:text-white">{selectedBrand.title}</p>
                  <p className="text-[10px] text-gray-400">{selectedBrand.slug}</p>
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">هیچ برندی انتخاب نشده</p>}
          </div>

          {}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">تعداد محصولات نمایشی</h3>
            <div className="flex items-center gap-3 flex-wrap">
              {[4, 6, 8, 10, 12].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className={`w-12 h-12 rounded-xl font-black text-sm transition-all ${count === n ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {selectedBrand ? `${count} محصول از برند «${selectedBrand.title}» در اسلایدر نمایش داده می‌شود` : "ابتدا برند انتخاب کنید"}
            </p>
          </div>
        </div>
      </div>

      {selectedBrand && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4">
          <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">
            💡 {count} محصول از برند «{selectedBrand.title}» در قالب اسلایدر نمایش داده می‌شود
          </p>
        </div>
      )}
    </div>
  );
}

// ─── AmazingDealsEditor ───────────────────────────────────────────────────────
function AmazingDealsEditor({
  selectedIds, setSelectedIds, endsAt, setEndsAt,
}: {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  endsAt: string;
  setEndsAt: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [loadingSelected, setLoadingSelected] = useState(false);

  useEffect(() => {
    if (selectedIds.length === 0) { setSelectedProducts([]); return; }
    setLoadingSelected(true);
    fetch(`/api/admin/products-search?ids=${selectedIds.join(",")}`)
      .then(r => r.json())
      .then((data: Product[]) => {
        const sorted = selectedIds.map(id => data.find(p => p.id === id)).filter(Boolean) as Product[];
        setSelectedProducts(sorted);
      })
      .finally(() => setLoadingSelected(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/admin/products-search?q=${encodeURIComponent(search)}`)
        .then(r => r.json()).then(setSearchResults).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function toggleProduct(product: Product) {
    if (selectedIds.includes(product.id)) {
      setSelectedIds(selectedIds.filter(id => id !== product.id));
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
    } else {
      setSelectedIds([...selectedIds, product.id]);
      setSelectedProducts(prev => [...prev, product]);
    }
  }
  function moveUp(i: number) {
    if (i === 0) return;
    const a = [...selectedProducts]; [a[i - 1], a[i]] = [a[i], a[i - 1]];
    setSelectedProducts(a); setSelectedIds(a.map(p => p.id));
  }
  function moveDown(i: number) {
    if (i === selectedProducts.length - 1) return;
    const a = [...selectedProducts]; [a[i], a[i + 1]] = [a[i + 1], a[i]];
    setSelectedProducts(a); setSelectedIds(a.map(p => p.id));
  }
  function remove(id: string) {
    setSelectedIds(selectedIds.filter(x => x !== id));
    setSelectedProducts(prev => prev.filter(p => p.id !== id));
  }
  function toLocal(iso: string): string {
    if (!iso) return "";
    try { return new Date(iso).toISOString().slice(0, 16); } catch { return ""; }
  }
  function fromLocal(val: string): string {
    if (!val) return "";
    return new Date(val).toISOString();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">زمان پایان پیشنهاد</h3>
        <div className="flex items-center gap-4">
          <input type="datetime-local" className="border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white flex-1 max-w-xs"
            value={toLocal(endsAt)} onChange={e => setEndsAt(fromLocal(e.target.value))} />
          {endsAt && (
            <button onClick={() => setEndsAt("")} className="text-xs text-red-500 hover:text-red-700 font-bold px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
              پاک کردن
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">اگر زمان تعیین نشود، شمارنده ۸ ساعت از لحظه بارگذاری صفحه خواهد بود</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">جستجوی محصول</h3>
            <div className="relative">
              <input type="text" placeholder="نام محصول را تایپ کنید..."
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white pr-8"
                value={search} onChange={e => setSearch(e.target.value)} />
              {searching && <div className="absolute left-3 top-2.5 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            </div>
          </div>
          <div className="min-h-[200px] max-h-96 overflow-y-auto">
            {!search.trim() ? (
              <div className="p-8 text-center text-sm text-gray-400">نام محصول را برای جستجو وارد کنید</div>
            ) : searchResults.length === 0 && !searching ? (
              <div className="p-8 text-center text-sm text-gray-400">محصولی یافت نشد</div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {searchResults.map(product => {
                  const sel = selectedIds.includes(product.id);
                  const discount = discountPercent(product.price, product.salePrice);
                  return (
                    <li key={product.id}>
                      <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${sel ? "bg-orange-50 dark:bg-orange-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                        {product.image ? <img src={product.image} alt={product.title} className="w-12 h-12 rounded-xl object-contain flex-shrink-0 bg-gray-50" /> : <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{product.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {discount && <span className="text-[10px] font-black text-white bg-orange-500 px-1.5 py-0.5 rounded-lg">{discount}٪</span>}
                            <span className="text-[11px] text-gray-500">{formatPrice(product.salePrice ?? product.price)} تومان</span>
                            {product.salePrice && <span className="text-[10px] text-gray-400 line-through">{formatPrice(product.price)}</span>}
                          </div>
                        </div>
                        <div className="relative flex-shrink-0">
                          <input type="checkbox" className="peer appearance-none w-5 h-5 rounded-lg border-2 border-gray-300 dark:border-gray-600 checked:bg-orange-500 checked:border-orange-500 transition-all cursor-pointer"
                            checked={sel} onChange={() => toggleProduct(product)} />
                          <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 left-1 top-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M5 13l4 4L19 7" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-sm text-gray-900 dark:text-white">
              محصولات انتخاب‌شده
              <span className="mr-2 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">{selectedIds.length} محصول</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">با دکمه‌های ↑↓ ترتیب نمایش را تغییر دهید</p>
          </div>
          {loadingSelected ? (
            <div className="p-8 text-center text-sm text-gray-400">در حال بارگذاری...</div>
          ) : selectedProducts.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">هیچ محصولی انتخاب نشده</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
              {selectedProducts.map((product, i) => {
                const discount = discountPercent(product.price, product.salePrice);
                return (
                  <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 h-6 rounded-lg bg-orange-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    {product.image ? <img src={product.image} alt={product.title} className="w-10 h-10 rounded-xl object-contain flex-shrink-0 bg-gray-50" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{product.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {discount && <span className="text-[10px] font-black text-white bg-orange-500 px-1.5 py-0.5 rounded">{discount}٪</span>}
                        <span className="text-[11px] text-gray-500">{formatPrice(product.salePrice ?? product.price)} تومان</span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => moveUp(i)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-30 flex items-center justify-center text-gray-500 transition-all text-xs">↑</button>
                      <button onClick={() => moveDown(i)} disabled={i === selectedProducts.length - 1} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-30 flex items-center justify-center text-gray-500 transition-all text-xs">↓</button>
                      <button onClick={() => remove(product.id)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all text-xs">×</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
          <p className="text-xs text-orange-700 dark:text-orange-300 font-bold">
            {selectedIds.length} محصول در بخش شگفت‌انگیز نمایش داده می‌شود
            {endsAt ? ` — پیشنهاد تا ${new Date(endsAt).toLocaleString("fa-IR")} ادامه دارد` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── CallToActionEditor ───────────────────────────────────────────────────────
interface CTAConfig {
  heading: string; subheading: string;
  btnText: string; btnUrl: string;
  bgType: "solid" | "gradient";
  bgColor: string;
  bgGradientFrom: string; bgGradientTo: string; bgGradientDir: string;
  btnBg: string; btnColor: string; textColor: string;
}

const GRAD_DIRS = [
  { value: "90deg",  label: "← چپ به راست →" },
  { value: "270deg", label: "→ راست به چپ ←" },
  { value: "180deg", label: "↓ بالا به پایین" },
  { value: "0deg",   label: "↑ پایین به بالا" },
  { value: "135deg", label: "↘ قطری" },
  { value: "45deg",  label: "↗ قطری معکوس" },
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 w-32 flex-shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer p-0.5 bg-white dark:bg-gray-800" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-mono bg-white dark:bg-gray-800 dark:text-white uppercase" />
      </div>
    </div>
  );
}

function CallToActionEditor({ config, setConfig }: { config: CTAConfig; setConfig: (c: CTAConfig) => void }) {
  const set = (key: keyof CTAConfig, value: string) => setConfig({ ...config, [key]: value });

  const bgStyle: React.CSSProperties = config.bgType === "gradient"
    ? { background: `linear-gradient(${config.bgGradientDir}, ${config.bgGradientFrom}, ${config.bgGradientTo})` }
    : { backgroundColor: config.bgColor };

  return (
    <div className="space-y-5">

      {/* ── Content ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">محتوا</h3>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان اصلی *</label>
          <input type="text" placeholder="مثال: با ما تماس بگیرید" value={config.heading}
            onChange={e => set("heading", e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">زیرعنوان (اختیاری)</label>
          <textarea rows={2} placeholder="مثال: پشتیبانی ما ۲۴ ساعته آماده پاسخگویی است" value={config.subheading}
            onChange={e => set("subheading", e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">متن دکمه *</label>
            <input type="text" placeholder="مثال: تماس بگیرید" value={config.btnText}
              onChange={e => set("btnText", e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">لینک دکمه</label>
            <input type="text" placeholder="/contact یا https://..." value={config.btnUrl}
              onChange={e => set("btnUrl", e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
          </div>
        </div>
      </div>

      {/* ── Background ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">پس‌زمینه</h3>
        <div className="flex gap-2">
          {(["solid", "gradient"] as const).map(t => (
            <button key={t} onClick={() => setConfig({ ...config, bgType: t })}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                config.bgType === t
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              }`}>
              {t === "solid" ? "رنگ ساده" : "گرادینت"}
            </button>
          ))}
        </div>

        {config.bgType === "solid" ? (
          <ColorField label="رنگ پس‌زمینه" value={config.bgColor} onChange={v => set("bgColor", v)} />
        ) : (
          <div className="space-y-3">
            <ColorField label="رنگ شروع" value={config.bgGradientFrom} onChange={v => set("bgGradientFrom", v)} />
            <ColorField label="رنگ پایان" value={config.bgGradientTo} onChange={v => set("bgGradientTo", v)} />
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 w-32 flex-shrink-0">جهت گرادینت</label>
              <select value={config.bgGradientDir} onChange={e => set("bgGradientDir", e.target.value)}
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-gray-800 dark:text-white">
                {GRAD_DIRS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Colors ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">رنگ‌بندی متن و دکمه</h3>
        <ColorField label="رنگ متن" value={config.textColor} onChange={v => set("textColor", v)} />
        <ColorField label="پس‌زمینه دکمه" value={config.btnBg} onChange={v => set("btnBg", v)} />
        <ColorField label="رنگ نوشته دکمه" value={config.btnColor} onChange={v => set("btnColor", v)} />
      </div>

      {/* ── Live preview ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-black text-sm text-gray-900 dark:text-white">پیش‌نمایش</h3>
        </div>
        <div className="p-4">
          <div className="relative overflow-hidden rounded-2xl px-6 py-12 text-center" style={bgStyle}>
            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="relative z-10">
              {config.heading && (
                <h2 className="text-xl font-black mb-2" style={{ color: config.textColor }}>
                  {config.heading}
                </h2>
              )}
              {config.subheading && (
                <p className="text-xs mb-5 opacity-80" style={{ color: config.textColor }}>
                  {config.subheading}
                </p>
              )}
              {config.btnText && (
                <span className="inline-block px-6 py-2.5 rounded-xl font-black text-sm shadow-lg"
                  style={{ background: config.btnBg, color: config.btnColor }}>
                  {config.btnText}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WidgetEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [widget, setWidget] = useState<Widget | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [saving, setSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perCategory, setPerCategory] = useState(3);

  // state AMAZING_DEALS
  const [endsAt, setEndsAt] = useState("");
  const [amazingIds, setAmazingIds] = useState<string[]>([]);

  // state PRODUCTS_BY_CATEGORY
  const [pbcCategoryId, setPbcCategoryId] = useState("");
  const [pbcCategoryTitle, setPbcCategoryTitle] = useState("");
  const [pbcCategorySlug, setPbcCategorySlug] = useState("");
  const [pbcCount, setPbcCount] = useState(8);

  // state PRODUCTS_BY_BRAND
  const [pbbBrandId, setPbbBrandId] = useState("");
  const [pbbBrandTitle, setPbbBrandTitle] = useState("");
  const [pbbBrandSlug, setPbbBrandSlug] = useState("");
  const [pbbBrandLogo, setPbbBrandLogo] = useState<string | null>(null);
  const [pbbCount, setPbbCount] = useState(8);

   // FULL_BANNER
  const [fbImageUrl, setFbImageUrl] = useState("");
  const [fbLinkUrl, setFbLinkUrl] = useState("");
  const [fbAlt, setFbAlt] = useState("");
  const [fbUploading, setFbUploading] = useState(false);

  // CALL_TO_ACTION
  const [ctaConfig, setCtaConfig] = useState<CTAConfig>({
    heading: "", subheading: "", btnText: "شروع کنید", btnUrl: "",
    bgType: "gradient", bgColor: "#4f46e5",
    bgGradientFrom: "#4f46e5", bgGradientTo: "#7c3aed", bgGradientDir: "135deg",
    btnBg: "#ffffff", btnColor: "#4f46e5", textColor: "#ffffff",
  });

  // DOUBLE_BANNER
  const [db, setDb] = useState([
  { imageUrl: "", linkUrl: "", alt: "" },
  { imageUrl: "", linkUrl: "", alt: "" },
  ]);
  const [dbUploading, setDbUploading] = useState([false, false]);

  const SUPPORTED = ["CATEGORIES", "NEWEST_PRODUCTS", "AMAZING_DEALS", "PRODUCTS_BY_CATEGORY", "PRODUCTS_BY_BRAND", "FULL_BANNER", "DOUBLE_BANNER", "HERO_SLIDER", "STORY", "LATEST_ARTICLES", "CALL_TO_ACTION"];
  useEffect(() => {
    fetch("/api/admin/widgets")
      .then(r => r.json())
      .then((widgets: Widget[]) => {
        const w = widgets.find(x => x.id === id);
        if (!w) return;
        setWidget(w);
        if (w.type === "AMAZING_DEALS") {
          setAmazingIds(w.config.productIds ?? []);
          setEndsAt(w.config.endsAt ?? "");
        } else if (w.type === "PRODUCTS_BY_CATEGORY") {
          setPbcCategoryId(w.config.categoryId ?? "");
          setPbcCategoryTitle(w.config.categoryTitle ?? "");
          setPbcCategorySlug(w.config.categorySlug ?? "");
          setPbcCount(w.config.count ?? 8);
        } else if (w.type === "PRODUCTS_BY_BRAND") {
          setPbbBrandId(w.config.brandId ?? "");
          setPbbBrandTitle(w.config.brandTitle ?? "");
          setPbbBrandSlug(w.config.brandSlug ?? "");
          setPbbBrandLogo(w.config.brandLogoUrl ?? null);
          setPbbCount(w.config.count ?? 8);
        } else if (w.type === "CALL_TO_ACTION") {
          setCtaConfig({
            heading:         w.config.heading         ?? "",
            subheading:      w.config.subheading      ?? "",
            btnText:         w.config.btnText         ?? "شروع کنید",
            btnUrl:          w.config.btnUrl          ?? "",
            bgType:          w.config.bgType          ?? "gradient",
            bgColor:         w.config.bgColor         ?? "#4f46e5",
            bgGradientFrom:  w.config.bgGradientFrom  ?? "#4f46e5",
            bgGradientTo:    w.config.bgGradientTo    ?? "#7c3aed",
            bgGradientDir:   w.config.bgGradientDir   ?? "135deg",
            btnBg:           w.config.btnBg           ?? "#ffffff",
            btnColor:        w.config.btnColor        ?? "#4f46e5",
            textColor:       w.config.textColor       ?? "#ffffff",
          });
        } else if (w.type === "FULL_BANNER") {
          setFbImageUrl(w.config.imageUrl ?? "");
          setFbLinkUrl(w.config.linkUrl ?? "");
          setFbAlt(w.config.alt ?? "");
        } else if (w.type === "DOUBLE_BANNER") {
          const b = w.config.banners ?? [];
          setDb([
            { imageUrl: b[0]?.imageUrl ?? "", linkUrl: b[0]?.linkUrl ?? "", alt: b[0]?.alt ?? "" },
            { imageUrl: b[1]?.imageUrl ?? "", linkUrl: b[1]?.linkUrl ?? "", alt: b[1]?.alt ?? "" },
          ]);
        } else {
          setSelectedIds(w.config.categoryIds ?? []);
          setPerCategory(w.config.perCategory ?? 3);
        }
      });

    fetch("/api/admin/categories").then(r => r.json()).then(setCategories);
    fetch("/api/admin/brands").then(r => r.json()).then(setBrands);
  }, [id]);

  async function handleSave() {
    if (!widget) return;
    setSaving(true);

    let config: Record<string, any>;
    if (widget.type === "CALL_TO_ACTION") {
      config = { ...ctaConfig };
    } else if (widget.type === "AMAZING_DEALS") {
      config = { productIds: amazingIds, endsAt: endsAt || null };
    } else if (widget.type === "NEWEST_PRODUCTS") {
      config = { categoryIds: selectedIds, perCategory };
    } else if (widget.type === "PRODUCTS_BY_CATEGORY") {
      config = { categoryId: pbcCategoryId, categoryTitle: pbcCategoryTitle, categorySlug: pbcCategorySlug, count: pbcCount };
    } else if (widget.type === "PRODUCTS_BY_BRAND") {
      config = { brandId: pbbBrandId, brandTitle: pbbBrandTitle, brandSlug: pbbBrandSlug, brandLogoUrl: pbbBrandLogo, count: pbbCount };
    } else if (widget.type === "FULL_BANNER") {
      config = { imageUrl: fbImageUrl, linkUrl: fbLinkUrl || null, alt: fbAlt || null };
    } else if (widget.type === "DOUBLE_BANNER") {
      config = { banners: db.map(b => ({ imageUrl: b.imageUrl, linkUrl: b.linkUrl || null, alt: b.alt || null })) };
    } else {
      config = { categoryIds: selectedIds };
    }

    await fetch("/api/admin/widgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: widget.id, title: widget.title, isActive: widget.isActive, config }),
    });
    setSaving(false);
    router.push("/admin/widgets");
  }

  if (!widget) return <div className="p-6 text-gray-500">در حال بارگذاری...</div>;

  if (!SUPPORTED.includes(widget.type)) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
          <p className="text-yellow-700 font-bold">ویرایش ویجت «{widget.type}» هنوز پیاده‌سازی نشده.</p>
          <button onClick={() => router.push("/admin/widgets")} className="mt-4 px-5 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm">بازگشت</button>
        </div>
      </div>
    );
  }

  const pageDesc: Record<string, string> = {
    AMAZING_DEALS:        "محصولاتی که با تخفیف ویژه در بخش شگفت‌انگیز نمایش داده می‌شوند را انتخاب کنید",
    PRODUCTS_BY_CATEGORY: "یک دسته‌بندی انتخاب کنید تا محصولاتش در اسلایدر نمایش داده شود",
    PRODUCTS_BY_BRAND:    "یک برند انتخاب کنید تا محصولاتش در اسلایدر نمایش داده شود",
    CATEGORIES:           "دسته‌بندی‌هایی که می‌خواهید در این ویجت نمایش داده شوند را انتخاب کنید",
    NEWEST_PRODUCTS:      "دسته‌بندی‌هایی که می‌خواهید جدیدترین محصولاتشان نمایش داده شود را انتخاب کنید",
    CALL_TO_ACTION:       "متن، دکمه و رنگ‌بندی بنر دعوت به اقدام را تنظیم کنید",
    FULL_BANNER:          "یک تصویر بنر با لینک اختیاری آپلود کنید",
    DOUBLE_BANNER:        "دو تصویر بنر کنار هم آپلود کنید",
    HERO_SLIDER:          "اسلایدهای این بخش از صفحه مدیریت اسلایدر Hero قابل تنظیم هستند",
    STORY:                "استوری‌ها از صفحه مدیریت استوری‌ها قابل تنظیم هستند",
    LATEST_ARTICLES:      "آخرین مطالب بلاگ به صورت خودکار نمایش داده می‌شوند",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push("/admin/widgets")}
            className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 mb-2 transition-colors">
            ← بازگشت به ویجت‌ها
          </button>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">ویرایش: {widget.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{pageDesc[widget.type] ?? ""}</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/30">
          {saving ? "ذخیره..." : "ذخیره تغییرات"}
        </button>
      </div>

      {widget.type === "AMAZING_DEALS" && (
        <AmazingDealsEditor selectedIds={amazingIds} setSelectedIds={setAmazingIds} endsAt={endsAt} setEndsAt={setEndsAt} />
      )}

      {widget.type === "PRODUCTS_BY_CATEGORY" && (
        <ProductsByCategoryEditor
          categories={categories}
          categoryId={pbcCategoryId}
          setCategoryId={(id, title, slug) => { setPbcCategoryId(id); setPbcCategoryTitle(title); setPbcCategorySlug(slug); }}
          count={pbcCount}
          setCount={setPbcCount}
        />
      )}

      {widget.type === "PRODUCTS_BY_BRAND" && (
        <ProductsByBrandEditor
          brands={brands}
          brandId={pbbBrandId}
          onSelect={(id, title, slug, logo) => { setPbbBrandId(id); setPbbBrandTitle(title); setPbbBrandSlug(slug); setPbbBrandLogo(logo); }}
          count={pbbCount}
          setCount={setPbbCount}
        />
      )}

      {(widget.type === "CATEGORIES" || widget.type === "NEWEST_PRODUCTS") && (
        <CategoryEditor
          widget={widget}
          categories={categories}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          perCategory={perCategory}
          setPerCategory={setPerCategory}
        />
      )}

      {widget.type === "FULL_BANNER" && (
        <div className="space-y-6">
          {}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">تصویر بنر *</h3>
              <p className="text-xs text-gray-400 mt-1">توصیه: عرض ۱۴۰۰ پیکسل یا بیشتر</p>
            </div>
            <div className="p-4">
              {fbImageUrl ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={fbImageUrl} alt="" className="w-full h-40 object-cover" />
                  <button
                    onClick={() => setFbImageUrl("")}
                    className="absolute top-2 left-2 w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all text-sm">
                    ×
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  {fbUploading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span className="text-sm">آپلود...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      <span className="text-xs text-gray-400 font-bold">کلیک کنید برای آپلود</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFbUploading(true);
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                    const data = await res.json();
                    setFbImageUrl(data.url);
                    setFbUploading(false);
                  }} />
                </label>
              )}
            </div>
          </div>
      
          {}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <label className="block font-black text-sm text-gray-900 dark:text-white mb-3">لینک (اختیاری)</label>
              <input
                type="text"
                placeholder="https://... یا /products"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
                value={fbLinkUrl}
                onChange={e => setFbLinkUrl(e.target.value)}
              />
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <label className="block font-black text-sm text-gray-900 dark:text-white mb-3">متن جایگزین (alt)</label>
              <input
                type="text"
                placeholder="توضیح تصویر برای سئو"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
                value={fbAlt}
                onChange={e => setFbAlt(e.target.value)}
              />
            </div>
          </div>
      
          {fbImageUrl && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
              <p className="text-xs text-green-700 dark:text-green-300 font-bold">
                ✅ بنر آماده نمایش است{fbLinkUrl ? ` — با لینک: ${fbLinkUrl}` : " — بدون لینک"}
              </p>
            </div>
          )}
        </div>
      )}

      {widget.type === "DOUBLE_BANNER" && (
       <div className="space-y-6">
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {[0, 1].map(i => (
             <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
               <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                 <h3 className="font-black text-sm text-gray-900 dark:text-white">بنر {i === 0 ? "اول" : "دوم"}</h3>
               </div>
               <div className="p-4 space-y-3">
                 {}
                 {db[i].imageUrl ? (
                   <div className="relative rounded-xl overflow-hidden">
                     <img src={db[i].imageUrl} alt="" className="w-full h-32 object-cover" />
                     <button
                       onClick={() => setDb(prev => prev.map((b, idx) => idx === i ? { ...b, imageUrl: "" } : b))}
                       className="absolute top-2 left-2 w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all text-sm">
                       ×
                     </button>
                   </div>
                 ) : (
                   <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                     {dbUploading[i] ? (
                       <div className="flex items-center gap-2 text-gray-400">
                         <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                         </svg>
                         <span className="text-sm">آپلود...</span>
                       </div>
                     ) : (
                       <>
                         <svg className="w-8 h-8 text-gray-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                         </svg>
                         <span className="text-xs text-gray-400 font-bold">آپلود تصویر</span>
                       </>
                     )}
                     <input type="file" accept="image/*" className="hidden" onChange={async e => {
                       const file = e.target.files?.[0];
                       if (!file) return;
                       setDbUploading(prev => prev.map((v, idx) => idx === i ? true : v));
                       const fd = new FormData();
                       fd.append("file", file);
                       const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                       const data = await res.json();
                       setDb(prev => prev.map((b, idx) => idx === i ? { ...b, imageUrl: data.url } : b));
                       setDbUploading(prev => prev.map((v, idx) => idx === i ? false : v));
                     }} />
                   </label>
                 )}
                 {}
                 <input
                   type="text"
                   placeholder="لینک (اختیاری)"
                   className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
                   value={db[i].linkUrl}
                   onChange={e => setDb(prev => prev.map((b, idx) => idx === i ? { ...b, linkUrl: e.target.value } : b))}
                 />
                 {/* alt */}
                 <input
                   type="text"
                   placeholder="متن جایگزین (alt)"
                   className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
                   value={db[i].alt}
                   onChange={e => setDb(prev => prev.map((b, idx) => idx === i ? { ...b, alt: e.target.value } : b))}
                 />
               </div>
             </div>
           ))}
         </div>
     
         {(db[0].imageUrl || db[1].imageUrl) && (
           <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
             <p className="text-xs text-green-700 dark:text-green-300 font-bold">
               ✅ {db.filter(b => b.imageUrl).length} بنر آماده نمایش — در دسکتاپ کنار هم، در موبایل زیر هم
             </p>
           </div>
         )}
       </div>
     )}

      {widget.type === "CALL_TO_ACTION" && (
        <CallToActionEditor config={ctaConfig} setConfig={setCtaConfig} />
      )}

     {(widget.type === "HERO_SLIDER" || widget.type === "STORY" || widget.type === "LATEST_ARTICLES") && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
          <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-3">{pageDesc[widget.type]}</p>
          {widget.type === "HERO_SLIDER" && (
            <a href="/admin/hero-slides" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all">
              مدیریت اسلایدر Hero ←
            </a>
          )}
          {widget.type === "STORY" && (
            <a href="/admin/stories" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all">
              مدیریت استوری‌ها ←
            </a>
          )}
          {widget.type === "LATEST_ARTICLES" && (
            <a href="/admin/blog" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all">
              مدیریت مطالب بلاگ ←
            </a>
          )}
        </div>
      )}
     

    </div>
  );
}
