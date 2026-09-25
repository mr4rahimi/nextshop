"use client";

/**
 * ویرایشگر متن کار محتوا با ذخیره‌ی خودکار.
 *
 * ویرایشگر دوم ساخته نشده: همان `BlogEditor` مجله است (بخش ۲ مستندات).
 * این کامپوننت فقط **چرخه‌ی ذخیره** را دور آن می‌پیچد.
 *
 * قواعد بخش ۶.۳ که اینجا پیاده شده‌اند:
 *
 * - **۸ ثانیه بعد از آخرین تایپ**، و در تایپ ممتد دست‌کم **هر ۶۰ ثانیه**.
 * - **یک مسیر ذخیره** برای دستی و خودکار (`persist`) — وگرنه «ذخیره‌نشده» در
 *   دو جا جدا حساب می‌شود.
 * - **متن سرور بعد از اولین تایپ روی ویرایشگر نمی‌نشیند.** ویرایشگر فقط
 *   یک بار از `initial` مقدار می‌گیرد؛ والد با `key` روی وضعیت کار، آن را
 *   فقط بعد از یک انتقال وضعیت از نو می‌سازد. refetch پس‌زمینه (مثلاً بعد از
 *   آپلود پیوست) نوشته را با نسخه‌ی کهنه عوض نمی‌کند.
 * - **اگر کاربر حین ذخیره تایپ کند** متن هنوز ذخیره‌نشده است؛ مقایسه‌ی
 *   نسخه‌ی فرستاده با نسخه‌ی فعلی این را می‌گیرد.
 * - **خطای ذخیره‌ی خودکار بی‌صداست** — نشانگر «ذخیره‌نشده» پیام را می‌رساند.
 * - **رفتن به پس‌زمینه، بستن کشو و بستن تب** یک ذخیره‌ی آخر با `keepalive`
 *   می‌فرستند؛ بستن تب با متن ذخیره‌نشده هشدار مرورگر هم دارد.
 * - ⚠️ **قبل از هر انتقال وضعیت، والد `flushRef` را صدا می‌زند.** بعد از
 *   «ارسال»، متن دیگر دست نویسنده نیست و سرور ذخیره را رد می‌کند؛ ذخیره‌ی
 *   آخرِ unmount دیر می‌رسد و چند ثانیه‌ی آخر نوشته گم می‌شد.
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import dynamic from "next/dynamic";

const BlogEditor = dynamic(() => import("@/components/blog/BlogEditor"), { ssr: false });

const IDLE_MS = 8_000;
const MAX_WAIT_MS = 60_000;

type SaveState = "saved" | "dirty" | "saving" | "error";

/**
 * TipTap متن را نرمال می‌کند (`""` ← `<p></p>`) و همین را اولین بار پس
 * می‌فرستد. بدون این مقایسه، باز کردن کشو خودش «ذخیره‌نشده» می‌ساخت.
 */
function normalize(html: string): string {
  return html.replace(/<p>\s*<\/p>/g, "").replace(/\s+/g, " ").trim();
}

export default function ContentEditorPanel({
  taskId,
  initial,
  editable,
  onSaved,
  flushRef,
}: {
  taskId: string;
  initial: string;
  editable: boolean;
  onSaved?: (wordCount: number) => void;
  /** والد قبل از انتقال وضعیت صدایش می‌زند؛ اگر ذخیره نشد، خطا می‌دهد */
  flushRef?: MutableRefObject<(() => Promise<void>) | null>;
}) {
  const [html, setHtml] = useState(initial);
  const [state, setState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // آخرین متن در ref هم هست تا تایمرها و رویدادهای پنجره متن کهنه نفرستند
  const htmlRef = useRef(initial);
  const lastSavedRef = useRef(initial);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDirtyAt = useRef<number | null>(null);
  const inFlight = useRef(false);

  const persist = useCallback(
    async (opts: { keepalive?: boolean; manual?: boolean } = {}): Promise<boolean> => {
      const text = htmlRef.current;
      if (text === lastSavedRef.current) return true;
      if (inFlight.current && !opts.keepalive && !opts.manual) return false;

      if (idleTimer.current) clearTimeout(idleTimer.current);
      inFlight.current = true;
      setState("saving");
      try {
        const res = await fetch(`/api/admin/worklist/content/${taskId}/body`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: text }),
          keepalive: opts.keepalive,
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error ?? "ذخیره نشد");

        lastSavedRef.current = text;
        firstDirtyAt.current = null;
        setSavedAt(d.savedAt ?? new Date().toISOString());
        setError(null);
        // اگر حین ذخیره تایپ شده، هنوز ذخیره‌نشده است
        setState(htmlRef.current === text ? "saved" : "dirty");
        onSaved?.(d.wordCount ?? 0);
        return true;
      } catch (e) {
        setState("error");
        // خطای خودکار بی‌صداست؛ فقط ذخیره‌ی دستی پیام می‌دهد
        if (opts.manual) setError(e instanceof Error ? e.message : "ذخیره نشد");
        // «دوباره تلاش می‌شود» واقعاً دوباره تلاش می‌کند، حتی اگر تایپ نکند
        if (!opts.keepalive) {
          idleTimer.current = setTimeout(() => void persist(), IDLE_MS);
        }
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [taskId, onSaved],
  );

  function onChange(next: string) {
    // BlogEditor با هر رندر همان HTML را برمی‌گرداند؛ تغییر واقعی نیست
    if (next === htmlRef.current) return;
    if (normalize(next) === normalize(lastSavedRef.current)) {
      htmlRef.current = next;
      lastSavedRef.current = next;
      setHtml(next);
      return;
    }
    htmlRef.current = next;
    setHtml(next);
    if (!editable) return;

    setState("dirty");
    const now = Date.now();
    if (firstDirtyAt.current === null) firstDirtyAt.current = now;

    if (idleTimer.current) clearTimeout(idleTimer.current);
    // تایپ ممتد: اگر ۶۰ ثانیه از اولین تغییر ذخیره‌نشده گذشته، همین حالا
    if (now - firstDirtyAt.current >= MAX_WAIT_MS) {
      void persist();
      return;
    }
    idleTimer.current = setTimeout(() => void persist(), IDLE_MS);
  }

  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = async () => {
      if (!editable) return;
      const ok = await persist({ manual: true });
      if (!ok) throw new Error("متن ذخیره نشد — اول ذخیره را درست کنید، بعد مرحله را بزنید");
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, editable, persist]);

  // پس‌زمینه، بستن تب، و بستن کشو (unmount) — یک ذخیره‌ی آخر
  useEffect(() => {
    if (!editable) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") void persist({ keepalive: true });
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (htmlRef.current === lastSavedRef.current) return;
      void persist({ keepalive: true });
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      void persist({ keepalive: true });
    };
  }, [editable, persist]);

  const label =
    state === "saving"
      ? "در حال ذخیره..."
      : state === "dirty"
        ? "ذخیره‌نشده"
        : state === "error"
          ? "ذخیره نشد — دوباره تلاش می‌شود"
          : savedAt
            ? `ذخیره شد · ${new Date(savedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`
            : "ذخیره‌شده";

  const tone =
    state === "saved"
      ? "text-emerald-600 dark:text-emerald-400"
      : state === "error"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";

  if (!editable) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
        {html.trim() ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-right"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-xs text-gray-400 text-center py-6">هنوز متنی نوشته نشده</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold ${tone}`}>{label}</span>
        <button
          type="button"
          onClick={() => void persist({ manual: true })}
          disabled={state === "saved" || state === "saving"}
          className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 text-xs font-bold text-gray-600 dark:text-gray-300 disabled:opacity-40"
        >
          ذخیره
        </button>
      </div>
      {error && <p className="text-[11px] font-bold text-red-600 dark:text-red-400">{error}</p>}
      <BlogEditor value={html} onChange={onChange} placeholder="متن را اینجا بنویسید..." />
    </div>
  );
}
