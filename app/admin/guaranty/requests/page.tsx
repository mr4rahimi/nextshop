"use client";

import { useEffect, useState, useCallback } from "react";

interface RequestItem {
  id: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  adminNote: string | null;
  createdAt: string;
  guaranty: {
    serialNumber: string;
    productTitle: string;
    endDate: string;
    user: { firstName: string | null; lastName: string | null; phone: string };
  };
}

const PAGE_SIZE = 20;

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "ALL", label: "همه" },
  { value: "PENDING", label: "در انتظار" },
  { value: "IN_PROGRESS", label: "در حال بررسی" },
  { value: "RESOLVED", label: "حل شده" },
  { value: "REJECTED", label: "رد شده" },
];

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDING:     { label: "در انتظار",    color: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20" },
  IN_PROGRESS: { label: "در حال بررسی", color: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" },
  RESOLVED:    { label: "حل شده",       color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" },
  REJECTED:    { label: "رد شده",       color: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20" },
};

function toFa(n: number) { return n.toLocaleString("fa-IR"); }
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function GuarantyRequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [detailItem, setDetailItem] = useState<RequestItem | null>(null);
  const [editStatus, setEditStatus] = useState("PENDING");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [activeStatus, debouncedSearch]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status: activeStatus,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/guaranty-requests?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, activeStatus, debouncedSearch]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function openDetail(item: RequestItem) {
    setDetailItem(item);
    setEditStatus(item.status);
    setEditNote(item.adminNote || "");
  }

  async function saveDetail() {
    if (!detailItem) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/guaranty-requests/${detailItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus, adminNote: editNote }),
      });
      setItems(prev => prev.map(i => i.id === detailItem.id ? { ...i, status: editStatus as any, adminNote: editNote } : i));
      setDetailItem(null);
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">

      <div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white">درخواست‌های گارانتی</h1>
        <p className="text-xs text-gray-500 mt-0.5">{toFa(total)} درخواست ثبت شده</p>
      </div>

      {/* فیلتر */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setActiveStatus(tab.value)}
              className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${
                activeStatus === tab.value
                  ? "bg-blue-600 text-white shadow shadow-blue-500/20"
                  : "bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="جستجو بر اساس موبایل، سریال یا محصول..."
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all" />
        </div>
      </div>

      {/* لیست */}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1fr_140px_1fr_140px_140px_100px] gap-3 px-5 py-3 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/[0.06]">
          {["خریدار", "سریال محصول", "توضیحات", "تاریخ ثبت", "وضعیت", ""].map(h => (
            <div key={h} className="text-[11px] font-black text-gray-400">{h}</div>
          ))}
        </div>

        {loading && <div className="py-16 text-center text-sm text-gray-400">در حال بارگذاری...</div>}

        {!loading && items.length === 0 && (
          <div className="py-16 text-center text-sm font-bold text-gray-400">درخواستی یافت نشد</div>
        )}

        {!loading && items.map((item, idx) => (
          <div key={item.id}
            className={`flex flex-col lg:grid lg:grid-cols-[1fr_140px_1fr_140px_140px_100px] gap-3 px-5 py-3.5 items-center transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer ${
              idx < items.length - 1 ? "border-b border-gray-50 dark:border-white/[0.04]" : ""
            }`}
            onClick={() => openDetail(item)}
          >
            <div className="w-full">
              <p className="text-sm font-black text-gray-900 dark:text-white">{item.guaranty.user.firstName} {item.guaranty.user.lastName}</p>
              <p className="text-[11px] text-gray-400" dir="ltr">{item.guaranty.user.phone}</p>
            </div>

            <div className="text-xs font-mono text-gray-500" dir="ltr">{item.guaranty.serialNumber}</div>

            <div className="text-xs text-gray-600 dark:text-gray-400 truncate" title={item.description}>
              {item.description}
            </div>

            <div className="text-[11px] text-gray-400">{formatDate(item.createdAt)}</div>

            <div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${STATUS_CFG[item.status].color}`}>
                {STATUS_CFG[item.status].label}
              </span>
            </div>

            <div className="text-xs font-black text-blue-600 dark:text-blue-400">مشاهده ←</div>
          </div>
        ))}
      </div>

      {/* صفحه‌بندی */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-gray-400">
            نمایش {toFa((page - 1) * PAGE_SIZE + 1)} تا {toFa(Math.min(page * PAGE_SIZE, total))} از {toFa(total)} درخواست
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

      {/* مودال جزئیات */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetailItem(null)}>
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">جزئیات درخواست</h3>
              <button onClick={() => setDetailItem(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-gray-500 space-y-1 bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3">
                <p><span className="font-bold text-gray-400">خریدار: </span>{detailItem.guaranty.user.firstName} {detailItem.guaranty.user.lastName} (<span dir="ltr">{detailItem.guaranty.user.phone}</span>)</p>
                <p><span className="font-bold text-gray-400">محصول: </span>{detailItem.guaranty.productTitle}</p>
                <p><span className="font-bold text-gray-400">سریال: </span><span dir="ltr">{detailItem.guaranty.serialNumber}</span></p>
                <p><span className="font-bold text-gray-400">انقضای گارانتی: </span>{formatDate(detailItem.guaranty.endDate)}</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">توضیحات کاربر</label>
                <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3 leading-6">
                  {detailItem.description}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">وضعیت</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                    <button key={key} type="button" onClick={() => setEditStatus(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                        editStatus === key ? cfg.color : "bg-gray-50 dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10"
                      }`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300">یادداشت ادمین</label>
                <textarea rows={3} value={editNote} onChange={e => setEditNote(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all resize-none"
                  placeholder="یادداشت داخلی برای پیگیری..." />
              </div>

              <button onClick={saveDetail} disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all">
                {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}