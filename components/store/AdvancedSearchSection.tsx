"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RootCategory {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
}

interface SubCategory {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
}

interface Brand {
  id: string;
  title: string;
  slug: string;
  logoUrl: string | null;
}

interface AttrValue {
  id: string;
  value: string;
}

interface Attribute {
  id: string;
  title: string;
  values: AttrValue[];
}

interface AttributeGroup {
  id: string;
  title: string;
  attributes: Attribute[];
}

interface Product {
  id: string;
  title: string;
  slug: string;
  image: string | null;
  price: string;
  salePrice: string | null;
  ratingAvg: number;
  ratingCount: number;
  stock: number;
  trackStock: boolean;
  brand: { title: string; slug: string } | null;
}

interface Config {
  heading?: string;
  subheading?: string;
  accentColor?: string;
  categoryIds?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fa(n: number) {
  return Math.round(n).toLocaleString("fa-IR");
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ p, accent }: { p: Product; accent: string }) {
  const price = Number(p.price);
  const sale = p.salePrice ? Number(p.salePrice) : null;
  const display = sale ?? price;
  const discount = sale && price > 0 ? Math.round((1 - sale / price) * 100) : null;
  const outOfStock = p.trackStock && p.stock <= 0;

  return (
    <Link
      href={`/products/${p.slug}`}
      className="group bg-white dark:bg-gray-900 rounded-2xl overflow-hidden flex flex-col border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-square bg-gray-50 dark:bg-gray-800 overflow-hidden">
        {p.image ? (
          <img src={p.image} alt={p.title} className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📦</div>
        )}
        {discount !== null && discount > 0 && (
          <span className="absolute top-2 right-2 text-white text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: accent }}>
            {fa(discount)}٪
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-black/60 text-white text-xs font-bold px-3 py-1 rounded-full">ناموجود</span>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-[13px] font-bold text-gray-800 dark:text-white line-clamp-2 leading-relaxed flex-1">{p.title}</p>
        {p.brand && <p className="text-[11px] text-gray-400">{p.brand.title}</p>}
        <div className="flex flex-col mt-auto gap-0.5">
          {sale !== null && <span className="text-[11px] text-gray-400 line-through">{fa(price)} تومان</span>}
          <span className="text-sm font-black" style={{ color: accent }}>
            {fa(display)} <span className="text-[11px] text-gray-400 font-normal">تومان</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-pulse">
      <div className="aspect-square bg-gray-100 dark:bg-gray-800" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mt-2" />
      </div>
    </div>
  );
}

function CategoryCard({ cat, selected, accent, onClick }: {
  cat: RootCategory | SubCategory; selected: boolean; accent: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer min-w-[80px] md:min-w-[96px]"
      style={{
        borderColor: selected ? accent : "transparent",
        background: selected ? `${accent}12` : "rgba(0,0,0,0.03)",
      }}
    >
      <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl overflow-hidden flex items-center justify-center text-2xl"
        style={{ background: selected ? `${accent}20` : "#f3f4f6" }}>
        {cat.imageUrl
          ? <img src={cat.imageUrl} alt={cat.title} className="w-full h-full object-cover" />
          : <span>🗂️</span>}
      </div>
      <span className="text-[11px] md:text-xs font-bold text-center leading-tight" style={{ color: selected ? accent : undefined }}>
        {cat.title}
      </span>
      {selected && <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />}
    </button>
  );
}

function Chip({ label, selected, accent, onClick }: {
  label: string; selected: boolean; accent: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-150"
      style={{
        background: selected ? accent : "transparent",
        borderColor: selected ? accent : "#d1d5db",
        color: selected ? "#fff" : undefined,
      }}
    >
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdvancedSearchSection({ config }: { config: Config }) {
  const {
    heading = "جستجوی پیشرفته",
    subheading = "محصول مورد نظر خود را سریع‌تر پیدا کنید",
    accentColor = "#4f46e5",
    categoryIds = [],
  } = config;

  // ── State ──
  const [rootCats, setRootCats] = useState<RootCategory[]>([]);
  const [selectedRoot, setSelectedRoot] = useState<RootCategory | null>(null);

  const [subcats, setSubcats] = useState<SubCategory[]>([]);
  const [selectedSubcat, setSelectedSubcat] = useState<SubCategory | null>(null);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  // Filterable attribute groups from CategoryAttributeGroup
  // Record<attributeId, string[]> — array of selected attributeValueIds
  const [attrGroups, setAttrGroups] = useState<AttributeGroup[]>([]);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [metaLoading, setMetaLoading] = useState(false);
  const [results, setResults] = useState<Product[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // ── Load root categories on mount ──
  useEffect(() => {
    const rootParam = categoryIds.length > 0 ? `&rootIds=${categoryIds.join(",")}` : "";
    fetch(`/api/store/search-meta?init=1${rootParam}`)
      .then((r) => r.json())
      .then((d) => setRootCats(d.rootCategories ?? []));
  }, [categoryIds.join(",")]);

  // ── Load meta (subcats, brands, attr groups) for a category ──
  const loadMeta = useCallback((catId: string) => {
    setMetaLoading(true);
    setSubcats([]);
    setBrands([]);
    setAttrGroups([]);
    setSelectedSubcat(null);
    setSelectedBrand(null);
    setSelectedAttrs({});
    setExpandedGroups(new Set());
    setResults(null);
    setSearched(false);

    fetch(`/api/store/search-meta?categoryId=${catId}`)
      .then((r) => r.json())
      .then((d) => {
        setSubcats(d.subcategories ?? []);
        setBrands(d.brands ?? []);
        setAttrGroups(d.attributeGroups ?? []);
        setExpandedGroups(new Set((d.attributeGroups ?? []).map((g: AttributeGroup) => g.id)));
      })
      .finally(() => setMetaLoading(false));
  }, []);

  const handleRootSelect = (cat: RootCategory) => {
    if (selectedRoot?.id === cat.id) return;
    setSelectedRoot(cat);
    loadMeta(cat.id);
  };

  const handleSubcatSelect = (sub: SubCategory | null) => {
    setSelectedSubcat(sub);
    setSelectedBrand(null);
    setSelectedAttrs({});
    setResults(null);
    setSearched(false);

    const targetId = sub?.id ?? selectedRoot?.id;
    if (!targetId) return;
    setMetaLoading(true);
    fetch(`/api/store/search-meta?categoryId=${targetId}`)
      .then((r) => r.json())
      .then((d) => {
        setBrands(d.brands ?? []);
        setAttrGroups(d.attributeGroups ?? []);
        setExpandedGroups(new Set((d.attributeGroups ?? []).map((g: AttributeGroup) => g.id)));
      })
      .finally(() => setMetaLoading(false));
  };

  // ── Toggle attribute value ──
  const toggleAttr = (attrId: string, valueId: string) => {
    setSelectedAttrs((prev) => {
      const cur = prev[attrId] ?? [];
      const next = cur.includes(valueId) ? cur.filter((v) => v !== valueId) : [...cur, valueId];
      return { ...prev, [attrId]: next };
    });
  };

  const totalAttrCount = Object.values(selectedAttrs).reduce((acc, arr) => acc + arr.length, 0);

  // ── Build "show all" URL ──
  const buildShowAllUrl = () => {
    const catSlug = selectedSubcat?.slug ?? selectedRoot?.slug;
    const parts: string[] = [];
    if (catSlug) parts.push(`category=${encodeURIComponent(catSlug)}`);
    if (selectedBrand) parts.push(`brand=${encodeURIComponent(selectedBrand.slug)}`);
    Object.values(selectedAttrs).flat().forEach((v) => parts.push(`attr=${encodeURIComponent(v)}`));
    return `/products?${parts.join("&")}`;
  };

  // ── Search ──
  const handleSearch = async () => {
    const catId = selectedSubcat?.id ?? selectedRoot?.id;
    if (!catId) return;
    setSearching(true);
    setSearched(true);
    setResults(null);

    const params = new URLSearchParams();
    params.set("categoryId", catId);
    params.set("pageSize", "4");
    if (selectedBrand) params.set("brandId", selectedBrand.id);
    Object.values(selectedAttrs).flat().forEach((v) => params.append("attr", v));

    try {
      const data = await fetch(`/api/store/search-results?${params.toString()}`).then((r) => r.json());
      setResults(data.items ?? []);
      setTotalCount(data.total ?? 0);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleReset = () => {
    setSelectedRoot(null);
    setSelectedSubcat(null);
    setSelectedBrand(null);
    setSelectedAttrs({});
    setSubcats([]);
    setBrands([]);
    setAttrGroups([]);
    setResults(null);
    setSearched(false);
    setExpandedGroups(new Set());
  };

  const hasFilters = !!selectedSubcat || !!selectedBrand || totalAttrCount > 0;
  const filterCount = (selectedSubcat ? 1 : 0) + (selectedBrand ? 1 : 0) + totalAttrCount;
  const phase = selectedRoot ? "filter" : "category";

  return (
    <section className="py-10 lg:py-16" dir="rtl">
      <div className="container">

        {/* ── Header ── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-3"
            style={{ background: `${accentColor}15`, color: accentColor }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            جستجوی پیشرفته
          </div>
          <h2 className="text-xl lg:text-2xl font-black text-gray-900 dark:text-white">{heading}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subheading}</p>
        </div>

        {/* ── Main Card ── */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-800">

          {/* ── Step 1: Category ── */}
          <div className="p-5 lg:p-7 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                  style={{ background: accentColor }}>۱</div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">انتخاب دسته‌بندی</span>
              </div>
              {selectedRoot && (
                <button onClick={handleReset}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  شروع مجدد
                </button>
              )}
            </div>

            {rootCats.length === 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex-shrink-0 w-[80px] h-[104px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {rootCats.map((cat) => (
                  <CategoryCard key={cat.id} cat={cat}
                    selected={selectedRoot?.id === cat.id} accent={accentColor}
                    onClick={() => handleRootSelect(cat)} />
                ))}
              </div>
            )}
          </div>

          {/* ── Steps 2+: Filters (slides in) ── */}
          <div className="overflow-hidden transition-all duration-500"
            style={{ maxHeight: phase === "filter" ? "3000px" : "0", opacity: phase === "filter" ? 1 : 0 }}>

            {/* Subcategories */}
            {subcats.length > 0 && (
              <div className="px-5 lg:px-7 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                    style={{ background: accentColor }}>۲</div>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">زیردسته</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip label="همه" selected={!selectedSubcat} accent={accentColor}
                    onClick={() => handleSubcatSelect(null)} />
                  {subcats.map((sub) => (
                    <Chip key={sub.id} label={sub.title}
                      selected={selectedSubcat?.id === sub.id} accent={accentColor}
                      onClick={() => handleSubcatSelect(sub)} />
                  ))}
                </div>
              </div>
            )}

            {/* Brands */}
            {brands.length > 0 && (
              <div className="px-5 lg:px-7 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                      style={{ background: accentColor }}>
                      {subcats.length > 0 ? "۳" : "۲"}
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">برند</span>
                  </div>
                  {selectedBrand && (
                    <button onClick={() => setSelectedBrand(null)}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors">پاک کردن</button>
                  )}
                </div>
                {metaLoading ? (
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="h-7 w-16 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />)}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {brands.map((b) => (
                      <button key={b.id}
                        onClick={() => setSelectedBrand(selectedBrand?.id === b.id ? null : b)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                        style={{
                          background: selectedBrand?.id === b.id ? accentColor : "transparent",
                          borderColor: selectedBrand?.id === b.id ? accentColor : "#d1d5db",
                          color: selectedBrand?.id === b.id ? "#fff" : undefined,
                        }}>
                        {b.logoUrl && <img src={b.logoUrl} alt={b.title} className="w-4 h-4 object-contain" />}
                        {b.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Attribute Groups (filterable) */}
            {(attrGroups.length > 0 || metaLoading) && (
              <div className="px-5 lg:px-7 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                      style={{ background: accentColor }}>
                      {subcats.length > 0 && brands.length > 0 ? "۴" : subcats.length > 0 || brands.length > 0 ? "۳" : "۲"}
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">ویژگی‌ها</span>
                  </div>
                  {totalAttrCount > 0 && (
                    <button onClick={() => setSelectedAttrs({})}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors">
                      پاک کردن ({fa(totalAttrCount)})
                    </button>
                  )}
                </div>

                {metaLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {attrGroups.map((group) => (
                      <div key={group.id}>
                        {/* Group title */}
                        {attrGroups.length > 1 && (
                          <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2 px-1">{group.title}</p>
                        )}
                        {group.attributes.map((attr) => (
                          <div key={attr.id} className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden mb-2">
                            {/* Attribute header */}
                            <button
                              onClick={() => setExpandedGroups((prev) => {
                                const next = new Set(prev);
                                next.has(attr.id) ? next.delete(attr.id) : next.add(attr.id);
                                return next;
                              })}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              <span>{attr.title}</span>
                              <div className="flex items-center gap-1.5">
                                {(selectedAttrs[attr.id]?.length ?? 0) > 0 && (
                                  <span className="text-[10px] text-white px-1.5 py-0.5 rounded-full font-black"
                                    style={{ background: accentColor }}>
                                    {fa(selectedAttrs[attr.id].length)}
                                  </span>
                                )}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                  style={{ transform: expandedGroups.has(attr.id) ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>
                                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            </button>

                            {/* Attribute values */}
                            {expandedGroups.has(attr.id) && (
                              <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5">
                                {attr.values.map((val) => {
                                  const sel = selectedAttrs[attr.id]?.includes(val.id) ?? false;
                                  return (
                                    <button key={val.id}
                                      onClick={() => toggleAttr(attr.id, val.id)}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
                                      style={{
                                        background: sel ? accentColor : "transparent",
                                        borderColor: sel ? accentColor : "#e5e7eb",
                                        color: sel ? "#fff" : undefined,
                                      }}>
                                      {val.value}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Search Button ── */}
            <div className="px-5 lg:px-7 py-4 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
              <button
                onClick={handleSearch}
                disabled={!selectedRoot || searching}
                className="flex-1 md:flex-none md:px-10 py-3 rounded-2xl text-white font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 4px 15px ${accentColor}40` }}
              >
                {searching ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="15" />
                    </svg>
                    در حال جستجو...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2.5" />
                      <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    جستجو
                    {filterCount > 0 && (
                      <span className="bg-white/25 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                        {fa(filterCount)} فیلتر
                      </span>
                    )}
                  </>
                )}
              </button>

              {hasFilters && (
                <button
                  onClick={() => { setSelectedSubcat(null); setSelectedBrand(null); setSelectedAttrs({}); setResults(null); setSearched(false); if (selectedRoot) loadMeta(selectedRoot.id); }}
                  className="px-4 py-3 rounded-2xl text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-red-300 hover:text-red-500 transition-all"
                >
                  پاک کردن فیلترها
                </button>
              )}
            </div>
          </div>

          {/* ── Results ── */}
          {(searched || searching) && (
            <div className="border-t border-gray-100 dark:border-gray-800 p-5 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: accentColor }}>
                    <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm font-bold text-gray-800 dark:text-white">
                    {searching ? "در حال جستجو..." : (
                      <><span style={{ color: accentColor }}>{fa(totalCount)}</span> محصول یافت شد</>
                    )}
                  </span>
                </div>
                {!searching && totalCount > 4 && (
                  <Link href={buildShowAllUrl()} className="text-xs font-bold flex items-center gap-1 transition-colors"
                    style={{ color: accentColor }}>
                    مشاهده همه
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                )}
              </div>

              {searching ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
                  {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
                </div>
              ) : results && results.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
                    {results.map((p) => <ProductCard key={p.id} p={p} accent={accentColor} />)}
                  </div>
                  {totalCount > 4 && (
                    <div className="mt-6 text-center">
                      <Link href={buildShowAllUrl()}
                        className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl text-white text-sm font-black transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                        style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`, boxShadow: `0 4px 15px ${accentColor}30` }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        مشاهده همه {fa(totalCount)} محصول
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🔍</div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-bold">محصولی با این مشخصات پیدا نشد</p>
                  <p className="text-gray-400 text-xs mt-1">فیلترها را تغییر دهید و دوباره جستجو کنید</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
