"use client";

import { useState } from "react";

interface Link {
  platformCode: string;
  externalId: string;
  externalTitle: string | null;
  shopProduct: { id: string; title: string; mainImage: string | null; stock: number } | null;
}

interface MappingItem {
  id: string;
  stock: number;
  syncStockEnabled: boolean;
  lastStockSyncAt: string | null;
  lastHesabanStock: number | null;
  links: Link[];
}

interface Props {
  initialItems: MappingItem[];
  initialTotal: number;
}

export default function InventoryClient({ initialItems, initialTotal }: Props) {
  const [items, setItems] = useState<MappingItem[]>(initialItems);
  const [total] = useState(initialTotal);
  const [toggling, setToggling] = useState<string | null>(null);
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState<string | null>(null);

  async function handleToggle(mappingId: string, current: boolean) {
    setToggling(mappingId);
    try {
      const res = await fetch("/api/integration/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappingId, syncStockEnabled: !current }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((m) => (m.id === mappingId ? { ...m, syncStockEnabled: !current } : m)));
      }
    } finally {
      setToggling(null);
    }
  }

  async function handleResync() {
    setResyncing(true);
    setResyncMsg(null);
    try {
      const res = await fetch("/api/integration/inventory/resync", { method: "POST" });
      const data = await res.json() as { jobId?: string; error?: string; alreadyRunning?: boolean };
      if (res.ok) {
        setResyncMsg(
          data.alreadyRunning
            ? "یک بروزرسانی قبلاً در صف است — از صفحه «صف عملیات» پیگیری کنید"
            : "بروزرسانی موجودی در صف قرار گرفت — از صفحه «صف عملیات» پیگیری کنید"
        );
      } else {
        setResyncMsg(data.error ?? "خطا در ثبت درخواست");
      }
    } catch {
      setResyncMsg("خطای شبکه");
    } finally {
      setResyncing(false);
    }
  }

  function titleOf(m: MappingItem): string {
    const shopLink = m.links.find((l) => l.platformCode === "shop");
    return shopLink?.shopProduct?.title ?? shopLink?.externalTitle ?? m.links[0]?.externalTitle ?? "(بدون عنوان)";
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleResync}
          disabled={resyncing}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {resyncing ? "در حال ارسال..." : "بروزرسانی موجودی از حسابداری"}
        </button>
        {resyncMsg && <p className="text-xs text-gray-500">{resyncMsg}</p>}
        <p className="text-xs text-gray-400 mr-auto">{total} محصول نگاشت‌شده</p>
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        {items.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">هنوز محصولی نگاشت نشده</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {items.map((m) => (
              <div key={m.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{titleOf(m)}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {m.links.map((l) => (
                      <span key={l.platformCode} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500">
                        {l.platformCode}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-center flex-shrink-0">
                  <p className="text-lg font-black text-gray-900 dark:text-white">{m.stock}</p>
                  <p className="text-[10px] text-gray-400">موجودی نگاشت</p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={m.syncStockEnabled}
                    disabled={toggling === m.id}
                    onChange={() => handleToggle(m.id, m.syncStockEnabled)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-xs text-gray-500 font-bold">مدیریت موجودی</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}