"use client";

import { useEffect, useState, useCallback } from "react";

type Status = "pending" | "contacted" | "done";

interface CallbackItem {
  id: string;
  phone: string;
  siteId: string | null;
  conversationId: string | null;
  status: Status;
  note: string | null;
  createdAt: string;
  user: { name: string; phone: string } | null;
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string; dot: string }> = {
  pending:    { label: "جدید",              color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",   dot: "bg-amber-500" },
  contacted:  { label: "تماس گرفته شد",     color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10",    dot: "bg-blue-500" },
  done:       { label: "تکمیل شد",          color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", dot: "bg-emerald-500" },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fa-IR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function CallbackRequestsPage() {
  const [items, setItems] = useState<CallbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, contacted: 0, done: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const [selected, setSelected] = useState<CallbackItem | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback((p: number, sf: Status | "all") => {
    setLoading(true);
    const siteId = typeof window !== "undefined" ? window.location.host : "";
    const params = new URLSearchParams({ page: String(p), siteId });
    if (sf !== "all") params.set("status", sf);
    fetch(`/api/admin/callback-requests?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
        setCounts(d.counts ?? { pending: 0, contacted: 0, done: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page, statusFilter); }, [page, statusFilter, load]);

  async function changeStatus(id: string, status: Status) {
    setSaving(true);
    await fetch(`/api/admin/callback-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s);
    setCounts((c) => {
      const oldStatus = items.find((i) => i.id === id)?.status;
      if (!oldStatus || oldStatus === status) return c;
      return { ...c, [oldStatus]: c[oldStatus] - 1, [status]: c[status] + 1 };
    });
  }

  async function saveNote(id: string) {
    setSaving(true);
    await fetch(`/api/admin/callback-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteInput }),
    });
    setSaving(false);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, note: noteInput } : i));
    if (selected?.id === id) setSelected((s) => s ? { ...s, note: noteInput } : s);
  }

  async function deleteItem(id: string) {
    if (!confirm("این درخواست حذف شود؟")) return;
    await fetch(`/api/admin/callback-requests/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotal((t) => t - 1);
    if (selected?.id === id) setSelected(null);
  }

  function openDetail(item: CallbackItem) {
    setSelected(item);
    setNoteInput(item.note ?? "");
  }

  const totalPages = Math.ceil(total / 20);

  const TABS: { key: Status | "all"; label: string; count?: number }[] = [
    { key: "all",       label: "همه",            count: counts.pending + counts.contacted + counts.done },
    { key: "pending",   label: "جدید",           count: counts.pending },
    { key: "contacted", label: "تماس گرفته شد",  count: counts.contacted },
    { key: "done",      label: "تکمیل شد",       count: counts.done },
  ];

  return (
    <div className="p-4 lg:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">درخواست‌های تماس</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {counts.pending > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                {counts.pending.toLocaleString("fa-IR")} درخواست جدید
              </span>
            )}
            {counts.pending === 0 && `${total.toLocaleString("fa-IR")} درخواست`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              statusFilter === tab.key
                ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                statusFilter === tab.key ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400"
              }`}>
                {tab.count.toLocaleString("fa-IR")}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-white dark:bg-[#0f1117] rounded-2xl animate-pulse" />
            ))
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">
              <div className="text-4xl mb-3">📞</div>
              درخواست تماسی ثبت نشده
            </div>
          ) : (
            items.map((item) => {
              const meta = STATUS_META[item.status];
              return (
                <button
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className={`w-full text-right p-4 rounded-2xl border transition-all ${
                    selected?.id === item.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                      : "border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#0f1117] hover:border-gray-300 dark:hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                      <span className="text-sm font-black text-gray-900 dark:text-white" dir="ltr">
                        {item.phone}
                      </span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      {item.user ? `👤 ${item.user.name}` : "مهمان"}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(item.createdAt)}</span>
                  </div>
                  {item.note && (
                    <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 text-right">
                      💬 {item.note}
                    </p>
                  )}
                </button>
              );
            })
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-black disabled:opacity-40">
                قبلی
              </button>
              <span className="text-xs font-black text-gray-500">
                {page.toLocaleString("fa-IR")} / {totalPages.toLocaleString("fa-IR")}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-black disabled:opacity-40">
                بعدی
              </button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-5 sticky top-8 min-h-[400px]">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-[360px] gap-3 text-gray-400">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-3xl">📞</div>
                <p className="text-xs">یک درخواست را برای مشاهده انتخاب کنید</p>
              </div>
            ) : (
              <>
                {/* Top info */}
                <div className="flex items-start justify-between pb-4 mb-4 border-b border-gray-100 dark:border-white/[0.06]">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-lg">📞</div>
                      <div>
                        <p className="text-base font-black text-gray-900 dark:text-white" dir="ltr">{selected.phone}</p>
                        <p className="text-[11px] text-gray-400">
                          {selected.user ? `👤 ${selected.user.name}` : "کاربر مهمان"}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mr-12">
                      ثبت: {formatDate(selected.createdAt)}
                      {selected.siteId && <span className="mr-3">🌐 {selected.siteId}</span>}
                    </p>
                  </div>
                  <button onClick={() => deleteItem(selected.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-black hover:bg-red-100 transition-all">
                    حذف
                  </button>
                </div>

                {/* Status changer */}
                <div className="mb-5">
                  <p className="text-xs font-black text-gray-500 dark:text-gray-400 mb-2">وضعیت درخواست:</p>
                  <div className="flex items-center gap-2">
                    {(["pending", "contacted", "done"] as Status[]).map((s) => {
                      const m = STATUS_META[s];
                      const isActive = selected.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => changeStatus(selected.id, s)}
                          disabled={saving || isActive}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                            isActive
                              ? `${m.bg} ${m.color} border-current`
                              : "border-gray-200 dark:border-white/[0.06] text-gray-500 hover:border-gray-300 dark:hover:border-white/20 disabled:opacity-50"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Conversation link */}
                {selected.conversationId && (
                  <div className="mb-5 p-3 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-between">
                    <span className="text-xs text-gray-500">مکالمه چت مرتبط</span>
                    <a
                      href={`/admin/chat-history`}
                      className="text-xs font-black text-blue-500 hover:text-blue-600 transition-all"
                    >
                      مشاهده مکالمه ←
                    </a>
                  </div>
                )}

                {/* Note */}
                <div>
                  <p className="text-xs font-black text-gray-500 dark:text-gray-400 mb-2">یادداشت داخلی:</p>
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="یادداشتی برای این درخواست بنویسید..."
                    rows={3}
                    className="w-full text-sm border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 resize-none focus:outline-none focus:border-blue-400 transition-all"
                    dir="rtl"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => saveNote(selected.id)}
                      disabled={saving || noteInput === (selected.note ?? "")}
                      className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-black rounded-xl transition-all"
                    >
                      {saving ? "در حال ذخیره..." : "ذخیره یادداشت"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
