"use client";

import { useState } from "react";
import Image from "next/image";

interface Mapping {
  id: string;
  platformCode: string;
  platformProductId: string;
  platformTitle: string | null;
  isActive: boolean;
  createdAt: string;
  shopProduct: {
    id: string;
    title: string;
    price: string;
    stock: number;
    mainImage: string | null;
  };
  platform: { name: string };
}

interface Props {
  initialMappings: Mapping[];
  total: number;
  platform: string;
}

export default function MappingPageClient({ initialMappings, total, platform }: Props) {
  const [mappings, setMappings] = useState<Mapping[]>(initialMappings);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleFetchProducts() {
    setFetching(true);
    setFetchMsg(null);
    try {
      const res = await fetch("/api/integration/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ platformCode: platform, type: "FETCH_PRODUCTS", priority: 1 }),
      });
      const data = await res.json() as { jobId?: string; error?: string };
      if (res.ok) {
        setFetchMsg(`دریافت محصولات در صف قرار گرفت (job: ${data.jobId?.slice(-6)}) — چند دقیقه صبر کنید`);
      } else {
        setFetchMsg(data.error ?? "خطا");
      }
    } finally {
      setFetching(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("این نگاشت حذف شود؟")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/integration/mapping?id=${id}`, { method: "DELETE" });
      setMappings(prev => prev.filter(m => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* آمار + دکمه fetch */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-gray-500">
            {total} نگاشت فعال
            {mappings.length < total && ` (نمایش ${mappings.length} مورد)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetchMsg && (
            <p className="text-sm text-blue-600 dark:text-blue-400">{fetchMsg}</p>
          )}
          <button
            onClick={handleFetchProducts}
            disabled={fetching}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fetching ? "در حال ارسال..." : "دریافت محصولات از حسابان"}
          </button>
        </div>
      </div>

      {/* جدول mapping‌ها */}
      {mappings.length === 0 ? (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-12 text-center">
          <p className="text-gray-400 text-sm">هنوز نگاشتی وجود ندارد</p>
          <p className="text-gray-400 text-xs mt-2">
            ابتدا «دریافت محصولات از حسابان» را اجرا کنید تا auto-match شود
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {mappings.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                {/* محصول فروشگاه */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {m.shopProduct.mainImage ? (
                    <Image
                      src={m.shopProduct.mainImage}
                      alt={m.shopProduct.title}
                      width={36}
                      height={36}
                      className="rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {m.shopProduct.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      موجودی: {m.shopProduct.stock}
                    </p>
                  </div>
                </div>

                {/* جهت */}
                <span className="text-gray-400 text-lg flex-shrink-0">↔</span>

                {/* محصول پلتفرم */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {m.platformTitle ?? m.platformProductId}
                  </p>
                  <p className="text-xs text-gray-400">
                    {m.platform.name} · کد: {m.platformProductId}
                  </p>
                </div>

                {/* حذف */}
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  className="text-xs text-red-400 hover:text-red-500 transition-colors flex-shrink-0 disabled:opacity-40"
                >
                  {deletingId === m.id ? "..." : "حذف"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
