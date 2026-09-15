"use client";

/**
 * صدای «سفارش آنلاین ثبت شد» — همان صدا و رفتار CRM
 * (`bartar-crm/features/notifications/hooks/use-notification-sound.ts`).
 *
 * در نوار بالای `app/admin/layout.tsx` نصب می‌شود، پس در همه‌ی صفحات ادمین
 * زنده است. خودش یک دکمه‌ی بلندگوی روشن/خاموش است.
 *
 * چهار قاعده:
 *
 * **۱. اولین poll فقط شناسه‌ها را ثبت می‌کند.** وگرنه با هر باز کردن پنل،
 * سفارش‌های قدیمی صدا می‌دادند.
 *
 * **۲. وقتی تب پنهان است هم poll می‌رود.** برخلاف `WorklistNotifier`؛ صدا
 * دقیقاً برای وقتی است که کارمند در تب دیگری است. مرورگر تایمر تب پنهان را
 * کند می‌کند (حداکثر دقیقه‌ای یک بار) و همین کافی است.
 *
 * **۳. مرورگر تا کاربر با صفحه تعامل نکرده اجازه‌ی پخش نمی‌دهد.** کلیک روی
 * دکمه همان تعامل است و یک پخش آزمایشی هم انجام می‌دهد. اگر Sound برای دامنه
 * در تنظیمات مرورگر Allow باشد، بدون کلیک هم پخش می‌شود.
 *
 * **۴. بدون دسترسی به بخش سفارش‌ها هیچ‌چیز رندر نمی‌شود.**
 */

import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_SRC = "/sounds/online-order.mp3";
const STORAGE_KEY = "nextshop-order-sound";
const POLL_MS = 20_000;

// چند بار تکرار تا در محیط شلوغ شنیده شود
const REPEAT = 2;
const REPEAT_GAP_MS = 900;

type FeedOrder = { id: string; orderNumber: string; createdAt: string };

function play() {
  let count = 0;
  const once = () => {
    const audio = new Audio(SOUND_SRC);
    audio.volume = 1;
    // مرورگر ممکن است رد کند — نباید باعث خطای صفحه شود
    void audio.play().catch(() => undefined);
    count += 1;
    if (count < REPEAT) window.setTimeout(once, REPEAT_GAP_MS);
  };
  once();
}

export default function OnlineOrderSound() {
  const [allowed, setAllowed] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {}
    const on = stored !== "off";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage فقط بعد از mount در دسترس است
    setEnabled(on);
    enabledRef.current = on;
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders/online-feed", { cache: "no-store" });
      if (!res.ok) {
        // بدون دسترسی به سفارش‌ها: ساکت و بی‌دکمه
        if (res.status === 401 || res.status === 403) setAllowed(false);
        return;
      }
      setAllowed(true);
      const { orders } = (await res.json()) as { orders: FeedOrder[] };

      if (seenIds.current === null) {
        seenIds.current = new Set(orders.map((o) => o.id));
        return;
      }

      const fresh = orders.filter((o) => !seenIds.current!.has(o.id));
      orders.forEach((o) => seenIds.current!.add(o.id));

      // اگر چند سفارش هم‌زمان رسید، یک بار صدا کافی است
      if (fresh.length > 0 && enabledRef.current) play();
    } catch {
      // شبکه قطع است؛ poll بعدی دوباره امتحان می‌کند
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState بعد از await درخواست است، نه هم‌زمان
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    enabledRef.current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {}
    // پخش آزمایشی هنگام روشن کردن — هم تست است هم مجوز مرورگر را می‌گیرد
    if (next) void new Audio(SOUND_SRC).play().catch(() => undefined);
  };

  if (!allowed) return null;

  return (
    <button
      onClick={toggle}
      aria-label={enabled ? "خاموش کردن صدای سفارش آنلاین" : "روشن کردن صدای سفارش آنلاین"}
      title={enabled ? "صدای سفارش آنلاین روشن است" : "صدای سفارش آنلاین خاموش است"}
      className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${
        enabled
          ? "border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-white/[0.06] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
          : "border-red-200 bg-red-50 text-red-500 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
      }`}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5L6 9H3v6h3l5 4V5z" />
        {enabled ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 9l5 5m0-5l-5 5" />
        )}
      </svg>
    </button>
  );
}
