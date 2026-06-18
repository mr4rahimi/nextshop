"use client";

import { useEffect, useState, useCallback } from "react";

// ─── انواع ───────────────────────────────────────────────────────────────────
interface ConvListItem {
  id: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  firstMessage: string;
  user: { name: string; phone: string } | null;
  isGuest: boolean;
}

interface ConvMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  context: string | null;
  createdAt: string;
}

interface ConvDetail {
  id: string;
  createdAt: string;
  isGuest: boolean;
  user: { name: string; phone: string; email: string | null } | null;
  messages: ConvMessage[];
}

// برچسب فارسی برای context
function contextLabel(ctx: string | null): string {
  if (!ctx) return "";
  if (ctx.startsWith("topic:")) {
    const t = ctx.slice(6);
    const map: Record<string, string> = {
      warranty: "گارانتی",
      shipping: "ارسال",
      contact: "تماس",
      address: "آدرس",
      about: "درباره",
    };
    return map[t] ?? t;
  }
  if (ctx.startsWith("category:")) return `دسته: ${ctx.slice(9)}`;
  if (ctx === "free") return "سوال آزاد";
  if (ctx === "menu") return "منو";
  return ctx;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fa-IR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ChatHistoryPage() {
  const [list, setList] = useState<ConvListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConvDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadList = useCallback((p: number) => {
    setLoadingList(true);
    fetch(`/api/admin/chat-history?page=${p}`)
      .then((r) => r.json())
      .then((data) => {
        setList(data.items ?? []);
        setTotal(data.total ?? 0);
        setLoadingList(false);
      })
      .catch(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadList(page);
  }, [page, loadList]);

  function openConv(id: string) {
    setSelectedId(id);
    setLoadingDetail(true);
    fetch(`/api/admin/chat-history/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        setLoadingDetail(false);
      })
      .catch(() => setLoadingDetail(false));
  }

  async function deleteConv(id: string) {
    if (!confirm("این مکالمه حذف شود؟")) return;
    await fetch(`/api/admin/chat-history/${id}`, { method: "DELETE" });
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
    }
    loadList(page);
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 lg:p-6" dir="rtl">
      <div className="mb-5">
        <h1 className="text-xl font-black text-gray-900 dark:text-white">تاریخچه گفتگوها</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {total.toLocaleString("fa-IR")} مکالمه ثبت شده
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* لیست مکالمه‌ها */}
        <div className="lg:col-span-2 space-y-2">
          {loadingList ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-white dark:bg-[#0f1117] rounded-2xl animate-pulse" />
            ))
          ) : list.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-12">مکالمه‌ای ثبت نشده</p>
          ) : (
            list.map((c) => (
              <button
                key={c.id}
                onClick={() => openConv(c.id)}
                className={`w-full text-right p-4 rounded-2xl border transition-all ${
                  selectedId === c.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                    : "border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#0f1117] hover:border-gray-300 dark:hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-gray-900 dark:text-white">
                    {c.isGuest ? "👤 مهمان" : `🔵 ${c.user?.name ?? "کاربر"}`}
                  </span>
                  <span className="text-[10px] text-gray-400">{formatDate(c.lastMessageAt)}</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 leading-6">
                  {c.firstMessage || "—"}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400">
                    {c.messageCount.toLocaleString("fa-IR")} پیام
                  </span>
                </div>
              </button>
            ))
          )}

          {/* صفحه‌بندی */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-black disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="text-xs font-black text-gray-500">
                {page.toLocaleString("fa-IR")} / {totalPages.toLocaleString("fa-IR")}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-black disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          )}
        </div>

        {/* جزئیات مکالمه */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 sticky top-8 min-h-[400px]">
            {!selectedId ? (
              <div className="flex items-center justify-center h-[360px] text-xs text-gray-400">
                یک مکالمه را برای مشاهده انتخاب کنید
              </div>
            ) : loadingDetail ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : detail ? (
              <>
                {/* سرتیتر */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 dark:border-white/[0.06]">
                  <div>
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      {detail.isGuest ? "مهمان" : detail.user?.name ?? "کاربر"}
                    </p>
                    {detail.user && (
                      <p className="text-[11px] text-gray-400 mt-0.5" dir="ltr">
                        {detail.user.phone}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      شروع: {formatDate(detail.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteConv(detail.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-black hover:bg-red-100 transition-all"
                  >
                    حذف
                  </button>
                </div>

                {/* پیام‌ها */}
                <div className="space-y-3 max-h-[440px] overflow-y-auto">
                  {detail.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.role === "user" ? "items-start" : "items-end"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12.5px] leading-7 whitespace-pre-wrap ${
                          m.role === "user"
                            ? "bg-blue-50 dark:bg-blue-500/10 text-gray-800 dark:text-gray-200 rounded-tr-sm"
                            : "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-tl-sm"
                        }`}
                      >
                        {m.content}
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[9px] text-gray-400">{formatDate(m.createdAt)}</span>
                        {m.context && contextLabel(m.context) && (
                          <span className="text-[9px] font-bold text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {contextLabel(m.context)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[360px] text-xs text-gray-400">
                خطا در بارگذاری
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}