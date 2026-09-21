"use client";

/**
 * پاپ‌آپ ارجاع فوری و نشان کارتابل روی منو.
 *
 * در `app/admin/layout.tsx` نصب می‌شود، پس در همه‌ی صفحات ادمین زنده است.
 *
 * سه قاعده که باید سر جایشان بمانند:
 *
 * **۱. `seenAt` روی «دیدم» یا «باز کردن» پر می‌شود، نه روی رندر.** اگر موقع
 * گرفتن فهرست علامت می‌زدیم، همین poll نشان را پیش از آنکه کسی ببیند پاک می‌کرد.
 *
 * **۲. پاپ‌آپ‌ها یکی‌یکی نشان داده می‌شوند نه همه با هم.** با نمایش هم‌زمان،
 * کارمند همه را یک‌جا می‌بندد بدون خواندن و ارجاع فوری بی‌اثر می‌شود.
 *
 * **۳. poll سبک است.** هر سی ثانیه، فقط شمارنده و حداکثر پنج ردیف. وقتی تب
 * پنهان است اصلاً درخواستی فرستاده نمی‌شود.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/worklist/types";
import type { UrgentReferral, InboxCounts, MarketingNotification } from "./types";

const POLL_MS = 30_000;

export default function WorklistNotifier() {
  const router = useRouter();
  const [queue, setQueue] = useState<UrgentReferral[]>([]);
  const [counts, setCounts] = useState<InboxCounts | null>(null);
  const [notes, setNotes] = useState<MarketingNotification[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** ارجاع‌هایی که همین جلسه بسته شده‌اند — تا poll بعدی دوباره نشانشان ندهد */
  const dismissed = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/admin/worklist/inbox");
      if (!res.ok) return; // بدون دسترسی یا بدون ورود: بی‌سروصدا ساکت می‌ماند
      const data = await res.json();
      setCounts(data.counts ?? null);
      setNotes(data.marketing ?? []);
      const fresh: UrgentReferral[] = (data.urgent ?? []).filter(
        (r: UrgentReferral) => !dismissed.current.has(r.id),
      );
      setQueue(fresh);
    } catch {
      // شبکه قطع است؛ poll بعدی دوباره امتحان می‌کند
    }
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  const current = queue[0] ?? null;

  const acknowledge = useCallback(
    async (referral: UrgentReferral, open: boolean) => {
      setBusy(true);
      dismissed.current.add(referral.id);
      setQueue((prev) => prev.filter((r) => r.id !== referral.id));
      try {
        await fetch("/api/admin/worklist/inbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralIds: [referral.id] }),
        });
        setCounts((c) =>
          c ? { ...c, unseenReferrals: Math.max(0, c.unseenReferrals - 1) } : c,
        );
      } catch {
        // اگر ثبت «دیدم» نرسید، poll بعدی دوباره نشانش می‌دهد — همین درست است
        dismissed.current.delete(referral.id);
      } finally {
        setBusy(false);
        if (open) router.push("/admin/worklist?tab=referred");
      }
    },
    [router],
  );

  if (!current) {
    // نشان بی‌صدا: فقط وقتی چیزی هست دیده می‌شود
    if (
      !counts ||
      (counts.unseenReferrals === 0 && counts.overdue === 0 && (counts.marketing ?? 0) === 0)
    ) {
      return null;
    }

    // ⚠️ اعلان سئو/محتوا/لینک عمداً **پاپ‌آپ نمی‌گیرد**؛ پاپ‌آپ مال ارجاع
    // فوری است و ارزشش به کمیابی‌اش است. اینجا فقط یک فهرست کوتاه باز می‌شود.
    if (notesOpen && notes.length > 0) {
      return (
        <div className="fixed bottom-24 left-6 z-40 w-80 max-w-[calc(100vw-3rem)] rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-white/10">
            <span className="text-xs font-black text-gray-900 dark:text-white">اعلان‌ها</span>
            <button
              onClick={() => setNotesOpen(false)}
              className="text-[11px] font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white"
            >
              بستن
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  onClick={async () => {
                    setNotes((prev) => prev.filter((x) => x.id !== n.id));
                    setCounts((c) =>
                      c ? { ...c, marketing: Math.max(0, c.marketing - 1) } : c,
                    );
                    try {
                      await fetch("/api/admin/worklist/inbox", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notificationIds: [n.id] }),
                      });
                    } catch {
                      // نرسید؛ poll بعدی دوباره نشانش می‌دهد
                    }
                    router.push(n.url);
                  }}
                  className="w-full text-right px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{n.title}</p>
                  {n.body && (
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{n.body}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {formatDateTime(n.createdAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    // ⚠️ سمت چپ و بالای دکمه‌ی «ثبت کار»، نه پایین‌راست: آنجا حباب چت و دکمه‌ی
    // «مشاهده سایت» می‌نشینند و نشان زیرشان گم می‌شد.
    // `bottom-24` دقیقاً بالای دکمه‌ی `bottom-6 h-14` قرار می‌گیرد.
    return (
      <button
        onClick={() =>
          notes.length > 0 ? setNotesOpen(true) : router.push("/admin/worklist")
        }
        className="fixed bottom-24 left-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold shadow-xl transition hover:opacity-90"
      >
        {counts.overdue > 0 && (
          <span className="text-red-400 dark:text-red-500">
            {counts.overdue.toLocaleString("fa-IR")} عقب‌افتاده
          </span>
        )}
        {counts.unseenReferrals > 0 && (
          <span>{counts.unseenReferrals.toLocaleString("fa-IR")} ارجاع تازه</span>
        )}
        {counts.marketing > 0 && (
          <span className="text-amber-400 dark:text-amber-600">
            {counts.marketing.toLocaleString("fa-IR")} اعلان
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-red-300 dark:border-red-500/40 shadow-2xl overflow-hidden">
        <div className="px-5 py-3 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/30 flex items-center justify-between">
          <span className="text-xs font-black text-red-600 dark:text-red-400">
            ارجاع فوری
          </span>
          {queue.length > 1 && (
            <span className="text-[10px] text-red-500 dark:text-red-400">
              {queue.length.toLocaleString("fa-IR")} مورد در صف
            </span>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {current.task.title}
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">
              از طرف {current.fromName} · {formatDateTime(current.createdAt)}
            </p>
          </div>

          {(current.task.contactName || current.task.contactPhone) && (
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-2.5">
              {current.task.contactName && (
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {current.task.contactName}
                </p>
              )}
              {current.task.contactPhone && (
                <p className="text-[11px] text-gray-500" dir="ltr">
                  {current.task.contactPhone}
                </p>
              )}
            </div>
          )}

          {current.note && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2.5">
              <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {current.note}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-gray-200 dark:border-white/10">
          <button
            onClick={() => acknowledge(current, true)}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-bold transition"
          >
            باز کردن کار
          </button>
          <button
            onClick={() => acknowledge(current, false)}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40 text-gray-700 dark:text-gray-300 text-sm font-bold transition"
          >
            دیدم
          </button>
        </div>
      </div>
    </div>
  );
}
