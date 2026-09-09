"use client";

/**
 * رشته‌ی یادداشت‌های یک کار.
 *
 * ⚠️ ثبت یادداشت کارِ باز را `IN_PROGRESS` می‌کند (سمت سرور، در
 * `task-service.ts`). پس بعد از ثبت، کار به‌روزشده باید به فهرست برگردد
 * وگرنه وضعیت روی صفحه با دیتابیس نمی‌خواند.
 */

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/worklist/types";
import type { TaskItem, TaskNote } from "./types";

interface Props {
  task: TaskItem | null;
  onClose: () => void;
  onNoteAdded: (taskId: string) => void;
}

export default function NotesPanel({ task, onClose, onNoteAdded }: Props) {
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskId = task?.id ?? null;

  const load = useCallback(() => {
    if (!taskId) return;
    setLoading(true);
    fetch(`/api/admin/worklist/tasks/${taskId}/notes`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes ?? []))
      .catch(() => setError("بارگذاری یادداشت‌ها ناموفق بود"))
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    setNotes([]);
    setBody("");
    setError(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [task, onClose]);

  async function submit() {
    const text = body.trim();
    if (!text || !taskId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/worklist/tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ثبت یادداشت ناموفق بود");
      setNotes((prev) => [...prev, data.note]);
      setBody("");
      onNoteAdded(taskId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت یادداشت ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  if (!task) return null;

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
            <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {task.title}
            </h2>
            <p className="text-[11px] text-gray-500">یادداشت‌ها</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading && <p className="text-xs text-gray-500">در حال بارگذاری...</p>}
          {!loading && notes.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-6">
              هنوز یادداشتی ثبت نشده است
            </p>
          )}
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                  {n.authorName}
                </span>
                <span className="text-[10px] text-gray-400">
                  {formatDateTime(n.createdAt)}
                  {n.editedAt && " · ویرایش‌شده"}
                </span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {n.body}
              </p>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-white/10 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="یادداشت تازه..."
            className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400 resize-none"
          />
          {error && (
            <p className="text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            onClick={submit}
            disabled={saving || !body.trim()}
            className="w-full px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-bold transition"
          >
            {saving ? "در حال ثبت..." : "ثبت یادداشت"}
          </button>
        </div>
      </div>
    </div>
  );
}
