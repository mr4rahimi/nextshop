"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { type ProductCardItem } from "@/components/store/product/ManaProductCard";
import { ProductCardAuto, useProductGridClass } from "@/components/store/product/ProductLayoutContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Brand {
  id: string;
  title: string;
  slug: string;
  logoUrl: string | null;
}

interface Category {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  seoDescription: string | null;
  children: { id: string; title: string; slug: string; imageUrl: string | null }[];
  parent: { id: string; title: string; slug: string } | null;
  brands: Brand[];
  priceRange: { min: string; max: string };
  landings?: { slug: string; h1: string }[];
  attributeGroups?: {
    id: string;
    attributeGroup: {
      id: string;
      title: string;
      attributes: {
        id: string;
        title: string;
        slug: string;
        values: {
          id: string;
          value: string;
          slug: string | null;
        }[];
      }[];
    };
  }[];
}

interface ProductsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: ProductCardItem[];
}

type SortType = "newest" | "popular" | "price_asc" | "price_desc";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;
const INFINITE_SCROLL_LIMIT = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toFarsi(n: number): string {
  return n.toLocaleString("fa-IR");
}

function formatPrice(val: string | number): string {
  const n = Number(val);
  if (isNaN(n)) return "۰";
  return n.toLocaleString("fa-IR");
}

/** پنجره‌ی متحرک شماره صفحات — همیشه حول صفحه فعلی */
function pageWindow(current: number, total: number, size = 7): number[] {
  if (total <= size) return Array.from({ length: total }, (_, i) => i + 1);
  const half = Math.floor(size / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + size - 1);
  start = Math.max(1, end - size + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// ─── Attribute Filters Component ──────────────────────────────────────────────
function AttributeFilters({
  attributeGroups,
  selectedAttributes,
  onAttributeToggle,
 }: {
  attributeGroups: Category["attributeGroups"];
  selectedAttributes: Record<string, string[]>;
  onAttributeToggle: (attributeId: string, valueId: string) => void;
 }) {
  if (!attributeGroups || attributeGroups.length === 0) return null;

  return (
    <>
      {attributeGroups.map((ag) => {
        const group = ag.attributeGroup;
        if (!group.attributes || group.attributes.length === 0) return null;
        
        return group.attributes.map((attr) => {
          if (!attr.values || attr.values.length === 0) return null;
          
          return (
            <AttributeFilterItem
              key={attr.id}
              attribute={attr}
              selectedValues={selectedAttributes[attr.id] || []}
              onToggle={(valueId) => onAttributeToggle(attr.id, valueId)}
            />
          );
        });
      })}
    </>
  );
}

function AttributeFilterItem({
  attribute,
  selectedValues,
  onToggle,
}: {
  attribute: {
    id: string;
    title: string;
    values: { id: string; value: string }[];
  };
  selectedValues: string[];
  onToggle: (valueId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const selectedCount = selectedValues.length;

  return (
    <div className="relative bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-gray-200/50 dark:shadow-none">
      <button
        className="flex items-center justify-between p-7 w-full cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-purple-500" />
          {attribute.title}
          {selectedCount > 0 && (
            <span className="text-[10px] font-black text-purple-500 bg-purple-500/10 px-3 py-1 rounded-full">
              {toFarsi(selectedCount)}
            </span>
          )}
        </h3>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-7 pb-8 space-y-1">
          <ul className="space-y-1 max-h-72 overflow-y-auto pl-2">
            {attribute.values.map((val) => (
              <li key={val.id} className="group/attr">
                <label className="flex items-center justify-between p-3 rounded-2xl hover:bg-purple-500/5 dark:hover:bg-purple-500/10 cursor-pointer transition-all border border-transparent hover:border-purple-500/20">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 group-hover/attr:text-purple-600 transition-colors">
                    {val.value}
                  </span>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      className="peer appearance-none w-5 h-5 rounded-lg border-2 border-gray-300/70 dark:border-white/20 checked:bg-purple-500 checked:border-purple-500 transition-all cursor-pointer"
                      checked={selectedValues.includes(val.id)}
                      onChange={() => onToggle(val.id)}
                    />
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
  );
}
// ─── Filter Sidebar ───────────────────────────────────────────────────────────
function FilterSidebar({
  brands,
  priceRange,
  selectedBrands,
  minPrice,
  maxPrice,
  onBrandToggle,
  onPriceChange,
  onApplyPrice,
  brandSearch,
  onBrandSearch,
  attributeGroups,
  selectedAttributes,
  onAttributeToggle,
}: {
  brands: Brand[];
  priceRange: { min: string; max: string };
  selectedBrands: string[];
  minPrice: string;
  maxPrice: string;
  onBrandToggle: (slug: string) => void;
  onPriceChange: (min: string, max: string) => void;
  onApplyPrice: () => void;
  brandSearch: string;
  onBrandSearch: (v: string) => void;
  attributeGroups?: Category["attributeGroups"];
  selectedAttributes: Record<string, string[]>;
  onAttributeToggle: (attributeId: string, valueId: string) => void;
}) {
  const [priceOpen, setPriceOpen] = useState(true);
  const [brandOpen, setBrandOpen] = useState(true);

  const filteredBrands = (brands ?? []).filter((b) =>
    b.title.toLowerCase().includes(brandSearch.toLowerCase())
  );

  return (
    <div className="sticky top-10 space-y-6">
      {/* Price Filter */}
      <div className="relative bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-gray-200/50 dark:shadow-none">
        <button
          className="flex items-center justify-between p-7 w-full cursor-pointer select-none"
          onClick={() => setPriceOpen(!priceOpen)}
        >
          <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            محدوده قیمت
          </h3>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${priceOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {priceOpen && (
          <div className="px-7 pb-8 pt-0 space-y-4">
            <div className="group/in relative flex items-center bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[1.25rem] px-4 py-3">
              <span className="text-[11px] font-bold text-gray-400 ml-3 shrink-0">از</span>
              <input
                type="number"
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-gray-700 dark:text-white p-0 outline-none"
                value={minPrice}
                onChange={(e) => onPriceChange(e.target.value, maxPrice)}
                placeholder={formatPrice(priceRange.min)}
              />
            </div>
            <div className="group/in relative flex items-center bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[1.25rem] px-4 py-3">
              <span className="text-[11px] font-bold text-gray-400 ml-3 shrink-0">تا</span>
              <input
                type="number"
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-gray-700 dark:text-white p-0 outline-none"
                value={maxPrice}
                onChange={(e) => onPriceChange(minPrice, e.target.value)}
                placeholder={formatPrice(priceRange.max)}
              />
            </div>
            <button
              onClick={onApplyPrice}
              className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-[1.5rem] text-xs font-black transition-all active:scale-95"
            >
              تایید محدوده قیمت
            </button>
          </div>
        )}
      </div>

      {/* Brand Filter */}
      {brands.length > 0 && (
        <div className="relative bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-gray-200/50 dark:shadow-none">
          <button
            className="flex items-center justify-between p-7 w-full cursor-pointer select-none"
            onClick={() => setBrandOpen(!brandOpen)}
          >
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-primary-500" />
              برندها
              {selectedBrands.length > 0 && (
                <span className="text-[10px] font-black text-primary-500 bg-primary-500/10 px-3 py-1 rounded-full">
                  {toFarsi(selectedBrands.length)}
                </span>
              )}
            </h3>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${brandOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {brandOpen && (
            <div className="px-7 pb-8 space-y-5">
              {brands.length > 5 && (
                <div className="relative">
                  <input
                    type="text"
                    className="w-full bg-white/60 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-2xl py-3.5 pr-11 pl-4 text-xs font-bold text-gray-800 dark:text-white outline-none transition-all focus:border-primary-500/50"
                    placeholder="جستجوی برند..."
                    value={brandSearch}
                    onChange={(e) => onBrandSearch(e.target.value)}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              )}

              <ul className="space-y-1 max-h-72 overflow-y-auto pl-2">
                {filteredBrands.map((b) => (
                  <li key={b.id} className="group/brand">
                    <label className="flex items-center justify-between p-3 rounded-2xl hover:bg-primary-500/5 dark:hover:bg-primary-500/10 cursor-pointer transition-all border border-transparent hover:border-primary-500/20">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 group-hover/brand:text-primary-600 transition-colors">
                        {b.title}
                      </span>
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer appearance-none w-5 h-5 rounded-lg border-2 border-gray-300/70 dark:border-white/20 checked:bg-primary-500 checked:border-primary-500 transition-all cursor-pointer"
                          checked={selectedBrands.includes(b.slug)}
                          onChange={() => onBrandToggle(b.slug)}
                        />
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

      {/* Attribute Filters */}
      <AttributeFilters 
        attributeGroups={attributeGroups}
        selectedAttributes={selectedAttributes}
        onAttributeToggle={onAttributeToggle}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CategoryPageClient({
  category,
  categorySlug,
  initialData,
  landingH1,
  landingIntro,
  lockedFilters,
  basePath,
}: {
  category: Category;
  categorySlug: string;
  initialData?: ProductsResponse;
  landingH1?: string | null;
  landingIntro?: string | null;
  lockedFilters?: Record<string, string>;
  basePath?: string;
}) {
  const searchParams = useSearchParams();
  const gridCls = useProductGridClass();

  // ── نگاشت دوطرفه slug ↔ id برای ویژگی‌ها ──
  const attrMaps = useMemo(() => {
    const attrIdToSlug = new Map<string, string>();
    const attrSlugToId = new Map<string, string>();
    const valueIdToSlug = new Map<string, string>();
    const valueSlugToId = new Map<string, string>(); // key: `${attrId}:${valueSlug}`

    (category?.attributeGroups ?? []).forEach((ag) => {
      (ag.attributeGroup?.attributes ?? []).forEach((attr: any) => {
        if (!attr.slug) return;
        attrIdToSlug.set(attr.id, attr.slug);
        attrSlugToId.set(attr.slug, attr.id);
        (attr.values ?? []).forEach((v: any) => {
          if (!v.slug) return;
          valueIdToSlug.set(v.id, v.slug);
          valueSlugToId.set(`${attr.id}:${v.slug}`, v.id);
        });
      });
    });
    return { attrIdToSlug, attrSlugToId, valueIdToSlug, valueSlugToId };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category?.id, category?.attributeGroups?.length]);

  const absMin = String(Number(category?.priceRange?.min ?? 0));
  const absMax = String(Number(category?.priceRange?.max ?? 100000000));

  const [products, setProducts] = useState<ProductCardItem[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [page, setPage] = useState(() => {
    const n = parseInt(searchParams.get("page") ?? "1");
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(!!initialData);

  // Filters
  const [sort, setSort] = useState<SortType>(() => {
    const s = searchParams.get("sort") ?? "";
    return (["newest", "popular", "price_asc", "price_desc"].includes(s) ? s : "newest") as SortType;
  });
  const [selectedBrands, setSelectedBrands] = useState<string[]>(() =>
    (lockedFilters?.brand ?? searchParams.get("brand") ?? "")
      .split(",").map(s => s.trim()).filter(Boolean)
  );
  const [minPrice, setMinPrice] = useState(() => searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(() => searchParams.get("maxPrice") ?? "");
  const [appliedMin, setAppliedMin] = useState(() => searchParams.get("minPrice") ?? "");
  const [appliedMax, setAppliedMax] = useState(() => searchParams.get("maxPrice") ?? "");
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>(() => {
  const out: Record<string, string[]> = {};
    (category?.attributeGroups ?? []).forEach((ag) => {
      (ag.attributeGroup?.attributes ?? []).forEach((attr: any) => {
        if (!attr.slug) return;
        const raw = lockedFilters?.[attr.slug] ?? searchParams.get(attr.slug);
        if (!raw) return;
        const ids = raw.split(",").map(s => s.trim()).filter(Boolean)
          .map(vs => (attr.values ?? []).find((v: any) => v.slug === vs)?.id)
          .filter(Boolean) as string[];
        if (ids.length) out[attr.id] = ids;
      });
    });
    return out;
  });

  // Mobile filter offcanvas
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    if (!category?.priceRange) return;
    const min = String(Number(category.priceRange.min));
    const max = String(Number(category.priceRange.max));
    if (min !== max) {
      setMinPrice(min);
      setMaxPrice(max);
    }
  }, [category]);

  // Intersection observer for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  // تا رسیدن به صفحه‌ی INFINITE_SCROLL_LIMIT با اسکرول لود می‌شود؛ از آن به بعد
  // صفحه‌بندی معمولی نمایش داده می‌شود تا DOM بی‌نهایت بزرگ نشود.
  const useInfiniteScroll = page < INFINITE_SCROLL_LIMIT;

  // ── سازنده مشترک پارامترها (هم برای URL هم برای API) ──
  const buildParams = useCallback(
    (opts: { forApi: boolean; page: number }) => {
      const p = new URLSearchParams();

      if (opts.forApi) {
        p.set("category", categorySlug);
        p.set("page", String(opts.page));
        p.set("pageSize", String(PAGE_SIZE));
        p.set("sort", sort);
      } else {
        if (opts.page > 1) p.set("page", String(opts.page));
        if (sort !== "newest") p.set("sort", sort);
      }

      const locked = lockedFilters ?? {};

      if (selectedBrands.length && (opts.forApi || !locked.brand)) {
        p.set("brand", selectedBrands.join(","));
      }

      Object.entries(selectedAttributes).forEach(([attrId, valueIds]) => {
        const aSlug = attrMaps.attrIdToSlug.get(attrId);
        if (!aSlug || !valueIds?.length) return;
        if (!opts.forApi && locked[aSlug]) return;
        const vSlugs = valueIds
          .map(id => attrMaps.valueIdToSlug.get(id))
          .filter(Boolean) as string[];
        if (vSlugs.length) p.set(aSlug, vSlugs.join(","));
      });

      if (appliedMin && appliedMin !== absMin) p.set("minPrice", appliedMin);
      if (appliedMax && appliedMax !== absMax) p.set("maxPrice", appliedMax);

      return p;
    },
[categorySlug, sort, selectedBrands, selectedAttributes, appliedMin, appliedMax, absMin, absMax, attrMaps, lockedFilters]
  );

  // ── آدرس واقعی هر صفحه — برای <a href> صفحه‌بندی (قابل کراول) ──
  const hrefFor = useCallback(
    (p: number) => {
      const qs = buildParams({ forApi: false, page: p }).toString();
      const base = basePath ?? `/categories/${categorySlug}`;
      return `${base}${qs ? `?${qs}` : ""}`;
    },
    [buildParams, basePath, categorySlug]
  );

  // ── نوشتن در URL ──
  // history.replaceState به‌جای router.replace: محصولات از /api/products گرفته
  // می‌شوند، پس رندر مجدد سرور (و کوئری‌های دیتابیسش) صرفاً هدررفت است — با هر
  // قدم اسکرول بی‌نهایت یک بار تکرار می‌شد. آدرس همچنان قابل اشتراک/بوکمارک است
  // و بارگذاری مستقیم همان URL کاملاً SSR می‌شود.
  useEffect(() => {
    const next = hrefFor(page);

    // اگر آدرس فعلی همین است، ننویس — وگرنه حلقه بی‌نهایت رندر ایجاد می‌شود
    const current = window.location.pathname + window.location.search;
    if (current === next) return;

    window.history.replaceState(null, "", next);
  }, [hrefFor, page]);

  // ── Fetch ──
  const abortRef = useRef<AbortController | null>(null);

  const fetchProducts = useCallback(
    async (pageToFetch: number, append: boolean) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const params = buildParams({ forApi: true, page: pageToFetch });
        const res = await fetch(`/api/products?${params}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data: ProductsResponse = await res.json();
        setTotal(data.total);
        setProducts((prev) => (append ? [...prev, ...data.items] : data.items));
        setInitialLoaded(true);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [buildParams]
  );

  // ── ریست هنگام تغییر فیلتر (با احترام به page اولیهٔ URL) ──
  const entryPageRef = useRef(page);
  const skipFirstFetch = useRef(!!initialData);
  useEffect(() => {
    if (skipFirstFetch.current) { skipFirstFetch.current = false; return; }
    const target = entryPageRef.current;
    entryPageRef.current = 1;
    setPage(target);
    fetchProducts(target, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, selectedBrands, appliedMin, appliedMax, selectedAttributes, categorySlug]);

  // ── Infinite scroll ──
  // بدون این observer فقط صفحه اول (۱۲ محصول) نمایش داده می‌شد.
  const loadingRef = useRef(false);
  loadingRef.current = loading;

  useEffect(() => {
    if (!useInfiniteScroll || !initialLoaded || page >= totalPages) return;
    const el = sentinelRef.current;
    if (!el) return;

    let fired = false;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0].isIntersecting || fired || loadingRef.current) return;
        fired = true;              // هر observer فقط یک بار صفحه بعد را می‌گیرد
        const next = page + 1;
        setPage(next);
        fetchProducts(next, true);
      },
      // کمی زودتر از رسیدن به انتها لود کن تا اسکرول بی‌وقفه بماند
      { rootMargin: "400px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // `loading` در وابستگی‌هاست تا وقتی فچ تمام شد observer دوباره ساخته شود و
    // اگر sentinel هنوز در دید است، صفحه بعدی زنجیره‌وار لود شود.
  }, [useInfiniteScroll, initialLoaded, page, totalPages, loading, fetchProducts]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleBrandToggle(slug: string) {
    setSelectedBrands((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function handleApplyPrice() {
    setAppliedMin(minPrice);
    setAppliedMax(maxPrice);
  }

  function handlePageClick(e: React.MouseEvent, p: number) {
    e.preventDefault();
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    fetchProducts(p, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** «مشاهده بیشتر» — نسخه‌ی کلیک‌شدنیِ همان لینکی که خزنده دنبال می‌کند */
  function handleLoadMore(e: React.MouseEvent) {
    e.preventDefault();
    if (loading || page >= totalPages) return;
    const next = page + 1;
    setPage(next);
    fetchProducts(next, true);
  }

  function handleAttributeToggle(attributeId: string, valueId: string) {
    setSelectedAttributes((prev) => {
      const current = prev[attributeId] || [];
      const newValues = current.includes(valueId)
        ? current.filter((id) => id !== valueId)
        : [...current, valueId];
      
      if (newValues.length === 0) {
        const { [attributeId]: _, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [attributeId]: newValues };
    });
  }

  const sortLabels: Record<SortType, string> = {
    newest: "جدیدترین",
    popular: "پرفروش‌ترین",
    price_asc: "ارزان‌ترین",
    price_desc: "گران‌ترین",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-100 dark:bg-[#050505] min-h-screen" dir="rtl">
      <section className="relative py-16">
        <div className="container px-4">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[10px] font-black text-gray-400 mb-6 bg-white/30 dark:bg-white/[0.02] w-fit px-4 py-2 rounded-full border border-white/40 dark:border-white/5 backdrop-blur-md">
            <Link href="/" className="hover:text-primary-500 transition-colors uppercase tracking-tighter">خانه</Link>
            <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {category.parent && (
              <>
                <Link href={`/categories/${category.parent.slug}`} className="hover:text-primary-500 transition-colors uppercase tracking-tighter">
                  {category.parent.title}
                </Link>
                <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
            <span className="text-primary-600 dark:text-primary-400">{category.title}</span>
          </nav>

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
            <div className="relative">
              <div className="absolute -right-4 top-0 w-1 h-12 bg-primary-500 rounded-full blur-[2px]" />
              <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                 {landingH1 ?? category.title}
              </h1>
              <div className="flex items-center gap-2 mt-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                  {toFarsi(total)} محصول موجود
                </p>
              </div>
               {landingIntro && (
                <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-300">
                  {landingIntro}
                </p>
              )}

               {!basePath && (category.landings?.length ?? 0) > 0 && (
                <nav aria-label="دسته‌بندی‌های مرتبط" className="mt-5 -mx-4 lg:mx-0">
                  <div className="relative">
                    <div
                      className="flex gap-2 overflow-x-auto scroll-smooth px-4 lg:px-0 pb-2
                                 [scrollbar-width:none] [-ms-overflow-style:none]
                                 [&::-webkit-scrollbar]:hidden"
                    >
                      {category.landings!.map((lp) => (
                        <Link
                          key={lp.slug}
                          href={`/collections/${lp.slug}`}
                          className="group shrink-0 inline-flex items-center gap-1.5 rounded-full
                                     border border-gray-200 dark:border-white/10
                                     bg-white dark:bg-white/5 px-3.5 py-1.5
                                     text-xs font-bold whitespace-nowrap
                                     text-gray-700 dark:text-gray-200 transition-all
                                     hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700
                                     dark:hover:bg-primary-500/10 dark:hover:text-primary-300"
                        >
                          <span className="w-1 h-1 rounded-full bg-primary-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                          {lp.h1}
                        </Link>
                      ))}
                    </div>
                    {/* محو‌شدگی لبه — نشانه‌ی وجود محتوای بیشتر */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-gray-50 dark:from-[#0a0b0f] to-transparent lg:hidden" />
                  </div>
                </nav>
              )}
            
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1 bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 p-2 rounded-[1.8rem] shadow-xl shadow-gray-200/40 dark:shadow-none">
              <div className="flex items-center px-4 gap-2">
                <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">مرتب‌سازی:</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {(["newest", "popular", "price_asc", "price_desc"] as SortType[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`px-4 py-2.5 rounded-[1.2rem] text-[11px] font-black transition-all ${
                      sort === s
                        ? "bg-primary-500 text-white shadow-lg shadow-primary-500/25"
                        : "text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/5"
                    }`}
                  >
                    {sortLabels[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sub-categories */}
          {category.children.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-10">
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/categories/${child.slug}`}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-primary-500 hover:text-primary-600 transition-all"
                >
                  {child.imageUrl && (
                    <Image src={child.imageUrl} alt={child.title} width={24} height={24} className="object-contain" unoptimized />
                  )}
                  {child.title}
                </Link>
              ))}
            </div>
          )}

          {/* Mobile filter button */}
          <div className="fixed bottom-28 right-6 z-[95] lg:hidden">
            <button
              onClick={() => setFilterOpen(true)}
              className="flex items-center justify-center w-14 h-14 bg-white/40 dark:bg-white/[0.05] backdrop-blur-2xl text-primary-600 rounded-2xl shadow-xl border border-white/60 dark:border-white/10 active:scale-90 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>

          {/* Mobile filter overlay */}
          {filterOpen && (
            <div className="fixed inset-0 z-[140] lg:hidden" onClick={() => setFilterOpen(false)}>
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            </div>
          )}

          {/* Mobile filter offcanvas */}
          <div className={`fixed top-0 right-0 h-full w-[85%] max-w-[380px] bg-white/90 dark:bg-black/90 backdrop-blur-[30px] z-[150] transition-transform duration-500 ease-in-out border-l border-white/40 dark:border-white/10 shadow-2xl lg:hidden overflow-y-auto ${filterOpen ? "translate-x-0" : "translate-x-[110%]"}`}>
            <div className="p-6 flex items-center justify-between border-b border-white/40 dark:border-white/5">
              <h2 className="text-lg font-black text-gray-900 dark:text-white">فیلترها</h2>
              <button onClick={() => setFilterOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <FilterSidebar
                brands={category.brands}
                priceRange={category.priceRange}
                selectedBrands={selectedBrands}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onBrandToggle={handleBrandToggle}
                onPriceChange={(mn, mx) => { setMinPrice(mn); setMaxPrice(mx); }}
                onApplyPrice={() => { handleApplyPrice(); setFilterOpen(false); }}
                brandSearch={brandSearch}
                onBrandSearch={setBrandSearch}
                attributeGroups={category.attributeGroups}
                selectedAttributes={selectedAttributes}
                onAttributeToggle={handleAttributeToggle}

              />
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

            {/* Sidebar - desktop */}
            <aside className="hidden lg:block lg:col-span-1">
              <FilterSidebar
                brands={category.brands}
                priceRange={category.priceRange}
                selectedBrands={selectedBrands}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onBrandToggle={handleBrandToggle}
                onPriceChange={(mn, mx) => { setMinPrice(mn); setMaxPrice(mx); }}
                onApplyPrice={handleApplyPrice}
                brandSearch={brandSearch}
                onBrandSearch={setBrandSearch}
                attributeGroups={category.attributeGroups}
                selectedAttributes={selectedAttributes}
                onAttributeToggle={handleAttributeToggle}

              />
            </aside>

            {/* Products */}
            <div className="lg:col-span-3">
              {!initialLoaded ? (
                /* Skeleton */
                <div className={gridCls}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="relative h-full pt-12">
                      <div className="absolute inset-0 bg-white/50 dark:bg-white/5 rounded-[3rem] animate-pulse" />
                      <div className="relative p-7 flex flex-col h-full gap-4">
                        <div className="h-44 bg-gray-200 dark:bg-white/10 rounded-2xl animate-pulse" />
                        <div className="h-4 bg-gray-200 dark:bg-white/10 rounded-full w-3/4 animate-pulse" />
                        <div className="h-4 bg-gray-200 dark:bg-white/10 rounded-full w-1/2 animate-pulse" />
                      </div>
                    </div>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[250px] leading-6">
                    فیلترهای انتخابی را تغییر دهید یا همه فیلترها را پاک کنید.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedBrands([]);
                      setMinPrice(""); setMaxPrice("");
                      setAppliedMin(""); setAppliedMax("");
                      setSelectedAttributes({});
                    }}
                    className="mt-6 px-6 py-2.5 rounded-xl border border-primary-500/30 text-primary-600 dark:text-primary-400 font-bold text-sm hover:bg-primary-500 hover:text-white transition-all"
                  >
                    پاک کردن فیلترها
                  </button>
                </div>
              ) : (
                <>
                  <div className={gridCls}>
                    {products.map((p) => (
                      <ProductCardAuto key={p.id} product={p} />
                    ))}
                  </div>

                  {/* Loading skeleton for new items */}
                  {loading && useInfiniteScroll && (
                    <div className={`${gridCls} mt-6`}>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="relative h-full pt-12">
                          <div className="absolute inset-0 bg-white/50 dark:bg-white/5 rounded-[3rem] animate-pulse" />
                          <div className="relative p-7 flex flex-col h-full gap-4">
                            <div className="h-44 bg-gray-200 dark:bg-white/10 rounded-2xl animate-pulse" />
                            <div className="h-4 bg-gray-200 dark:bg-white/10 rounded-full w-3/4 animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sentinel + لینک واقعیِ صفحه بعد.
                      لینک برای خزنده و کاربر بدون جاوااسکریپت است؛ با JS همان
                      کلیک محصولات بعدی را به لیست اضافه می‌کند. */}
                  {useInfiniteScroll && page < totalPages && (
                    <div ref={sentinelRef} className="mt-10 flex justify-center">
                      <Link
                        href={hrefFor(page + 1)}
                        rel="next"
                        onClick={handleLoadMore}
                        aria-label={`نمایش محصولات بیشتر — صفحه ${toFarsi(page + 1)}`}
                        className="px-8 py-3.5 rounded-[1.5rem] bg-white/60 dark:bg-white/[0.05] backdrop-blur-2xl border border-white/60 dark:border-white/10 text-xs font-black text-gray-600 dark:text-gray-300 hover:bg-primary-500 hover:text-white transition-all"
                      >
                        {loading ? "در حال بارگذاری..." : "نمایش محصولات بیشتر"}
                      </Link>
                    </div>
                  )}

                  {/* صفحه‌بندی — بعد از سقف اسکرول بی‌نهایت */}
                  {!useInfiniteScroll && totalPages > 1 && (
                    <nav aria-label="صفحه‌بندی" className="mt-16 flex items-center justify-center">
                      <div className="flex items-center gap-2 bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 p-2 rounded-[2rem] shadow-xl shadow-gray-200/40 dark:shadow-none">
                        {/* Prev */}
                        {page > 1 && (
                          <Link
                            href={hrefFor(page - 1)}
                            rel="prev"
                            onClick={(e) => handlePageClick(e, page - 1)}
                            aria-label="صفحه قبل"
                            className="w-11 h-11 rounded-[1.2rem] bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-center text-gray-400 hover:text-primary-500 hover:bg-white dark:hover:bg-white/10 transition-all"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        )}

                        <div className="flex items-center gap-1.5 px-2">
                          {pageWindow(page, totalPages).map((p) => (
                            <Link
                              key={p}
                              href={hrefFor(p)}
                              onClick={(e) => handlePageClick(e, p)}
                              aria-label={`صفحه ${toFarsi(p)}`}
                              aria-current={page === p ? "page" : undefined}
                              className={`w-11 h-11 rounded-[1.2rem] flex items-center justify-center text-xs font-black transition-all ${
                                page === p
                                  ? "bg-primary-500 text-white shadow-lg shadow-primary-500/40 ring-4 ring-primary-500/10"
                                  : "bg-white/60 dark:bg-white/10 border border-white dark:border-white/5 text-gray-600 dark:text-gray-300 hover:bg-primary-500 hover:text-white"
                              }`}
                            >
                              {toFarsi(p)}
                            </Link>
                          ))}
                          {totalPages > 7 && page < totalPages - 3 && (
                            <>
                              <span className="px-2 text-gray-400 font-black">...</span>
                              <Link
                                href={hrefFor(totalPages)}
                                onClick={(e) => handlePageClick(e, totalPages)}
                                aria-label={`صفحه آخر — ${toFarsi(totalPages)}`}
                                className="w-11 h-11 rounded-[1.2rem] bg-white/60 dark:bg-white/10 border border-white dark:border-white/5 flex items-center justify-center text-xs font-black text-gray-600 dark:text-gray-300 hover:bg-primary-500 hover:text-white transition-all"
                              >
                                {toFarsi(totalPages)}
                              </Link>
                            </>
                          )}
                        </div>

                        {/* Next */}
                        {page < totalPages && (
                          <Link
                            href={hrefFor(page + 1)}
                            rel="next"
                            onClick={(e) => handlePageClick(e, page + 1)}
                            aria-label="صفحه بعد"
                            className="w-11 h-11 rounded-[1.2rem] bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-center text-gray-400 hover:text-primary-500 hover:bg-white dark:hover:bg-white/10 transition-all"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    </nav>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Shop Features */}
          <div className="mt-20 pt-12 border-t border-gray-200 dark:border-white/5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "ارسال فوری", desc: "تحویل در کمتر از ۲۴ ساعت", color: "blue" },
                { icon: "M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z", label: "۷ روز ضمانت بازگشت", desc: "بازگشت در صورت عدم رضایت", color: "secondary" },
                { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "پرداخت امن", desc: "درگاه‌های پرداخت معتبر", color: "emerald" },
                { icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z", label: "ضمانت اصالت", desc: "تضمین ۱۰۰٪ کالا", color: "indigo" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center group">
                  <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                    <div className="relative z-10 w-full h-full bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-all duration-500 group-hover:-translate-y-2 flex items-center justify-center">
                      <svg className="w-7 h-7 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white mb-1">{item.label}</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-5 max-w-[140px]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Category Description */}
          {category.description && (
            <div className="mt-16 bg-white/40 dark:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[3rem] p-10 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2 h-8 bg-primary-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)]" />
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                  درباره دسته‌بندی {category.title}
                </h2>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 leading-9 text-justify">
                {category.description}
              </p>
            </div>
          )}

        </div>
      </section>
    </div>
  );
}
