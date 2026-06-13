"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  salePrice?: number;
  mainImage?: string;
  isActive: boolean;
  stock?: number;
  trackStock?: boolean;
  lowStockThreshold?: number;
  category?: { title: string };
  brand?: { title: string };
  attributes?: { attributeValueId: string }[];
  createdAt: string;
}

const PAGE_SIZE = 50;

function toFa(n: number) { return n.toLocaleString("fa-IR"); }

export default function ProductsListPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [attributeGroups, setAttributeGroups] = useState<any[]>([]);
  const [selectedAttributeValues, setSelectedAttributeValues] = useState<string[]>([]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  // آمار کلی (مستقل از فیلترها)
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, outofstock: 0 });

  // ── دیتای اولیه: دسته‌بندی‌ها، برندها، آمار ──────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/categories").then(r => r.json()).then(setCategories).catch(() => {});
    fetch("/api/admin/brands").then(r => r.json()).then(setBrands).catch(() => {});

    Promise.all([
      fetch("/api/admin/products?pageSize=1").then(r => r.json()),
      fetch("/api/admin/products?pageSize=1&status=active").then(r => r.json()),
      fetch("/api/admin/products?pageSize=1&status=inactive").then(r => r.json()),
      fetch("/api/admin/products?pageSize=1&status=outofstock").then(r => r.json()),
    ]).then(([all, active, inactive, outofstock]) => {
      setStats({
        total: all.total ?? 0,
        active: active.total ?? 0,
        inactive: inactive.total ?? 0,
        outofstock: outofstock.total ?? 0,
      });
    }).catch(() => {});
  }, []);

  // ── debounce جستجو ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── دریافت گروه‌های ویژگی بر اساس دسته‌بندی انتخاب‌شده ───────────────────────
  useEffect(() => {
    if (!filterCategory) {
      setAttributeGroups([]);
      setSelectedAttributeValues([]);
      return;
    }
    const selectedCat = categories.find(c => c.title === filterCategory);
    if (!selectedCat) return;
    fetch(`/api/admin/categories/${selectedCat.id}/attribute-groups`)
      .then(r => r.json())
      .then(setAttributeGroups)
      .catch(() => setAttributeGroups([]));
  }, [filterCategory, categories]);

  // ── دریافت محصولات (صفحه‌بندی‌شده) ───────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterCategory) params.set("category", filterCategory);
      if (filterBrand) params.set("brand", filterBrand);
      if (filterStatus) params.set("status", filterStatus);
      selectedAttributeValues.forEach(v => params.append("attr", v));

      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();
      setProducts(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterCategory, filterBrand, filterStatus, selectedAttributeValues]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // وقتی فیلتر/جستجو تغییر کرد، برگرد به صفحه ۱
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCategory, filterBrand, filterStatus, selectedAttributeValues]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      setProducts(prev => prev.filter(p => p.id !== id));
      setTotal(t => Math.max(0, t - 1));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function handleDuplicate(id: string) {
    setDuplicatingId(id);
    try {
      const res = await fetch("/api/admin/products/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.id) router.push(`/admin/products/${data.id}`);
    } finally {
      setDuplicatingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setFilterCategory("");
    setFilterBrand("");
    setFilterStatus("");
    setSelectedAttributeValues([]);
  }

  const hasFilters = !!(search || filterCategory || filterBrand || filterStatus || selectedAttributeValues.length > 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      {/* مودال حذف */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 dark:text-white mb-2">حذف محصول</h3>
            <p className="text-sm text-gray-500 mb-6">این عملیات برگشت‌پذیر نیست. مطمئنید؟</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-black transition-all">
                انصراف
              </button>
              <button onClick={() => handleDelete(confirmId)} disabled={!!deletingId}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all">
                {deletingId ? "در حال حذف..." : "حذف کن"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* هدر */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">مدیریت محصولات</h1>
          <p className="text-xs text-gray-500 mt-0.5">{toFa(stats.total)} محصول در سیستم</p>
        </div>
        <button
          onClick={() => router.push("/admin/products/create")}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-500/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          محصول جدید
        </button>
      </div>

      {/* آمار */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "کل محصولات", value: stats.total, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10" },
          { label: "فعال", value: stats.active, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
          { label: "غیرفعال", value: stats.inactive, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10" },
          { label: "ناموجود", value: stats.outofstock, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <span className={`text-lg font-black ${stat.color}`}>{toFa(stat.value)}</span>
            </div>
            <span className="text-xs font-bold text-gray-500">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* فیلترها */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* جستجو */}
          <div className="relative md:col-span-2">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="جستجو در عنوان، slug، دسته‌بندی، برند..."
              className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* فیلتر دسته‌بندی */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">همه دسته‌بندی‌ها</option>
            {categories.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
          </select>

          {/* فیلتر برند */}
          <select
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">همه برندها</option>
            {brands.map(b => <option key={b.id} value={b.title}>{b.title}</option>)}
          </select>
        </div>

        {/* فیلتر وضعیت */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {[
            { value: "", label: "همه" },
            { value: "active", label: "فعال" },
            { value: "inactive", label: "غیرفعال" },
            { value: "outofstock", label: "ناموجود" },
          ].map(f => (
            <button key={f.value} onClick={() => setFilterStatus(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                filterStatus === f.value
                  ? "bg-blue-600 text-white shadow shadow-blue-500/20"
                  : "bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}>
              {f.label}
            </button>
          ))}
          {hasFilters && (
            <button onClick={clearFilters}
              className="px-3 py-1.5 rounded-lg text-xs font-black text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all mr-auto">
              پاک کردن فیلترها
            </button>
          )}
        </div>

        {/* فیلتر ویژگی‌ها */}
        {attributeGroups.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
            <p className="text-xs font-black text-gray-500 mb-2">فیلتر با ویژگی‌ها:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {attributeGroups.map(group => (
                <div key={group.id}>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">
                    {group.attributeGroup.title}
                  </label>
                  {group.attributeGroup.attributes.map((attr: any) => (
                    <select
                      key={attr.id}
                      value={selectedAttributeValues.find(v =>
                        attr.values.some((val: any) => val.id === v)
                      ) || ""}
                      onChange={e => {
                        const newValue = e.target.value;
                        setSelectedAttributeValues(prev => {
                          const filtered = prev.filter(v =>
                            !attr.values.some((val: any) => val.id === v)
                          );
                          return newValue ? [...filtered, newValue] : filtered;
                        });
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all mb-2"
                    >
                      <option value="">{attr.title}: همه</option>
                      {attr.values.map((val: any) => (
                        <option key={val.id} value={val.id}>
                          {val.value}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* جدول */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        {/* هدر جدول */}
        <div className="hidden lg:grid grid-cols-[56px_1fr_140px_120px_90px_160px] gap-3 px-5 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/[0.06]">
          {["", "محصول", "دسته / برند", "قیمت", "وضعیت", "عملیات"].map(h => (
            <div key={h} className="text-[11px] font-black text-gray-400">{h}</div>
          ))}
        </div>

        {/* لودینگ */}
        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">در حال بارگذاری...</div>
        )}

        {/* خالی */}
        {!loading && products.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-400">
              {hasFilters ? "محصولی با این فیلترها یافت نشد" : "هنوز محصولی ثبت نشده"}
            </p>
            {!hasFilters && (
              <button onClick={() => router.push("/admin/products/create")}
                className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all">
                اولین محصول را ایجاد کنید
              </button>
            )}
          </div>
        )}

        {/* ردیف‌ها */}
        {!loading && products.map((p, idx) => (
          <div key={p.id}
            className={`group flex lg:grid lg:grid-cols-[56px_1fr_140px_120px_90px_160px] gap-3 px-5 py-3.5 items-center transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] ${
              idx < products.length - 1 ? "border-b border-gray-50 dark:border-white/[0.04]" : ""
            }`}>

            {/* تصویر */}
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/[0.06] flex-shrink-0 flex items-center justify-center">
              {p.mainImage ? (
                <img src={p.mainImage} alt={p.title} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>

            {/* عنوان */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 dark:text-white truncate">{p.title}</p>
              <p className="text-[11px] text-gray-400 truncate" dir="ltr">/{p.slug}</p>
              {p.trackStock && p.stock === 0 && (
                <span className="text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-md">ناموجود</span>
              )}
            </div>

            {/* دسته / برند */}
            <div className="hidden lg:block">
              {p.category && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 block w-fit mb-1">
                  {p.category.title}
                </span>
              )}
              {p.brand && <p className="text-[11px] text-gray-400">{p.brand.title}</p>}
            </div>

            {/* قیمت */}
            <div className="hidden lg:block">
              <p className="text-sm font-black text-gray-900 dark:text-white" dir="ltr">{toFa(Number(p.price))}</p>
              {p.salePrice && (
                <p className="text-[11px] text-emerald-500" dir="ltr">{toFa(Number(p.salePrice))}</p>
              )}
            </div>

            {/* وضعیت */}
            <div className="hidden lg:block">
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
                p.isActive
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                  : "bg-gray-50 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10"
              }`}>
                {p.isActive ? "فعال" : "غیرفعال"}
              </span>
            </div>

            {/* عملیات */}
            <div className="flex gap-1.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
              {/* ویرایش */}
              <button onClick={() => router.push(`/admin/products/${p.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-black text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                ویرایش
              </button>

              {/* کپی */}
              <button onClick={() => handleDuplicate(p.id)} disabled={duplicatingId === p.id}
                title="کپی محصول"
                className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-amber-500 hover:border-amber-300 dark:hover:border-amber-500/30 disabled:opacity-50 transition-all">
                {duplicatingId === p.id ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>

              {/* حذف */}
              <button onClick={() => setConfirmId(p.id)} disabled={!!deletingId}
                className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-500/30 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* صفحه‌بندی */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-gray-400">
            نمایش {toFa((page - 1) * PAGE_SIZE + 1)} تا {toFa(Math.min(page * PAGE_SIZE, total))} از {toFa(total)} محصول
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
              قبلی
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, i, arr) => (
                <span key={p} className="flex items-center gap-1.5">
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="text-gray-400 text-xs px-1">...</span>}
                  <button onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                      p === page
                        ? "bg-blue-600 text-white shadow shadow-blue-500/20"
                        : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
                    }`}>
                    {toFa(p)}
                  </button>
                </span>
              ))}

            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
              بعدی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}