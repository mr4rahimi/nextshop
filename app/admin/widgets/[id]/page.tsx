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

interface ICDBox {
  badge: string;
  heading: string;
  content: string;
  btnText: string;
  btnUrl: string;
}
const EMPTY_ICD_BOX: ICDBox = { badge: "", heading: "", content: "", btnText: "", btnUrl: "" };

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

// ─── ProductPicker ────────────────────────────────────────────────────────────
type PickerAccent = "teal" | "indigo";

const PICKER_COLORS: Record<PickerAccent, { badge: string; sel: string; check: string; upHover: string; spin: string }> = {
  teal:  { badge: "bg-teal-500",  sel: "bg-teal-50 dark:bg-teal-900/20",  check: "checked:bg-teal-500 checked:border-teal-500",  upHover: "hover:bg-teal-100 dark:hover:bg-teal-900/30",  spin: "border-teal-500"  },
  indigo:{ badge: "bg-indigo-500",sel: "bg-indigo-50 dark:bg-indigo-900/20",check:"checked:bg-indigo-500 checked:border-indigo-500",upHover:"hover:bg-indigo-100 dark:hover:bg-indigo-900/30",spin:"border-indigo-500"},
};

function ProductPicker({
  selectedIds, setSelectedIds,
  filterCategoryId, filterBrandId,
  accent,
}: {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  filterCategoryId?: string;
  filterBrandId?: string;
  accent: PickerAccent;
}) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [filterOnly, setFilterOnly] = useState(true);
  const c = PICKER_COLORS[accent];

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
      const params = new URLSearchParams({ q: search });
      if (filterOnly && filterCategoryId) params.set("categoryId", filterCategoryId);
      if (filterOnly && filterBrandId) params.set("brandId", filterBrandId);
      fetch(`/api/admin/products-search?${params}`)
        .then(r => r.json()).then(setSearchResults).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filterOnly, filterCategoryId, filterBrandId]);

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

  const hasFilter = !!(filterCategoryId || filterBrandId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">جستجوی محصول</h3>
          {hasFilter && (
            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
              <div className="relative flex-shrink-0">
                <input type="checkbox" className="peer sr-only" checked={filterOnly} onChange={() => setFilterOnly(v => !v)} />
                <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-checked:bg-blue-500 rounded-full transition-all" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-all peer-checked:translate-x-4" />
              </div>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                فقط {filterCategoryId ? "از این دسته‌بندی" : "از این برند"}
              </span>
            </label>
          )}
          <div className="relative">
            <input type="text" placeholder="نام محصول را تایپ کنید..."
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
              value={search} onChange={e => setSearch(e.target.value)} />
            {searching && <div className={`absolute left-3 top-2.5 w-4 h-4 border-2 ${c.spin} border-t-transparent rounded-full animate-spin`} />}
          </div>
        </div>
        <div className="min-h-[200px] max-h-96 overflow-y-auto">
          {!search.trim() ? (
            <div className="p-8 text-center">
              <svg className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth={1.5} /><path d="m21 21-4.35-4.35" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
              <p className="text-sm text-gray-400">نام محصول را برای جستجو تایپ کنید</p>
            </div>
          ) : searchResults.length === 0 && !searching ? (
            <div className="p-8 text-center text-sm text-gray-400">محصولی یافت نشد</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {searchResults.map(product => {
                const sel = selectedIds.includes(product.id);
                const discount = discountPercent(product.price, product.salePrice);
                return (
                  <li key={product.id}>
                    <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${sel ? c.sel : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                      {product.image ? <img src={product.image} alt={product.title} className="w-11 h-11 rounded-xl object-contain flex-shrink-0 bg-gray-50 dark:bg-gray-800" /> : <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{product.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {discount && <span className={`text-[10px] font-black text-white ${c.badge} px-1.5 py-0.5 rounded-lg`}>{discount}٪</span>}
                          <span className="text-[11px] text-gray-500">{formatPrice(product.salePrice ?? product.price)} تومان</span>
                          {product.salePrice && <span className="text-[10px] text-gray-400 line-through">{formatPrice(product.price)}</span>}
                        </div>
                      </div>
                      <div className="relative flex-shrink-0">
                        <input type="checkbox"
                          className={`peer appearance-none w-5 h-5 rounded-lg border-2 border-gray-300 dark:border-gray-600 ${c.check} transition-all cursor-pointer`}
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
          <div className="flex items-center gap-2">
            <h3 className="font-black text-sm text-gray-900 dark:text-white">محصولات انتخاب‌شده</h3>
            <span className={`text-[10px] font-bold text-white ${c.badge} px-2 py-0.5 rounded-full`}>{selectedIds.length}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">با دکمه‌های ↑↓ ترتیب نمایش را تغییر دهید</p>
        </div>
        {loadingSelected ? (
          <div className="p-8 text-center text-sm text-gray-400">در حال بارگذاری...</div>
        ) : selectedProducts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">محصولی انتخاب نشده</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto">
            {selectedProducts.map((product, i) => {
              const discount = discountPercent(product.price, product.salePrice);
              return (
                <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-6 h-6 rounded-lg ${c.badge} text-white text-[10px] font-black flex items-center justify-center flex-shrink-0`}>{i + 1}</span>
                  {product.image ? <img src={product.image} alt={product.title} className="w-10 h-10 rounded-xl object-contain flex-shrink-0 bg-gray-50 dark:bg-gray-800" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{product.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {discount && <span className={`text-[10px] font-black text-white ${c.badge} px-1.5 py-0.5 rounded`}>{discount}٪</span>}
                      <span className="text-[11px] text-gray-500">{formatPrice(product.salePrice ?? product.price)} تومان</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => moveUp(i)} disabled={i === 0} className={`w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 ${c.upHover} disabled:opacity-30 flex items-center justify-center text-gray-500 transition-all text-xs`}>↑</button>
                    <button onClick={() => moveDown(i)} disabled={i === selectedProducts.length - 1} className={`w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 ${c.upHover} disabled:opacity-30 flex items-center justify-center text-gray-500 transition-all text-xs`}>↓</button>
                    <button onClick={() => remove(product.id)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all text-xs">×</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── SortModeSelector ─────────────────────────────────────────────────────────
type SortMode = "newest" | "best_sellers" | "manual";

function SortModeSelector({
  value, onChange, accent,
}: {
  value: SortMode;
  onChange: (v: SortMode) => void;
  accent: PickerAccent;
}) {
  const options: { mode: SortMode; icon: string; label: string; desc: string }[] = [
    { mode: "newest",      icon: "🆕", label: "جدیدترین",       desc: "جدیدترین محصولات به صورت خودکار" },
    { mode: "best_sellers",icon: "🏆", label: "پرفروش‌ترین",    desc: "پرفروش‌ترین محصولات به صورت خودکار" },
    { mode: "manual",      icon: "✋", label: "انتخاب دستی",    desc: "محصولات را خودتان انتخاب کنید" },
  ];
  const activeColor = accent === "indigo"
    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
    : "border-teal-500 bg-teal-50 dark:bg-teal-900/20";
  const activeText = accent === "indigo" ? "text-indigo-700 dark:text-indigo-300" : "text-teal-700 dark:text-teal-300";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">نحوه نمایش محصولات</h3>
      <div className="grid grid-cols-3 gap-3">
        {options.map(opt => (
          <button key={opt.mode} onClick={() => onChange(opt.mode)}
            className={`p-4 rounded-2xl border-2 text-right transition-all ${value === opt.mode ? activeColor : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`}>
            <div className="text-2xl mb-2">{opt.icon}</div>
            <p className={`text-xs font-black ${value === opt.mode ? activeText : "text-gray-700 dark:text-gray-300"}`}>{opt.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ProductsByCategoryEditor ─────────────────────────────────────────────────
function ProductsByCategoryEditor({
  categories, categoryId, setCategoryId, count, setCount,
  sortMode, setSortMode, productIds, setProductIds,
}: {
  categories: Category[];
  categoryId: string;
  setCategoryId: (id: string, title: string, slug: string) => void;
  count: number;
  setCount: (n: number) => void;
  sortMode: SortMode;
  setSortMode: (m: SortMode) => void;
  productIds: string[];
  setProductIds: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = categories.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const selectedCat = categories.find(c => c.id === categoryId);

  return (
    <div className="space-y-6">
      {/* Category selector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">انتخاب دسته‌بندی</h3>
            <input type="text" placeholder="جستجو..."
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
            {filtered.map(cat => {
              const sel = categoryId === cat.id;
              return (
                <li key={cat.id}>
                  <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${sel ? "bg-teal-50 dark:bg-teal-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                    {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.title} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{cat.title}</p>
                      <p className="text-[10px] text-gray-400">{cat.slug}</p>
                    </div>
                    <input type="radio" name="pbcCat" className="w-4 h-4 accent-teal-600"
                      checked={sel} onChange={() => setCategoryId(cat.id, cat.title, cat.slug)} />
                  </label>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-400">دسته‌بندی‌ای یافت نشد</li>}
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">دسته انتخاب‌شده</h3>
          {selectedCat ? (
            <div className="flex items-center gap-3">
              {selectedCat.imageUrl ? (
                <img src={selectedCat.imageUrl} alt={selectedCat.title} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 border border-gray-100 dark:border-gray-700" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-7 h-7 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              )}
              <div>
                <p className="font-black text-sm text-gray-900 dark:text-white">{selectedCat.title}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{selectedCat.slug}</p>
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded-full">
                  ✓ انتخاب شده
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">دسته‌ای انتخاب نشده</p>
            </div>
          )}
        </div>
      </div>

      {/* Sort/display mode */}
      <SortModeSelector value={sortMode} onChange={setSortMode} accent="teal" />

      {/* Count (auto mode only) */}
      {sortMode !== "manual" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">تعداد محصولات نمایشی</h3>
          <div className="flex items-center gap-3 flex-wrap">
            {[4, 6, 8, 10, 12].map(n => (
              <button key={n} onClick={() => setCount(n)}
                className={`w-12 h-12 rounded-xl font-black text-sm transition-all ${count === n ? "bg-teal-600 text-white shadow-lg shadow-teal-500/30" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-900/20"}`}>
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {selectedCat
              ? `${count} محصول ${sortMode === "best_sellers" ? "پرفروش" : "جدید"} از دسته «${selectedCat.title}»`
              : "ابتدا دسته‌بندی انتخاب کنید"}
          </p>
        </div>
      )}

      {/* Manual product picker */}
      {sortMode === "manual" && (
        <div className="space-y-3">
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-teal-700 dark:text-teal-300 font-bold">
              محصولات را جستجو و انتخاب کنید — ترتیب نمایش همین ترتیب انتخاب خواهد بود
            </p>
          </div>
          <ProductPicker
            selectedIds={productIds}
            setSelectedIds={setProductIds}
            filterCategoryId={categoryId || undefined}
            accent="teal"
          />
        </div>
      )}

      {/* Summary */}
      {selectedCat && (
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-4">
          <p className="text-xs text-teal-700 dark:text-teal-300 font-bold">
            {sortMode === "manual"
              ? `✋ ${productIds.length} محصول به صورت دستی از دسته «${selectedCat.title}» انتخاب شده`
              : `${sortMode === "best_sellers" ? "🏆 پرفروش‌ترین" : "🆕 جدیدترین"} — ${count} محصول از دسته «${selectedCat.title}» به صورت خودکار نمایش داده می‌شود`}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── ProductsByBrandEditor ────────────────────────────────────────────────────
function ProductsByBrandEditor({
  brands, brandId, onSelect, count, setCount,
  sortMode, setSortMode, productIds, setProductIds,
}: {
  brands: Brand[];
  brandId: string;
  onSelect: (id: string, title: string, slug: string, logoUrl: string | null) => void;
  count: number;
  setCount: (n: number) => void;
  sortMode: SortMode;
  setSortMode: (m: SortMode) => void;
  productIds: string[];
  setProductIds: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = brands.filter(b => b.title.toLowerCase().includes(search.toLowerCase()));
  const selectedBrand = brands.find(b => b.id === brandId);

  return (
    <div className="space-y-6">
      {/* Brand selector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">انتخاب برند</h3>
            <input type="text" placeholder="جستجوی برند..."
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
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

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">برند انتخاب‌شده</h3>
          {selectedBrand ? (
            <div className="flex items-center gap-3">
              {selectedBrand.logoUrl ? (
                <img src={selectedBrand.logoUrl} alt={selectedBrand.title} className="w-16 h-16 rounded-2xl object-contain flex-shrink-0 bg-gray-50 dark:bg-gray-800 p-2 border border-gray-100 dark:border-gray-700" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
              )}
              <div>
                <p className="font-black text-sm text-gray-900 dark:text-white">{selectedBrand.title}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{selectedBrand.slug}</p>
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  ✓ انتخاب شده
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">برندی انتخاب نشده</p>
            </div>
          )}
        </div>
      </div>

      {/* Sort/display mode */}
      <SortModeSelector value={sortMode} onChange={setSortMode} accent="indigo" />

      {/* Count (auto mode only) */}
      {sortMode !== "manual" && (
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
            {selectedBrand
              ? `${count} محصول ${sortMode === "best_sellers" ? "پرفروش" : "جدید"} از برند «${selectedBrand.title}»`
              : "ابتدا برند انتخاب کنید"}
          </p>
        </div>
      )}

      {/* Manual product picker */}
      {sortMode === "manual" && (
        <div className="space-y-3">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">
              محصولات را جستجو و انتخاب کنید — ترتیب نمایش همین ترتیب انتخاب خواهد بود
            </p>
          </div>
          <ProductPicker
            selectedIds={productIds}
            setSelectedIds={setProductIds}
            filterBrandId={brandId || undefined}
            accent="indigo"
          />
        </div>
      )}

      {/* Summary */}
      {selectedBrand && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4">
          <p className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">
            {sortMode === "manual"
              ? `✋ ${productIds.length} محصول به صورت دستی از برند «${selectedBrand.title}» انتخاب شده`
              : `${sortMode === "best_sellers" ? "🏆 پرفروش‌ترین" : "🆕 جدیدترین"} — ${count} محصول از برند «${selectedBrand.title}» به صورت خودکار نمایش داده می‌شود`}
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

// ─── SpecialOffersEditor ──────────────────────────────────────────────────────
function SpecialOffersEditor({
  productIds, setProductIds,
  endsAt, setEndsAt,
  heading, setHeading,
  subheading, setSubheading,
  bgColor, setBgColor,
  accentColor, setAccentColor,
}: {
  productIds: string[]; setProductIds: (ids: string[]) => void;
  endsAt: string; setEndsAt: (v: string) => void;
  heading: string; setHeading: (v: string) => void;
  subheading: string; setSubheading: (v: string) => void;
  bgColor: string; setBgColor: (v: string) => void;
  accentColor: string; setAccentColor: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [loadingSelected, setLoadingSelected] = useState(false);

  useEffect(() => {
    if (productIds.length === 0) { setSelectedProducts([]); return; }
    setLoadingSelected(true);
    fetch(`/api/admin/products-search?ids=${productIds.join(",")}`)
      .then(r => r.json())
      .then((data: Product[]) => {
        const sorted = productIds.map(id => data.find(p => p.id === id)).filter(Boolean) as Product[];
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
    if (productIds.includes(product.id)) {
      setProductIds(productIds.filter(id => id !== product.id));
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
    } else {
      setProductIds([...productIds, product.id]);
      setSelectedProducts(prev => [...prev, product]);
    }
  }
  function moveUp(i: number) {
    if (i === 0) return;
    const a = [...selectedProducts]; [a[i - 1], a[i]] = [a[i], a[i - 1]];
    setSelectedProducts(a); setProductIds(a.map(p => p.id));
  }
  function moveDown(i: number) {
    if (i === selectedProducts.length - 1) return;
    const a = [...selectedProducts]; [a[i], a[i + 1]] = [a[i + 1], a[i]];
    setSelectedProducts(a); setProductIds(a.map(p => p.id));
  }
  function remove(id: string) {
    setProductIds(productIds.filter(x => x !== id));
    setSelectedProducts(prev => prev.filter(p => p.id !== id));
  }
  function toLocal(iso: string) { try { return iso ? new Date(iso).toISOString().slice(0, 16) : ""; } catch { return ""; } }
  function fromLocal(val: string) { return val ? new Date(val).toISOString() : ""; }

  return (
    <div className="space-y-5">

      {/* ── متن و رنگ ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">متن و رنگ‌بندی</h3>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان</label>
          <input type="text" placeholder="تخفیف‌های شگفت‌انگیز" value={heading}
            onChange={e => setHeading(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">زیرعنوان</label>
          <input type="text" placeholder="پیشنهادهای ویژه، فقط تا پایان امروز" value={subheading}
            onChange={e => setSubheading(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <ColorField label="رنگ پس‌زمینه" value={bgColor} onChange={setBgColor} />
          <ColorField label="رنگ تاکیدی" value={accentColor} onChange={setAccentColor} />
        </div>
        {/* mini preview */}
        <div className="rounded-2xl overflow-hidden mt-1" style={{ background: bgColor }}>
          <div className="px-5 py-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: accentColor, boxShadow: `0 8px 24px ${accentColor}55` }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M13 2 4.5 13.5h6L9 22l9.5-12.5h-6L13 2Z" fill="#fff" />
              </svg>
            </div>
            <div>
              <p className="font-black text-white text-[15px]">{heading || "عنوان ویجت"}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{subheading || "زیرعنوان"}</p>
            </div>
          </div>
          <div className="flex gap-2 px-5 pb-4 overflow-hidden">
            {[1,2,3].map(i => (
              <div key={i} className="flex-shrink-0 w-[140px] bg-white rounded-2xl overflow-hidden opacity-90">
                <div className="h-28 bg-gray-100 flex items-center justify-center text-gray-300 text-3xl">📦</div>
                <div className="p-2.5">
                  <div className="h-2 bg-gray-200 rounded mb-2 w-4/5" />
                  <div className="flex justify-between items-center">
                    <div className="h-3 bg-gray-900 rounded w-2/3 font-black" />
                    <div className="w-7 h-7 rounded-lg" style={{ background: accentColor }} />
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full w-2/5 rounded-full" style={{ background: accentColor }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── زمان پایان ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">زمان پایان پیشنهاد</h3>
        <div className="flex items-center gap-4">
          <input type="datetime-local"
            className="border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white flex-1 max-w-xs"
            value={toLocal(endsAt)} onChange={e => setEndsAt(fromLocal(e.target.value))} />
          {endsAt && (
            <button onClick={() => setEndsAt("")}
              className="text-xs text-red-500 hover:text-red-700 font-bold px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
              پاک کردن
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">اگر تعیین نشود، تایمر ۸ ساعته از لحظه بارگذاری صفحه خواهد بود</p>
      </div>

      {/* ── انتخاب محصولات ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">جستجوی محصول</h3>
            <div className="relative">
              <input type="text" placeholder="نام محصول را تایپ کنید..."
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white pr-8"
                value={search} onChange={e => setSearch(e.target.value)} />
              {searching && <div className="absolute left-3 top-2.5 w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />}
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
                  const sel = productIds.includes(product.id);
                  const disc = discountPercent(product.price, product.salePrice);
                  return (
                    <li key={product.id}>
                      <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${sel ? "bg-rose-50 dark:bg-rose-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                        {product.image ? <img src={product.image} alt={product.title} className="w-12 h-12 rounded-xl object-contain flex-shrink-0 bg-gray-50" /> : <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{product.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {disc && <span className="text-[10px] font-black text-white bg-rose-500 px-1.5 py-0.5 rounded-lg">{disc}٪</span>}
                            <span className="text-[11px] text-gray-500">{formatPrice(product.salePrice ?? product.price)} تومان</span>
                          </div>
                        </div>
                        <div className="relative flex-shrink-0">
                          <input type="checkbox"
                            className="peer appearance-none w-5 h-5 rounded-lg border-2 border-gray-300 dark:border-gray-600 checked:bg-rose-500 checked:border-rose-500 transition-all cursor-pointer"
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
              <span className="mr-2 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">{productIds.length} محصول</span>
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
                const disc = discountPercent(product.price, product.salePrice);
                return (
                  <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 h-6 rounded-lg bg-rose-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    {product.image ? <img src={product.image} alt={product.title} className="w-10 h-10 rounded-xl object-contain flex-shrink-0 bg-gray-50" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{product.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {disc && <span className="text-[10px] font-black text-white bg-rose-500 px-1.5 py-0.5 rounded">{disc}٪</span>}
                        <span className="text-[11px] text-gray-500">{formatPrice(product.salePrice ?? product.price)} تومان</span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => moveUp(i)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-rose-100 dark:hover:bg-rose-900/30 disabled:opacity-30 flex items-center justify-center text-gray-500 transition-all text-xs">↑</button>
                      <button onClick={() => moveDown(i)} disabled={i === selectedProducts.length - 1} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-rose-100 dark:hover:bg-rose-900/30 disabled:opacity-30 flex items-center justify-center text-gray-500 transition-all text-xs">↓</button>
                      <button onClick={() => remove(product.id)} className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all text-xs">×</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {productIds.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-4">
          <p className="text-xs text-rose-700 dark:text-rose-300 font-bold">
            {productIds.length} محصول در اسلایدر شگفت‌انگیز نمایش داده می‌شود
            {endsAt ? ` — پیشنهاد تا ${new Date(endsAt).toLocaleString("fa-IR")} ادامه دارد` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── ImageContentDoubleEditor ─────────────────────────────────────────────────
function ImageContentDoubleEditor({
  imageUrl, setImageUrl, imageAlt, setImageAlt,
  bgColor, setBgColor, accentColor, setAccentColor,
  boxes, setBoxes, uploading, setUploading,
}: {
  imageUrl: string; setImageUrl: (v: string) => void;
  imageAlt: string; setImageAlt: (v: string) => void;
  bgColor: string; setBgColor: (v: string) => void;
  accentColor: string; setAccentColor: (v: string) => void;
  boxes: [ICDBox, ICDBox]; setBoxes: (b: [ICDBox, ICDBox]) => void;
  uploading: boolean; setUploading: (v: boolean) => void;
}) {
  function setBox(i: 0 | 1, key: keyof ICDBox, val: string) {
    const next: [ICDBox, ICDBox] = [{ ...boxes[0] }, { ...boxes[1] }];
    next[i] = { ...next[i], [key]: val };
    setBoxes(next);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    setImageUrl(data.url);
    setUploading(false);
  }

  const fa = (n: number) => String(n).replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);

  return (
    <div className="space-y-5">

      {/* ── تصویر اصلی ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-black text-sm text-gray-900 dark:text-white">تصویر اصلی (تمام‌عرض)</h3>
          <p className="text-xs text-gray-400 mt-0.5">توصیه: عرض حداقل ۱۴۰۰ پیکسل، نسبت ۱۶:۵ یا ۱۶:۷</p>
        </div>
        <div className="p-4">
          {imageUrl ? (
            <div className="relative rounded-2xl overflow-hidden">
              <img src={imageUrl} alt="" className="w-full h-48 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              <button onClick={() => setImageUrl("")}
                className="absolute top-2 left-2 w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all text-sm">×</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              {uploading ? (
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
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
            </label>
          )}
          {imageUrl && (
            <input type="text" placeholder="متن جایگزین (alt)" value={imageAlt}
              onChange={e => setImageAlt(e.target.value)}
              className="mt-3 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white" />
          )}
        </div>
      </div>

      {/* ── دو باکس محتوا ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {([0, 1] as const).map(i => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                style={{ background: accentColor }}>
                {fa(i + 1)}
              </div>
              <h3 className="font-black text-sm text-gray-900 dark:text-white">باکس {i === 0 ? "اول" : "دوم"}</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">برچسب (اختیاری)</label>
                <input type="text" placeholder="مثال: مزیت ما" value={boxes[i].badge}
                  onChange={e => setBox(i, "badge", e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">عنوان</label>
                <input type="text" placeholder="عنوان باکس" value={boxes[i].heading}
                  onChange={e => setBox(i, "heading", e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">متن</label>
                <textarea rows={3} placeholder="توضیحات..." value={boxes[i].content}
                  onChange={e => setBox(i, "content", e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">متن دکمه</label>
                  <input type="text" placeholder="بیشتر بدانید" value={boxes[i].btnText}
                    onChange={e => setBox(i, "btnText", e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">لینک</label>
                  <input type="text" placeholder="/..." value={boxes[i].btnUrl}
                    onChange={e => setBox(i, "btnUrl", e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── رنگ‌بندی ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">رنگ‌بندی</h3>
        <ColorField label="رنگ پس‌زمینه" value={bgColor} onChange={setBgColor} />
        <ColorField label="رنگ تاکیدی" value={accentColor} onChange={setAccentColor} />
      </div>

      {/* ── پیش‌نمایش ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-black text-sm text-gray-900 dark:text-white">پیش‌نمایش</h3>
        </div>
        <div className="p-4" style={{ background: bgColor }}>
          {/* image */}
          <div className="relative rounded-2xl overflow-hidden mb-[-32px]" style={{ height: 120 }}>
            {imageUrl
              ? <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-4xl" style={{ background: `${accentColor}15` }}>🖼</div>
            }
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
          {/* boxes */}
          <div className="relative z-10 grid grid-cols-2 gap-3 px-3">
            {([0, 1] as const).map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-3 relative overflow-hidden"
                style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
                  style={{ background: accentColor }} />
                <div className="absolute top-2.5 left-2.5 w-5 h-5 rounded-lg flex items-center justify-center text-white text-[9px] font-black"
                  style={{ background: accentColor }}>
                  {fa(i + 1)}
                </div>
                <div className="pt-1">
                  {boxes[i].badge && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full block w-fit mb-1"
                      style={{ background: `${accentColor}15`, color: accentColor }}>
                      {boxes[i].badge}
                    </span>
                  )}
                  {boxes[i].heading && (
                    <p className="text-[11px] font-black text-gray-900 dark:text-white leading-tight">
                      {boxes[i].heading}
                    </p>
                  )}
                  {boxes[i].content && (
                    <p className="text-[9px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      {boxes[i].content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── ImageContentEditor ───────────────────────────────────────────────────────
interface ICConfig {
  imageUrl: string; imageAlt: string;
  heading: string; content: string; badge: string;
  btnText: string; btnUrl: string;
  imagePosition: "right" | "left";
  bgColor: string; accentColor: string;
}

function ImageContentEditor({
  config, setConfig, uploading, setUploading,
}: {
  config: ICConfig;
  setConfig: (c: ICConfig) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const set = <K extends keyof ICConfig>(key: K, value: ICConfig[K]) =>
    setConfig({ ...config, [key]: value });

  async function uploadImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    set("imageUrl", data.url);
    setUploading(false);
  }

  return (
    <div className="space-y-5">

      {/* ── تصویر ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-black text-sm text-gray-900 dark:text-white">تصویر</h3>
          <p className="text-xs text-gray-400 mt-0.5">توصیه: تصویر مربعی یا ۴:۳ — حداقل ۸۰۰ پیکسل عرض</p>
        </div>
        <div className="p-4">
          {config.imageUrl ? (
            <div className="relative rounded-2xl overflow-hidden">
              <img src={config.imageUrl} alt="" className="w-full h-52 object-cover" />
              <button
                onClick={() => set("imageUrl", "")}
                className="absolute top-2 left-2 w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all text-sm"
              >×</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              {uploading ? (
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
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
            </label>
          )}
          {config.imageUrl && (
            <input
              type="text" placeholder="متن جایگزین (alt) برای سئو" value={config.imageAlt}
              onChange={e => set("imageAlt", e.target.value)}
              className="mt-3 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
            />
          )}
        </div>
      </div>

      {/* ── محتوا ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">محتوا</h3>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">برچسب کوچک (اختیاری)</label>
          <input type="text" placeholder="مثال: درباره ما" value={config.badge}
            onChange={e => set("badge", e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان اصلی *</label>
          <input type="text" placeholder="عنوان جذاب بنویسید" value={config.heading}
            onChange={e => set("heading", e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">متن اصلی</label>
          <textarea rows={4} placeholder="توضیحات کامل را اینجا بنویسید..." value={config.content}
            onChange={e => set("content", e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white resize-none leading-relaxed" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">متن دکمه (اختیاری)</label>
            <input type="text" placeholder="بیشتر بدانید" value={config.btnText}
              onChange={e => set("btnText", e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">لینک دکمه</label>
            <input type="text" placeholder="/about یا https://..." value={config.btnUrl}
              onChange={e => set("btnUrl", e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
          </div>
        </div>
      </div>

      {/* ── چیدمان ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-black text-sm text-gray-900 dark:text-white mb-4">جایگاه تصویر (دسکتاپ)</h3>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: "right", label: "تصویر سمت راست", desc: "محتوا چپ، تصویر راست" },
            { value: "left",  label: "تصویر سمت چپ",   desc: "تصویر چپ، محتوا راست" },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => set("imagePosition", opt.value)}
              className={`p-4 rounded-2xl border-2 text-right transition-all ${
                config.imagePosition === opt.value
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {/* mini layout preview */}
              <div className="flex gap-1.5 mb-3" dir={opt.value === "right" ? "rtl" : "ltr"}>
                <div className="flex-1 h-6 rounded bg-indigo-200 dark:bg-indigo-800" />
                <div className="flex-1 h-6 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
              <p className={`text-xs font-black ${config.imagePosition === opt.value ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300"}`}>
                {opt.label}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-3">در موبایل: تصویر همیشه بالا، محتوا پایین نمایش داده می‌شود</p>
      </div>

      {/* ── رنگ‌بندی ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">رنگ‌بندی</h3>
        <ColorField label="رنگ پس‌زمینه" value={config.bgColor} onChange={v => set("bgColor", v)} />
        <ColorField label="رنگ تاکیدی" value={config.accentColor} onChange={v => set("accentColor", v)} />
      </div>

      {/* ── پیش‌نمایش ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-black text-sm text-gray-900 dark:text-white">پیش‌نمایش</h3>
        </div>
        <div className="p-4" style={{ background: config.bgColor }}>
          <div className="grid grid-cols-2 gap-3" style={{ direction: config.imagePosition === "right" ? "rtl" : "ltr" }}>
            {/* image box preview */}
            <div className="rounded-2xl overflow-hidden h-40 relative" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
              {config.imageUrl
                ? <img src={config.imageUrl} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl" style={{ background: `${config.accentColor}15` }}>🖼</div>
              }
            </div>
            {/* content box preview */}
            <div className="rounded-2xl p-4 bg-white dark:bg-gray-800 h-40 flex flex-col justify-center relative overflow-hidden" dir="rtl">
              <div className="absolute top-0 right-0 w-16 h-16 rounded-full -translate-y-8 translate-x-8" style={{ background: `${config.accentColor}12` }} />
              <div className="absolute right-0 top-4 bottom-4 w-0.5 rounded-full" style={{ background: `${config.accentColor}60` }} />
              {config.badge && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full mb-1.5 inline-block" style={{ background: `${config.accentColor}15`, color: config.accentColor }}>
                  {config.badge}
                </span>
              )}
              {config.heading && (
                <p className="text-sm font-black text-gray-900 dark:text-white line-clamp-2 leading-snug">{config.heading}</p>
              )}
              <div className="flex gap-1 mt-1.5">
                <div className="h-0.5 w-6 rounded-full" style={{ background: config.accentColor }} />
                <div className="h-0.5 w-3 rounded-full" style={{ background: `${config.accentColor}50` }} />
              </div>
              {config.content && (
                <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{config.content}</p>
              )}
              {config.btnText && (
                <span className="mt-2 inline-block text-[10px] font-black px-3 py-1 rounded-lg text-white" style={{ background: config.accentColor }}>
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

  // state SPECIAL_OFFERS
  const [soIds, setSoIds] = useState<string[]>([]);
  const [soEndsAt, setSoEndsAt] = useState("");
  const [soHeading, setSoHeading] = useState("تخفیف‌های شگفت‌انگیز");
  const [soSubheading, setSoSubheading] = useState("پیشنهادهای ویژه، فقط تا پایان امروز");
  const [soBgColor, setSoBgColor] = useState("#0e0f12");
  const [soAccentColor, setSoAccentColor] = useState("#ff3b4e");

  // state PRODUCTS_BY_CATEGORY
  const [pbcCategoryId, setPbcCategoryId] = useState("");
  const [pbcCategoryTitle, setPbcCategoryTitle] = useState("");
  const [pbcCategorySlug, setPbcCategorySlug] = useState("");
  const [pbcCount, setPbcCount] = useState(8);
  const [pbcSortMode, setPbcSortMode] = useState<SortMode>("newest");
  const [pbcProductIds, setPbcProductIds] = useState<string[]>([]);

  // state PRODUCTS_BY_BRAND
  const [pbbBrandId, setPbbBrandId] = useState("");
  const [pbbBrandTitle, setPbbBrandTitle] = useState("");
  const [pbbBrandSlug, setPbbBrandSlug] = useState("");
  const [pbbBrandLogo, setPbbBrandLogo] = useState<string | null>(null);
  const [pbbCount, setPbbCount] = useState(8);
  const [pbbSortMode, setPbbSortMode] = useState<SortMode>("newest");
  const [pbbProductIds, setPbbProductIds] = useState<string[]>([]);

   // FULL_BANNER
  const [fbImageUrl, setFbImageUrl] = useState("");
  const [fbLinkUrl, setFbLinkUrl] = useState("");
  const [fbAlt, setFbAlt] = useState("");
  const [fbUploading, setFbUploading] = useState(false);

  // LAST_VISITED
  const [lvHeading, setLvHeading] = useState("آخرین بازدیدهای شما");
  const [lvAccentColor, setLvAccentColor] = useState("#4f46e5");

  // IMAGE_CONTENT_DOUBLE
  const [icdImageUrl, setIcdImageUrl] = useState("");
  const [icdImageAlt, setIcdImageAlt] = useState("");
  const [icdBgColor, setIcdBgColor] = useState("#f8fafc");
  const [icdAccentColor, setIcdAccentColor] = useState("#4f46e5");
  const [icdBoxes, setIcdBoxes] = useState<[ICDBox, ICDBox]>([{ ...EMPTY_ICD_BOX }, { ...EMPTY_ICD_BOX }]);
  const [icdUploading, setIcdUploading] = useState(false);

  // IMAGE_CONTENT
  const [icConfig, setIcConfig] = useState<ICConfig>({
    imageUrl: "", imageAlt: "", heading: "", content: "", badge: "",
    btnText: "", btnUrl: "", imagePosition: "right",
    bgColor: "#f8fafc", accentColor: "#4f46e5",
  });
  const [icUploading, setIcUploading] = useState(false);

  // ADVANCED_SEARCH
  const [asHeading, setAsHeading] = useState("جستجوی پیشرفته");
  const [asSubheading, setAsSubheading] = useState("محصول مورد نظر خود را سریع‌تر پیدا کنید");
  const [asAccentColor, setAsAccentColor] = useState("#4f46e5");
  const [asCategoryIds, setAsCategoryIds] = useState<string[]>([]);

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

  const SUPPORTED = ["CATEGORIES", "NEWEST_PRODUCTS", "AMAZING_DEALS", "SPECIAL_OFFERS", "PRODUCTS_BY_CATEGORY", "PRODUCTS_BY_BRAND", "FULL_BANNER", "DOUBLE_BANNER", "IMAGE_CONTENT", "IMAGE_CONTENT_DOUBLE", "LAST_VISITED", "HERO_SLIDER", "STORY", "LATEST_ARTICLES", "CALL_TO_ACTION", "ADVANCED_SEARCH"];
  useEffect(() => {
    fetch("/api/admin/widgets")
      .then(r => r.json())
      .then((widgets: Widget[]) => {
        const w = widgets.find(x => x.id === id);
        if (!w) return;
        setWidget(w);
        if (w.type === "SPECIAL_OFFERS") {
          setSoIds(w.config.productIds ?? []);
          setSoEndsAt(w.config.endsAt ?? "");
          setSoHeading(w.config.heading ?? "تخفیف‌های شگفت‌انگیز");
          setSoSubheading(w.config.subheading ?? "پیشنهادهای ویژه، فقط تا پایان امروز");
          setSoBgColor(w.config.bgColor ?? "#0e0f12");
          setSoAccentColor(w.config.accentColor ?? "#ff3b4e");
        } else if (w.type === "AMAZING_DEALS") {
          setAmazingIds(w.config.productIds ?? []);
          setEndsAt(w.config.endsAt ?? "");
        } else if (w.type === "PRODUCTS_BY_CATEGORY") {
          setPbcCategoryId(w.config.categoryId ?? "");
          setPbcCategoryTitle(w.config.categoryTitle ?? "");
          setPbcCategorySlug(w.config.categorySlug ?? "");
          setPbcCount(w.config.count ?? 8);
          setPbcSortMode((w.config.sortMode as SortMode) ?? "newest");
          setPbcProductIds(w.config.productIds ?? []);
        } else if (w.type === "PRODUCTS_BY_BRAND") {
          setPbbBrandId(w.config.brandId ?? "");
          setPbbBrandTitle(w.config.brandTitle ?? "");
          setPbbBrandSlug(w.config.brandSlug ?? "");
          setPbbBrandLogo(w.config.brandLogoUrl ?? null);
          setPbbCount(w.config.count ?? 8);
          setPbbSortMode((w.config.sortMode as SortMode) ?? "newest");
          setPbbProductIds(w.config.productIds ?? []);
        } else if (w.type === "LAST_VISITED") {
          setLvHeading(w.config.heading ?? "آخرین بازدیدهای شما");
          setLvAccentColor(w.config.accentColor ?? "#4f46e5");
        } else if (w.type === "IMAGE_CONTENT_DOUBLE") {
          setIcdImageUrl(w.config.imageUrl ?? "");
          setIcdImageAlt(w.config.imageAlt ?? "");
          setIcdBgColor(w.config.bgColor ?? "#f8fafc");
          setIcdAccentColor(w.config.accentColor ?? "#4f46e5");
          const b = w.config.boxes ?? [];
          setIcdBoxes([
            { badge: b[0]?.badge ?? "", heading: b[0]?.heading ?? "", content: b[0]?.content ?? "", btnText: b[0]?.btnText ?? "", btnUrl: b[0]?.btnUrl ?? "" },
            { badge: b[1]?.badge ?? "", heading: b[1]?.heading ?? "", content: b[1]?.content ?? "", btnText: b[1]?.btnText ?? "", btnUrl: b[1]?.btnUrl ?? "" },
          ]);
        } else if (w.type === "IMAGE_CONTENT") {
          setIcConfig({
            imageUrl:      w.config.imageUrl      ?? "",
            imageAlt:      w.config.imageAlt      ?? "",
            heading:       w.config.heading       ?? "",
            content:       w.config.content       ?? "",
            badge:         w.config.badge         ?? "",
            btnText:       w.config.btnText       ?? "",
            btnUrl:        w.config.btnUrl        ?? "",
            imagePosition: w.config.imagePosition ?? "right",
            bgColor:       w.config.bgColor       ?? "#f8fafc",
            accentColor:   w.config.accentColor   ?? "#4f46e5",
          });
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
        } else if (w.type === "ADVANCED_SEARCH") {
          setAsHeading(w.config.heading ?? "جستجوی پیشرفته");
          setAsSubheading(w.config.subheading ?? "محصول مورد نظر خود را سریع‌تر پیدا کنید");
          setAsAccentColor(w.config.accentColor ?? "#4f46e5");
          setAsCategoryIds(w.config.categoryIds ?? []);
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
    if (widget.type === "ADVANCED_SEARCH") {
      config = { heading: asHeading, subheading: asSubheading, accentColor: asAccentColor, categoryIds: asCategoryIds };
    } else if (widget.type === "LAST_VISITED") {
      config = { heading: lvHeading, accentColor: lvAccentColor };
    } else if (widget.type === "IMAGE_CONTENT_DOUBLE") {
      config = { imageUrl: icdImageUrl, imageAlt: icdImageAlt, bgColor: icdBgColor, accentColor: icdAccentColor, boxes: icdBoxes };
    } else if (widget.type === "IMAGE_CONTENT") {
      config = { ...icConfig };
    } else if (widget.type === "CALL_TO_ACTION") {
      config = { ...ctaConfig };
    } else if (widget.type === "SPECIAL_OFFERS") {
      config = { productIds: soIds, endsAt: soEndsAt || null, heading: soHeading, subheading: soSubheading, bgColor: soBgColor, accentColor: soAccentColor };
    } else if (widget.type === "AMAZING_DEALS") {
      config = { productIds: amazingIds, endsAt: endsAt || null };
    } else if (widget.type === "NEWEST_PRODUCTS") {
      config = { categoryIds: selectedIds, perCategory };
    } else if (widget.type === "PRODUCTS_BY_CATEGORY") {
      config = {
        categoryId: pbcCategoryId, categoryTitle: pbcCategoryTitle,
        categorySlug: pbcCategorySlug, count: pbcCount,
        sortMode: pbcSortMode,
        productIds: pbcSortMode === "manual" ? pbcProductIds : [],
      };
    } else if (widget.type === "PRODUCTS_BY_BRAND") {
      config = {
        brandId: pbbBrandId, brandTitle: pbbBrandTitle,
        brandSlug: pbbBrandSlug, brandLogoUrl: pbbBrandLogo, count: pbbCount,
        sortMode: pbbSortMode,
        productIds: pbbSortMode === "manual" ? pbbProductIds : [],
      };
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
    SPECIAL_OFFERS:       "محصولات اسلایدر پیشنهاد شگفت‌انگیز را با عنوان، تایمر و رنگ‌بندی تنظیم کنید",
    AMAZING_DEALS:        "محصولاتی که با تخفیف ویژه در بخش شگفت‌انگیز نمایش داده می‌شوند را انتخاب کنید",
    PRODUCTS_BY_CATEGORY: "یک دسته‌بندی انتخاب کنید تا محصولاتش در اسلایدر نمایش داده شود",
    PRODUCTS_BY_BRAND:    "یک برند انتخاب کنید تا محصولاتش در اسلایدر نمایش داده شود",
    CATEGORIES:           "دسته‌بندی‌هایی که می‌خواهید در این ویجت نمایش داده شوند را انتخاب کنید",
    NEWEST_PRODUCTS:      "دسته‌بندی‌هایی که می‌خواهید جدیدترین محصولاتشان نمایش داده شود را انتخاب کنید",
    IMAGE_CONTENT:        "یک تصویر و یک محتوا کنار هم با چیدمان و رنگ‌بندی قابل تنظیم",
    IMAGE_CONTENT_DOUBLE: "تصویر تمام‌عرض بالا و دو باکس محتوا با افکت شناور",
    LAST_VISITED:         "آخرین محصولات بازدیدشده توسط کاربر — داده‌ها از مرورگر کاربر خوانده می‌شود",
    ADVANCED_SEARCH:      "جستجوی پیشرفته با فیلتر دسته‌بندی، زیردسته، برند و ویژگی‌های فنی — نتایج همانجا نمایش داده می‌شود",
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

      {widget.type === "SPECIAL_OFFERS" && (
        <SpecialOffersEditor
          productIds={soIds} setProductIds={setSoIds}
          endsAt={soEndsAt} setEndsAt={setSoEndsAt}
          heading={soHeading} setHeading={setSoHeading}
          subheading={soSubheading} setSubheading={setSoSubheading}
          bgColor={soBgColor} setBgColor={setSoBgColor}
          accentColor={soAccentColor} setAccentColor={setSoAccentColor}
        />
      )}

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
          sortMode={pbcSortMode}
          setSortMode={setPbcSortMode}
          productIds={pbcProductIds}
          setProductIds={setPbcProductIds}
        />
      )}

      {widget.type === "PRODUCTS_BY_BRAND" && (
        <ProductsByBrandEditor
          brands={brands}
          brandId={pbbBrandId}
          onSelect={(id, title, slug, logo) => { setPbbBrandId(id); setPbbBrandTitle(title); setPbbBrandSlug(slug); setPbbBrandLogo(logo); }}
          count={pbbCount}
          setCount={setPbbCount}
          sortMode={pbbSortMode}
          setSortMode={setPbbSortMode}
          productIds={pbbProductIds}
          setProductIds={setPbbProductIds}
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

      {widget.type === "IMAGE_CONTENT_DOUBLE" && (
        <ImageContentDoubleEditor
          imageUrl={icdImageUrl} setImageUrl={setIcdImageUrl}
          imageAlt={icdImageAlt} setImageAlt={setIcdImageAlt}
          bgColor={icdBgColor} setBgColor={setIcdBgColor}
          accentColor={icdAccentColor} setAccentColor={setIcdAccentColor}
          boxes={icdBoxes} setBoxes={setIcdBoxes}
          uploading={icdUploading} setUploading={setIcdUploading}
        />
      )}

      {widget.type === "IMAGE_CONTENT" && (
        <ImageContentEditor config={icConfig} setConfig={setIcConfig} uploading={icUploading} setUploading={setIcUploading} />
      )}

      {widget.type === "CALL_TO_ACTION" && (
        <CallToActionEditor config={ctaConfig} setConfig={setCtaConfig} />
      )}

      {widget.type === "LAST_VISITED" && (
        <div className="space-y-5">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-black text-sm text-blue-800 dark:text-blue-200 mb-1">نیازی به تنظیم دستی نیست</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                  این ویجت به‌صورت خودکار آخرین محصولاتی که کاربر بازدید کرده را از مرورگر او می‌خواند.
                  برای کاربرانی که هنوز بازدیدی نداشتند، ویجت نمایش داده نمی‌شود.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <h3 className="font-black text-sm text-gray-900 dark:text-white">تنظیمات اختیاری</h3>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان ویجت</label>
              <input type="text" placeholder="آخرین بازدیدهای شما"
                value={lvHeading} onChange={e => setLvHeading(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
            </div>
            <ColorField label="رنگ تاکیدی" value={lvAccentColor} onChange={setLvAccentColor} />
          </div>
        </div>
      )}

      {widget.type === "ADVANCED_SEARCH" && (
        <div className="space-y-5">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                  <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="font-black text-sm text-indigo-800 dark:text-indigo-200 mb-1">جستجوی پیشرفته با فیلترهای هوشمند</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 leading-relaxed">
                  کاربر دسته‌بندی، زیردسته، برند و ویژگی‌های فنی را انتخاب می‌کند و نتایج همانجا نمایش داده می‌شود.
                  دکمه «مشاهده همه» او را به صفحه محصولات با همان فیلترها هدایت می‌کند.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <h3 className="font-black text-sm text-gray-900 dark:text-white">تنظیمات</h3>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان ویجت</label>
              <input type="text" placeholder="جستجوی پیشرفته"
                value={asHeading} onChange={e => setAsHeading(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">زیرعنوان</label>
              <input type="text" placeholder="محصول مورد نظر خود را سریع‌تر پیدا کنید"
                value={asSubheading} onChange={e => setAsSubheading(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white" />
            </div>
            <ColorField label="رنگ تاکیدی" value={asAccentColor} onChange={setAsAccentColor} />
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-black text-sm text-gray-900 dark:text-white">دسته‌بندی‌های ریشه</h3>
                <p className="text-xs text-gray-400 mt-0.5">خالی = همه دسته‌های اصلی نمایش داده می‌شوند</p>
              </div>
              {asCategoryIds.length > 0 && (
                <button onClick={() => setAsCategoryIds([])} className="text-xs text-red-500 hover:text-red-700">پاک کردن</button>
              )}
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {categories.filter(c => !c.parentId).map(cat => {
                const sel = asCategoryIds.includes(cat.id);
                return (
                  <label key={cat.id} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => setAsCategoryIds(sel ? asCategoryIds.filter(x => x !== cat.id) : [...asCategoryIds, cat.id])}
                      className="rounded"
                      style={{ accentColor: asAccentColor }}
                    />
                    {cat.imageUrl && <img src={cat.imageUrl} alt={cat.title} className="w-7 h-7 object-cover rounded-lg" />}
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{cat.title}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
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
