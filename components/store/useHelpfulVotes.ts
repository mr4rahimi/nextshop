"use client";

/**
 * رأی «مفید بود» — مشترک بین نظرات محصول و نظرات مقاله.
 *
 * سرور با کلید یکتای `[شناسه، رأی‌دهنده]` مانع رأی دوم می‌شود؛ این هوک فقط
 * کاری می‌کند که کاربر بعد از رفرش هم دکمه‌ی رأی‌داده‌اش را غیرفعال ببیند.
 * حافظه‌ی مرورگر اینجا یک راحتیِ نمایشی است نه منبع حقیقت، پس اگر در دسترس
 * نبود (حالت ناشناس، مسدودکردن کوکی) هیچ چیزی نباید بشکند.
 *
 * مستندات: docs/features/reviews.md
 */

import { useCallback, useEffect, useState } from "react";

export function useHelpfulVotes(storageKey: string, endpoint: (id: string) => string) {
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState<Record<string, number>>({});

  useEffect(() => {
    // بازگرداندن رأی‌های قبلی بعد از mount؛ روی سرور localStorage وجود ندارد
    // و خواندنش در مقدار اولیه‌ی state باعث ناسازگاری hydration می‌شود
    setVoted(read(storageKey));
  }, [storageKey]);

  const vote = useCallback(
    async (id: string, helpful: boolean) => {
      let already = false;
      setVoted((prev) => {
        if (prev[id]) {
          already = true;
          return prev;
        }
        const next = { ...prev, [id]: true };
        write(storageKey, next);
        return next;
      });
      if (already) return;

      if (helpful) {
        setExtra((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
      }

      await fetch(endpoint(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful }),
      }).catch(() => {
        // شمارنده‌ی نمایشی برمی‌گردد سر جایش؛ رأی ثبت نشده است
        if (helpful) {
          setExtra((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 1) - 1) }));
        }
      });
    },
    [storageKey, endpoint],
  );

  return { voted, extra, vote };
}

function read(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(key: string, value: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // بی‌اهمیت است؛ سرور هم رأی تکراری را رد می‌کند
  }
}
