"use client";

import { useState } from "react";
import Image from "next/image";

interface Suggestion {
  id: string;
  platformCode: string;
  platformProductId: string;
  platformTitle: string | null;
  confidence: number;
  matchReason: string | null;
  shopProductId: string;
  shopProduct: { id: string; title: string; mainImage: string | null } | null;
  platform: { name: string };
}

interface Props {
  initialSuggestions: Suggestion[];
  total: number;
}

export default function SuggestionsClient({ initialSuggestions, total }: Props) {
  const [items, setItems] = useState<Suggestion[]>(initialSuggestions);
  const [processing, setProcessing] = useState<string | null>(null);

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessing(id);
    try {
      const res = await fetch("/api/integration/mapping/suggestions", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id, action }),
      });
      if (res.ok) {
        setItems(prev => prev.filter(s => s.id !== id));
      } else {
        const data = await res.json() as { error?: string };
        alert(data.error ?? "خطا");
      }
    } finally {
      setProcessing(null);
    }
  }

  const remaining = items.length;

  if (remaining === 0) {
    return (
      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-12 text-center">
        <p className="text-gray-400 text-sm">پیشنهادی در انتظار بررسی وجود ندارد</p>
        <p className="text-gray-400 text-xs mt-2">
          {total > 0 ? `${total} پیشنهاد پردازش شد` : "برای دریافت پیشنهادها ابتدا محصولات را از حسابان دریافت کنید"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{remaining} پیشنهاد در انتظار بررسی</p>

      {items.map((s) => (
        <div key={s.id}
          className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4">
          <div className="flex items-start gap-4">
            {/* محصول فروشگاه */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {s.shopProduct?.mainImage ? (
                <Image
                  src={s.shopProduct.mainImage}
                  alt={s.shopProduct?.title ?? ""}
                  width={48}
                  height={48}
                  className="rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                  بدون تصویر
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-0.5">فروشگاه</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {s.shopProduct?.title ?? s.shopProductId}
                </p>
              </div>
            </div>

            {/* اطمینان */}
            <div className="text-center flex-shrink-0 px-2">
              <div className={`text-lg font-black ${
                s.confidence >= 0.80 ? "text-green-500" :
                s.confidence >= 0.70 ? "text-amber-500" : "text-red-400"
              }`}>
                {Math.round(s.confidence * 100)}%
              </div>
              <p className="text-[10px] text-gray-400">اطمینان</p>
              {s.matchReason && (
                <p className="text-[10px] text-gray-400 mt-0.5 max-w-16 text-center leading-tight">
                  {s.matchReason.replace("title_exact", "عنوان دقیق").replace("title_fuzzy", "عنوان مشابه").replace("+brand", "+برند")}
                </p>
              )}
            </div>

            {/* محصول پلتفرم */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-0.5">{s.platform.name}</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {s.platformTitle ?? s.platformProductId}
              </p>
              <p className="text-xs text-gray-400">کد: {s.platformProductId}</p>
            </div>

            {/* دکمه‌ها */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleAction(s.id, "approve")}
                disabled={processing === s.id}
                className="px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-bold hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors disabled:opacity-40"
              >
                {processing === s.id ? "..." : "تأیید"}
              </button>
              <button
                onClick={() => handleAction(s.id, "reject")}
                disabled={processing === s.id}
                className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors disabled:opacity-40"
              >
                {processing === s.id ? "..." : "رد"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
