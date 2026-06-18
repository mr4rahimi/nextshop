"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Product {
  id: string; title: string; slug: string;
  price: string; salePrice: string | null;
  mainImage: string | null; images: { url: string }[];
  brand: { title: string } | null;
  category: { title: string; slug: string } | null;
  stock?: number;
  trackStock?: boolean;
  lowStockThreshold?: number;
}
interface SearchData { products: Product[]; total: number; }

function toFa(n: number | string) { return Number(n).toLocaleString("fa-IR"); }

const PAGE_SIZE = 24;

interface Props {
  initialQ: string;
  initialPage: number;
  initialData: SearchData;
}

export default function SearchPageClient({ initialQ, initialPage, initialData }: Props) {
  const router = useRouter();
  const [q, setQ]               = useState(initialQ);
  const [inputVal, setInputVal]  = useState(initialQ);
  const [products, setProducts]  = useState<Product[]>(initialData.products);
  const [total, setTotal]        = useState(initialData.total);
  const [page, setPage]          = useState(initialPage);
  const [loading, setLoading]    = useState(false);
  const [initialized, setInitialized] = useState(true);

  const doSearch = useCallback(async (query: string, p: number) => {
    if (!query || query.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${p}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setProducts([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialized) { doSearch(q, page); }
    else setInitialized(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = inputVal.trim();
    if (!term) return;
    setQ(term); setPage(1);
    router.replace(`/search?q=${encodeURIComponent(term)}`, { scroll: false });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen" dir="rtl">
      {}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-white/5 sticky top-[80px] z-30">
        <div className="container py-4">
          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
            <div className="relative flex-1">
              <input type="text" value={inputVal} onChange={e => setInputVal(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-2xl py-3.5 pr-12 pl-4 text-sm outline-none focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-white"
                placeholder="جستجو در محصولات..." autoFocus />
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5} />
              </svg>
            </div>
            <button type="submit" className="px-6 py-3.5 bg-primary-600 text-white rounded-2xl text-sm font-black hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20">
              جستجو
            </button>
          </form>
        </div>
      </div>

      <div className="container py-8">
        {q && !loading && (
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-black text-gray-900 dark:text-white">
                نتایج «<span className="text-primary-600">{q}</span>»
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">{toFa(total)} محصول</p>
            </div>
            {totalPages > 1 && <span className="text-sm text-gray-400">صفحه {toFa(page)} از {toFa(totalPages)}</span>}
          </div>
        )}

        {/* loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-100 dark:bg-gray-800" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {}
        {!loading && q && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
            <svg className="w-20 h-20 opacity-20 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h2 className="text-xl font-black text-gray-700 dark:text-gray-300 mb-2">نتیجه‌ای یافت نشد</h2>
            <p className="text-sm mb-8">عبارت «{q}» با هیچ محصولی مطابقت ندارد</p>
            <Link href="/products" className="px-6 py-3 bg-primary-600 text-white rounded-2xl text-sm font-black hover:bg-primary-700 transition-all">
              مشاهده همه محصولات
            </Link>
          </div>
        )}

        {}
        {!loading && products.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {products.map(p => {
                const img   = p.mainImage ?? p.images[0]?.url ?? null;
                const price = Number(p.salePrice ?? p.price);
                const orig  = Number(p.price);
                const disc  = p.salePrice && Number(p.salePrice) < orig ? Math.round(((orig - price) / orig) * 100) : 0;
                return (
                  <Link key={p.id} href={`/products/${p.slug}`}
                    className="group bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
                    <div className="relative aspect-square bg-gray-50 dark:bg-gray-800 overflow-hidden">
                      {img
                        ? <img src={img} alt={p.title} className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center"><svg className="w-12 h-12 text-gray-200 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                      }
                      {disc > 0 && (
                        <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-xl shadow">
                          {toFa(disc)}٪
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 p-4 flex-1">
                      <p className="text-xs font-black text-gray-800 dark:text-white line-clamp-2 leading-relaxed">{p.title}</p>
                      {p.brand && <span className="text-[10px] text-gray-400">{p.brand.title}</span>}
                      <div className="mt-auto pt-2">
                        {disc > 0 && <span className="block text-[10px] text-gray-400 line-through tabular-nums">{toFa(orig)} تومان</span>}
                        {p.trackStock && p.stock === 0 ? (
                          <span className="text-sm font-black text-secondary-500">ناموجود</span>
                        ) : (
                          <span className="text-sm font-black text-primary-600 dark:text-primary-400 tabular-nums">{toFa(price)} تومان</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10 flex-wrap">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg = i + 1;
                  if (totalPages > 5) {
                    if (page <= 3) pg = i + 1;
                    else if (page >= totalPages - 2) pg = totalPages - 4 + i;
                    else pg = page - 2 + i;
                  }
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${page === pg ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20" : "border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                      {toFa(pg)}
                    </button>
                  );
                })}

                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
