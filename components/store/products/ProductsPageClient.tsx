"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ManaProductCard, { ProductCardItem } from "@/components/store/product/ManaProductCard";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Brand { id: string; title: string; slug: string; logoUrl: string | null }
interface Category { id: string; title: string; slug: string; imageUrl: string | null }
interface Meta {
  brands: Brand[];
  categories: Category[];
  priceRange: { min: string; max: string };
}
interface ProductsResponse {
  page: number; pageSize: number; total: number; items: ProductCardItem[];
}
type SortType = "newest" | "popular" | "price_asc" | "price_desc";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;
const INFINITE_SCROLL_LIMIT = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function formatPrice(val: string | number) {
  const n = Number(val);
  return isNaN(n) ? "۰" : n.toLocaleString("fa-IR");
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────
function FilterSidebar({
  meta, selectedBrands, selectedCategories, minPrice, maxPrice,
  onBrandToggle, onCategoryToggle, onPriceChange, onApplyPrice, onReset,
}: {
  meta: Meta;
  selectedBrands: string[];
  selectedCategories: string[];
  minPrice: string; maxPrice: string;
  onBrandToggle: (s: string) => void;
  onCategoryToggle: (s: string) => void;
  onPriceChange: (mn: string, mx: string) => void;
  onApplyPrice: () => void;
  onReset: () => void;
}) {
  const [brandOpen, setBrandOpen] = useState(true);
  const [catOpen, setCatOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [brandSearch, setBrandSearch] = useState("");

  const filteredBrands = meta.brands.filter(b =>
    b.title.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const activeCount = selectedBrands.length + selectedCategories.length +
    (minPrice || maxPrice ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Reset */}
      {activeCount > 0 && (
        <button
          onClick={onReset}
          className="w-full py-3 border border-red-500/30 text-red-500 rounded-2xl text-xs font-black hover:bg-red-500 hover:text-white transition-all"
        >
          پاک کردن همه فیلترها ({toFa(activeCount)})
        </button>
      )}

      {/* Price */}
      <div className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-xl">
        <button className="flex items-center justify-between p-6 w-full" onClick={() => setPriceOpen(!priceOpen)}>
          <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />محدوده قیمت
          </h3>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${priceOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {priceOpen && (
          <div className="px-6 pb-6 space-y-3">
            <div className="flex items-center bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[1.25rem] px-4 py-3">
              <span className="text-[11px] font-bold text-gray-400 ml-3 shrink-0">از</span>
              <input type="number" className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-gray-700 dark:text-white p-0 outline-none"
                value={minPrice} placeholder={formatPrice(meta.priceRange.min)}
                onChange={e => onPriceChange(e.target.value, maxPrice)} />
            </div>
            <div className="flex items-center bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[1.25rem] px-4 py-3">
              <span className="text-[11px] font-bold text-gray-400 ml-3 shrink-0">تا</span>
              <input type="number" className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-gray-700 dark:text-white p-0 outline-none"
                value={maxPrice} placeholder={formatPrice(meta.priceRange.max)}
                onChange={e => onPriceChange(minPrice, e.target.value)} />
            </div>
            <button onClick={onApplyPrice} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] text-xs font-black transition-all active:scale-95">
              تایید قیمت
            </button>
          </div>
        )}
      </div>

      {/* Category */}
      {meta.categories.length > 0 && (
        <div className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-xl">
          <button className="flex items-center justify-between p-6 w-full" onClick={() => setCatOpen(!catOpen)}>
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              دسته‌بندی
              {selectedCategories.length > 0 && (
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">{toFa(selectedCategories.length)}</span>
              )}
            </h3>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${catOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {catOpen && (
            <ul className="px-6 pb-6 space-y-1 max-h-64 overflow-y-auto">
              {meta.categories.map(c => (
                <li key={c.id}>
                  <label className="flex items-center justify-between p-3 rounded-2xl hover:bg-emerald-500/5 cursor-pointer border border-transparent hover:border-emerald-500/20 transition-all">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{c.title}</span>
                    <div className="relative flex items-center">
                      <input type="checkbox" className="peer appearance-none w-5 h-5 rounded-lg border-2 border-gray-300/70 dark:border-white/20 checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer"
                        checked={selectedCategories.includes(c.slug)} onChange={() => onCategoryToggle(c.slug)} />
                      <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 left-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Brand */}
      {meta.brands.length > 0 && (
        <div className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-xl">
          <button className="flex items-center justify-between p-6 w-full" onClick={() => setBrandOpen(!brandOpen)}>
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              برند
              {selectedBrands.length > 0 && (
                <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">{toFa(selectedBrands.length)}</span>
              )}
            </h3>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${brandOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {brandOpen && (
            <div className="px-6 pb-6 space-y-3">
              {meta.brands.length > 5 && (
                <div className="relative">
                  <input type="text" className="w-full bg-white/60 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-2xl py-3 pr-10 pl-4 text-xs font-bold text-gray-800 dark:text-white outline-none"
                    placeholder="جستجوی برند..." value={brandSearch} onChange={e => setBrandSearch(e.target.value)} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              )}
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {filteredBrands.map(b => (
                  <li key={b.id}>
                    <label className="flex items-center justify-between p-3 rounded-2xl hover:bg-blue-500/5 cursor-pointer border border-transparent hover:border-blue-500/20 transition-all">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{b.title}</span>
                      <div className="relative flex items-center">
                        <input type="checkbox" className="peer appearance-none w-5 h-5 rounded-lg border-2 border-gray-300/70 dark:border-white/20 checked:bg-blue-500 checked:border-blue-500 transition-all cursor-pointer"
                          checked={selectedBrands.includes(b.slug)} onChange={() => onBrandToggle(b.slug)} />
                        <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 left-1 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProductsPageClient() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [products, setProducts] = useState<ProductCardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [sort, setSort] = useState<SortType>("newest");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [appliedMin, setAppliedMin] = useState("");
  const [appliedMax, setAppliedMax] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const useInfiniteScroll = page <= INFINITE_SCROLL_LIMIT;

  // ── Load meta ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/products-meta")
      .then(r => r.json())
      .then(setMeta);
  }, []);

  // ── Fetch products ─────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (pageToFetch: number, append: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageToFetch),
        pageSize: String(PAGE_SIZE),
        sort,
      });
      if (selectedBrands.length === 1) params.set("brand", selectedBrands[0]);
      if (selectedCategories.length === 1) params.set("category", selectedCategories[0]);

      const absMin = String(Number(meta?.priceRange?.min ?? 0));
      const absMax = String(Number(meta?.priceRange?.max ?? 100_000_000));
      if (appliedMin && appliedMin !== absMin) params.set("minPrice", appliedMin);
      if (appliedMax && appliedMax !== absMax) params.set("maxPrice", appliedMax);

      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) return;
      const data: ProductsResponse = await res.json();
      setTotal(data.total);
      setProducts(prev => append ? [...prev, ...data.items] : data.items);
      setInitialLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [sort, selectedBrands, selectedCategories, appliedMin, appliedMax, meta]);

  useEffect(() => {
    setPage(1);
    fetchProducts(1, false);
  }, [sort, selectedBrands, selectedCategories, appliedMin, appliedMax]);

  // ── Infinite scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!useInfiniteScroll || !initialLoaded || page >= totalPages) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading) {
        const next = page + 1;
        setPage(next);
        fetchProducts(next, true);
      }
    }, { threshold: 0.1 });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [page, totalPages, loading, useInfiniteScroll, initialLoaded, fetchProducts]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function toggleBrand(s: string) {
    setSelectedBrands(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }
  function toggleCategory(s: string) {
    setSelectedCategories(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }
  function applyPrice() { setAppliedMin(minPrice); setAppliedMax(maxPrice); }
  function reset() {
    setSelectedBrands([]); setSelectedCategories([]);
    setMinPrice(""); setMaxPrice(""); setAppliedMin(""); setAppliedMax("");
  }
  function goToPage(p: number) {
    setPage(p); fetchProducts(p, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sortLabels: Record<SortType, string> = {
    newest: "جدیدترین", popular: "پرفروش‌ترین",
    price_asc: "ارزان‌ترین", price_desc: "گران‌ترین",
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-100 dark:bg-[#050505] min-h-screen" dir="rtl">
      <section className="py-16">
        <div className="container px-4">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[10px] font-black text-gray-400 mb-6 bg-white/30 dark:bg-white/[0.02] w-fit px-4 py-2 rounded-full border border-white/40 dark:border-white/5 backdrop-blur-md">
            <Link href="/" className="hover:text-blue-500 transition-colors">خانه</Link>
            <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-blue-600 dark:text-blue-400">همه محصولات</span>
          </nav>

          {/* Header + Sort */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
            <div className="relative">
              <div className="absolute -right-4 top-0 w-1 h-12 bg-blue-500 rounded-full blur-[2px]" />
              <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">همه محصولات</h1>
              <div className="flex items-center gap-2 mt-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                  {toFa(total)} محصول موجود
                </p>
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1 bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 p-2 rounded-[1.8rem] shadow-xl">
              <div className="flex items-center px-4 gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">مرتب‌سازی:</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {(["newest", "popular", "price_asc", "price_desc"] as SortType[]).map(s => (
                  <button key={s} onClick={() => setSort(s)}
                    className={`px-4 py-2.5 rounded-[1.2rem] text-[11px] font-black transition-all ${sort === s ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25" : "text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/5"}`}>
                    {sortLabels[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active filters chips */}
          {(selectedBrands.length > 0 || selectedCategories.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-6">
              {selectedCategories.map(slug => {
                const cat = meta?.categories.find(c => c.slug === slug);
                return cat ? (
                  <span key={slug} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {cat.title}
                    <button onClick={() => toggleCategory(slug)} className="hover:text-red-500 transition-colors">×</button>
                  </span>
                ) : null;
              })}
              {selectedBrands.map(slug => {
                const brand = meta?.brands.find(b => b.slug === slug);
                return brand ? (
                  <span key={slug} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400">
                    {brand.title}
                    <button onClick={() => toggleBrand(slug)} className="hover:text-red-500 transition-colors">×</button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Mobile filter button */}
          <div className="fixed bottom-28 right-6 z-[95] lg:hidden">
            <button onClick={() => setFilterOpen(true)}
              className="flex items-center justify-center w-14 h-14 bg-white/40 dark:bg-white/[0.05] backdrop-blur-2xl text-blue-600 rounded-2xl shadow-xl border border-white/60 dark:border-white/10 active:scale-90 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>

          {/* Mobile filter offcanvas */}
          {filterOpen && meta && (
            <div className="fixed inset-0 z-[150] lg:hidden">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setFilterOpen(false)} />
              <div className="absolute top-0 right-0 h-full w-[85%] max-w-[380px] bg-white/90 dark:bg-gray-950/95 backdrop-blur-2xl overflow-y-auto flex flex-col shadow-2xl">
                <div className="p-6 flex items-center justify-between border-b border-gray-200 dark:border-white/10">
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">فیلترها</h2>
                  <button onClick={() => setFilterOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <FilterSidebar meta={meta} selectedBrands={selectedBrands} selectedCategories={selectedCategories}
                    minPrice={minPrice} maxPrice={maxPrice} onBrandToggle={toggleBrand} onCategoryToggle={toggleCategory}
                    onPriceChange={(mn, mx) => { setMinPrice(mn); setMaxPrice(mx); }}
                    onApplyPrice={() => { applyPrice(); setFilterOpen(false); }} onReset={() => { reset(); setFilterOpen(false); }} />
                </div>
                <div className="p-6 border-t border-gray-200 dark:border-white/10">
                  <button onClick={() => setFilterOpen(false)} className="w-full bg-blue-600 text-white py-4 rounded-[1.8rem] font-black shadow-lg shadow-blue-600/30 active:scale-95 transition-all">
                    نمایش نتایج ({toFa(total)})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

            {/* Sidebar desktop */}
            <aside className="hidden lg:block lg:col-span-1">
              <div className="sticky top-24">
                {meta ? (
                  <FilterSidebar meta={meta} selectedBrands={selectedBrands} selectedCategories={selectedCategories}
                    minPrice={minPrice} maxPrice={maxPrice} onBrandToggle={toggleBrand} onCategoryToggle={toggleCategory}
                    onPriceChange={(mn, mx) => { setMinPrice(mn); setMaxPrice(mx); }}
                    onApplyPrice={applyPrice} onReset={reset} />
                ) : (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <div key={i} className="h-48 bg-white/60 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />)}
                  </div>
                )}
              </div>
            </aside>

            {/* Products */}
            <div className="lg:col-span-3">
              {!initialLoaded ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-96 bg-white/60 dark:bg-white/5 rounded-[3rem] animate-pulse" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-24 h-24 bg-white/50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 border border-dashed border-gray-300 dark:border-white/10">
                    <svg className="w-10 h-10 text-gray-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-gray-700 dark:text-gray-300 font-black text-lg mb-2">محصولی یافت نشد</h3>
                  <button onClick={reset} className="mt-4 px-6 py-2.5 rounded-xl border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold text-sm hover:bg-blue-500 hover:text-white transition-all">
                    پاک کردن فیلترها
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {products.map(p => <ManaProductCard key={p.id} product={p} />)}
                  </div>

                  {/* Infinite scroll sentinel */}
                  {useInfiniteScroll && page < totalPages && (
                    <div ref={sentinelRef} className="flex justify-center py-10">
                      {loading && (
                        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="text-sm font-bold">در حال بارگذاری...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pagination صفحه ۱۱ به بعد */}
                  {!useInfiniteScroll && totalPages > 1 && (
                    <div className="mt-16 flex items-center justify-center">
                      <div className="flex items-center gap-2 bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 p-2 rounded-[2rem] shadow-xl">
                        <button onClick={() => page > 1 && goToPage(page - 1)} disabled={page <= 1}
                          className="w-11 h-11 rounded-[1.2rem] bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-all disabled:opacity-30">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <div className="flex items-center gap-1.5 px-2">
                          {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                            const p = i + INFINITE_SCROLL_LIMIT + 1;
                            if (p > totalPages) return null;
                            return (
                              <button key={p} onClick={() => goToPage(p)}
                                className={`w-11 h-11 rounded-[1.2rem] flex items-center justify-center text-xs font-black transition-all ${page === p ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40 ring-4 ring-blue-500/10" : "bg-white/60 dark:bg-white/10 border border-white dark:border-white/5 text-gray-600 dark:text-gray-300 hover:bg-blue-500 hover:text-white"}`}>
                                {toFa(p)}
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={() => page < totalPages && goToPage(page + 1)} disabled={page >= totalPages}
                          className="w-11 h-11 rounded-[1.2rem] bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-all disabled:opacity-30">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}