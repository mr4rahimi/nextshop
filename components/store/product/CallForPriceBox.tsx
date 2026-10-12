"use client";

/**
 * کادر «تماس بگیرید» جای قیمت و دکمه‌ی خرید محصولی که قیمت ندارد (قیمت صفر
 * یعنی «قیمت ثبت نشده»، نه رایگان). دکمه‌ی تماس با اولین شماره‌ی تنظیمات
 * سایت و فرم «با من تماس بگیرید» که در «درخواست‌های تماس» پنل ثبت می‌شود.
 */

import { useState } from "react";
import { firstPhone, telHref } from "@/lib/tel";

const PHONE_RE = /^(09|\+989|00989)\d{9}$/;

function latin(s: string) {
  return s.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export default function CallForPriceBox({ productId, sitePhone }: { productId: string; sitePhone?: string | null }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tel = telHref(sitePhone);
  const shown = firstPhone(sitePhone);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = latin(phone).replace(/[\s-]/g, "");
    if (!PHONE_RE.test(p)) return setError("شماره موبایل را درست وارد کنید، مثل ۰۹۱۲۱۲۳۴۵۶۷");
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/store/callback-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p, productId }),
      });
      if (r.ok) setDone(true);
      else setError("ثبت نشد؛ دوباره تلاش کنید");
    } catch {
      setError("ارتباط برقرار نشد؛ دوباره تلاش کنید");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-primary-500/20 dark:bg-primary-500/5">
      <div>
        <p className="text-sm font-black text-gray-900 dark:text-white">برای استعلام قیمت تماس بگیرید</p>
        <p className="mt-1 text-[11px] font-bold leading-5 text-gray-500 dark:text-gray-400">
          قیمت روز و موجودی این محصول را کارشناسان ما اعلام می‌کنند.
        </p>
      </div>

      {tel && (
        <a href={tel}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 py-3.5 text-sm font-black text-white shadow-lg shadow-primary-500/25 transition-colors hover:bg-primary-700">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          تماس: <span dir="ltr" className="tabular-nums">{shown}</span>
        </a>
      )}

      {done ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-[12px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          ثبت شد ✓ به‌زودی با شما تماس می‌گیریم.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-1.5">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">یا شماره‌تان را بگذارید تا با شما تماس بگیریم:</p>
          <div className="flex gap-2">
            <input
              type="tel" inputMode="tel" dir="ltr" autoComplete="tel" placeholder="09xxxxxxxxx"
              value={phone} onChange={e => setPhone(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <button type="submit" disabled={busy}
              className="shrink-0 rounded-xl border border-primary-600 px-4 text-xs font-black text-primary-700 transition-colors hover:bg-primary-600 hover:text-white disabled:opacity-50 dark:text-primary-300">
              {busy ? "…" : "تماس با من"}
            </button>
          </div>
          {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
