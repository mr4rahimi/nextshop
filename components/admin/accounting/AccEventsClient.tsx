"use client";

/**
 * صف رویداد مالی (docs/plans/accounting.md بخش ۴.۲).
 *
 * تب پیش‌فرض «نیازمند رسیدگی» است — رویدادی که گیر کرده مهم‌ترین چیز این
 * صفحه است. موبایل کارت، دسکتاپ همان کارت‌ها در یک ستون پهن.
 */

import { useCallback, useEffect, useState } from "react";
import { formatJalali } from "@/lib/club/jalali";

interface AccEvent {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  dedupeKey: string;
  status: "PENDING" | "DONE" | "BLOCKED" | "FAILED" | "SKIPPED";
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  blockedReason: string | null;
  resultRef: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface Data {
  items: AccEvent[];
  counts: Record<string, number>;
  can: { manage: boolean };
}

const TYPE_LABELS: Record<string, string> = {
  SALE_ISSUED: "فاکتور فروش",
  SALE_VOIDED: "ابطال فروش",
  SALE_RETURNED: "برگشت از فروش",
  PAYMENT_RECEIVED: "دریافت وجه",
  PAYMENT_REFUNDED: "استرداد وجه",
  PURCHASE_RECORDED: "فاکتور خرید",
  PURCHASE_RETURNED: "برگشت از خرید",
  INSTALLMENT_PAID: "واریز قسط",
  COMMISSION_PAID: "تسویه‌ی پورسانت",
  WALLET_ADJUSTED: "شارژ یا کسر کیف پول",
  STOCK_TRANSFERRED: "حواله‌ی انبار",
  STOCK_ADJUSTED: "انبارگردانی",
};

const STATUS: Record<AccEvent["status"], { label: string; cls: string }> = {
  PENDING: { label: "در صف", cls: "bg-blue-500/10 text-blue-600" },
  DONE: { label: "ثبت شد", cls: "bg-emerald-500/10 text-emerald-600" },
  BLOCKED: { label: "مسدود", cls: "bg-amber-500/10 text-amber-600" },
  FAILED: { label: "ناموفق", cls: "bg-red-500/10 text-red-600" },
  SKIPPED: { label: "رد شده", cls: "bg-gray-500/10 text-gray-500" },
};

const TABS: { key: string; label: string }[] = [
  { key: "attention", label: "نیازمند رسیدگی" },
  { key: "PENDING", label: "در صف" },
  { key: "DONE", label: "ثبت شد" },
  { key: "SKIPPED", label: "رد شده" },
  { key: "all", label: "همه" },
];

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function AccEventsClient({ initialStatus }: { initialStatus?: string }) {
  const initialTab =
    initialStatus === "BLOCKED" || initialStatus === "FAILED"
      ? "attention"
      : TABS.some((t) => t.key === initialStatus)
        ? initialStatus!
        : "attention";
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // «نیازمند رسیدگی» دو وضعیت است؛ API یکی می‌گیرد، پس دو درخواست
    const statuses = tab === "attention" ? ["BLOCKED", "FAILED"] : tab === "all" ? [null] : [tab];
    try {
      const results = await Promise.all(
        statuses.map(async (s) => {
          const p = new URLSearchParams();
          if (s) p.set("status", s);
          if (q.trim()) p.set("q", q.trim());
          const r = await fetch(`/api/admin/accounting/events?${p}`);
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? "بارگذاری نشد");
          return d as Data;
        }),
      );
      const items = results
        .flatMap((r) => r.items)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setData({ items, counts: results[0].counts, can: results[0].can });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "بارگذاری نشد");
    }
  }, [tab, q]);

  useEffect(() => {
    const h = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(h);
  }, [load, q]);

  async function act(action: "retry" | "run", ids?: string[]) {
    setBusy(true);
    setNotice(null);
    const r = await fetch("/api/admin/accounting/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(d.error ?? "انجام نشد");
      return;
    }
    setNotice(d.message ?? "انجام شد");
    setSelected(new Set());
    load();
  }

  const counts = data?.counts ?? {};
  const countOf = (k: string) =>
    k === "attention"
      ? (counts.BLOCKED ?? 0) + (counts.FAILED ?? 0)
      : k === "all"
        ? Object.values(counts).reduce((a, b) => a + b, 0)
        : counts[k] ?? 0;
  const retryable = (e: AccEvent) => e.status === "BLOCKED" || e.status === "FAILED";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="شناسه‌ی سفارش یا منبع"
          className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-400"
        />
        {data?.can.manage && (
          <button
            onClick={() => act("run")}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold disabled:opacity-50"
          >
            اجرای صف همین الان
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setSelected(new Set());
            }}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              tab === t.key
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
            }`}
          >
            {t.label}
            <span
              className={`mr-1 ${
                t.key === "attention" && countOf(t.key) > 0 && tab !== t.key ? "text-red-600" : "opacity-60"
              }`}
            >
              {fa(countOf(t.key))}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      {notice && <p className="text-xs font-bold text-emerald-600">{notice}</p>}

      {data?.can.manage && selected.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-2 rounded-xl bg-blue-600 text-white px-3 py-2">
          <span className="text-xs font-bold">{fa(selected.size)} رویداد انتخاب شد</span>
          <button
            onClick={() => act("retry", [...selected])}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-white text-blue-700 text-xs font-bold disabled:opacity-50"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5">
        {data?.items.map((e) => {
          const st = STATUS[e.status];
          const canPick = data.can.manage && retryable(e);
          return (
            <div key={e.id} className="px-4 py-3 flex gap-3">
              {data.can.manage && (
                <input
                  type="checkbox"
                  disabled={!canPick}
                  checked={selected.has(e.id)}
                  onChange={(ev) => {
                    const next = new Set(selected);
                    if (ev.target.checked) next.add(e.id);
                    else next.delete(e.id);
                    setSelected(next);
                  }}
                  className="mt-1 shrink-0 disabled:opacity-30"
                  aria-label="انتخاب رویداد"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{TYPE_LABELS[e.type] ?? e.type}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${st.cls}`}>{st.label}</span>
                  {e.attempts > 0 && <span className="text-[10px] text-gray-400">{fa(e.attempts)} تلاش</span>}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                  {e.aggregateType} · <span dir="ltr">{e.aggregateId}</span> · {formatJalali(new Date(e.createdAt))}
                </p>
                {(e.blockedReason || e.lastError) && (
                  <p className={`text-[11px] mt-1 ${e.status === "FAILED" ? "text-red-600" : "text-amber-600"}`}>
                    {e.status === "FAILED" || (e.status === "PENDING" && e.lastError) ? e.lastError : e.blockedReason}
                  </p>
                )}
                {e.resultRef && <p className="text-[10px] text-gray-400 mt-0.5">مرجع: <span dir="ltr">{e.resultRef}</span></p>}
              </div>
            </div>
          );
        })}
        {data && data.items.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-gray-400">
            {tab === "attention" ? "همه‌چیز مرتب است — رویداد گیرکرده‌ای نیست." : "رویدادی در این بخش نیست."}
          </p>
        )}
        {!data && !error && <p className="px-4 py-10 text-center text-xs text-gray-400">در حال بارگذاری…</p>}
      </div>
    </div>
  );
}
