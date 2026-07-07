"use client";

import { useState } from "react";

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

export default function PricingClient({ initialItems, initialTotal }: { initialItems: Item[]; initialTotal: number }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [saving, setSaving] = useState<string | null>(null);
  const [resyncing, setResyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
      if (res.ok) {
        setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
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
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-xs"
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
                    className="w-32 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-xs"
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}