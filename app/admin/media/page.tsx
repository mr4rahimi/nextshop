"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface MediaItem {
  id: string;
  fileName: string;
  originalName: string;
  url: string;
  mimeType: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "OTHER";
  size: number;
  title: string | null;
  altText: string | null;
  folder: string | null;
  createdAt: string;
}

const PAGE_SIZE = 24;

const TYPE_TABS: { value: string; label: string; icon: string }[] = [
  { value: "ALL", label: "همه", icon: "🗂️" },
  { value: "IMAGE", label: "تصاویر", icon: "🖼️" },
  { value: "VIDEO", label: "ویدیو", icon: "🎬" },
  { value: "AUDIO", label: "صدا", icon: "🎵" },
  { value: "DOCUMENT", label: "اسناد", icon: "📄" },
  { value: "OTHER", label: "سایر", icon: "📦" },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toFa(n: number) { return n.toLocaleString("fa-IR"); }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}

function FileIcon({ type, mime }: { type: string; mime: string }) {
  const cfg: Record<string, { icon: string; bg: string; color: string }> = {
    VIDEO:    { icon: "🎬", bg: "bg-purple-50 dark:bg-purple-500/10", color: "text-purple-500" },
    AUDIO:    { icon: "🎵", bg: "bg-pink-50 dark:bg-pink-500/10", color: "text-pink-500" },
    DOCUMENT: { icon: "📄", bg: "bg-blue-50 dark:bg-blue-500/10", color: "text-blue-500" },
    OTHER:    { icon: "📦", bg: "bg-gray-100 dark:bg-white/5", color: "text-gray-400" },
  };
  const c = cfg[type] || cfg.OTHER;
  return (
    <div className={`w-full h-full flex items-center justify-center ${c.bg}`}>
      <span className="text-3xl">{c.icon}</span>
    </div>
  );
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; all: number } | null>(null);

  const [activeType, setActiveType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stats, setStats] = useState<Record<string, number>>({});

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAlt, setEditAlt] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [deletingDetail, setDeletingDetail] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [activeType, debouncedSearch]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        type: activeType,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/media?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? {});
    } finally {
      setLoading(false);
    }
  }, [page, activeType, debouncedSearch]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;

    setUploading(true);
    setUploadProgress({ done: 0, all: arr.length });

    const chunkSize = 5;
    let done = 0;
    try {
      for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        const fd = new FormData();
        chunk.forEach(f => fd.append("files", f));
        await fetch("/api/admin/media", { method: "POST", body: fd });
        done += chunk.length;
        setUploadProgress({ done, all: arr.length });
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setPage(1);
      setActiveType("ALL");
      fetchItems();
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() { setSelected(new Set()); }

  async function bulkDelete() {
    await fetch("/api/admin/media/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    clearSelection();
    setConfirmBulkDelete(false);
    fetchItems();
  }

  function openDetail(item: MediaItem) {
    setDetailItem(item);
    setEditTitle(item.title ?? "");
    setEditAlt(item.altText ?? "");
  }

  async function saveDetail() {
    if (!detailItem) return;
    setSavingDetail(true);
    try {
      await fetch(`/api/admin/media/${detailItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, altText: editAlt }),
      });
      setItems(prev => prev.map(i => i.id === detailItem.id ? { ...i, title: editTitle, altText: editAlt } : i));
      setDetailItem(null);
    } finally {
      setSavingDetail(false);
    }
  }

  async function deleteDetail() {
    if (!detailItem) return;
    setDeletingDetail(true);
    try {
      await fetch(`/api/admin/media/${detailItem.id}`, { method: "DELETE" });
      setItems(prev => prev.filter(i => i.id !== detailItem.id));
      setTotal(t => Math.max(0, t - 1));
      setDetailItem(null);
    } finally {
      setDeletingDetail(false);
    }
  }

  function copyUrl(item: MediaItem) {
    const fullUrl = `${window.location.origin}${item.url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">کتابخانه رسانه</h1>
          <p className="text-xs text-gray-500 mt-0.5">{toFa(total)} فایل در سیستم</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={() => setConfirmBulkDelete(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl text-xs font-black transition-all hover:bg-red-100 dark:hover:bg-red-500/20">
              حذف {toFa(selected.size)} فایل
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-500/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            {uploading ? "در حال آپلود..." : "آپلود فایل"}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={e => e.target.files && uploadFiles(e.target.files)} />
        </div>
      </div>

      {}
      {uploadProgress && (
        <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-gray-700 dark:text-gray-300">در حال آپلود فایل‌ها...</span>
            <span className="text-xs font-bold text-gray-400">{toFa(uploadProgress.done)} از {toFa(uploadProgress.all)}</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(uploadProgress.done / uploadProgress.all) * 100}%` }} />
          </div>
        </div>
      )}

      {}
      <div className="flex items-center gap-2 flex-wrap">
        {TYPE_TABS.map(tab => {
          const count = tab.value === "ALL"
            ? Object.values(stats).reduce((a, b) => a + b, 0)
            : (stats[tab.value] ?? 0);
          return (
            <button key={tab.value} onClick={() => setActiveType(tab.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all border ${
                activeType === tab.value
                  ? "bg-blue-600 text-white border-blue-600 shadow shadow-blue-500/20"
                  : "bg-white dark:bg-[#0f1117] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/[0.06] hover:border-blue-300"
              }`}>
              <span>{tab.icon}</span>
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeType === tab.value ? "bg-white/20" : "bg-gray-100 dark:bg-white/5 text-gray-400"
              }`}>{toFa(count)}</span>
            </button>
          );
        })}

        {}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="جستجو در نام فایل..."
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        {selected.size > 0 && (
          <button onClick={clearSelection}
            className="px-3 py-2.5 rounded-xl text-xs font-black text-gray-500 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
            لغو انتخاب
          </button>
        )}
      </div>

      {}
      <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4 relative min-h-[300px]">

        {}
        {dragOver && (
          <div className="absolute inset-0 z-20 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-2xl flex items-center justify-center pointer-events-none">
            <p className="text-blue-600 dark:text-blue-400 font-black text-lg">فایل‌ها را اینجا رها کنید</p>
          </div>
        )}

        {loading && (
          <div className="py-16 text-center text-sm text-gray-400">در حال بارگذاری...</div>
        )}

        {!loading && items.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 mx-auto mb-4 flex items-center justify-center text-3xl">
              📁
            </div>
            <p className="text-sm font-bold text-gray-400">فایلی یافت نشد</p>
            <p className="text-xs text-gray-400 mt-1">فایل‌ها را اینجا بکشید یا از دکمه آپلود استفاده کنید</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map(item => (
              <div key={item.id}
                className={`group relative rounded-xl border overflow-hidden bg-gray-50 dark:bg-white/[0.02] cursor-pointer transition-all ${
                  selected.has(item.id)
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-gray-100 dark:border-white/[0.06] hover:border-blue-300 dark:hover:border-blue-500/30"
                }`}
                onClick={() => openDetail(item)}
              >
                {}
                <button
                  onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}
                  className={`absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-lg flex items-center justify-center transition-all border ${
                    selected.has(item.id)
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white/80 dark:bg-black/40 border-white/60 dark:border-white/20 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {selected.has(item.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {}
                <div className="aspect-square w-full">
                  {item.type === "IMAGE" ? (
                    <img src={item.url} alt={item.altText ?? item.originalName} className="w-full h-full object-cover" />
                  ) : (
                    <FileIcon type={item.type} mime={item.mimeType} />
                  )}
                </div>

                {}
                <div className="p-2">
                  <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate" title={item.originalName}>
                    {item.title || item.originalName}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{formatSize(item.size)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-gray-400">
            نمایش {toFa((page - 1) * PAGE_SIZE + 1)} تا {toFa(Math.min(page * PAGE_SIZE, total))} از {toFa(total)} فایل
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

      {}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 dark:text-white mb-2">حذف {toFa(selected.size)} فایل</h3>
            <p className="text-sm text-gray-500 mb-6">این عملیات برگشت‌پذیر نیست. مطمئنید؟</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBulkDelete(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-black transition-all">
                انصراف
              </button>
              <button onClick={bulkDelete}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-black transition-all">
                حذف کن
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetailItem(null)}>
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">جزئیات فایل</h3>
              <button onClick={() => setDetailItem(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {}
              <div className="space-y-3">
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]">
                  {detailItem.type === "IMAGE" ? (
                    <img src={detailItem.url} alt={detailItem.altText ?? ""} className="w-full h-full object-contain" />
                  ) : detailItem.type === "VIDEO" ? (
                    <video src={detailItem.url} controls className="w-full h-full object-contain" />
                  ) : detailItem.type === "AUDIO" ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6">
                      <span className="text-5xl">🎵</span>
                      <audio src={detailItem.url} controls className="w-full" />
                    </div>
                  ) : (
                    <FileIcon type={detailItem.type} mime={detailItem.mimeType} />
                  )}
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p><span className="font-bold text-gray-400">نام فایل: </span>{detailItem.originalName}</p>
                  <p><span className="font-bold text-gray-400">نوع: </span><span dir="ltr">{detailItem.mimeType}</span></p>
                  <p><span className="font-bold text-gray-400">حجم: </span>{formatSize(detailItem.size)}</p>
                  <p><span className="font-bold text-gray-400">تاریخ آپلود: </span>{formatDate(detailItem.createdAt)}</p>
                </div>
              </div>

              {}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300">عنوان</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="عنوان فایل" />
                </div>
                {detailItem.type === "IMAGE" && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-gray-700 dark:text-gray-300">متن جایگزین (Alt)</label>
                    <input value={editAlt} onChange={e => setEditAlt(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all"
                      placeholder="برای سئو و دسترسی‌پذیری" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300">آدرس فایل</label>
                  <div className="flex gap-2">
                    <input readOnly dir="ltr" value={detailItem.url}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-500 focus:outline-none" />
                    <button onClick={() => copyUrl(detailItem)}
                      className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-black text-gray-600 dark:text-gray-300 hover:border-blue-300 transition-all whitespace-nowrap">
                      {copiedId === detailItem.id ? "کپی شد ✓" : "کپی"}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={saveDetail} disabled={savingDetail}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all">
                    {savingDetail ? "در حال ذخیره..." : "ذخیره تغییرات"}
                  </button>
                  <button onClick={deleteDetail} disabled={deletingDetail}
                    className="px-4 py-2.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-xl text-sm font-black transition-all">
                    {deletingDetail ? "..." : "حذف"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
