/**
 * زمان‌بند ابزارها — هر ۵ دقیقه: پیامک درخواست نظر و یادآوری سبد رهاشده.
 *
 * جدا از زمان‌بند کارتابل و حسابداری است: گیت هر کار تنظیمات خود همان ابزار
 * است (`isEnabled`) و خاموش‌بودن یکی نباید اثری روی دیگری داشته باشد.
 *
 * مستندات: docs/features/tools.md بخش ۴، docs/plans/store-tools-2.md بخش ۱
 */

import { runCartRecoveries, scanAbandonedCarts } from "./cart-recovery";
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
  try {
    const found = await scanAbandonedCarts();
    const r = await runCartRecoveries();
    if (found + r.sent + r.failed + r.skipped > 0) {
      console.log(`[cart-recovery] ${found} سبد تازه، ${r.sent} ارسال، ${r.skipped} کنار گذاشته، ${r.failed} ناموفق`);
    }
  } catch (e) {
    console.error("[tools-scheduler] یادآوری سبد ناموفق:", e);
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
