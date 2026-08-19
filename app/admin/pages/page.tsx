"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TEMPLATE_META, type PageTemplate } from "@/lib/pages";
import { PAGE_STARTERS } from "@/lib/pageStarters";

type Row = {
  id: string; slug: string; title: string; subtitle: string | null;
  template: PageTemplate; isActive: boolean; isIndexable: boolean;
  sortOrder: number; updatedAt: string;
};

export default function PagesAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // بدون setState همگام در بدنه‌ی افکت: مقدار اولیه‌ی loading از قبل true است
  const load = useCallback(async () => {
    const res = await fetch("/api/admin/pages");
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(row: Row) {
    setRows(rs => rs.map(r => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)));
    await fetch(`/api/admin/pages/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch: true, isActive: !row.isActive }),
    });
  }

  async function remove(row: Row) {
    if (!confirm(`برگه «${row.title}» حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;
    await fetch(`/api/admin/pages/${row.id}`, { method: "DELETE" });
    load();
  }

  const filtered = rows.filter(r =>
    !q.trim() || r.title.includes(q.trim()) || r.slug.includes(q.trim())
  );

  const existingSlugs = new Set(rows.map(r => r.slug));

  return (
    <div className="space-y-6" dir="rtl">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">برگه‌ها</h1>
          <p className="text-xs text-gray-400 mt-1">
            برگه‌های ثابت سایت مثل تماس با ما، درباره ما و قوانین. نشانی هر برگه در ریشه‌ی سایت است.
          </p>
        </div>
        <Link href="/admin/pages/create"
          className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-black hover:bg-primary-700 transition-colors">
          + برگه جدید
        </Link>
      </div>

      {/* شروع سریع */}
      <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-5">
        <h2 className="text-sm font-black text-gray-900 dark:text-white">شروع سریع</h2>
        <p className="text-[11px] text-gray-400 mt-1 mb-4">
          روی هر کدام بزنید تا برگه‌ای با ساختار و متن نمونه‌ی آماده باز شود؛ فقط جای اطلاعات را عوض کنید.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PAGE_STARTERS.map(s => {
            const made = !!s.slug && existingSlugs.has(s.slug);
            return (
              <Link key={s.key} href={`/admin/pages/create?starter=${s.key}`}
                className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-primary-500 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-all text-center">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-xs font-black text-gray-800 dark:text-gray-200">{s.label}</div>
                {made && <div className="text-[10px] text-emerald-600 font-bold mt-1">قبلاً ساخته شده</div>}
              </Link>
            );
          })}
        </div>
      </section>

      {/* لیست */}
      <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در عنوان یا نشانی..."
            className="w-full md:w-72 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-primary-500" />
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">در حال بارگذاری...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-400">هنوز برگه‌ای ساخته نشده است.</p>
            <p className="text-xs text-gray-400 mt-1">از «شروع سریع» بالا یکی را انتخاب کنید.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map(row => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">

                <span className="text-xl w-8 text-center flex-shrink-0">{TEMPLATE_META[row.template]?.icon ?? "📄"}</span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/admin/pages/${row.id}`}
                      className="text-sm font-black text-gray-900 dark:text-white hover:text-primary-600 truncate">
                      {row.title}
                    </Link>
                    {!row.isIndexable && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20">noindex</span>
                    )}
                  </div>
                  <button type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(`${location.origin}/${row.slug}`);
                      setCopied(row.id);
                      setTimeout(() => setCopied(c => (c === row.id ? null : c)), 1500);
                    }}
                    className="text-[11px] font-mono text-gray-400 hover:text-primary-600 transition-colors"
                    title="کپی نشانی کامل">
                    /{row.slug} {copied === row.id ? "✓ کپی شد" : "⧉"}
                  </button>
                </div>

                <span className="text-[11px] text-gray-400 hidden md:block">
                  {TEMPLATE_META[row.template]?.label}
                </span>

                <button type="button" onClick={() => toggleActive(row)}
                  className={`text-[11px] font-black px-3 py-1.5 rounded-xl transition-colors ${row.isActive
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800"}`}>
                  {row.isActive ? "فعال" : "غیرفعال"}
                </button>

                <div className="flex items-center gap-1">
                  <a href={`/${row.slug}`} target="_blank" rel="noreferrer"
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title="مشاهده در سایت">↗</a>
                  <button type="button" onClick={() => router.push(`/admin/pages/${row.id}`)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title="ویرایش">✎</button>
                  <button type="button" onClick={() => remove(row)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" title="حذف">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
