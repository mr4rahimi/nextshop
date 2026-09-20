"use client";

import { useEffect, useState } from "react";

interface Link {
  platformCode: string;
  shopProduct: { id: string; title: string } | null;
  externalTitle: string | null;
}

interface Item {
  id: string;
  stock: number;
  purchasePriceSource: "HESABAN" | "MANUAL";
  purchasePrice: number | null;
  syncPriceEnabled: boolean;
  lastPriceSyncAt: string | null;
  links: Link[];
}

// ── پیش‌نمایش قیمت روی پلتفرم‌ها ────────────────────────────────────
// فقط خواندنی؛ این پاپ‌آپ هیچ قیمتی به بازارگاه ارسال نمی‌کند.

interface PlatformPrice {
  platformCode: string;
  platformName: string;
  ruleName: string | null;
  price: number | null;
  effective: number | null;
  discountPercent: number | null;
  discountSource: "MANAGED" | "PLATFORM" | "NONE" | "UNKNOWN";
  reason: string | null;
}

const fa = (n: number) => n.toLocaleString("fa-IR");

const SOURCE_FA: Record<string, string> = {
  MANAGED:  "تخفیف از پنل",
  PLATFORM: "تخفیف از خود پلتفرم",
};

function PricePreviewModal({ item, title, onClose }: {
  item: Item;
  title: string;
  onClose: () => void;
}) {
  const [rows,    setRows]    = useState<PlatformPrice[] | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res  = await fetch(`/api/integration/pricing/preview?mappingId=${item.id}`);
        const data = await res.json() as { platforms?: PlatformPrice[]; error?: string };
        if (!alive) return;
        if (!res.ok) { setError(data.error ?? "خطا در محاسبه"); return; }
        setRows(data.platforms ?? []);
      } catch {
        if (alive) setError("ارتباط برقرار نشد");
      }
    })();
    return () => { alive = false; };
  }, [item.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-2xl bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/10 shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.06] flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-gray-900 dark:text-white">قیمت نهایی در پلتفرم‌ها</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">{title}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              قیمت خرید {item.purchasePrice != null ? fa(item.purchasePrice) : "—"} · موجودی {fa(item.stock)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none px-1"
            aria-label="بستن"
          >
            ×
          </button>
        </div>

        <div className="p-3">
          {error ? (
            <p className="text-center text-xs text-red-500 py-8">{error}</p>
          ) : rows === null ? (
            <p className="text-center text-xs text-gray-400 py-8">در حال محاسبه…</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">این محصول به هیچ پلتفرمی لینک نیست</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.platformCode}
                  className="rounded-xl border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-xs text-gray-900 dark:text-white">{r.platformName}</span>
                    {r.ruleName && (
                      <span className="text-[10px] text-gray-400">قانون: {r.ruleName}</span>
                    )}
                    {r.price != null && (
                      <span className="mr-auto flex items-center gap-2">
                        <b className={r.effective !== r.price
                          ? "text-gray-400 line-through font-normal text-xs"
                          : "text-sm font-black text-gray-900 dark:text-white"}>
                          {fa(r.price)}
                        </b>
                        {r.effective !== r.price && r.effective != null && (
                          <b className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            {fa(r.effective)}
                          </b>
                        )}
                        <span className="text-[10px] text-gray-400">تومان</span>
                      </span>
                    )}
                  </div>

                  {r.discountPercent != null && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                      {fa(r.discountPercent)}٪ تخفیف فعال
                      {SOURCE_FA[r.discountSource] ? ` — ${SOURCE_FA[r.discountSource]}` : ""}
                    </p>
                  )}
                  {r.reason && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-5">{r.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-3 leading-5 px-1">
            این اعداد فقط محاسبه‌اند و چیزی به بازارگاه ارسال نمی‌شود. قیمتی که مشتری
            می‌بیند بعد از آخرین «بروزرسانی قیمت» موفق تغییر می‌کند.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PricingClient({ initialItems, initialTotal }: { initialItems: Item[]; initialTotal: number }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [saving, setSaving] = useState<string | null>(null);
  const [resyncing, setResyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<Item | null>(null);

  function titleOf(m: Item): string {
    const shopLink = m.links.find((l) => l.platformCode === "shop");
    return shopLink?.shopProduct?.title ?? shopLink?.externalTitle ?? m.links[0]?.externalTitle ?? "(بدون عنوان)";
  }

  async function patch(id: string, data: Partial<Item>) {
    setSaving(id);
    try {
      const res = await fetch("/api/integration/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappingId: id, ...data }),
      });
      if (!res.ok) {
        setMsg("ذخیره نشد");
        return;
      }

      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));

      // نتیجه‌ی ارسال قیمت به پلتفرم‌ها — بدون این، ویرایش «موفق» به نظر می‌رسید
      // حتی وقتی هیچ پلتفرمی قیمت جدید را نگرفته بود.
      const body = await res.json() as {
        pricePush?: { pushed: number; failed: number; skipped: number } | null;
        pricePushError?: string;
      };

      if (body.pricePushError) {
        setMsg(`ذخیره شد، ولی ارسال قیمت خطا داد: ${body.pricePushError}`);
      } else if (body.pricePush) {
        const { pushed, failed } = body.pricePush;
        setMsg(
          failed > 0
            ? `ذخیره شد — ${pushed} پلتفرم بروز شد، ${failed} ناموفق (جزئیات در لاگ‌ها)`
            : pushed > 0
              ? `ذخیره شد و روی ${pushed} پلتفرم اعمال شد`
              : "ذخیره شد — هیچ پلتفرمی برای ارسال نبود",
        );
      } else {
        setMsg("ذخیره شد");
      }
    } finally {
      setSaving(null);
    }
  }

  async function handleResync() {
    setResyncing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integration/pricing/resync", { method: "POST" });
      const data = await res.json() as { error?: string; alreadyRunning?: boolean };
      setMsg(res.ok ? (data.alreadyRunning ? "یک بروزرسانی در حال اجراست" : "بروزرسانی قیمت در صف قرار گرفت") : data.error ?? "خطا");
    } finally {
      setResyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={handleResync} disabled={resyncing}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
          {resyncing ? "در حال ارسال..." : "بروزرسانی قیمت از حسابداری"}
        </button>
        {msg && <p className="text-xs text-gray-500">{msg}</p>}
        <p className="text-xs text-gray-400 mr-auto">{initialTotal} محصول نگاشت‌شده</p>
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        {items.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">هنوز محصولی نگاشت نشده</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {items.map((m) => (
              <div key={m.id} className="px-4 py-3 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-40">
                  <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{titleOf(m)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">موجودی: {m.stock}</p>
                </div>

                <select
                  value={m.purchasePriceSource}
                  onChange={(e) => patch(m.id, { purchasePriceSource: e.target.value as "HESABAN" | "MANUAL" })}
                  disabled={saving === m.id}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-xs text-gray-900 dark:text-white"
                >
                  <option value="HESABAN">از حسابداری</option>
                  <option value="MANUAL">دستی</option>
                </select>

                {m.purchasePriceSource === "MANUAL" ? (
                  <input
                    type="number"
                    defaultValue={m.purchasePrice ?? ""}
                    onBlur={(e) => patch(m.id, { purchasePrice: e.target.value ? Number(e.target.value) : null })}
                    placeholder="قیمت خرید"
                    className="w-32 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    dir="ltr"
                  />
                ) : (
                  <p className="w-32 text-center text-sm font-black text-gray-700 dark:text-gray-300">
                    {m.purchasePrice?.toLocaleString("fa-IR") ?? "—"}
                  </p>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.syncPriceEnabled}
                    disabled={saving === m.id}
                    onChange={() => patch(m.id, { syncPriceEnabled: !m.syncPriceEnabled })}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-xs text-gray-500 font-bold">سینک قیمت</span>
                </label>

                {/* قیمت‌ها پشت یک پاپ‌آپ می‌مانند تا ردیف شلوغ نشود */}
                <button
                  onClick={() => setPreview(m)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
                >
                  قیمت نهایی در پلتفرم‌ها
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <PricePreviewModal
          item={preview}
          title={titleOf(preview)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}