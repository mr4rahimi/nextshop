"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeDestination } from "@/lib/redirects";

type Row = {
  id: string;
  path: string;
  hits: number;
  referer: string | null;
  firstSeen: string;
  lastSeen: string;
  ignored: boolean;
};

export default function NotFoundLogPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [showIgnored, setShowIgnored] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // ساخت ریدایرکت درجا
  const [fixing, setFixing] = useState<Row | null>(null);
  const [dest, setDest] = useState("");
  const [status, setStatus] = useState(301);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/not-found-log?q=${encodeURIComponent(q)}&page=${page}&ignored=${showIgnored ? "1" : "0"}`,
    );
    const data = await res.json();
    setRows(data.items || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [q, page, showIgnored]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function openFix(r: Row) {
    setFixing(r);
    setDest("");
    setStatus(301);
    setErr(null);
  }

  async function createRedirect() {
    if (status !== 410 && !dest.trim()) {
      setErr("آدرس مقصد را وارد کنید");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: fixing!.path,
        destination: status === 410 ? "" : normalizeDestination(dest),
        statusCode: status,
        matchType: "EXACT",
        note: "از گزارش ۴۰۴",
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.errors?.[0]?.message || "ساخته نشد");
      return;
    }

    // بعد از ساخت ریدایرکت، ردیف ۴۰۴ دیگر لازم نیست
    await fetch(`/api/admin/not-found-log?id=${fixing!.id}`, { method: "DELETE" });
    setFixing(null);
    setToast("ریدایرکت ساخته شد — تا حداکثر ۶۰ ثانیه دیگر اعمال می‌شود");
    load();
  }

  async function setIgnored(r: Row, ignored: boolean) {
    await fetch("/api/admin/not-found-log", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, ignored }),
    });
    load();
  }

  async function clearAll() {
    if (!confirm("کل گزارش ۴۰۴ پاک شود؟ این کار برگشت‌پذیر نیست.")) return;
    const res = await fetch("/api/admin/not-found-log?all=1", { method: "DELETE" });
    const d = await res.json();
    setToast(`${d.deleted} ردیف پاک شد`);
    load();
  }

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">گزارش ۴۰۴</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            آدرس‌هایی که بازدیدکننده‌ها روی آن‌ها به صفحه‌ی «یافت نشد» رسیده‌اند.
          </p>
        </div>
        {total > 0 && (
          <button onClick={clearAll} className="px-4 py-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-bold text-red-600 dark:text-red-400">
            پاک‌سازی همه
          </button>
        )}
      </div>

      {toast && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-sm text-green-800 dark:text-green-300">
          {toast}
        </div>
      )}

      {fixing && (
        <div className="mb-6 p-5 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10">
          <h2 className="font-bold text-gray-900 dark:text-white mb-1">ساخت ریدایرکت</h2>
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-4 break-all" dir="ltr">{fixing.path}</p>
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">هدایت شود به</label>
              <input
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                disabled={status === 410}
                dir="ltr"
                placeholder="/products/new-name"
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">نوع</label>
              <select
                value={status}
                onChange={(e) => setStatus(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value={301}>۳۰۱ — دائمی</option>
                <option value={302}>۳۰۲ — موقت</option>
                <option value={410}>۴۱۰ — حذف شده</option>
              </select>
            </div>
          </div>
          {err && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{err}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={createRedirect} disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-bold disabled:opacity-50">
              {saving ? "ذخیره…" : "ساخت ریدایرکت"}
            </button>
            <button onClick={() => setFixing(null)} className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-sm font-bold">
              انصراف
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="جستجو در آدرس‌ها…"
          className="flex-1 min-w-52 px-4 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-gray-100"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 px-3">
          <input type="checkbox" checked={showIgnored} onChange={(e) => { setShowIgnored(e.target.checked); setPage(1); }} />
          نمایش نادیده‌گرفته‌شده‌ها
        </label>
      </div>

      <div className="rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr className="text-xs text-gray-500 dark:text-gray-400">
                <th className="text-right font-bold px-4 py-3">آدرس</th>
                <th className="text-right font-bold px-4 py-3">تعداد</th>
                <th className="text-right font-bold px-4 py-3">آخرین بازدید</th>
                <th className="text-right font-bold px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">در حال بارگذاری…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">
                  {showIgnored ? "موردی نادیده گرفته نشده." : "هیچ ۴۰۴ای ثبت نشده — یعنی همه‌چیز درست کار می‌کند."}
                </td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-white/5">
                  <td className="px-4 py-3">
                    <span dir="ltr" className="font-mono text-xs break-all text-gray-900 dark:text-gray-200">{r.path}</span>
                    {r.referer && (
                      <div dir="ltr" className="font-mono text-[10px] text-gray-400 mt-0.5 break-all">از: {r.referer}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-900 dark:text-gray-200">{r.hits.toLocaleString("fa-IR")}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(r.lastSeen).toLocaleDateString("fa-IR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end whitespace-nowrap">
                      {!r.ignored && (
                        <button onClick={() => openFix(r)} className="text-xs text-primary-600 dark:text-primary-400 font-bold">
                          ساخت ریدایرکت
                        </button>
                      )}
                      <button onClick={() => setIgnored(r, !r.ignored)} className="text-xs text-gray-500 font-bold">
                        {r.ignored ? "بازگردانی" : "نادیده بگیر"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm disabled:opacity-40">قبلی</button>
          <span className="text-sm text-gray-500 tabular-nums">{page} از {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm disabled:opacity-40">بعدی</button>
        </div>
      )}
    </div>
  );
}
