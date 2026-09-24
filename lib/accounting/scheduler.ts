/**
 * زمان‌بند حسابداری — هر ده دقیقه، فقط در حالت داخلی.
 *
 * جدا از worker یکپارچه‌سازی و زمان‌بند کارتابل است: هر دو گیت خودشان را
 * دارند و خاموش بودنشان نباید یادآوری چک را خاموش کند.
 */

import { getAccMode } from "./settings";
import { runChequeReminders } from "./cash/reminders";

let started = false;
const TICK_MS = 10 * 60_000;
const BOOT_DELAY_MS = 30_000;

async function tick() {
  try {
    if ((await getAccMode()) !== "INTERNAL") return;
    const r = await runChequeReminders();
    if (r.notified + r.tasks > 0) console.log(`[acc-cheque] یادآوری سررسید: ${r.notified} اعلان، ${r.tasks} کار پیگیری`);
  } catch (e) {
    console.error("[acc-scheduler] چرخه ناموفق:", e);
  }
}

export function startAccountingScheduler(): void {
  if (started || typeof window !== "undefined") return;
  started = true;
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, BOOT_DELAY_MS);
}
