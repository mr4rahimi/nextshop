"use client";

/**
 * تاریخچه‌ی تماس‌ها و کارهای یک مشتری.
 *
 * از پرونده‌ی عضو باشگاه باز می‌شود. هدفش این است که وقتی مشتری زنگ می‌زند،
 * کارمند بدون گشتن ببیند قبلاً چه گفته‌وگویی با او شده و آخرین وضعیت چیست.
 *
 * ⚠️ ترتیب بر اساس `occurredAt` است نه `createdAt`: اینجا سؤال «کِی اتفاق
 * افتاد» است، نه «کِی ثبت شد». برعکسِ گزارش عملکرد، که مبنایش `createdAt` است.
 */

import { useCallback, useEffect, useState } from "react";
import QuickTaskForm from "./QuickTaskForm";
import NotesPanel from "./NotesPanel";
import {
  DOMAIN_LABELS,
  DOMAIN_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  CHANNEL_LABELS,
  parseOutcomes,
  outcomeLabel,
  formatDateTime,
} from "@/lib/worklist/types";
import type { TaskItem } from "./types";

interface Props {
  /** شناسه‌ی **کاربر**، نه شناسه‌ی پروفایل باشگاه */
  customerId: string;
  customerName: string;
  customerPhone: string;
  onClose: () => void;
}

export default function CustomerTimeline({
  customerId,
  customerName,
  customerPhone,
  onClose,
}: Props) {
  const [items, setItems] = useState<TaskItem[]>([]);
  /** آخرین کلیدی که پاسخش نشست — «در حال بارگذاری» از همین مشتق می‌شود */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [notesTask, setNotesTask] = useState<TaskItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const fetchKey = `${customerId}:${reloadKey}`;
  const loaded = loadedKey === fetchKey;

  useEffect(() => {
    let ignore = false;
    fetch(`/api/admin/worklist/tasks?tab=all&customerId=${encodeURIComponent(customerId)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "بارگذاری ناموفق بود");
        return d;
      })
      .then((d) => {
        if (ignore) return;
        setItems(d.items ?? []);
        setError(null);
        setLoadedKey(fetchKey);
      })
      .catch((e) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود");
        setLoadedKey(fetchKey);
      });
    return () => { ignore = true; };
  }, [customerId, fetchKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !formOpen && !notesTask) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, formOpen, notesTask]);

  // مرتب‌سازی بر اساس «کِی اتفاق افتاد»، تازه‌ترین بالا
  const sorted = [...items].sort((a, b) => {
    const at = new Date(a.occurredAt ?? a.createdAt).getTime();
    const bt = new Date(b.occurredAt ?? b.createdAt).getTime();
    return bt - at;
  });

  const openCount = sorted.filter(
    (t) => t.status === "OPEN" || t.status === "IN_PROGRESS",
  ).length;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-2xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {customerName}
            </h2>
            <p className="text-[11px] text-gray-500" dir="ltr">
              {customerPhone}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFormOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-bold transition"
            >
              ثبت تماس
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
              aria-label="بستن"
            >
              ✕
            </button>
          </div>
        </div>

        {sorted.length > 0 && (
          <div className="px-5 py-2.5 border-b border-gray-100 dark:border-white/5 flex items-center gap-4 text-[11px] text-gray-500">
            <span>
              مجموع{" "}
              <b className="text-gray-800 dark:text-gray-200">
                {sorted.length.toLocaleString("fa-IR")}
              </b>{" "}
              مورد
            </span>
            {openCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {openCount.toLocaleString("fa-IR")} کار باز
              </span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {!loaded && <p className="text-xs text-gray-500">در حال بارگذاری...</p>}

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {loaded && !error && sorted.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                هنوز تماسی با این مشتری ثبت نشده
              </p>
              <p className="text-xs text-gray-400 mt-1">
                با دکمه‌ی «ثبت تماس» اولین مورد را وارد کنید.
              </p>
            </div>
          )}

          {sorted.map((t) => {
            const outcome = outcomeLabel(parseOutcomes(t.type.outcomes), t.outcome);
            return (
              <div
                key={t.id}
                className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm leading-none">{t.type.icon ?? "•"}</span>
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                        {t.title}
                      </h3>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${DOMAIN_COLORS[t.domain]}`}
                      >
                        {DOMAIN_LABELS[t.domain]}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] text-gray-500">
                      <span>{formatDateTime(t.occurredAt ?? t.createdAt)}</span>
                      {t.channel !== "NONE" && <span>{CHANNEL_LABELS[t.channel]}</span>}
                      <span>{t.ownerName}</span>
                      {t._count.notes > 0 && (
                        <span>{t._count.notes.toLocaleString("fa-IR")} یادداشت</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-left space-y-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-bold ${STATUS_COLORS[t.status]}`}
                    >
                      {STATUS_LABELS[t.status]}
                    </span>
                    {outcome && (
                      <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400">
                        {outcome}
                      </p>
                    )}
                  </div>
                </div>

                {t.note && (
                  <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {t.note}
                  </p>
                )}

                <button
                  onClick={() => setNotesTask(t)}
                  className="mt-2 text-[10px] font-bold text-blue-600 dark:text-blue-400"
                >
                  یادداشت‌ها
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <QuickTaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={() => reload()}
        presetCustomer={{ id: customerId, name: customerName, phone: customerPhone }}
      />
      <NotesPanel
        task={notesTask}
        onClose={() => setNotesTask(null)}
        onNoteAdded={() => reload()}
      />
    </div>
  );
}
