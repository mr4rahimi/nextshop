"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────

interface Platform {
  code: string;
  name: string;
  type: "ACCOUNTING" | "MARKETPLACE";
}

interface ShopProductMini {
  id: string;
  title: string;
  price: string | number;
  stock: number;
}

interface PlatformProduct {
  id: string;
  platformCode: string;
  platformProductId: string;
  title: string;
  sku: string | null;
  stock: number | null;
  price: number | null;
  purchasePrice: number | null;
  unit: string | null;
  lastFetchedAt: string;
  mappingStatus: "mapped" | "suggested" | "unmapped";
  mapping: {
    id: string;
    shopProduct: ShopProductMini;
  } | null;
  suggestion: {
    id: string;
    confidence: number;
    matchReason: string | null;
    shopProduct: ShopProductMini | null;
  } | null;
}

interface PlatformProductsResponse {
  items: PlatformProduct[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface MappingRecord {
  id: string;
  platformCode: string;
  platformProductId: string;
  platformTitle: string | null;
  createdAt: string;
  shopProduct: { id: string; title: string; price: string; stock: number; mainImage: string | null };
  platform: { name: string };
}

interface ShopSearchProduct {
  id: string;
  title: string;
  price: string | number;
  image: string | null;
}

// ── Status badge ──────────────────────────────────────────────────────

function StatusDot({ status }: { status: "mapped" | "suggested" | "unmapped" }) {
  if (status === "mapped")    return <span className="text-green-500 text-base" title="نگاشت شده">●</span>;
  if (status === "suggested") return <span className="text-amber-400 text-base" title="پیشنهاد در انتظار">●</span>;
  return <span className="text-red-400 text-base" title="بدون نگاشت">●</span>;
}

// ── Price formatter ───────────────────────────────────────────────────

function fmtPrice(p: number | string | null): string {
  if (p === null || p === undefined) return "—";
  const n = Number(p);
  return isNaN(n) ? "—" : n.toLocaleString("fa-IR") + " ﷼";
}

// ── Shop product search modal ─────────────────────────────────────────

function ShopSearchModal({
  platformProduct,
  onClose,
  onMap,
}: {
  platformProduct: PlatformProduct;
  onClose: () => void;
  onMap: (shopProductId: string, shopTitle: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ShopSearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapping, setMapping] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/products-search?q=${encodeURIComponent(q)}`);
        const data = await res.json() as ShopSearchProduct[];
        setResults(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q]);

  async function handleSelect(p: ShopSearchProduct) {
    setMapping(p.id);
    try {
      await onMap(p.id, p.title);
    } finally {
      setMapping(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-gray-900 dark:text-white text-sm">انتخاب محصول فروشگاه</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">×</button>
          </div>
          <p className="text-xs text-gray-500 mb-3 truncate">
            نگاشت برای: <span className="font-bold text-gray-700 dark:text-gray-300">{platformProduct.title}</span>
          </p>
          <input
            autoFocus
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی محصول فروشگاه..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-white/[0.04]">
          {loading && (
            <div className="p-6 text-center text-sm text-gray-400">جستجو...</div>
          )}
          {!loading && q && results.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">نتیجه‌ای یافت نشد</div>
          )}
          {!loading && !q && (
            <div className="p-6 text-center text-sm text-gray-400">نام محصول را تایپ کنید</div>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              disabled={mapping !== null}
              className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {p.image ? (
                <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.title}</p>
                <p className="text-xs text-gray-400">{fmtPrice(p.price)}</p>
              </div>
              {mapping === p.id && <span className="text-xs text-blue-500">در حال نگاشت...</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Platform product row ──────────────────────────────────────────────

function ProductRow({
  product,
  onApprove,
  onReject,
  onDelete,
  onOpenMap,
  actioning,
}: {
  product: PlatformProduct;
  onApprove: (suggestionId: string, productId: string) => void;
  onReject:  (suggestionId: string, productId: string) => void;
  onDelete:  (mappingId: string, productId: string) => void;
  onOpenMap: (product: PlatformProduct) => void;
  actioning: string | null;
}) {
  const isActioning = actioning === product.platformProductId;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
      {/* Status */}
      <div className="flex-shrink-0 w-5 text-center">
        <StatusDot status={product.mappingStatus} />
      </div>

      {/* Platform product info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{product.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">کد: {product.platformProductId}</span>
          {product.sku && <span className="text-xs text-gray-400">SKU: {product.sku}</span>}
          {product.stock !== null && (
            <span className="text-xs text-gray-400">موجودی: {product.stock}</span>
          )}
          {product.price !== null && (
            <span className="text-xs text-gray-400">قیمت: {fmtPrice(product.price)}</span>
          )}
        </div>
      </div>

      {/* Right side — actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {product.mappingStatus === "mapped" && product.mapping && (
          <>
            {/* Mapped shop product */}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-green-600 dark:text-green-400 truncate max-w-[140px]">
                {product.mapping.shopProduct.title}
              </p>
              <p className="text-xs text-gray-400">موجودی: {product.mapping.shopProduct.stock}</p>
            </div>
            <button
              onClick={() => onDelete(product.mapping!.id, product.platformProductId)}
              disabled={isActioning}
              className="text-xs text-red-400 hover:text-red-500 transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {isActioning ? "..." : "حذف"}
            </button>
          </>
        )}

        {product.mappingStatus === "suggested" && product.suggestion && (
          <>
            {/* Suggestion info */}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate max-w-[120px]">
                {product.suggestion.shopProduct?.title ?? "محصول ناشناس"}
              </p>
              <p className="text-xs text-gray-400">
                اطمینان: {Math.round(product.suggestion.confidence * 100)}٪
              </p>
            </div>
            <button
              onClick={() => onApprove(product.suggestion!.id, product.platformProductId)}
              disabled={isActioning}
              className="text-xs text-green-600 dark:text-green-400 font-bold px-2 py-1 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-40"
            >
              {isActioning ? "..." : "تأیید"}
            </button>
            <button
              onClick={() => onReject(product.suggestion!.id, product.platformProductId)}
              disabled={isActioning}
              className="text-xs text-red-400 hover:text-red-500 transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              رد
            </button>
          </>
        )}

        {product.mappingStatus === "unmapped" && (
          <button
            onClick={() => onOpenMap(product)}
            disabled={isActioning}
            className="text-xs text-blue-600 dark:text-blue-400 font-bold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            نگاشت کن
          </button>
        )}
      </div>
    </div>
  );
}

// ── Mapped tab ────────────────────────────────────────────────────────

function MappedTab({
  platforms,
}: {
  platforms: Platform[];
}) {
  const [mappings, setMappings] = useState<MappingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (p: number, pf: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p), perPage: "50" });
      if (pf) qs.set("platform", pf);
      const res = await fetch(`/api/integration/mapping?${qs}`);
      const data = await res.json() as { mappings: MappingRecord[]; total: number };
      setMappings(data.mappings ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page, platformFilter); }, [load, page, platformFilter]);

  async function handleDelete(id: string) {
    if (!confirm("این نگاشت حذف شود؟")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/integration/mapping?id=${id}`, { method: "DELETE" });
      setMappings((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => prev - 1);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setPlatformFilter(""); setPage(1); }}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${!platformFilter ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"}`}
        >
          همه
        </button>
        {platforms.map((pl) => (
          <button
            key={pl.code}
            onClick={() => { setPlatformFilter(pl.code); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${platformFilter === pl.code ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"}`}
          >
            {pl.name}
          </button>
        ))}
        <span className="text-xs text-gray-400 mr-2">{total} نگاشت</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-10 text-center text-sm text-gray-400">
          در حال بارگذاری...
        </div>
      ) : mappings.length === 0 ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-10 text-center text-sm text-gray-400">
          هنوز نگاشتی وجود ندارد
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {mappings.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{m.shopProduct.title}</p>
                  <p className="text-xs text-gray-400">موجودی: {m.shopProduct.stock}</p>
                </div>
                <span className="text-gray-300 dark:text-gray-600 flex-shrink-0">↔</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {m.platformTitle ?? m.platformProductId}
                  </p>
                  <p className="text-xs text-gray-400">{m.platform.name} · کد: {m.platformProductId}</p>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  className="text-xs text-red-400 hover:text-red-500 transition-colors flex-shrink-0 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {deletingId === m.id ? "..." : "حذف"}
                </button>
              </div>
            ))}
          </div>
          {total > 50 && (
            <div className="p-4 flex items-center justify-center gap-3 border-t border-gray-100 dark:border-white/[0.04]">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="text-xs text-gray-500">صفحه {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 50 >= total}
                className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Platform tab ──────────────────────────────────────────────────────

function PlatformTab({
  platform,
  onCountChange,
}: {
  platform: Platform;
  onCountChange: (mapped: number, suggested: number) => void;
}) {
  const [products, setProducts] = useState<PlatformProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "mapped" | "suggested" | "unmapped">("all");
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [mapTarget, setMapTarget] = useState<PlatformProduct | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(q), 350);
  }, [q]);

  const loadProducts = useCallback(async (p: number, search: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        platformCode: platform.code,
        page: String(p),
        pageSize: "50",
      });
      if (search) qs.set("q", search);
      const res = await fetch(`/api/integration/platform-products?${qs}`);
      if (!res.ok) return;
      const data = await res.json() as PlatformProductsResponse;
      setProducts(data.items ?? []);
      setTotal(data.total ?? 0);

      const mapped    = data.items.filter((i) => i.mappingStatus === "mapped").length;
      const suggested = data.items.filter((i) => i.mappingStatus === "suggested").length;
      onCountChange(mapped, suggested);
    } finally {
      setLoading(false);
    }
  }, [platform.code, onCountChange]);

  useEffect(() => {
    void loadProducts(page, debouncedQ);
  }, [loadProducts, page, debouncedQ]);

  async function handleFetch() {
    setFetching(true);
    setFetchMsg(null);
    try {
      const res = await fetch("/api/integration/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformCode: platform.code, type: "FETCH_PRODUCTS", priority: 1 }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      if (res.ok) {
        setFetchMsg(`در صف قرار گرفت (job: ${data.jobId?.slice(-6)}) — چند دقیقه صبر کنید، سپس صفحه را رفرش کنید`);
      } else {
        setFetchMsg(data.error ?? "خطا");
      }
    } finally {
      setFetching(false);
    }
  }

  async function handleApprove(suggestionId: string, platformProductId: string) {
    setActioning(platformProductId);
    try {
      const res = await fetch("/api/integration/mapping/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: suggestionId, action: "approve" }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.platformProductId === platformProductId
              ? { ...p, mappingStatus: "mapped", mapping: p.suggestion ? { id: suggestionId, shopProduct: p.suggestion.shopProduct! } : p.mapping, suggestion: null }
              : p
          )
        );
      }
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(suggestionId: string, platformProductId: string) {
    setActioning(platformProductId);
    try {
      const res = await fetch("/api/integration/mapping/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: suggestionId, action: "reject" }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.platformProductId === platformProductId
              ? { ...p, mappingStatus: "unmapped", suggestion: null }
              : p
          )
        );
      }
    } finally {
      setActioning(null);
    }
  }

  async function handleDelete(mappingId: string, platformProductId: string) {
    if (!confirm("این نگاشت حذف شود؟")) return;
    setActioning(platformProductId);
    try {
      const res = await fetch(`/api/integration/mapping?id=${mappingId}`, { method: "DELETE" });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.platformProductId === platformProductId
              ? { ...p, mappingStatus: "unmapped", mapping: null }
              : p
          )
        );
      }
    } finally {
      setActioning(null);
    }
  }

  async function handleMap(shopProductId: string, shopTitle: string) {
    if (!mapTarget) return;
    const res = await fetch("/api/integration/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopProductId,
        platformCode: platform.code,
        platformProductId: mapTarget.platformProductId,
        platformTitle: mapTarget.title,
      }),
    });
    const data = await res.json() as { error?: string; id?: string };
    if (!res.ok) {
      alert(data.error ?? "خطا در ایجاد نگاشت");
      return;
    }
    setProducts((prev) =>
      prev.map((p) =>
        p.platformProductId === mapTarget.platformProductId
          ? {
              ...p,
              mappingStatus: "mapped",
              mapping: { id: data.id!, shopProduct: { id: shopProductId, title: shopTitle, price: 0, stock: 0 } },
              suggestion: null,
            }
          : p
      )
    );
    setMapTarget(null);
  }

  const filtered = statusFilter === "all"
    ? products
    : products.filter((p) => p.mappingStatus === statusFilter);

  const mappedCount    = products.filter((p) => p.mappingStatus === "mapped").length;
  const suggestedCount = products.filter((p) => p.mappingStatus === "suggested").length;
  const unmappedCount  = products.filter((p) => p.mappingStatus === "unmapped").length;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex-1 w-full sm:max-w-xs">
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="جستجو در محصولات..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {fetchMsg && (
            <p className="text-xs text-blue-600 dark:text-blue-400 max-w-[200px] truncate" title={fetchMsg}>{fetchMsg}</p>
          )}
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {fetching ? "در حال ارسال..." : "دریافت محصولات"}
          </button>
        </div>
      </div>

      {/* Status filter pills */}
      {!loading && total > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "mapped", "suggested", "unmapped"] as const).map((s) => {
            const labels = {
              all:       `همه (${total})`,
              mapped:    `🟢 نگاشت شده (${mappedCount})`,
              suggested: `🟡 پیشنهاد (${suggestedCount})`,
              unmapped:  `🔴 بدون نگاشت (${unmappedCount})`,
            };
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === s
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                    : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                }`}
              >
                {labels[s]}
              </button>
            );
          })}
        </div>
      )}

      {/* Product list */}
      {loading ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-10 text-center text-sm text-gray-400">
          در حال بارگذاری...
        </div>
      ) : total === 0 ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-12 text-center">
          <p className="text-gray-400 text-sm">هنوز محصولی دریافت نشده</p>
          <p className="text-gray-400 text-xs mt-2">دکمه «دریافت محصولات» را بزنید تا همگام‌سازی شروع شود</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              موردی با این فیلتر یافت نشد
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {filtered.map((product) => (
                <ProductRow
                  key={product.platformProductId}
                  product={product}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDelete={handleDelete}
                  onOpenMap={setMapTarget}
                  actioning={actioning}
                />
              ))}
            </div>
          )}
          {total > 50 && (
            <div className="p-4 flex items-center justify-center gap-3 border-t border-gray-100 dark:border-white/[0.04]">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="text-xs text-gray-500">صفحه {page} از {Math.ceil(total / 50)}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 50 >= total || loading}
                className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual map modal */}
      {mapTarget && (
        <ShopSearchModal
          platformProduct={mapTarget}
          onClose={() => setMapTarget(null)}
          onMap={handleMap}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

interface Props {
  platforms: Platform[];
  initialMappingCount: number;
  initialSuggestionCount: number;
}

export default function MappingPageClient({ platforms, initialMappingCount, initialSuggestionCount }: Props) {
  const [activeTab, setActiveTab] = useState<string>(platforms[0]?.code ?? "mapped");
  const [mappingCount, setMappingCount] = useState(initialMappingCount);
  const [suggestionCount, setSuggestionCount] = useState(initialSuggestionCount);

  // Update counts when a platform tab reports changes
  function handlePlatformCounts(_mapped: number, suggested: number) {
    setSuggestionCount(suggested);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">نگاشت محصولات</h1>
          <p className="text-sm text-gray-500 mt-1">ارتباط محصولات فروشگاه با سیستم‌های خارجی</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4">
          <p className="text-2xl font-black text-gray-900 dark:text-white">{mappingCount}</p>
          <p className="text-xs text-gray-500 mt-1">نگاشت فعال</p>
        </div>
        <div className={`bg-white dark:bg-[#0f1117] rounded-2xl border p-4 transition-colors ${
          suggestionCount > 0
            ? "border-amber-200 dark:border-amber-500/20"
            : "border-gray-200 dark:border-white/[0.06]"
        }`}>
          <p className={`text-2xl font-black ${suggestionCount > 0 ? "text-amber-500" : "text-gray-900 dark:text-white"}`}>
            {suggestionCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">پیشنهاد در انتظار</p>
        </div>
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4">
          <p className="text-2xl font-black text-gray-900 dark:text-white">{platforms.length}</p>
          <p className="text-xs text-gray-500 mt-1">پلتفرم متصل</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="text-green-500">●</span> نگاشت شده</span>
        <span className="flex items-center gap-1.5"><span className="text-amber-400">●</span> پیشنهاد سیستم — نیاز به تأیید</span>
        <span className="flex items-center gap-1.5"><span className="text-red-400">●</span> بدون نگاشت</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-white/[0.06]">
        {platforms.map((pl) => (
          <button
            key={pl.code}
            onClick={() => setActiveTab(pl.code)}
            className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${
              activeTab === pl.code
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {pl.name}
          </button>
        ))}
        <button
          onClick={() => setActiveTab("mapped")}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${
            activeTab === "mapped"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          نگاشت‌های تأیید‌شده
        </button>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "mapped" ? (
          <MappedTab platforms={platforms} />
        ) : (
          platforms.map((pl) =>
            activeTab === pl.code ? (
              <PlatformTab
                key={pl.code}
                platform={pl}
                onCountChange={handlePlatformCounts}
              />
            ) : null
          )
        )}
      </div>
    </div>
  );
}
