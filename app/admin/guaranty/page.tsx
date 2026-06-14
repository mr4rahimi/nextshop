"use client";

import { useEffect, useState, useCallback } from "react";

interface GuarantyItem {
  id: string;
  serialNumber: string;
  productTitle: string;
  durationDays: number;
  startDate: string;
  endDate: string;
  notes: string | null;
  createdAt: string;
  user: { firstName: string | null; lastName: string | null; phone: string };
  _count?: { requests: number };
}

const PAGE_SIZE = 20;

function toFa(n: number) { return n.toLocaleString("fa-IR"); }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}

function remainingDays(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function RemainingBadge({ endDate }: { endDate: string }) {
  const days = remainingDays(endDate);
  if (days < 0) {
    return <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-400 border border-gray-200 dark:border-white/10">منقضی شده</span>;
  }
  if (days <= 14) {
    return <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">{toFa(days)} روز مانده</span>;
  }
  if (days <= 30) {
    return <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">{toFa(days)} روز مانده</span>;
  }
  return <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">{toFa(days)} روز مانده</span>;
}

const inp = "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all";

const DURATION_PRESETS = [
  { label: "۶ ماهه", days: 180 },
  { label: "۱۲ ماهه", days: 365 },
  { label: "۱۸ ماهه", days: 540 },
  { label: "۲۴ ماهه", days: 730 },
];

export default function GuarantyListPage() {
  // ── فرم ثبت ──────────────────────────────────────────────────────────────
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [durationDays, setDurationDays] = useState("180");
  const [notes, setNotes] = useState("");
  const [userLookup, setUserLookup] = useState<"idle" | "loading" | "found" | "new">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // ── لیست ─────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<GuarantyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("newest");

  // ── ویرایش ───────────────────────────────────────────────────────────────
  const [editItem, setEditItem] = useState<GuarantyItem | null>(null);
  const [editSerial, setEditSerial] = useState("");
  const [editProduct, setEditProduct] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── lookup کاربر با موبایل ───────────────────────────────────────────────
  useEffect(() => {
    if (phone.length < 10) { setUserLookup("idle"); return; }
    const t = setTimeout(async () => {
      setUserLookup("loading");
      try {
        const res = await fetch(`/api/admin/guaranty/lookup-user?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (data.user) {
          setUserLookup("found");
          setFirstName(data.user.firstName || "");
          setLastName(data.user.lastName || "");
        } else {
          setUserLookup("new");
        }
      } catch {
        setUserLookup("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [phone]);

  // ── debounce جستجو ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, sort]);

  // ── دریافت لیست ──────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sort,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/guaranty?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sort]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── ثبت گارانتی ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/guaranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone, firstName, lastName, serialNumber, productTitle,
          durationDays: Number(durationDays), notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ثبت گارانتی");

      setFormSuccess(true);
      setPhone(""); setFirstName(""); setLastName("");
      setSerialNumber(""); setProductTitle(""); setNotes("");
      setDurationDays("180"); setUserLookup("idle");
      setTimeout(() => setFormSuccess(false), 2500);
      setPage(1);
      fetchItems();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── ویرایش ───────────────────────────────────────────────────────────────
  function openEdit(item: GuarantyItem) {
    setEditItem(item);
    setEditSerial(item.serialNumber);
    setEditProduct(item.productTitle);
    setEditDuration(String(item.durationDays));
    setEditStartDate(item.startDate.slice(0, 10));
    setEditNotes(item.notes || "");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editItem) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/guaranty/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber: editSerial,
          productTitle: editProduct,
          durationDays: Number(editDuration),
          startDate: editStartDate,
          notes: editNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره");
      setEditItem(null);
      fetchItems();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/guaranty/${id}`, { method: "DELETE" });
      setItems(prev => prev.filter(i => i.id !== id));
      setTotal(t => Math.max(0, t - 1));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      {/* هدر */}
      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">مدیریت گارانتی</h1>
        <p className="text-xs text-gray-500 mt-0.5">{toFa(total)} گارانتی ثبت شده</p>
      </div>

      {/* فرم ثبت گارانتی جدید */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5">
        <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4">ثبت گارانتی جدید</h2>

        {formError && (
          <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-bold">
            {formError}
          </div>
        )}
        {formSuccess && (
          <div className="flex items-center gap-3 p-3 mb-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            گارانتی با موفقیت ثبت شد
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300">شماره موبایل خریدار *</label>
              <div className="relative">
                <input required dir="ltr" value={phone} onChange={e => setPhone(e.target.value)}
                  className={inp} placeholder="09xxxxxxxxx" />
                {userLookup === "loading" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">در حال بررسی...</span>
                )}
                {userLookup === "found" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-500">کاربر موجود ✓</span>
                )}
                {userLookup === "new" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-500">کاربر جدید</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300">نام *</label>
              <input required value={firstName} onChange={e => setFirstName(e.target.value)}
                className={inp} placeholder="نام خریدار" />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300">نام خانوادگی *</label>
              <input required value={lastName} onChange={e => setLastName(e.target.value)}
                className={inp} placeholder="نام خانوادگی خریدار" />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300">شماره سریال محصول *</label>
              <input required dir="ltr" value={serialNumber} onChange={e => setSerialNumber(e.target.value)}
                className={inp} placeholder="SN-XXXXXXX" />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300">عنوان محصول *</label>
              <input required value={productTitle} onChange={e => setProductTitle(e.target.value)}
                className={inp} placeholder="نام محصول" />
            </div>
          </div>

          {/* مدت گارانتی */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-700 dark:text-gray-300">مدت گارانتی (روز) *</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map(p => (
                <button key={p.days} type="button" onClick={() => setDurationDays(String(p.days))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                    Number(durationDays) === p.days
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10"
                  }`}>
                  {p.label}
                </button>
              ))}
              <input required type="number" min="1" dir="ltr" value={durationDays}
                onChange={e => setDurationDays(e.target.value)}
                className="w-28 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                placeholder="روز دلخواه" />
            </div>
            <p className="text-[11px] text-gray-400">
              تاریخ شروع: امروز — تاریخ پایان به‌صورت خودکار محاسبه می‌شود.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-gray-700 dark:text-gray-300">یادداشت (اختیاری)</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className={`${inp} resize-none`} placeholder="توضیحات داخلی..." />
          </div>

          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-blue-500/30">
            {submitting ? "در حال ثبت..." : "ثبت گارانتی"}
          </button>
        </form>
      </div>

      {/* فیلتر و جستجو */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام، موبایل، سریال یا محصول..."
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all" />
        </div>

        <div className="flex gap-2">
          {[
            { value: "newest", label: "جدیدترین" },
            { value: "remaining_asc", label: "نزدیک به اتمام" },
            { value: "remaining_desc", label: "بیشترین باقیمانده" },
          ].map(o => (
            <button key={o.value} onClick={() => setSort(o.value)}
              className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${
                sort === o.value
                  ? "bg-blue-600 text-white shadow shadow-blue-500/20"
                  : "bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* جدول */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1fr_140px_140px_120px_120px_140px_140px] gap-3 px-5 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/[0.06]">
          {["خریدار", "محصول", "سریال", "تاریخ ثبت", "تاریخ پایان", "وضعیت", "عملیات"].map(h => (
            <div key={h} className="text-[11px] font-black text-gray-400">{h}</div>
          ))}
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">در حال بارگذاری...</div>}

        {!loading && items.length === 0 && (
          <div className="py-16 text-center text-sm font-bold text-gray-400">گارانتی‌ای یافت نشد</div>
        )}

        {!loading && items.map((item, idx) => (
          <div key={item.id}
            className={`flex flex-col lg:grid lg:grid-cols-[1fr_140px_140px_120px_120px_140px_140px] gap-3 px-5 py-3.5 items-center transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] ${
              idx < items.length - 1 ? "border-b border-gray-50 dark:border-white/[0.04]" : ""
            }`}>

            <div className="w-full">
              <p className="text-sm font-black text-gray-900 dark:text-white">{item.user.firstName} {item.user.lastName}</p>
              <p className="text-[11px] text-gray-400" dir="ltr">{item.user.phone}</p>
            </div>

            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate" title={item.productTitle}>
              {item.productTitle}
            </div>

            <div className="text-xs font-mono text-gray-500" dir="ltr">{item.serialNumber}</div>

            <div className="text-[11px] text-gray-400">{formatDate(item.startDate)}</div>

            <div className="text-[11px] text-gray-400">{formatDate(item.endDate)}</div>

            <div><RemainingBadge endDate={item.endDate} /></div>

            <div className="flex gap-1.5">
              <button onClick={() => openEdit(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-black text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all">
                ویرایش
              </button>
              <button onClick={() => setConfirmDeleteId(item.id)} disabled={!!deletingId}
                className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-500/30 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* صفحه‌بندی */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-gray-400">
            نمایش {toFa((page - 1) * PAGE_SIZE + 1)} تا {toFa(Math.min(page * PAGE_SIZE, total))} از {toFa(total)} گارانتی
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
              قبلی
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, i, arr) => (
                <span key={p} className="flex items-center gap-1.5">
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="text-gray-400 text-xs px-1">...</span>}
                  <button onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                      p === page
                        ? "bg-blue-600 text-white shadow shadow-blue-500/20"
                        : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
                    }`}>
                    {toFa(p)}
                  </button>
                </span>
              ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
              بعدی
            </button>
          </div>
        </div>
      )}

      {/* مودال ویرایش */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setEditItem(null)}>
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">
                ویرایش گارانتی — {editItem.user.firstName} {editItem.user.lastName}
              </h3>
              <button onClick={() => setEditItem(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-bold">
                  {editError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">شماره سریال</label>
                <input dir="ltr" value={editSerial} onChange={e => setEditSerial(e.target.value)} className={inp} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">عنوان محصول</label>
                <input value={editProduct} onChange={e => setEditProduct(e.target.value)} className={inp} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300">تاریخ شروع</label>
                  <input type="date" dir="ltr" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} className={inp} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300">مدت (روز)</label>
                  <input type="number" min="1" dir="ltr" value={editDuration} onChange={e => setEditDuration(e.target.value)} className={inp} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">یادداشت</label>
                <textarea rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} className={`${inp} resize-none`} />
              </div>

              <button onClick={saveEdit} disabled={savingEdit}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all">
                {savingEdit ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال حذف */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <h3 className="text-base font-black text-gray-900 dark:text-white mb-2">حذف گارانتی</h3>
            <p className="text-sm text-gray-500 mb-6">این عملیات برگشت‌پذیر نیست. مطمئنید؟</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-black transition-all">
                انصراف
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)} disabled={!!deletingId}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all">
                {deletingId ? "در حال حذف..." : "حذف کن"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}