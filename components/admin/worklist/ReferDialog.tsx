"use client";

/**
 * ارجاع کار به کارمند دیگر، با تاریخچه‌ی «کی به کی».
 *
 * ⚠️ باز شدن این پنجره خودش نشان «جدید» را پاک می‌کند، چون تاریخچه را از
 * `GET .../refer` می‌گیرد و همان مسیر `seenAt` را پر می‌کند. این عمدی است:
 * نشان وقتی پاک می‌شود که کاربر واقعاً ردیف را باز کرده باشد.
 *
 * یادداشت اجباری نیست — «الف تماس را به ب ارجاع می‌دهد چون پرونده دست ب است»
 * توضیح لازم ندارد، و اجباری‌کردنش یعنی ارجاع اصلاً انجام نمی‌شود.
 */

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/worklist/types";
import type { TaskItem, TaskReferral, StaffMember } from "./types";
import HelpButton from "./HelpButton";

interface Props {
  task: TaskItem | null;
  onClose: () => void;
  onReferred: (taskId: string) => void;
}

export default function ReferDialog({ task, onClose, onReferred }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [referrals, setReferrals] = useState<TaskReferral[]>([]);
  const [toId, setToId] = useState("");
  const [note, setNote] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskId = task?.id ?? null;

  const loadHistory = useCallback(() => {
    if (!taskId) return;
    // این فراخوانی نشان «جدید» را هم پاک می‌کند
    fetch(`/api/admin/worklist/tasks/${taskId}/refer`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setReferrals(d.referrals ?? []))
      .catch(() => {});
  }, [taskId]);

  useEffect(() => {
    setReferrals([]);
    setToId("");
    setNote("");
    setIsUrgent(false);
    setError(null);
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!taskId || staff.length) return;
    fetch("/api/admin/worklist/staff")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStaff(d.staff ?? []))
      .catch(() => {});
  }, [taskId, staff.length]);

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [task, onClose]);

  async function submit() {
    if (!toId || !taskId) {
      setError("گیرنده را انتخاب کنید");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/worklist/tasks/${taskId}/refer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId, note: note.trim() || null, isUrgent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ارجاع ناموفق بود");
      onReferred(taskId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ارجاع ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  if (!task) return null;

  const others = staff.filter((s) => !s.isMe && s.id !== task.ownerId);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
              ارجاع کار
              <HelpButton topic="refer" size="sm" />
            </h2>
            <p className="text-[11px] text-gray-500 truncate">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* تاریخچه */}
          {referrals.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                تاریخچه‌ی ارجاع
              </p>
              <div className="space-y-1.5">
                {referrals.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                        {r.fromName} ← {r.toName}
                        {r.isUrgent && (
                          <span className="mr-1.5 px-1.5 py-0.5 rounded text-[9px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                            فوری
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formatDateTime(r.createdAt)}
                      </span>
                    </div>
                    {r.note && (
                      <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
                        {r.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
              ارجاع به
            </label>
            <div className="space-y-1.5">
              {others.length === 0 && (
                <p className="text-xs text-gray-500">کارمند دیگری برای ارجاع نیست</p>
              )}
              {others.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setToId(s.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-right border transition ${
                    toId === s.id
                      ? "bg-blue-50 dark:bg-blue-500/10 border-blue-400 dark:border-blue-500/50"
                      : "bg-gray-50 dark:bg-white/5 border-transparent hover:border-gray-300 dark:hover:border-white/20"
                  }`}
                >
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {s.name}
                  </span>
                  {s.roleTitle && (
                    <span className="text-[10px] text-gray-500 shrink-0">{s.roleTitle}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
              توضیح (اختیاری)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="چرا دارید ارجاع می‌دهید؟"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400 resize-none"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="w-4 h-4 rounded accent-red-500"
            />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              فوری — برای گیرنده پاپ‌آپ نشان داده شود
            </span>
          </label>

          {error && (
            <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs font-bold text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-white/10">
          <button
            onClick={submit}
            disabled={saving || !toId}
            className="w-full px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-bold transition"
          >
            {saving ? "در حال ارجاع..." : "ارجاع بده"}
          </button>
          <p className="mt-2 text-[10px] text-gray-400 text-center">
            ارجاع، کارِ بسته را دوباره باز می‌کند
          </p>
        </div>
      </div>
    </div>
  );
}
