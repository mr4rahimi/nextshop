"use client";

import { useState } from "react";

interface GuarantyItem {
  id: string;
  serialNumber: string;
  productTitle: string;
  startDate: string;
  endDate: string;
  durationDays: number;
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}

function remainingDays(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function StatusBadge({ endDate }: { endDate: string }) {
  const days = remainingDays(endDate);
  if (days < 0) {
    return <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-400 border border-gray-200 dark:border-white/10">گارانتی منقضی شده</span>;
  }
  if (days <= 14) {
    return <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">{toFa(days)} روز تا پایان گارانتی</span>;
  }
  return <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">{toFa(days)} روز تا پایان گارانتی</span>;
}

function RequestForm({ guaranty }: { guaranty: GuarantyItem }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (description.trim().length < 5) {
      setError("لطفاً توضیحات را کامل‌تر بنویسید");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/guaranty/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guarantyId: guaranty.id, description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ثبت درخواست");
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-sm text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        درخواست شما با موفقیت ثبت شد. به‌زودی با شما تماس گرفته خواهد شد.
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mt-4 px-5 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl text-sm font-black hover:bg-red-100 dark:hover:bg-red-500/20 transition-all">
        ثبت مشکل گارانتی
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-gray-500 leading-6">
        لطفاً توضیحات خود را در مورد محصول با شماره ستومان <span className="font-mono font-black text-gray-700 dark:text-gray-300" dir="ltr">{guaranty.serialNumber}</span> بنویسید و ثبت کنید. به‌زودی با شما تماس گرفته خواهد شد.
      </p>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-bold">
          {error}
        </div>
      )}

      <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
        placeholder="توضیح مشکل خود را اینجا بنویسید..."
        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all resize-none" />

      <div className="flex gap-2">
        <button onClick={submit} disabled={submitting}
          className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all">
          {submitting ? "در حال ارسال..." : "ثبت درخواست"}
        </button>
        <button onClick={() => setOpen(false)}
          className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-black hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
          انصراف
        </button>
      </div>
    </div>
  );
}

export default function WarrantyPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GuarantyItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setItems(null);
    try {
      const res = await fetch(`/api/guaranty/lookup?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "گارانتی برای شما ثبت نشده است");
        return;
      }
      setItems(data.items);
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-100 dark:bg-[#050505] min-h-screen py-12" dir="rtl">
      <div className="container max-w-2xl mx-auto px-4">

        {}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">استعلام گارانتی</h1>
          <p className="text-sm text-gray-500 mt-2">شماره ستومان محصول یا شماره موبایل خود را وارد کنید</p>
        </div>

        {}
        <form onSubmit={search} className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 flex flex-col sm:flex-row gap-3">
          <input dir="ltr" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="شماره ستومان یا شماره موبایل..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all" />
          <button type="submit" disabled={loading}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all whitespace-nowrap">
            {loading ? "در حال جستجو..." : "استعلام گارانتی"}
          </button>
        </form>

        {}
        {error && (
          <div className="mt-6 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-sm text-amber-700 dark:text-amber-400 font-bold text-center">
            {error}
          </div>
        )}

        {items && items.length > 0 && (
          <div className="mt-6 space-y-4">
            {items.map(item => (
              <div key={item.id} className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white">{item.productTitle}</h3>
                    <p className="text-xs text-gray-400 mt-1 font-mono" dir="ltr">ستومان: {item.serialNumber}</p>
                  </div>
                  <StatusBadge endDate={item.endDate} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3">
                    <p className="text-gray-400 font-bold mb-1">تاریخ شروع گارانتی</p>
                    <p className="font-black text-gray-700 dark:text-gray-300">{formatDate(item.startDate)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3">
                    <p className="text-gray-400 font-bold mb-1">تاریخ پایان گارانتی</p>
                    <p className="font-black text-gray-700 dark:text-gray-300">{formatDate(item.endDate)}</p>
                  </div>
                </div>

                <RequestForm guaranty={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
