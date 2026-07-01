"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface MissingPlatform {
  platformCode: string;
  platformName: string;
  platformType: string;
}

interface SuggestionLink {
  id: string;
  platformCode: string;
  externalId: string;
  externalTitle: string | null;
  shopProduct: { id: string; title: string; price: string | number; stock: number; slug: string } | null;
}

interface Suggestion {
  mappingId: string;
  createdAt: string;
  links: SuggestionLink[];
  missing: MissingPlatform[];
}

const PLATFORM_COLORS: Record<string, string> = {
  shop:    "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  hesaban: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
  basalam: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300",
};

function fmtPrice(p: string | number | null | undefined): string {
  if (p == null) return "—";
  const n = Number(p);
  return isNaN(n) ? "—" : n.toLocaleString("fa-IR") + " ﷼";
}

export default function ProductSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integration/product-suggestions")
      .then((r) => r.json() as Promise<{ suggestions: Suggestion[]; total: number }>)
      .then((data) => {
        setSuggestions(data.suggestions ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">پیشنهادات اضافه کردن محصول</h1>
        <p className="text-sm text-gray-500 mt-1">
          نگاشت‌هایی که حداقل یک پلتفرم هنوز لینک نشده — این محصولات باید در پلتفرم‌های مفقود ایجاد یا لینک شوند.
        </p>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-12 text-center text-sm text-gray-400">
          در حال بارگذاری...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-12 text-center">
          <p className="text-gray-400 text-sm">همه نگاشت‌ها کامل هستند</p>
          <p className="text-gray-400 text-xs mt-2">
            وقتی نگاشتی بدون یک پلتفرم ایجاد شود، اینجا نمایش داده می‌شود.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{total} نگاشت ناقص</p>
          <div className="space-y-4">
            {suggestions.map((s) => {
              const shopLink = s.links.find((l) => l.platformCode === "shop");
              const otherLinks = s.links.filter((l) => l.platformCode !== "shop");

              return (
                <div key={s.mappingId} className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5">
                  {/* Product name */}
                  <div className="mb-4">
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      {shopLink?.shopProduct?.title
                        ?? otherLinks[0]?.externalTitle
                        ?? "محصول بدون نام"}
                    </p>
                    {shopLink?.shopProduct && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        موجودی فروشگاه: {shopLink.shopProduct.stock} · {fmtPrice(shopLink.shopProduct.price)}
                      </p>
                    )}
                  </div>

                  {/* Existing links */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {s.links.map((l) => (
                      <span key={l.id} className={`px-2 py-1 rounded-lg text-xs font-bold ${PLATFORM_COLORS[l.platformCode] ?? "bg-gray-100 dark:bg-white/5 text-gray-600"}`}>
                        ✓ {l.platformCode === "shop" ? "فروشگاه" : l.platformCode}
                        {l.externalTitle && <span className="font-normal"> — {l.externalTitle.slice(0, 20)}{l.externalTitle.length > 20 ? "..." : ""}</span>}
                      </span>
                    ))}
                  </div>

                  {/* Missing platforms — actions */}
                  <div className="space-y-2">
                    {s.missing.map((m) => (
                      <div key={m.platformCode} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                        <div>
                          <p className="text-sm font-bold text-red-700 dark:text-red-400">
                            ✗ لینک نشده در {m.platformName}
                          </p>
                          {m.platformCode === "shop" && (
                            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                              این محصول هنوز در فروشگاه ایجاد نشده
                            </p>
                          )}
                          {m.platformCode !== "shop" && (
                            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                              محصول در {m.platformName} لینک یا ایجاد نشده
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {m.platformCode === "shop" && (
                            <Link
                              href={`/admin/products/create?prefillTitle=${encodeURIComponent(otherLinks[0]?.externalTitle ?? "")}&mappingId=${s.mappingId}`}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                            >
                              ایجاد در فروشگاه
                            </Link>
                          )}
                          {m.platformCode !== "shop" && (
                            <Link
                              href={`/admin/integration/mapping?mappingId=${s.mappingId}`}
                              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                            >
                              لینک کردن در {m.platformName}
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
