/**
 * زمان‌بند ابزارها — فعلاً فقط ارسال پیامک درخواست نظر، هر ۵ دقیقه.
 *
 * جدا از زمان‌بند کارتابل و حسابداری است: گیتش خودِ تنظیمات «درخواست نظر»
 * است (`ReviewRequestSetting.isEnabled`) و خاموش‌بودن بقیه نباید اثری داشته باشد.
 *
 * مستندات: docs/features/tools.md بخش ۴
 */

import { runReviewRequests } from "./reviews";

let started = false;
const TICK_MS = 5 * 60_000;
const BOOT_DELAY_MS = 45_000;

async function tick() {
  try {
    const r = await runReviewRequests();
    if (r.sent + r.failed + r.skipped > 0) {
      console.log(`[review-request] ${r.sent} ارسال، ${r.skipped} کنار گذاشته، ${r.failed} ناموفق`);
    }
  } catch (e) {
    console.error("[tools-scheduler] چرخه ناموفق:", e);
  }
}

export function startToolsScheduler(): void {
  if (started || typeof window !== "undefined") return;
  started = true;
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, BOOT_DELAY_MS);
}
