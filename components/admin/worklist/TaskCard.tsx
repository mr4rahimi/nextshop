"use client";

/**
 * کارت یک کار.
 *
 * نتیجه‌ها روی خود کارت‌اند نه پشت کلیک — بستنِ کار باید یک ضربه باشد.
 * نتیجه‌ی از قبل ثبت‌شده جمع‌شده نشان داده می‌شود با دکمه‌ی «تغییر»، تا ثبت
 * دوباره تصادفی نشود.
 */

import { useState } from "react";
import {
  DOMAIN_LABELS,
  DOMAIN_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  CHANNEL_LABELS,
  SOURCE_LABELS,
  parseOutcomes,
  outcomeLabel,
  formatDateTime,
  dueLabel,
  isOverdue,
} from "@/lib/worklist/types";
import type { TaskItem } from "./types";

interface Props {
  task: TaskItem;
  /** نام صاحب کار را نشان بده — در «همه‌ی کارها» لازم است، در «کارهای من» نه */
  showOwner?: boolean;
  onChanged: (task: TaskItem) => void;
  onOpenNotes?: (task: TaskItem) => void;
  onOpenRefer?: (task: TaskItem) => void;
}

export default function TaskCard({
  task,
  showOwner = false,
  onChanged,
  onOpenNotes,
  onOpenRefer,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outcomes = parseOutcomes(task.type.outcomes);
  const currentOutcome = outcomeLabel(outcomes, task.outcome);
  const overdue = isOverdue(task);
  const closed = task.status === "DONE" || task.status === "CANCELED";

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/worklist/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ذخیره ناموفق بود");
      onChanged(data.task);
      setEditingOutcome(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  const amountFa = task.amount
    ? Number(task.amount).toLocaleString("fa-IR")
    : null;

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        overdue
          ? "border-red-300 dark:border-red-500/40 bg-red-50/50 dark:bg-red-500/5"
          : closed
            ? "border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]"
            : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base leading-none">{task.type.icon ?? "•"}</span>
            <h3
              className={`text-sm font-bold truncate ${
                closed
                  ? "text-gray-500 dark:text-gray-500"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              {task.title}
            </h3>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${DOMAIN_COLORS[task.domain]}`}
            >
              {DOMAIN_LABELS[task.domain]}
            </span>
            {task.source !== "MANUAL" && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-white/5 text-gray-500">
                {SOURCE_LABELS[task.source]}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-2.5 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
            {task.contactName && (
              <span className="font-bold text-gray-700 dark:text-gray-300">
                {task.contactName}
              </span>
            )}
            {task.contactPhone && <span dir="ltr">{task.contactPhone}</span>}
            {task.supplierName && <span>تأمین‌کننده: {task.supplierName}</span>}
            {task.channel !== "NONE" && <span>{CHANNEL_LABELS[task.channel]}</span>}
            {amountFa && <span className="font-bold">{amountFa} تومان</span>}
            {task.carrier && <span>{task.carrier}</span>}
            {showOwner && <span>مسئول: {task.ownerName}</span>}
          </div>

          {task.note && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              {task.note}
            </p>
          )}

          {task.linkUrl && (
            <a
              href={task.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="mt-1.5 block text-[11px] text-blue-600 dark:text-blue-400 truncate hover:underline"
            >
              {task.linkUrl}
            </a>
          )}
        </div>

        <div className="shrink-0 text-left space-y-1">
          <span
            className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${STATUS_COLORS[task.status]}`}
          >
            {STATUS_LABELS[task.status]}
          </span>
          {task.dueAt && !closed && (
            <p
              className={`text-[10px] font-bold ${
                overdue ? "text-red-600 dark:text-red-400" : "text-gray-500"
              }`}
            >
              {dueLabel(task.dueAt)}
            </p>
          )}
          {closed && task.doneAt && (
            <p className="text-[10px] text-gray-400">{formatDateTime(task.doneAt)}</p>
          )}
        </div>
      </div>

      {/* نتیجه */}
      {outcomes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
          {currentOutcome && !editingOutcome ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">نتیجه:</span>
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                {currentOutcome}
              </span>
              <button
                onClick={() => setEditingOutcome(true)}
                className="text-[11px] text-blue-600 dark:text-blue-400 font-bold"
              >
                تغییر
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {outcomes.map((o) => (
                <button
                  key={o.value}
                  disabled={busy}
                  onClick={() => patch({ outcome: o.value })}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition disabled:opacity-40 ${
                    o.isSuccess
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                      : "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
                  }`}
                >
                  {o.label}
                </button>
              ))}
              {editingOutcome && (
                <button
                  onClick={() => setEditingOutcome(false)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-gray-500"
                >
                  انصراف
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* اقدام‌ها */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {!closed && (
          <button
            disabled={busy}
            onClick={() => patch({ status: "DONE" })}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-[11px] font-bold transition"
          >
            انجام شد
          </button>
        )}
        {closed && (
          <button
            disabled={busy}
            onClick={() => patch({ status: "IN_PROGRESS" })}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 text-gray-700 dark:text-gray-300 text-[11px] font-bold transition"
          >
            باز کردن دوباره
          </button>
        )}
        {onOpenNotes && (
          <button
            onClick={() => onOpenNotes(task)}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-[11px] font-bold transition"
          >
            یادداشت‌ها
            {task._count.notes > 0 && (
              <span className="mr-1 text-blue-600 dark:text-blue-400">
                {task._count.notes.toLocaleString("fa-IR")}
              </span>
            )}
          </button>
        )}
        {onOpenRefer && (
          <button
            onClick={() => onOpenRefer(task)}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-[11px] font-bold transition"
          >
            ارجاع
            {task._count.referrals > 0 && (
              <span className="mr-1 text-violet-600 dark:text-violet-400">
                {task._count.referrals.toLocaleString("fa-IR")}
              </span>
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
