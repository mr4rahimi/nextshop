"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  SPACER_DEFAULT, SPACER_MIN, SPACER_MAX,
  normalizeSpacerConfig, type SpacerConfig,
} from "@/components/store/SpacerSection";
import {
  SHOWCASE_DEFAULT, AUTOPLAY_MIN, AUTOPLAY_MAX,
  normalizeShowcaseConfig, type ProductShowcaseConfig,
} from "@/components/store/ProductShowcaseSection";

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

// ─── UniqueStarHeroEditor ─────────────────────────────────────────────────────
interface USHLink {
  text: string;
  url: string;
  tone: "primary" | "secondary" | "accent";
}

interface USHConfig {
  brandLabel: string;
  heading: string;
  subheading: string;
  description: string;
  btnText: string;
  btnUrl: string;
  hangingLinks: USHLink[];
  bgFrom: string;
  bgMid: string;
  bgTo: string;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorText: string;
  colorMuted: string;
  showParticles: boolean;
  showMoon: boolean;
  showMeteors: boolean;
  showClock: boolean;
  showHangingLinks: boolean;
  height: "full" | "large" | "medium";
  headerOverlay: boolean;
}

const USH_DEFAULT: USHConfig = {
  brandLabel: "Unique Star",
  heading: "یونیک استار",
  subheading: "انواع تابلو و لگوهای خاص",
  description: "تابلو دکوراتیو، ساعت لگویی و طرح‌های اختصاصی با سلیقه‌ی تو",
  btnText: "مشاهده محصولات",
  btnUrl: "/products",
  hangingLinks: [
    { text: "درباره ما", url: "#", tone: "primary" },
    { text: "پیج اینستاگرام", url: "#", tone: "secondary" },
    { text: "ارتباط با ما", url: "#", tone: "secondary" },
    { text: "تخفیف‌ها ✦", url: "#", tone: "accent" },
  ],
  bgFrom: "#2a1650",
  bgMid: "#17102e",
  bgTo: "#0e0a1a",
  colorPrimary: "#ff5fb0",
  colorSecondary: "#8b5cf6",
  colorAccent: "#ff8ac6",
  colorText: "#e6dcff",
  colorMuted: "#9d8ec4",
  showParticles: true,
  showMoon: true,
  showMeteors: true,
  showClock: true,
  showHangingLinks: true,
  height: "full",
  headerOverlay: true,
};

const USH_TONES: { value: USHLink["tone"]; label: string }[] = [
  { value: "primary", label: "صورتی" },
  { value: "secondary", label: "بنفش" },
  { value: "accent", label: "صورتی روشن" },
];

const USH_HEIGHTS: { value: USHConfig["height"]; label: string }[] = [
  { value: "full", label: "تمام صفحه" },
  { value: "large", label: "بلند" },
  { value: "medium", label: "متوسط" },
];

function USHToggle({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <span className="min-w-0">
        <span className="block text-xs font-black text-gray-800 dark:text-gray-200">{label}</span>
        {hint && <span className="block text-[10px] text-gray-400 mt-0.5">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded flex-shrink-0"
        style={{ accentColor: "#8b5cf6" }}
      />
    </label>
  );
}

function UniqueStarHeroEditor({
  config, setConfig,
}: { config: USHConfig; setConfig: (c: USHConfig) => void }) {
  const set = <K extends keyof USHConfig>(k: K, v: USHConfig[K]) => setConfig({ ...config, [k]: v });

  const setLink = (i: number, patch: Partial<USHLink>) =>
    set("hangingLinks", config.hangingLinks.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLink = () =>
    set("hangingLinks", [...config.hangingLinks, { text: "", url: "#", tone: "primary" }]);

  const removeLink = (i: number) =>
    set("hangingLinks", config.hangingLinks.filter((_, idx) => idx !== i));

  const inputCls =
    "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white";

  return (
    <div className="space-y-5">

      {/* راهنما */}
      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0 text-lg">✦</div>
          <div>
            <p className="font-black text-sm text-violet-800 dark:text-violet-200 mb-1">بنر هرو یونیک استار</p>
            <p className="text-xs text-violet-600 dark:text-violet-400 leading-relaxed">
              این ویجت تمام‌عرض است و برای بالای صفحه اصلی طراحی شده. اگر «هدر شفاف» را در
              تنظیمات صفحه اصلی فعال کرده‌اید، گزینه «فضای هدر شفاف» را روشن بگذارید تا هدر روی بنر بیفتد.
            </p>
          </div>
        </div>
      </div>

      {/* متن‌ها */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">متن‌ها</h3>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">برچسب کوچک بالا</label>
          <input type="text" placeholder="Unique Star" className={inputCls}
            value={config.brandLabel} onChange={e => set("brandLabel", e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان اصلی</label>
          <input type="text" placeholder="یونیک استار" className={inputCls}
            value={config.heading} onChange={e => set("heading", e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">زیرعنوان (نئونی)</label>
          <input type="text" placeholder="انواع تابلو و لگوهای خاص" className={inputCls}
            value={config.subheading} onChange={e => set("subheading", e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">توضیح</label>
          <textarea rows={2} placeholder="تابلو دکوراتیو، ساعت لگویی و ..." className={inputCls}
            value={config.description} onChange={e => set("description", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">متن دکمه</label>
            <input type="text" placeholder="مشاهده محصولات" className={inputCls}
              value={config.btnText} onChange={e => set("btnText", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">لینک دکمه</label>
            <input type="text" placeholder="/products" className={inputCls} dir="ltr"
              value={config.btnUrl} onChange={e => set("btnUrl", e.target.value)} />
          </div>
        </div>
      </div>

      {/* تابلوهای آویزان */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm text-gray-900 dark:text-white">تابلوهای نئون آویزان</h3>
            <p className="text-xs text-gray-400 mt-0.5">حداکثر ۶ مورد — در موبایل ممکن است شلوغ شود</p>
          </div>
          {config.hangingLinks.length < 6 && (
            <button type="button" onClick={addLink}
              className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white/10 text-white text-xs font-black hover:opacity-80 transition-opacity">
              + افزودن
            </button>
          )}
        </div>

        {config.hangingLinks.length === 0 && (
          <p className="text-xs text-gray-400 py-3 text-center">هیچ تابلویی اضافه نشده</p>
        )}

        {config.hangingLinks.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input type="text" placeholder="متن" className={`col-span-4 ${inputCls}`}
              value={l.text} onChange={e => setLink(i, { text: e.target.value })} />
            <input type="text" placeholder="لینک" dir="ltr" className={`col-span-4 ${inputCls}`}
              value={l.url} onChange={e => setLink(i, { url: e.target.value })} />
            <select className={`col-span-3 ${inputCls}`}
              value={l.tone} onChange={e => setLink(i, { tone: e.target.value as USHLink["tone"] })}>
              {USH_TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button type="button" onClick={() => removeLink(i)}
              className="col-span-1 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 text-sm font-black hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
              ×
            </button>
          </div>
        ))}
      </div>

      {/* رنگ‌ها */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">رنگ‌بندی</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ColorField label="پس‌زمینه ۱ (روشن)" value={config.bgFrom} onChange={v => set("bgFrom", v)} />
          <ColorField label="پس‌زمینه ۲ (میانی)" value={config.bgMid} onChange={v => set("bgMid", v)} />
          <ColorField label="پس‌زمینه ۳ (تیره)" value={config.bgTo} onChange={v => set("bgTo", v)} />
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ColorField label="رنگ اصلی" value={config.colorPrimary} onChange={v => set("colorPrimary", v)} />
          <ColorField label="رنگ دوم" value={config.colorSecondary} onChange={v => set("colorSecondary", v)} />
          <ColorField label="رنگ تاکیدی" value={config.colorAccent} onChange={v => set("colorAccent", v)} />
          <ColorField label="رنگ متن" value={config.colorText} onChange={v => set("colorText", v)} />
          <ColorField label="رنگ متن کم‌رنگ" value={config.colorMuted} onChange={v => set("colorMuted", v)} />
        </div>
      </div>

      {/* عناصر و چیدمان */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">عناصر و چیدمان</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <USHToggle label="ذرات و ستاره‌ها" hint="ستاره‌های چشمک‌زن و آجرهای لگویی" value={config.showParticles} onChange={v => set("showParticles", v)} />
          <USHToggle label="ماه" hint="ماه با ستاره‌ی مداری" value={config.showMoon} onChange={v => set("showMoon", v)} />
          <USHToggle label="شهاب‌ها" value={config.showMeteors} onChange={v => set("showMeteors", v)} />
          <USHToggle label="ساعت لگویی" hint="گرافیک سمت چپ" value={config.showClock} onChange={v => set("showClock", v)} />
          <USHToggle label="تابلوهای آویزان" value={config.showHangingLinks} onChange={v => set("showHangingLinks", v)} />
          <USHToggle label="فضای هدر شفاف" hint="فضای خالی بالا برای هدری که روی بنر می‌افتد" value={config.headerOverlay} onChange={v => set("headerOverlay", v)} />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">ارتفاع بنر</label>
          <div className="flex gap-2">
            {USH_HEIGHTS.map(h => (
              <button key={h.value} type="button" onClick={() => set("height", h.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                  config.height === h.value
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}>
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* پیش‌نمایش رنگ */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-black text-sm text-gray-900 dark:text-white mb-3">پیش‌نمایش</h3>
        <div className="relative rounded-2xl overflow-hidden h-44 flex items-center px-6" dir="rtl"
          style={{ background: `radial-gradient(600px 300px at 78% 30%, ${config.bgFrom} 0%, ${config.bgMid} 45%, ${config.bgTo} 100%)` }}>
          <div className="relative z-10">
            {config.brandLabel && (
              <span className="block text-[10px] font-bold mb-1.5" style={{ color: config.colorText, opacity: 0.8 }}>
                {config.brandLabel}
              </span>
            )}
            <span className="block text-2xl font-black mb-1.5"
              style={{
                background: `linear-gradient(90deg, ${config.colorPrimary}, ${config.colorSecondary}, ${config.colorAccent})`,
                WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
              {config.heading || "عنوان"}
            </span>
            {config.subheading && (
              <span className="block text-xs font-bold mb-3" style={{ color: config.colorText }}>
                {config.subheading}
              </span>
            )}
            {config.btnText && (
              <span className="inline-block px-5 py-2 rounded-full text-xs font-black text-white"
                style={{ background: `linear-gradient(90deg, ${config.colorSecondary}, ${config.colorPrimary})` }}>
                {config.btnText}
              </span>
            )}
          </div>
          {config.showClock && (
            <div className="absolute left-6 top-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4"
              style={{ background: "#241a44", borderColor: "#2e2052", boxShadow: `0 0 30px ${config.colorSecondary}55` }} />
          )}
        </div>
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  این بلوک را در app/admin/widgets/[id]/page.tsx
//  بلافاصله بعد از پایان تابع UniqueStarHeroEditor و قبل از خط
//  «// ─── Main Page ───...» بچسبانید.
// ═══════════════════════════════════════════════════════════════════════════

// ─── DimensionalCardsEditor ───────────────────────────────────────────────────
type DCTheme = "mint" | "violet" | "solar" | "ocean" | "prism" | "void";
type DCShape = "rounded" | "chamfer";

interface DCItem {
  title: string;
  text: string;
  imageUrl: string;
  btnText: string;
  btnUrl: string;
  theme: DCTheme;
  shape: DCShape;
}

interface DCConfig {
  heading: string;
  subheading: string;
  cards: DCItem[];
}

const DC_THEMES: { value: DCTheme; label: string; swatch: string }[] = [
  { value: "mint",   label: "سبز نعنایی", swatch: "linear-gradient(135deg,#00ffd6,#08e260)" },
  { value: "violet", label: "بنفش",       swatch: "linear-gradient(145deg,#a855f7,#6366f1 40%,#ec4899)" },
  { value: "solar",  label: "نارنجی",     swatch: "linear-gradient(135deg,#fbbf24,#f97316 45%,#dc2626)" },
  { value: "ocean",  label: "آبی",        swatch: "linear-gradient(155deg,#22d3ee,#0284c7 50%,#1e3a8a)" },
  { value: "prism",  label: "رنگین‌کمان", swatch: "conic-gradient(from 200deg at 65% 35%,#22d3ee,#818cf8,#f472b6,#facc15,#22d3ee)" },
  { value: "void",   label: "تیره",       swatch: "linear-gradient(160deg,#0f172a,#1e1b4b 50%,#312e81)" },
];

const DC_SHAPES: { value: DCShape; label: string }[] = [
  { value: "rounded", label: "گوشه گرد" },
  { value: "chamfer", label: "گوشه پخ" },
];

const DC_DEFAULT: DCConfig = {
  heading: "چرا ما را انتخاب کنید؟",
  subheading: "سه دلیل که کار با ما را متفاوت می‌کند",
  cards: [
    { title: "کیفیت شیشه‌ای", text: "بدنه‌ی نرم با لایه‌های شیشه‌ای و عمق حلقوی.", imageUrl: "", btnText: "مشاهده محصولات", btnUrl: "/products", theme: "mint",   shape: "rounded" },
    { title: "برش دقیق",     text: "گوشه‌های پخ‌دار — روی زمینه‌ی تیره تیز و شفاف دیده می‌شود.", imageUrl: "", btnText: "مشاهده محصولات", btnUrl: "/products", theme: "violet", shape: "chamfer" },
    { title: "سطح مدرن",     text: "کنتراست بالا، سایه‌ی سخت و ریل رنگی برجسته.", imageUrl: "", btnText: "مشاهده محصولات", btnUrl: "/products", theme: "solar",  shape: "rounded" },
  ],
};

function DimensionalCardsEditor({
  config, setConfig, uploading, setUploading,
}: {
  config: DCConfig;
  setConfig: (c: DCConfig) => void;
  uploading: boolean[];
  setUploading: (fn: (prev: boolean[]) => boolean[]) => void;
}) {
  const inputCls =
    "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500 transition-colors";

  const setCard = (i: number, patch: Partial<DCItem>) =>
    setConfig({ ...config, cards: config.cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });

  async function uploadImage(i: number, file: File) {
    setUploading(prev => prev.map((v, idx) => (idx === i ? true : v)));
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (d?.url) setCard(i, { imageUrl: d.url });
    setUploading(prev => prev.map((v, idx) => (idx === i ? false : v)));
  }

  return (
    <div className="space-y-5">

      {/* راهنما */}
      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0 text-lg">🧊</div>
          <div>
            <p className="font-black text-sm text-teal-800 dark:text-teal-200 mb-1">کارت‌های سه‌بعدی</p>
            <p className="text-xs text-teal-600 dark:text-teal-400 leading-relaxed">
              سه کارت شیشه‌ای که با حرکت ماوس می‌چرخند. تصویر هر کارت داخل کوچک‌ترین دایره
              نمایش داده می‌شود — بهترین نتیجه با <b>PNG بدون پس‌زمینه</b> و ابعاد مربعی (مثلاً ۲۰۰×۲۰۰) به‌دست می‌آید.
            </p>
          </div>
        </div>
      </div>

      {/* سربرگ بخش */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">سربرگ بخش</h3>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان</label>
          <input type="text" className={inputCls} placeholder="چرا ما را انتخاب کنید؟"
            value={config.heading} onChange={e => setConfig({ ...config, heading: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">زیرعنوان</label>
          <input type="text" className={inputCls} placeholder="سه دلیل که کار با ما را متفاوت می‌کند"
            value={config.subheading} onChange={e => setConfig({ ...config, subheading: e.target.value })} />
        </div>
        <p className="text-[11px] text-gray-400">هر دو را خالی بگذارید تا سربرگ اصلاً نمایش داده نشود.</p>
      </div>

      {/* کارت‌ها */}
      {config.cards.map((c, i) => (
        <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg text-[11px] font-black text-white flex items-center justify-center"
              style={{ background: DC_THEMES.find(t => t.value === c.theme)?.swatch }}>
              {i + 1}
            </span>
            <h3 className="font-black text-sm text-gray-900 dark:text-white">کارت {i + 1}</h3>
          </div>

          {/* تصویر */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">تصویر داخل دایره (PNG شفاف)</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 bg-gray-50 dark:bg-gray-800">
                {c.imageUrl
                  ? <img src={c.imageUrl} alt="" className="w-full h-full object-contain" />
                  : <span className="text-[10px] text-gray-400">بدون تصویر</span>}
              </div>

              <label className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white/10 text-white text-xs font-black cursor-pointer hover:opacity-80 transition-opacity">
                {uploading[i] ? "در حال آپلود..." : c.imageUrl ? "تغییر تصویر" : "آپلود تصویر"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(i, f); }} />
              </label>

              {c.imageUrl && (
                <button type="button" onClick={() => setCard(i, { imageUrl: "" })}
                  className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-black hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                  حذف
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان</label>
            <input type="text" className={inputCls} value={c.title}
              onChange={e => setCard(i, { title: e.target.value })} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">توضیحات</label>
            <textarea rows={2} className={inputCls} value={c.text}
              onChange={e => setCard(i, { text: e.target.value })} />
            <p className="text-[11px] text-gray-400 mt-1">حداکثر ۳ خط نمایش داده می‌شود؛ متن بلندتر بریده می‌شود.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">متن دکمه</label>
              <input type="text" className={inputCls} placeholder="مشاهده محصولات" value={c.btnText}
                onChange={e => setCard(i, { btnText: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">لینک دکمه</label>
              <input type="text" dir="ltr" className={inputCls} placeholder="/products" value={c.btnUrl}
                onChange={e => setCard(i, { btnUrl: e.target.value })} />
            </div>
          </div>

          {/* تم */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">رنگ‌بندی</label>
            <div className="flex flex-wrap gap-2">
              {DC_THEMES.map(t => (
                <button key={t.value} type="button" onClick={() => setCard(i, { theme: t.value })}
                  title={t.label}
                  className={`w-11 h-11 rounded-xl border-2 transition-all ${
                    c.theme === t.value
                      ? "border-blue-500 scale-105 shadow-lg"
                      : "border-transparent hover:border-gray-300 dark:hover:border-white/20"
                  }`}
                  style={{ background: t.swatch }}
                />
              ))}
            </div>
          </div>

          {/* شکل */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">شکل گوشه‌ها</label>
            <div className="flex gap-2">
              {DC_SHAPES.map(s => (
                <button key={s.value} type="button" onClick={() => setCard(i, { shape: s.value })}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                    c.shape === s.value
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  این بلوک را در app/admin/widgets/[id]/page.tsx
//  بعد از تابع DimensionalCardsEditor و قبل از «// ─── Main Page ───...»
//  بچسبانید.
// ═══════════════════════════════════════════════════════════════════════════

// ─── CoverflowGalleryEditor ───────────────────────────────────────────────────
interface CFItem {
  imageUrl: string;
  title: string;
  linkUrl: string;
  btnText: string;
  btnUrl: string;
}

interface CFConfig {
  heading: string;
  subheading: string;
  items: CFItem[];
  size: "small" | "medium" | "large";
  showCaption: boolean;
  autoplay: boolean;
  autoplaySeconds: number;
}

const CF_DEFAULT: CFConfig = {
  heading: "",
  subheading: "",
  items: [],
  size: "medium",
  showCaption: true,
  autoplay: false,
  autoplaySeconds: 5,
};

const CF_EMPTY_ITEM: CFItem = { imageUrl: "", title: "", linkUrl: "", btnText: "", btnUrl: "" };

const CF_SIZES: { value: CFConfig["size"]; label: string }[] = [
  { value: "small",  label: "کوچک" },
  { value: "medium", label: "متوسط" },
  { value: "large",  label: "بزرگ" },
];

function CoverflowGalleryEditor({
  config, setConfig, uploadingIdx, setUploadingIdx,
}: {
  config: CFConfig;
  setConfig: (c: CFConfig) => void;
  uploadingIdx: number | null;
  setUploadingIdx: (v: number | null) => void;
}) {
  const inputCls =
    "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-blue-500 transition-colors";

  const setItem = (i: number, patch: Partial<CFItem>) =>
    setConfig({ ...config, items: config.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

  const addItem = () => setConfig({ ...config, items: [...config.items, { ...CF_EMPTY_ITEM }] });

  const removeItem = (i: number) =>
    setConfig({ ...config, items: config.items.filter((_, idx) => idx !== i) });

  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= config.items.length) return;
    const next = [...config.items];
    [next[i], next[j]] = [next[j], next[i]];
    setConfig({ ...config, items: next });
  };

  async function uploadImage(i: number, file: File) {
    setUploadingIdx(i);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data?.url) setItem(i, { imageUrl: data.url });
    setUploadingIdx(null);
  }

  return (
    <div className="space-y-5">

      {/* راهنما */}
      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0 text-lg">🖼️</div>
          <div>
            <p className="font-black text-sm text-sky-800 dark:text-sky-200 mb-1">گالری کاورفلو</p>
            <p className="text-xs text-sky-600 dark:text-sky-400 leading-relaxed">
              تصاویر با افکت سه‌بعدی کنار هم می‌چرخند. بهترین نتیجه با تصاویر <b>مربعی</b> (مثلاً ۸۰۰×۸۰۰).
              عنوان و دکمه‌ی هر تصویر فقط وقتی همان تصویر فعال است زیر گالری نمایش داده می‌شود.
            </p>
          </div>
        </div>
      </div>

      {/* سربرگ بخش */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">سربرگ بخش</h3>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان</label>
          <input type="text" className={inputCls} value={config.heading}
            onChange={e => setConfig({ ...config, heading: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">زیرعنوان</label>
          <input type="text" className={inputCls} value={config.subheading}
            onChange={e => setConfig({ ...config, subheading: e.target.value })} />
        </div>
        <p className="text-[11px] text-gray-400">هر دو را خالی بگذارید تا سربرگ نمایش داده نشود.</p>
      </div>

      {/* تنظیمات نمایش */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white">تنظیمات نمایش</h3>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">اندازه تصاویر</label>
          <div className="flex gap-2">
            {CF_SIZES.map(s => (
              <button key={s.value} type="button" onClick={() => setConfig({ ...config, size: s.value })}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                  config.size === s.value
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <span>
            <span className="block text-xs font-black text-gray-800 dark:text-gray-200">نمایش عنوان و دکمه</span>
            <span className="block text-[10px] text-gray-400 mt-0.5">زیر گالری، مربوط به تصویر فعال</span>
          </span>
          <input type="checkbox" checked={config.showCaption} className="w-4 h-4 rounded flex-shrink-0" style={{ accentColor: "#2563eb" }}
            onChange={e => setConfig({ ...config, showCaption: e.target.checked })} />
        </label>

        <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <span>
            <span className="block text-xs font-black text-gray-800 dark:text-gray-200">چرخش خودکار</span>
            <span className="block text-[10px] text-gray-400 mt-0.5">با قرار گرفتن ماوس روی گالری متوقف می‌شود</span>
          </span>
          <input type="checkbox" checked={config.autoplay} className="w-4 h-4 rounded flex-shrink-0" style={{ accentColor: "#2563eb" }}
            onChange={e => setConfig({ ...config, autoplay: e.target.checked })} />
        </label>

        {config.autoplay && (
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">فاصله بین تصاویر (ثانیه)</label>
            <input type="number" min={2} max={30} className={inputCls} value={config.autoplaySeconds}
              onChange={e => setConfig({ ...config, autoplaySeconds: Math.max(2, Number(e.target.value) || 5) })} />
          </div>
        )}
      </div>

      {/* تصاویر */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm text-gray-900 dark:text-white">تصاویر گالری</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {config.items.length > 0 ? `${config.items.length} تصویر` : "هنوز تصویری اضافه نشده"}
            </p>
          </div>
          <button type="button" onClick={addItem}
            className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white/10 text-white text-xs font-black hover:opacity-80 transition-opacity">
            + افزودن تصویر
          </button>
        </div>

        {config.items.length === 0 && (
          <p className="text-xs text-gray-400 py-6 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
            برای شروع، روی «افزودن تصویر» بزنید
          </p>
        )}

        {config.items.map((it, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-700 dark:text-gray-300">تصویر {i + 1}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-black disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">↑</button>
                <button type="button" onClick={() => moveItem(i, 1)} disabled={i === config.items.length - 1}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-black disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">↓</button>
                <button type="button" onClick={() => removeItem(i)}
                  className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 text-sm font-black hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">×</button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 bg-gray-50 dark:bg-gray-800">
                {it.imageUrl
                  ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[10px] text-gray-400">بدون تصویر</span>}
              </div>
              <label className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-white/10 text-white text-xs font-black cursor-pointer hover:opacity-80 transition-opacity">
                {uploadingIdx === i ? "در حال آپلود..." : it.imageUrl ? "تغییر تصویر" : "آپلود تصویر"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(i, f); }} />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان (اختیاری)</label>
              <input type="text" className={inputCls} value={it.title}
                onChange={e => setItem(i, { title: e.target.value })} />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">لینک تصویر (اختیاری)</label>
              <input type="text" dir="ltr" placeholder="/products/example" className={inputCls} value={it.linkUrl}
                onChange={e => setItem(i, { linkUrl: e.target.value })} />
              <p className="text-[11px] text-gray-400 mt-1">با کلیک روی تصویرِ فعال باز می‌شود.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">متن دکمه (اختیاری)</label>
                <input type="text" placeholder="خرید کنید" className={inputCls} value={it.btnText}
                  onChange={e => setItem(i, { btnText: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">لینک دکمه</label>
                <input type="text" dir="ltr" placeholder="/products" className={inputCls} value={it.btnUrl}
                  onChange={e => setItem(i, { btnUrl: e.target.value })} />
              </div>
            </div>
            <p className="text-[11px] text-gray-400">دکمه فقط وقتی نمایش داده می‌شود که هم متن و هم لینکش پر باشد.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ProductShowcaseEditor ────────────────────────────────────────────────────
function ProductShowcaseEditor({
  config, setConfig, categories, brands,
}: {
  config: ProductShowcaseConfig;
  setConfig: (c: ProductShowcaseConfig) => void;
  categories: Category[];
  brands: Brand[];
}) {
  const isBrand = config.source === "brand";
  const patch = (p: Partial<ProductShowcaseConfig>) => setConfig({ ...config, ...p });

  return (
    <div className="space-y-6">
      {/* منبع محصولات */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-1.5 h-5 bg-emerald-600 rounded-full" />
          محصولات از کجا بیایند؟
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            { id: "category" as const, label: "یک دسته‌بندی", desc: "محصولات یک دسته نمایش داده می‌شوند و «مشاهده همه» به صفحه‌ی همان دسته می‌رود" },
            { id: "brand" as const,    label: "یک برند",      desc: "محصولات یک برند نمایش داده می‌شوند و «مشاهده همه» به صفحه‌ی همان برند می‌رود" },
          ]).map(opt => {
            const active = config.source === opt.id;
            return (
              <button key={opt.id} type="button"
                onClick={() => patch({ source: opt.id })}
                className={`text-right p-4 rounded-2xl border-2 transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                    : "border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20"
                }`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-black text-gray-900 dark:text-white">{opt.label}</span>
                  {active && <span className="text-[10px] font-black text-emerald-600">فعال ✓</span>}
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* انتخابگر دسته یا برند — همان ادیتورهای ویجت‌های قبلی */}
      {isBrand ? (
        <ProductsByBrandEditor
          brands={brands}
          brandId={config.brandId ?? ""}
          onSelect={(id, title, slug) => patch({ brandId: id, brandTitle: title, brandSlug: slug })}
          count={config.count ?? 12}
          setCount={n => patch({ count: n })}
          sortMode={(config.sortMode as SortMode) ?? "newest"}
          setSortMode={m => patch({ sortMode: m })}
          productIds={config.productIds ?? []}
          setProductIds={ids => patch({ productIds: ids })}
        />
      ) : (
        <ProductsByCategoryEditor
          categories={categories}
          categoryId={config.categoryId ?? ""}
          setCategoryId={(id, title, slug) => patch({ categoryId: id, categoryTitle: title, categorySlug: slug })}
          count={config.count ?? 12}
          setCount={n => patch({ count: n })}
          sortMode={(config.sortMode as SortMode) ?? "newest"}
          setSortMode={m => patch({ sortMode: m })}
          productIds={config.productIds ?? []}
          setProductIds={ids => patch({ productIds: ids })}
        />
      )}

      {/* نمایش و رفتار اسلایدر */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-1.5 h-5 bg-emerald-600 rounded-full" />
          نمایش و حرکت اسلایدر
        </h3>

        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">
            عنوان بخش
            <span className="font-bold text-gray-400 mr-2">(خالی بگذارید تا نام {isBrand ? "برند" : "دسته‌بندی"} استفاده شود)</span>
          </label>
          <input
            type="text"
            value={config.heading ?? ""}
            onChange={e => patch({ heading: e.target.value })}
            placeholder={(isBrand ? config.brandTitle : config.categoryTitle) || "محصولات"}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
          />
        </div>

        {([
          { key: "showArrows" as const, label: "نمایش فلش‌های چپ و راست",
            desc: "کنار لینک «مشاهده همه» بالای بخش قرار می‌گیرند. حتی با خاموش بودن فلش‌ها، در موبایل می‌توان اسلایدر را با انگشت کشید." },
          { key: "showBrandBadge" as const, label: "نمایش نام برند روی کارت",
            desc: "برچسب کوچک نام برند بالای عنوان محصول" },
          { key: "autoplay" as const, label: "اسلاید خودکار",
            desc: "با نگه داشتن اشاره‌گر روی اسلایدر موقتاً متوقف می‌شود" },
        ]).map(f => (
          <label key={f.key} className="flex items-center justify-between gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-white/5 cursor-pointer hover:border-gray-300 dark:hover:border-white/20 transition-all">
            <span className="min-w-0">
              <span className="block text-sm font-black text-gray-900 dark:text-white">{f.label}</span>
              <span className="block text-[11px] text-gray-500 mt-1 leading-relaxed">{f.desc}</span>
            </span>
            <input
              type="checkbox"
              checked={config[f.key] ?? true}
              onChange={e => patch({ [f.key]: e.target.checked } as Partial<ProductShowcaseConfig>)}
              className="w-5 h-5 rounded flex-shrink-0"
              style={{ accentColor: "#059669" }}
            />
          </label>
        ))}

        {config.autoplay && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-gray-700 dark:text-gray-300">
                فاصله‌ی بین اسلایدها
              </label>
              <span className="text-xs font-black text-emerald-600 tabular-nums">
                {((config.autoplayDelay ?? 4000) / 1000).toLocaleString("fa-IR")} ثانیه
              </span>
            </div>
            <input
              type="range"
              min={AUTOPLAY_MIN} max={AUTOPLAY_MAX} step={500}
              value={config.autoplayDelay ?? 4000}
              onChange={e => patch({ autoplayDelay: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: "#059669" }}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              از {(AUTOPLAY_MIN / 1000).toLocaleString("fa-IR")} تا {(AUTOPLAY_MAX / 1000).toLocaleString("fa-IR")} ثانیه
            </p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          این ویجت از کارت محصول جدید استفاده می‌کند: در موبایل دو کارت کامل کنار هم و بخشی از کارت
          سوم دیده می‌شود تا معلوم باشد لیست ادامه دارد. دو ویجت قدیمی «محصولات بر اساس دسته» و
          «محصولات بر اساس برند» دست‌نخورده باقی مانده‌اند و می‌توانید هم‌زمان از آن‌ها استفاده کنید.
        </p>
      </div>
    </div>
  );
}

// ─── SpacerEditor ─────────────────────────────────────────────────────────────
/** فاصله‌ی پیش‌فرضی که صفحه اصلی (space-y-12) بین هر دو ویجت می‌گذارد */
const HOME_GAP = 48;

function SpacerEditor({
  config, setConfig,
}: {
  config: SpacerConfig;
  setConfig: (c: SpacerConfig) => void;
}) {
  const mobileSame = config.heightMobile === null;
  const mobileValue = config.heightMobile ?? config.height;

  const rows = [
    {
      key: "desktop" as const,
      label: "ارتفاع در دسکتاپ",
      hint: "عرض صفحه ۷۶۸ پیکسل و بیشتر",
      value: config.height,
      onChange: (n: number) => setConfig({ ...config, height: n }),
    },
    {
      key: "mobile" as const,
      label: "ارتفاع در موبایل",
      hint: "عرض صفحه کمتر از ۷۶۸ پیکسل",
      value: mobileValue,
      onChange: (n: number) => setConfig({ ...config, heightMobile: n }),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gray-500 rounded-full" />
          ارتفاع فضای خالی
        </h3>

        {rows.map(r => {
          const disabled = r.key === "mobile" && mobileSame;
          return (
            <div key={r.key} className={disabled ? "opacity-50" : ""}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black text-gray-700 dark:text-gray-300">
                  {r.label}
                  <span className="font-bold text-gray-400 mr-2">({r.hint})</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={SPACER_MIN}
                    max={SPACER_MAX}
                    value={r.value}
                    disabled={disabled}
                    onChange={e => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) r.onChange(Math.min(SPACER_MAX, Math.max(SPACER_MIN, Math.round(n))));
                    }}
                    className="w-20 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-black text-center tabular-nums disabled:cursor-not-allowed"
                  />
                  <span className="text-[10px] font-black text-gray-400">px</span>
                </div>
              </div>
              <input
                type="range"
                min={SPACER_MIN}
                max={SPACER_MAX}
                step={4}
                value={r.value}
                disabled={disabled}
                onChange={e => r.onChange(Number(e.target.value))}
                className="w-full disabled:cursor-not-allowed"
                style={{ accentColor: "#4b5563" }}
              />
            </div>
          );
        })}

        <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border-2 border-gray-100 dark:border-white/5 cursor-pointer hover:border-gray-300 dark:hover:border-white/20 transition-all">
          <span className="min-w-0">
            <span className="block text-sm font-black text-gray-900 dark:text-white">
              در موبایل هم همان ارتفاع دسکتاپ باشد
            </span>
            <span className="block text-[11px] text-gray-500 mt-1 leading-relaxed">
              اگر روشن باشد، ارتفاع موبایل جداگانه ذخیره نمی‌شود و همیشه از ارتفاع دسکتاپ پیروی می‌کند.
            </span>
          </span>
          <input
            type="checkbox"
            checked={mobileSame}
            onChange={e =>
              setConfig({ ...config, heightMobile: e.target.checked ? null : config.height })
            }
            className="w-5 h-5 rounded flex-shrink-0"
            style={{ accentColor: "#4b5563" }}
          />
        </label>

        <button
          type="button"
          onClick={() => setConfig({ ...SPACER_DEFAULT })}
          className="text-[11px] font-black text-gray-500 hover:text-gray-900 dark:hover:text-white underline"
        >
          بازگرداندن به مقادیر پیش‌فرض
        </button>
      </div>

      {/* پیش‌نمایش */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-3">
        <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gray-500 rounded-full" />
          پیش‌نمایش (مقیاس واقعی — دسکتاپ)
        </h3>
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-3 overflow-y-auto" style={{ maxHeight: 420 }}>
          <div className="rounded-xl bg-gray-100 dark:bg-gray-800 py-4 text-center text-[11px] font-black text-gray-500">
            ویجت قبلی
          </div>
          <div style={{ height: HOME_GAP }} className="bg-blue-500/5" />
          <div
            style={{ height: config.height }}
            className="bg-gray-500/10 border-y border-dashed border-gray-400/50 flex items-center justify-center"
          >
            <span className="text-[10px] font-black text-gray-500 tabular-nums">
              فضای خالی — {config.height.toLocaleString("fa-IR")} پیکسل
            </span>
          </div>
          <div style={{ height: HOME_GAP }} className="bg-blue-500/5" />
          <div className="rounded-xl bg-gray-100 dark:bg-gray-800 py-4 text-center text-[11px] font-black text-gray-500">
            ویجت بعدی
          </div>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 space-y-2">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-bold">
          صفحه اصلی از قبل بین هر دو ویجت {HOME_GAP.toLocaleString("fa-IR")} پیکسل فاصله می‌گذارد
          (نواحی آبی‌رنگ در پیش‌نمایش). بنابراین فاصله‌ی نهایی بین ویجت قبلی و بعدی برابر است با:
        </p>
        <p className="text-xs text-blue-800 dark:text-blue-200 font-black tabular-nums">
          دسکتاپ: {(config.height + HOME_GAP * 2).toLocaleString("fa-IR")} پیکسل
          <span className="mx-2 opacity-40">|</span>
          موبایل: {(mobileValue + HOME_GAP * 2).toLocaleString("fa-IR")} پیکسل
        </p>
        <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
          این ویجت هیچ عنصر دیده‌شدنی رندر نمی‌کند و برای صفحه‌خوان‌ها نامرئی است؛ فقط جای خالی
          اشغال می‌کند. می‌توانید چند نمونه از آن را در جاهای مختلف صفحه اصلی قرار دهید.
        </p>
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
  // UNIQUE_STAR_HERO
  const [ushConfig, setUshConfig] = useState<USHConfig>({ ...USH_DEFAULT });
  // DIMENSIONAL_CARDS
  const [dcConfig, setDcConfig] = useState<DCConfig>({
    ...DC_DEFAULT,
    cards: DC_DEFAULT.cards.map(c => ({ ...c })),
  });
  const [dcUploading, setDcUploading] = useState([false, false, false]);
  const [cfConfig, setCfConfig] = useState<CFConfig>({ ...CF_DEFAULT, items: [] });
  const [cfUploadingIdx, setCfUploadingIdx] = useState<number | null>(null);
  // SPACER
  const [spacerConfig, setSpacerConfig] = useState<SpacerConfig>({ ...SPACER_DEFAULT });
  // PRODUCT_SHOWCASE
  const [showcaseConfig, setShowcaseConfig] = useState<ProductShowcaseConfig>({ ...SHOWCASE_DEFAULT });

const SUPPORTED = ["CATEGORIES", "NEWEST_PRODUCTS", "AMAZING_DEALS", "SPECIAL_OFFERS", "PRODUCTS_BY_CATEGORY", "PRODUCTS_BY_BRAND", "FULL_BANNER", "DOUBLE_BANNER", "IMAGE_CONTENT", "IMAGE_CONTENT_DOUBLE", "LAST_VISITED", "HERO_SLIDER", "STORY", "LATEST_ARTICLES", "CALL_TO_ACTION", "ADVANCED_SEARCH", "UNIQUE_STAR_HERO", "DIMENSIONAL_CARDS", "COVERFLOW_GALLERY", "SPACER", "PRODUCT_SHOWCASE"];  useEffect(() => {
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
          } else if (w.type === "UNIQUE_STAR_HERO") {
          setUshConfig({
            ...USH_DEFAULT,
            ...(w.config as Partial<USHConfig>),
            hangingLinks: Array.isArray(w.config.hangingLinks)
              ? w.config.hangingLinks
              : USH_DEFAULT.hangingLinks,
          });
          } else if (w.type === "DIMENSIONAL_CARDS") {
          const raw = Array.isArray(w.config.cards) ? w.config.cards : [];
          setDcConfig({
            heading:    w.config.heading    ?? DC_DEFAULT.heading,
            subheading: w.config.subheading ?? DC_DEFAULT.subheading,
            cards: DC_DEFAULT.cards.map((def, i) => ({ ...def, ...(raw[i] ?? {}) })),
          });
        } else if (w.type === "COVERFLOW_GALLERY") {
          setCfConfig({
            ...CF_DEFAULT,
            ...(w.config as Partial<CFConfig>),
            items: Array.isArray(w.config.items)
              ? w.config.items.map((it: any) => ({ ...CF_EMPTY_ITEM, ...it }))
              : [],
          });
        } else if (w.type === "SPACER") {
          setSpacerConfig(normalizeSpacerConfig(w.config));
        } else if (w.type === "PRODUCT_SHOWCASE") {
          setShowcaseConfig(normalizeShowcaseConfig(w.config));
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
    if (widget.type === "SPACER") {
      config = normalizeSpacerConfig(spacerConfig);
    } else if (widget.type === "PRODUCT_SHOWCASE") {
      const c = normalizeShowcaseConfig(showcaseConfig);
      // فیلدهای منبعِ غیرفعال ذخیره نمی‌شوند تا config تمیز بماند
      config = c.source === "brand"
        ? { ...c, categoryId: undefined, categoryTitle: undefined, categorySlug: undefined }
        : { ...c, brandId: undefined, brandTitle: undefined, brandSlug: undefined };
      if (c.sortMode !== "manual") config.productIds = [];
    } else if (widget.type === "COVERFLOW_GALLERY") {
      config = { ...cfConfig };
    } else if (widget.type === "DIMENSIONAL_CARDS") {
      config = { ...dcConfig };
    } else if (widget.type === "UNIQUE_STAR_HERO") {
      config = { ...ushConfig };
    } else if (widget.type === "ADVANCED_SEARCH") {
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
    UNIQUE_STAR_HERO:     "بنر هرو تمام‌عرض با انیمیشن — متن‌ها، رنگ‌ها، لینک‌ها و عناصر قابل تنظیم",
    DIMENSIONAL_CARDS:    "سه کارت شیشه‌ای با افکت سه‌بعدی — عنوان، توضیح، تصویر، لینک و رنگ‌بندی هر کارت جداگانه",
    COVERFLOW_GALLERY:    "گالری تصاویر با چرخش سه‌بعدی — هر تصویر لینک و دکمه‌ی اختیاری دارد",
    SPACER:               "ارتفاع فاصله‌ی خالی را برای دسکتاپ و موبایل تنظیم کنید",
    PRODUCT_SHOWCASE:     "اسلایدر محصولات با کارت جدید — یک دسته یا برند انتخاب کنید و رفتار اسلایدر را تنظیم نمایید",
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

      {widget.type === "UNIQUE_STAR_HERO" && (
        <UniqueStarHeroEditor config={ushConfig} setConfig={setUshConfig} />
      )}

      {widget.type === "DIMENSIONAL_CARDS" && (
        <DimensionalCardsEditor
          config={dcConfig}
          setConfig={setDcConfig}
          uploading={dcUploading}
          setUploading={setDcUploading}
        />
      )}

      {widget.type === "COVERFLOW_GALLERY" && (
        <CoverflowGalleryEditor
          config={cfConfig}
          setConfig={setCfConfig}
          uploadingIdx={cfUploadingIdx}
          setUploadingIdx={setCfUploadingIdx}
        />
      )}

      {widget.type === "SPACER" && (
        <SpacerEditor config={spacerConfig} setConfig={setSpacerConfig} />
      )}

      {widget.type === "PRODUCT_SHOWCASE" && (
        <ProductShowcaseEditor
          config={showcaseConfig}
          setConfig={setShowcaseConfig}
          categories={categories}
          brands={brands}
        />
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
