/**
 * زمان‌بند کارتابل — اجرای دوره‌ای قواعد تکرارشونده.
 *
 * عمداً **جدا از worker یکپارچه‌سازی** است. آن worker گیتِ خودش را دارد
 * (`IntegSettings.workerEnabled`) و اگر رکورد singleton نباشد بی‌صدا هیچ‌کاری
 * نمی‌کند — یک نقطه‌ی خرابیِ شناخته‌شده روی دیپلوی تازه. کارتابل نباید به آن
 * وصل شود.
 *
 * ⚠️ درسِ همان تله: وقتی زمان‌بند خاموش است، **در لاگ می‌گوید چرا**. زمان‌بندی
 * که بی‌صدا کار نمی‌کند، ساعت‌ها وقت عیب‌یابی می‌برد.
 */

import { prisma } from "@/lib/prisma";
import { runRecurringRules } from "./recurring";

let started = false;

/** هر ده دقیقه. قواعد به‌ازای هر روز یکتا هستند، پس اجرای مکرر بی‌خطر است. */
const TICK_MS = 10 * 60_000;
const BOOT_DELAY_MS = 20_000;

async function tick() {
  try {
    const settings = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { worklistEnabled: true },
    });

    if (!settings) {
      console.warn("[worklist] رکورد StoreSettings نیست؛ زمان‌بند خاموش می‌ماند.");
      return;
    }
    if (!settings.worklistEnabled) return; // خاموشیِ عمدی، لاگ لازم ندارد

    const results = await runRecurringRules();
    const created = results.reduce((sum, r) => sum + r.created, 0);
    if (created > 0) {
      console.log(`[worklist] ${created} کار خودکار ساخته شد.`);
    }
  } catch (e) {
    // زمان‌بند هرگز نباید پروسه‌ی سایت را بشکند
    console.error("[worklist] چرخه‌ی زمان‌بند شکست خورد:", e);
  }
}

export function startWorklistScheduler(): void {
  if (started || typeof window !== "undefined") return;
  started = true;

  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS);
  }, BOOT_DELAY_MS);
}
