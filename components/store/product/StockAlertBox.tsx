"use client";

/**
 * فرم «موجود شد خبرم کن» جای دکمه‌ی خرید کالای ناموجود — docs/features/tools.md بخش ۷.
 * اگر ابزار خاموش باشد همان `fallback` (کادر «ناموجود» قبلی) نشان داده می‌شود.
 */

import { useEffect, useState, type ReactNode } from "react";

type State = { enabled: boolean; phone: string | null; subscribed: boolean };

export default function StockAlertBox({ productId, fallback }: { productId: string; fallback: ReactNode }) {
  const [st, setSt] = useState<State | null>(null);
  const [phone, setPhone] = useState("");
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/store/stock-alert?productId=${encodeURIComponent(productId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((x: State | null) => {
        if (!x) return;
        setSt(x);
        if (x.phone) setPhone(x.phone);
        if (x.subscribed) setDone("درخواست شما ثبت شده است؛ وقتی موجود شد پیامک می‌گیرید.");
      })
      .catch(() => {});
  }, [productId]);

  if (!st?.enabled) return <>{fallback}</>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/store/stock-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, phone, website: trap }),
      });
      const x = await r.json().catch(() => null);
      if (x?.ok) setDone(x.already ? "این شماره قبلاً ثبت شده است؛ وقتی موجود شد پیامک می‌گیرید." : "ثبت شد ✓ وقتی موجود شد پیامک می‌گیرید.");
      else setError(x?.error ?? "ثبت نشد؛ دوباره تلاش کنید");
    } catch {
      setError("ارتباط برقرار نشد؛ دوباره تلاش کنید");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="flex items-center gap-2 text-sm font-black text-gray-800 dark:text-gray-100">
        <svg className="h-5 w-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
        </svg>
        ناموجود — موجود شد خبرم کن
      </p>
      {done ? (
        <p className="text-xs font-bold leading-6 text-emerald-600 dark:text-emerald-400">{done}</p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <p className="text-[11px] leading-5 text-gray-500 dark:text-gray-400">شماره‌تان را بگذارید؛ همین که این کالا موجود شود پیامک می‌دهیم.</p>
          <input type="text" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="numeric"
              dir="ltr"
              required
              placeholder="09121234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <button type="submit" disabled={busy} className="shrink-0 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">
              {busy ? "…" : "خبرم کن"}
            </button>
          </div>
          {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}
        </form>
      )}
    </div>
  );
}
