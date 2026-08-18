"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * مسیر ۴۰۴ فعلی را یک‌بار به سرور گزارش می‌کند تا در پنل ادمین دیده شود.
 *
 * چرا کلاینت‌ساید: صفحه‌ی `not-found` سرور-کامپوننت است و ممکن است استاتیک
 * رندر شود؛ در آن حالت کد سمت سرور فقط یک‌بار موقع build اجرا می‌شد و هیچ
 * ۴۰۴ واقعی ثبت نمی‌شد. از سمت کلاینت هر بازدید واقعی شمرده می‌شود.
 *
 * چیزی رندر نمی‌کند و هیچ خطایی را به کاربر نشان نمی‌دهد — اگر ثبت آمار
 * شکست بخورد، کاربر همان صفحه‌ی ۴۰۴ عادی را می‌بیند.
 */
export default function NotFoundReporter() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // در حالت توسعه ثبت نمی‌کنیم تا جدول با مسیرهای آزمایشی پر نشود
    if (process.env.NODE_ENV !== "production") return;

    const key = `nf:${pathname}`;
    try {
      // در یک نشست، هر مسیر فقط یک‌بار — رفرش پیاپی آمار را متورم نکند
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* sessionStorage در حالت خصوصی ممکن است در دسترس نباشد */
    }

    fetch("/api/internal/not-found", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, referer: document.referrer || null }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
