"use client";

import { useCallback, useEffect, useState } from "react";

// فقط اسنپ‌شاپ مفهوم «موجودی اختصاصی تخفیف» دارد
const STOCK_AWARE = new Set(["snappshop"]);

// هر بازارگاه به اندازه‌ی متفاوتی از تخفیف را خودش می‌فهمد؛ بقیه‌اش را پنل ما
// اجرا می‌کند. کاربر باید بداند تاریخ‌هایی که وارد می‌کند کجا اعمال می‌شوند.
const PLATFORM_NOTE: Record<string, string> = {
  snappshop:
    "اسنپ‌شاپ بازه‌ی تخفیف و موجودی تخفیف‌دار را خودش می‌شناسد — هر سه مقدار عیناً به اسنپ ارسال می‌شوند.",
  tapsi_shop:
    "تپسی‌شاپ فقط «قیمت نهایی» می‌گیرد و از تاریخ خبر ندارد. بازه را پنل ما اجرا می‌کند: با شروع بازه قیمت تخفیف‌دار و با پایانش قیمت اصلی ارسال می‌شود.",
  basalam:
    "باسلام تخفیف را به‌صورت «کمپین» نگه می‌دارد و فقط درصد و «چند روز فعال بماند» می‌گیرد. تاریخ شروع را پنل ما اجرا می‌کند و تاریخ پایان به تعداد روز تبدیل می‌شود. اعمال تخفیف چند ثانیه بعد از ارسال روی باسلام می‌نشیند.",
};

interface DiscountLink {
  id:                string;
  platformCode:      string;
  externalId:        string;
  externalTitle:     string | null;
  discountManaged:   boolean;
  discountPercent:   number | null;
  discountStartsAt:  string | null;
  discountEndsAt:    string | null;
  discountStock:     number | null;
  discountPushedAt:  string | null;
  discountPushError: string | null;
}

interface Item {
  id:    string;
  title: string;
  stock: number;
  syncPriceEnabled: boolean;
  links: DiscountLink[];
}

type Patch = Partial<Pick<DiscountLink,
  "discountManaged" | "discountPercent" | "discountStartsAt" | "discountEndsAt" | "discountStock">>;

const inputClass =
  "px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] " +
  "bg-gray-50 dark:bg-white/[0.03] text-xs disabled:opacity-40";

export default function DiscountsClient({
  platforms,
}: {
  platforms: { code: string; name: string }[];
}) {
  const [platform, setPlatform] = useState(platforms[0]?.code ?? "");
  const [items,    setItems]    = useState<Item[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [msg,      setMsg]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integration/discounts?page=${page}&perPage=30&platform=${platform}`);
      const data = await res.json() as { items?: Item[]; total?: number };
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, platform]);

  useEffect(() => { void load(); }, [load]);

  // ذخیره بدون ارسال، یا ذخیره + ارسال فوری به بازارگاه.
  // تخفیف تا وقتی ارسال نشود فقط در دیتابیس ماست و مشتری نمی‌بیندش.
  async function patch(link: DiscountLink, data: Patch, push: boolean) {
    setSaving(link.id);
    setMsg(null);
    try {
      const res = await fetch("/api/integration/discounts", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ linkId: link.id, ...data, push }),
      });
      const body = await res.json() as {
        error?: string;
        pricePush?: { pushed: number; failed: number; skipped: number } | null;
        pricePushError?: string;
      };

      if (!res.ok) { setMsg(body.error ?? "ذخیره نشد"); return; }

      setItems((prev) => prev.map((m) => ({
        ...m,
        links: m.links.map((l) => (l.id === link.id ? { ...l, ...data } : l)),
      })));

      if (body.pricePushError)      setMsg(`ذخیره شد، ولی ارسال خطا داد: ${body.pricePushError}`);
      else if (body.pricePush)      {
        const { pushed, failed } = body.pricePush;
        setMsg(failed > 0
          ? `ذخیره شد — ${pushed} ارسال موفق، ${failed} ناموفق (جزئیات در گزارش لاگ‌ها)`
          : pushed > 0 ? "ذخیره و روی بازارگاه اعمال شد" : "ذخیره شد — چیزی برای ارسال نبود");
        void load();
      }
      else setMsg("ذخیره شد — برای اعمال روی بازارگاه دکمه‌ی «اعمال» را بزنید");
    } finally {
      setSaving(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={platform}
          onChange={(e) => { setPage(1); setPlatform(e.target.value); }}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-sm font-bold"
        >
          {platforms.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        {msg && <p className="text-xs text-gray-500">{msg}</p>}
        <p className="text-xs text-gray-400 mr-auto">{total} نگاشت</p>
      </div>

      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] px-4 py-3 space-y-2">
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-6">
          وقتی «تحت مدیریت پنل» روشن باشد، هر تخفیفی که در پنل خود بازارگاه تنظیم شود در
          ارسال بعدی بازنویسی می‌شود. خالی گذاشتن درصد یعنی «تخفیف نداشته باشد» و تخفیف
          موجود روی بازارگاه حذف می‌شود.
        </p>
        {PLATFORM_NOTE[platform] && (
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-6">
            {PLATFORM_NOTE[platform]}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-[#0f1117] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-12">در حال بارگذاری…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">نگاشتی برای این بازارگاه نیست</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
            {items.map((m) => m.links.map((l) => {
              const busy = saving === l.id;
              return (
                <div key={l.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-48">
                      <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{m.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5" dir="ltr">
                        {l.externalId} · موجودی {m.stock}
                      </p>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={l.discountManaged}
                        disabled={busy}
                        onChange={() => patch(l, { discountManaged: !l.discountManaged }, false)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-xs text-gray-500 font-bold">تحت مدیریت پنل</span>
                    </label>

                    <input
                      type="number" min={1} max={99} placeholder="درصد"
                      defaultValue={l.discountPercent ?? ""}
                      disabled={busy || !l.discountManaged}
                      onBlur={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null;
                        if (v !== (l.discountPercent ?? null)) patch(l, { discountPercent: v }, false);
                      }}
                      className={`${inputClass} w-20`} dir="ltr"
                    />

                    <input
                      type="date" title="تاریخ شروع"
                      defaultValue={l.discountStartsAt ?? ""}
                      disabled={busy || !l.discountManaged}
                      onChange={(e) => patch(l, { discountStartsAt: e.target.value || null }, false)}
                      className={`${inputClass} w-36`} dir="ltr"
                    />

                    <input
                      type="date" title="تاریخ پایان"
                      defaultValue={l.discountEndsAt ?? ""}
                      disabled={busy || !l.discountManaged}
                      onChange={(e) => patch(l, { discountEndsAt: e.target.value || null }, false)}
                      className={`${inputClass} w-36`} dir="ltr"
                    />

                    {STOCK_AWARE.has(l.platformCode) && (
                      <input
                        type="number" min={0} placeholder="موجودی تخفیف"
                        defaultValue={l.discountStock ?? ""}
                        disabled={busy || !l.discountManaged}
                        onBlur={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          if (v !== (l.discountStock ?? null)) patch(l, { discountStock: v }, false);
                        }}
                        className={`${inputClass} w-28`} dir="ltr"
                      />
                    )}

                    <button
                      onClick={() => patch(l, {}, true)}
                      disabled={busy || !m.syncPriceEnabled}
                      title={m.syncPriceEnabled ? "" : "سینک قیمت این نگاشت خاموش است"}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-40"
                    >
                      {busy ? "…" : "اعمال"}
                    </button>
                  </div>

                  {l.discountPushError ? (
                    <p className="text-[11px] text-red-600 dark:text-red-400">
                      آخرین ارسال ناموفق: {l.discountPushError}
                    </p>
                  ) : l.discountPushedAt ? (
                    <p className="text-[11px] text-gray-400">
                      آخرین ارسال موفق: {new Date(l.discountPushedAt).toLocaleString("fa-IR")}
                    </p>
                  ) : null}
                </div>
              );
            }))}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-xs disabled:opacity-40">
            قبلی
          </button>
          <span className="text-xs text-gray-500">{page} از {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-xs disabled:opacity-40">
            بعدی
          </button>
        </div>
      )}
    </div>
  );
}
