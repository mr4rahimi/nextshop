"use client";

/**
 * ضربانِ حضور — هیچ چیزی رندر نمی‌کند.
 *
 * در `app/admin/layout.tsx` نصب می‌شود، پس تا وقتی تبِ پنل باز است زنده است.
 *
 * سه قاعده:
 *
 * **۱. وقتی تب پنهان است ضربان نمی‌رود.** مرورگرِ مینیمایزشده روی میز، حضور
 * نیست. سرور بعد از پانزده دقیقه بی‌ضربان، نشست را با `lastSeenAt` می‌بندد،
 * پس آن پانزده دقیقه هم به حساب نمی‌آید.
 *
 * **۲. برگشتنِ تب فوراً ضربان می‌فرستد.** اگر منتظر تایمر بعدی می‌ماندیم،
 * تا پنج دقیقه بعدِ برگشت، سرور هنوز فکر می‌کرد کارمند رفته است.
 *
 * **۳. خطا هیچ‌وقت دیده نمی‌شود.** شبکه قطع باشد یا کارمند مجوز نداشته باشد،
 * این کامپوننت ساکت می‌ماند. حضور یک قابلیت جانبی است.
 */

import { useEffect, useRef } from "react";

/** باید با `HEARTBEAT_MS` در `lib/worklist/attendance.ts` یکی بماند */
const PING_MS = 5 * 60_000;

/** فاصله‌ی حداقلی بین دو ضربان — جلوی رگبارِ visibilitychange را می‌گیرد */
const MIN_GAP_MS = 60_000;

export default function HeartbeatPing() {
  const lastPing = useRef(0);

  useEffect(() => {
    let stopped = false;

    const ping = async (force = false) => {
      if (stopped) return;
      if (document.hidden) return;
      const now = Date.now();
      if (!force && now - lastPing.current < MIN_GAP_MS) return;
      lastPing.current = now;
      try {
        await fetch("/api/admin/worklist/heartbeat", {
          method: "POST",
          keepalive: true,
        });
      } catch {
        // ضربان بعدی دوباره امتحان می‌کند
      }
    };

    void ping(true);
    const timer = setInterval(() => void ping(), PING_MS);

    const onVisible = () => {
      if (!document.hidden) void ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
