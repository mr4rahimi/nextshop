"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────

interface Platform {
  code: string;
  name: string;
  type: "ACCOUNTING" | "MARKETPLACE";
}

interface ShopProduct {
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
  mappingId: string | null;
  mappingLinkId: string | null;
  shopProduct: ShopProduct | null;
  allLinks: { id: string; platformCode: string; externalId: string; externalTitle: string | null }[];
  suggestion: {
    id: string;
    confidence: number;
    matchReason: string | null;
    shopProduct: ShopProduct | null;
  } | null;
}

interface MappingGroup {
  id: string;
  notes: string | null;
  createdAt: string;
  links: {
    id: string;
    platformCode: string;
    externalId: string;
    externalTitle: string | null;
    shopProduct: ShopProduct & { mainImage?: string | null } | null;
  }[];
}

interface ShopSearchResult {
  id: string;
  title: string;
  price: string | number;
  image: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────

function fmtPrice(p: number | string | null | undefined): string {
  if (p == null) return "—";
  const n = Number(p);
  return isNaN(n) ? "—" : n.toLocaleString("fa-IR") + " ﷼";
}

function StatusDot({ status }: { status: "mapped" | "suggested" | "unmapped" }) {
  if (status === "mapped")    return <span className="text-green-500" title="نگاشت شده">●</span>;
  if (status === "suggested") return <span className="text-amber-400" title="پیشنهاد">●</span>;
  return <span className="text-red-400" title="بدون نگاشت">●</span>;
}

const PLATFORM_NAMES: Record<string, string> = {
  shop:    "فروشگاه",
  hesaban: "وب‌حسابان",
  basalam: "باسلام",
};

function platformName(code: string, platforms: Platform[]): string {
  return platforms.find((p) => p.code === code)?.name ?? PLATFORM_NAMES[code] ?? code;
}

// ── Shop product search ───────────────────────────────────────────────

function useShopSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ShopSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/products-search?q=${encodeURIComponent(q)}`);
        const data = await res.json() as ShopSearchResult[];
        setResults(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q]);

  return { q, setQ, results, loading, reset: () => { setQ(""); setResults([]); } };
}

// ── Platform product search (from IntegPlatformProduct) ──────────────

function usePlatformSearch(platformCode: string) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ platformProductId: string; title: string; sku: string | null; stock: number | null; price: number | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/integration/platform-products?platformCode=${encodeURIComponent(platformCode)}&q=${encodeURIComponent(q)}&pageSize=20`);
        const data = await res.json() as { items: PlatformProduct[] };
        setResults(data.items?.map((i) => ({
          platformProductId: i.platformProductId,
          title: i.title,
          sku: i.sku,
          stock: i.stock,
          price: i.price,
        })) ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q, platformCode]);

  return { q, setQ, results, loading, reset: () => { setQ(""); setResults([]); } };
}

// ── Mapping Wizard ────────────────────────────────────────────────────
// Triggered when clicking "نگاشت کن" on a platform product.
// Steps: one per platform (shop + other platforms). Each step: search or "ندارم".

interface WizardStep {
  platformCode: string;
  label: string;
  selected: { externalId: string; externalTitle: string } | null;
  skipped: boolean;
}

function WizardStepShop({
  step,
  onSelect,
  onSkip,
  onBack,
}: {
  step: WizardStep;
  onSelect: (id: string, title: string) => void;
  onSkip: () => void;
  onBack: (() => void) | null;
}) {
  const { q, setQ, results, loading, reset } = useShopSearch();

  return (
    <div className="flex flex-col gap-3 h-full">
      <p className="text-xs text-gray-500">جستجوی محصول در فروشگاه و انتخاب آن، یا «ندارم» اگر هنوز در فروشگاه ثبت نشده.</p>
      <input
        autoFocus
        type="text" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="جستجوی محصول فروشگاه..."
        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
      />
      <div className="flex-1 overflow-y-auto min-h-[120px] max-h-[220px] border border-gray-100 dark:border-white/[0.06] rounded-xl divide-y divide-gray-50 dark:divide-white/[0.04]">
        {loading && <p className="p-4 text-center text-sm text-gray-400">جستجو...</p>}
        {!loading && q && !results.length && <p className="p-4 text-center text-sm text-gray-400">نتیجه‌ای یافت نشد</p>}
        {!q && <p className="p-4 text-center text-sm text-gray-400">نام محصول را جستجو کنید</p>}
        {results.map((r) => (
          <button key={r.id} onClick={() => { onSelect(r.id, r.title); reset(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
            {r.image ? <img src={r.image} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex-shrink-0" />}
            <div className="flex-1 min-w-0 text-right">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{r.title}</p>
              <p className="text-xs text-gray-400">{fmtPrice(r.price)}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        {onBack ? (
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← مرحله قبل</button>
        ) : <span />}
        <button onClick={onSkip}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
          ندارم — ادامه بده
        </button>
      </div>
    </div>
  );
}

function WizardStepPlatform({
  step,
  onSelect,
  onSkip,
  onBack,
}: {
  step: WizardStep;
  onSelect: (id: string, title: string) => void;
  onSkip: () => void;
  onBack: (() => void) | null;
}) {
  const { q, setQ, results, loading, reset } = usePlatformSearch(step.platformCode);

  return (
    <div className="flex flex-col gap-3 h-full">
      <p className="text-xs text-gray-500">جستجوی محصول در {step.label} و انتخاب آن، یا «ندارم» اگر هنوز آنجا وجود ندارد.</p>
      <input
        autoFocus
        type="text" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={`جستجو در ${step.label}...`}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
      />
      <div className="flex-1 overflow-y-auto min-h-[120px] max-h-[220px] border border-gray-100 dark:border-white/[0.06] rounded-xl divide-y divide-gray-50 dark:divide-white/[0.04]">
        {loading && <p className="p-4 text-center text-sm text-gray-400">جستجو...</p>}
        {!loading && q && !results.length && <p className="p-4 text-center text-sm text-gray-400">نتیجه‌ای یافت نشد</p>}
        {!q && <p className="p-4 text-center text-sm text-gray-400">نام محصول را جستجو کنید</p>}
        {results.map((r) => (
          <button key={r.platformProductId} onClick={() => { onSelect(r.platformProductId, r.title); reset(); }}
            className="w-full flex items-start gap-2 px-3 py-2.5 text-right hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{r.title}</p>
              <div className="flex gap-2 text-xs text-gray-400">
                {r.sku && <span>SKU: {r.sku}</span>}
                {r.stock !== null && <span>موجودی: {r.stock}</span>}
                {r.price !== null && <span>{fmtPrice(r.price)}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        {onBack ? (
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← مرحله قبل</button>
        ) : <span />}
        <button onClick={onSkip}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
          ندارم — ادامه بده
        </button>
      </div>
    </div>
  );
}

function MappingWizard({
  originPlatform,
  originProduct,
  allPlatforms,
  onClose,
  onComplete,
}: {
  originPlatform: string;
  originProduct: { platformProductId: string; title: string };
  allPlatforms: Platform[];
  onClose: () => void;
  onComplete: (mappingId: string) => void;
}) {
  // Build steps: shop first, then other platforms (excluding origin which is pre-filled)
  const otherPlatforms = allPlatforms.filter((p) => p.code !== originPlatform);

  const initialSteps: WizardStep[] = [
    { platformCode: "shop", label: "فروشگاه", selected: null, skipped: false },
    ...otherPlatforms.map((p) => ({ platformCode: p.code, label: p.name, selected: null, skipped: false })),
  ];

  const [steps, setSteps] = useState<WizardStep[]>(initialSteps);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectOnStep(idx: number, id: string, title: string) {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, selected: { externalId: id, externalTitle: title }, skipped: false } : s));
    setCurrentStep(idx + 1);
  }

  function skipStep(idx: number) {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, selected: null, skipped: true } : s));
    setCurrentStep(idx + 1);
  }

  const isLastStep = currentStep >= steps.length;

  async function handleComplete() {
    setSaving(true);
    setError(null);
    try {
      const links = [
        // Origin platform always included
        { platformCode: originPlatform, externalId: originProduct.platformProductId, externalTitle: originProduct.title },
        // Selected steps
        ...steps.filter((s) => s.selected).map((s) => ({
          platformCode: s.platformCode,
          externalId: s.selected!.externalId,
          externalTitle: s.selected!.externalTitle,
        })),
      ];

      if (links.length < 2) {
        setError("حداقل باید یک پلتفرم دیگر انتخاب شده باشد");
        return;
      }

      const res = await fetch("/api/integration/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "خطا در ایجاد نگاشت");
        return;
      }
      onComplete(data.id!);
    } finally {
      setSaving(false);
    }
  }

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#0f1117] rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-black text-gray-900 dark:text-white text-sm">نگاشت محصول</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[300px]" title={originProduct.title}>
                {platformName(originPlatform, allPlatforms)}: <span className="text-gray-600 dark:text-gray-300">{originProduct.title}</span>
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0">×</button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mt-3">
            {steps.map((s, i) => (
              <div key={s.platformCode} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                  i < currentStep
                    ? s.selected ? "bg-green-500 text-white" : "bg-gray-300 dark:bg-gray-600 text-gray-500"
                    : i === currentStep
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-white/5 text-gray-400"
                }`}>
                  {i < currentStep ? (s.selected ? "✓" : "–") : i + 1}
                </div>
                <span className={`text-[10px] ${i === currentStep ? "text-blue-600 dark:text-blue-400 font-bold" : "text-gray-400"}`}>
                  {s.label}
                </span>
                {i < steps.length - 1 && <span className="text-gray-200 dark:text-gray-700 text-xs mx-0.5">›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 overflow-auto">
          {isLastStep ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-900 dark:text-white">خلاصه نگاشت:</p>
              <div className="rounded-xl border border-gray-100 dark:border-white/[0.06] divide-y divide-gray-50 dark:divide-white/[0.04]">
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{platformName(originPlatform, allPlatforms)}</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{originProduct.title}</span>
                </div>
                {steps.map((s) => (
                  <div key={s.platformCode} className="px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{s.label}</span>
                    {s.selected ? (
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{s.selected.externalTitle}</span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">ندارم</span>
                    )}
                  </div>
                ))}
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setCurrentStep(steps.length - 1)} className="text-xs text-gray-400 hover:text-gray-600">← ویرایش</button>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "در حال ذخیره..." : "تکمیل نگاشت"}
                </button>
              </div>
            </div>
          ) : step.platformCode === "shop" ? (
            <WizardStepShop
              step={step}
              onSelect={(id, title) => selectOnStep(currentStep, id, title)}
              onSkip={() => skipStep(currentStep)}
              onBack={currentStep > 0 ? () => setCurrentStep(currentStep - 1) : null}
            />
          ) : (
            <WizardStepPlatform
              step={step}
              onSelect={(id, title) => selectOnStep(currentStep, id, title)}
              onSkip={() => skipStep(currentStep)}
              onBack={currentStep > 0 ? () => setCurrentStep(currentStep - 1) : null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Platform product row ──────────────────────────────────────────────

function ProductRow({
  product,
  allPlatforms,
  onApprove,
  onReject,
  onDelete,
  onOpenWizard,
  actioning,
}: {
  product: PlatformProduct;
  allPlatforms: Platform[];
  onApprove: (suggestionId: string, productId: string) => void;
  onReject:  (suggestionId: string, productId: string) => void;
  onDelete:  (mappingId: string, productId: string) => void;
  onOpenWizard: (product: PlatformProduct) => void;
  actioning: string | null;
}) {
  const isActioning = actioning === product.platformProductId;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex-shrink-0 w-5 text-center">
        <StatusDot status={product.mappingStatus} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{product.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">کد: {product.platformProductId}</span>
          {product.sku && <span className="text-xs text-gray-400">SKU: {product.sku}</span>}
          {product.stock !== null && <span className="text-xs text-gray-400">موجودی: {product.stock}</span>}
          {product.price !== null && <span className="text-xs text-gray-400">{fmtPrice(product.price)}</span>}
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        {product.mappingStatus === "mapped" && (
          <>
            <div className="text-right hidden sm:block">
              {product.shopProduct ? (
                <>
                  <p className="text-xs font-bold text-green-600 dark:text-green-400 truncate max-w-[130px]">{product.shopProduct.title}</p>
                  <p className="text-xs text-gray-400">موجودی: {product.shopProduct.stock}</p>
                </>
              ) : (
                <p className="text-xs text-amber-500 font-bold">محصول در فروشگاه ندارد</p>
              )}
            </div>
            <button
              onClick={() => onDelete(product.mappingId!, product.platformProductId)}
              disabled={isActioning}
              className="text-xs text-red-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
            >
              {isActioning ? "..." : "حذف نگاشت"}
            </button>
          </>
        )}

        {product.mappingStatus === "suggested" && product.suggestion && (
          <>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate max-w-[120px]">
                {product.suggestion.shopProduct?.title ?? "ناشناس"}
              </p>
              <p className="text-xs text-gray-400">اطمینان: {Math.round(product.suggestion.confidence * 100)}٪</p>
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
              className="text-xs text-red-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
            >
              رد
            </button>
          </>
        )}

        {product.mappingStatus === "unmapped" && (
          <button
            onClick={() => onOpenWizard(product)}
            className="text-xs text-blue-600 dark:text-blue-400 font-bold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            نگاشت کن
          </button>
        )}
      </div>
    </div>
  );
}

// ── Platform Tab ──────────────────────────────────────────────────────

function PlatformTab({ platform, allPlatforms }: { platform: Platform; allPlatforms: Platform[] }) {
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
  const [wizardProduct, setWizardProduct] = useState<PlatformProduct | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(q), 350);
  }, [q]);

  const load = useCallback(async (p: number, search: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ platformCode: platform.code, page: String(p), pageSize: "50" });
      if (search) qs.set("q", search);
      const res = await fetch(`/api/integration/platform-products?${qs}`);
      if (!res.ok) return;
      const data = await res.json() as { items: PlatformProduct[]; total: number };
      setProducts(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [platform.code]);

  useEffect(() => { void load(page, debouncedQ); }, [load, page, debouncedQ]);

  async function handleFetch() {
    setFetching(true); setFetchMsg(null);
    try {
      const res = await fetch("/api/integration/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platformCode: platform.code, type: "FETCH_PRODUCTS", priority: 1 }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      setFetchMsg(res.ok ? `در صف قرار گرفت (${data.jobId?.slice(-6)}) — چند دقیقه صبر کنید، سپس رفرش کنید` : (data.error ?? "خطا"));
    } finally {
      setFetching(false);
    }
  }

  async function handleApprove(suggestionId: string, pid: string) {
    setActioning(pid);
    try {
      const res = await fetch("/api/integration/mapping/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: suggestionId, action: "approve" }),
      });
      if (res.ok) {
        setProducts((prev) => prev.map((p) =>
          p.platformProductId === pid
            ? { ...p, mappingStatus: "mapped" as const, mappingId: suggestionId, suggestion: null,
                shopProduct: p.suggestion?.shopProduct ?? null, allLinks: [] }
            : p
        ));
      }
    } finally { setActioning(null); }
  }

  async function handleReject(suggestionId: string, pid: string) {
    setActioning(pid);
    try {
      const res = await fetch("/api/integration/mapping/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: suggestionId, action: "reject" }),
      });
      if (res.ok) {
        setProducts((prev) => prev.map((p) =>
          p.platformProductId === pid ? { ...p, mappingStatus: "unmapped" as const, suggestion: null } : p
        ));
      }
    } finally { setActioning(null); }
  }

  async function handleDelete(mappingId: string, pid: string) {
    if (!confirm("کل نگاشت حذف شود؟")) return;
    setActioning(pid);
    try {
      const res = await fetch(`/api/integration/mapping?id=${mappingId}`, { method: "DELETE" });
      if (res.ok) {
        setProducts((prev) => prev.map((p) =>
          p.platformProductId === pid
            ? { ...p, mappingStatus: "unmapped" as const, mappingId: null, mappingLinkId: null, shopProduct: null, allLinks: [] }
            : p
        ));
      }
    } finally { setActioning(null); }
  }

  function handleWizardComplete(mappingId: string) {
    setWizardProduct(null);
    void load(page, debouncedQ);
  }

  const filtered = statusFilter === "all" ? products : products.filter((p) => p.mappingStatus === statusFilter);
  const mappedCount    = products.filter((p) => p.mappingStatus === "mapped").length;
  const suggestedCount = products.filter((p) => p.mappingStatus === "suggested").length;
  const unmappedCount  = products.filter((p) => p.mappingStatus === "unmapped").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <input
          type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="جستجو..."
          className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
        />
        <div className="flex items-center gap-2">
          {fetchMsg && <p className="text-xs text-blue-500 max-w-[180px] truncate" title={fetchMsg}>{fetchMsg}</p>}
          <button onClick={handleFetch} disabled={fetching}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
            {fetching ? "..." : "دریافت محصولات"}
          </button>
        </div>
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "mapped", "suggested", "unmapped"] as const).map((s) => {
            const labels = { all: `همه (${total})`, mapped: `🟢 (${mappedCount})`, suggested: `🟡 (${suggestedCount})`, unmapped: `🔴 (${unmappedCount})` };
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${statusFilter === s ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200"}`}>
                {labels[s]}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-10 text-center text-sm text-gray-400">در حال بارگذاری...</div>
      ) : total === 0 ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-12 text-center">
          <p className="text-gray-400 text-sm">هنوز محصولی دریافت نشده</p>
          <p className="text-gray-400 text-xs mt-2">دکمه «دریافت محصولات» را بزنید</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">موردی با این فیلتر یافت نشد</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {filtered.map((product) => (
                <ProductRow
                  key={product.platformProductId}
                  product={product}
                  allPlatforms={allPlatforms}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDelete={handleDelete}
                  onOpenWizard={setWizardProduct}
                  actioning={actioning}
                />
              ))}
            </div>
          )}
          {total > 50 && (
            <div className="p-4 flex items-center justify-center gap-3 border-t border-gray-100 dark:border-white/[0.04]">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}
                className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40">قبلی</button>
              <span className="text-xs text-gray-500">صفحه {page} از {Math.ceil(total / 50)}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total || loading}
                className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40">بعدی</button>
            </div>
          )}
        </div>
      )}

      {wizardProduct && (
        <MappingWizard
          originPlatform={platform.code}
          originProduct={{ platformProductId: wizardProduct.platformProductId, title: wizardProduct.title }}
          allPlatforms={allPlatforms}
          onClose={() => setWizardProduct(null)}
          onComplete={handleWizardComplete}
        />
      )}
    </div>
  );
}

// ── Confirmed Mappings Tab ────────────────────────────────────────────

function MappingsTab({ platforms }: { platforms: Platform[] }) {
  const [mappings, setMappings] = useState<MappingGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integration/mapping?page=${p}&perPage=30`);
      const data = await res.json() as { mappings: MappingGroup[]; total: number };
      setMappings(data.mappings ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page); }, [load, page]);

  async function handleDelete(id: string) {
    if (!confirm("این نگاشت و تمام لینک‌های آن حذف شود؟")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/integration/mapping?id=${id}`, { method: "DELETE" });
      setMappings((prev) => prev.filter((m) => m.id !== id));
      setTotal((t) => t - 1);
    } finally {
      setDeletingId(null);
    }
  }

  const allCodes = ["shop", ...platforms.map((p) => p.code)];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{total} نگاشت تأیید‌شده</p>
      {loading ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-10 text-center text-sm text-gray-400">در حال بارگذاری...</div>
      ) : mappings.length === 0 ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-10 text-center text-sm text-gray-400">هنوز نگاشتی ایجاد نشده</div>
      ) : (
        <div className="space-y-3">
          {mappings.map((m) => {
            const linkByCode = new Map(m.links.map((l) => [l.platformCode, l]));
            return (
              <div key={m.id} className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    {allCodes.map((code) => {
                      const link = linkByCode.get(code);
                      const label = code === "shop" ? "فروشگاه" : platformName(code, platforms);
                      return (
                        <div key={code} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
                          {link ? (
                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                              {link.platformCode === "shop" && link.shopProduct
                                ? link.shopProduct.title
                                : (link.externalTitle ?? link.externalId)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600 italic">لینک نشده</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    className="text-xs text-red-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 disabled:opacity-40"
                  >
                    {deletingId === m.id ? "..." : "حذف"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {total > 30 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40">قبلی</button>
          <span className="text-xs text-gray-500">صفحه {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page * 30 >= total}
            className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-white/5 disabled:opacity-40">بعدی</button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

interface Props {
  platforms: Platform[];
  initialMappingCount: number;
  initialSuggestionCount: number;
}

export default function MappingPageClient({ platforms, initialMappingCount, initialSuggestionCount }: Props) {
  const [activeTab, setActiveTab] = useState<string>(platforms[0]?.code ?? "mappings");
  const [mappingCount]     = useState(initialMappingCount);
  const [suggestionCount]  = useState(initialSuggestionCount);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">نگاشت محصولات</h1>
        <p className="text-sm text-gray-500 mt-1">ارتباط محصولات بین همه پلتفرم‌ها در یک ظرف یکپارچه</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4">
          <p className="text-2xl font-black text-gray-900 dark:text-white">{mappingCount}</p>
          <p className="text-xs text-gray-500 mt-1">نگاشت فعال</p>
        </div>
        <div className={`bg-white dark:bg-[#0f1117] rounded-2xl border p-4 ${suggestionCount > 0 ? "border-amber-200 dark:border-amber-500/20" : "border-gray-200 dark:border-white/[0.06]"}`}>
          <p className={`text-2xl font-black ${suggestionCount > 0 ? "text-amber-500" : "text-gray-900 dark:text-white"}`}>{suggestionCount}</p>
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
        <span className="flex items-center gap-1.5"><span className="text-amber-400">●</span> پیشنهاد سیستم (نیاز به تأیید)</span>
        <span className="flex items-center gap-1.5"><span className="text-red-400">●</span> بدون نگاشت</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-white/[0.06] overflow-x-auto">
        {platforms.map((pl) => (
          <button key={pl.code} onClick={() => setActiveTab(pl.code)}
            className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === pl.code ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            {pl.name}
          </button>
        ))}
        <button onClick={() => setActiveTab("mappings")}
          className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === "mappings" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
          نگاشت‌ها
        </button>
      </div>

      <div>
        {activeTab === "mappings" ? (
          <MappingsTab platforms={platforms} />
        ) : (
          platforms.map((pl) =>
            activeTab === pl.code ? (
              <PlatformTab key={pl.code} platform={pl} allPlatforms={platforms} />
            ) : null
          )
        )}
      </div>
    </div>
  );
}
