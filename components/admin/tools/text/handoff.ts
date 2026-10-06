/**
 * فرستادن متن یک فرم (پیامک، توضیح محصول، متای سئو) به کاراکترشمار در زبانه‌ی
 * تازه — متن بلند در آدرس جا نمی‌شود، پس از localStorage رد می‌شود و صفحه‌ی
 * مقصد بعد از خواندن پاکش می‌کند. docs/features/tools.md بخش ۵
 */

import type { ProfileKey } from "@/lib/tools/text-profiles";

export const HANDOFF_KEY = "tools.textCounter.handoff";

export interface TextHandoff {
  text: string;
  profile?: ProfileKey;
  keyword?: string;
}

export function openTextCounter(h: TextHandoff) {
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(h));
  } catch {}
  window.open("/admin/tools/text-counter?from=handoff", "_blank", "noopener");
}
