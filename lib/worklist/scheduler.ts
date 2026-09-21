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
import { closeStaleSessions, aggregateRecentDays } from "./attendance";
import { sweepDeals } from "./deals";
import { runSeoSweep } from "@/lib/marketing/seo-sweep";

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

    // حضور — بستن نشستِ مرورگرهای بسته‌شده و بازسازی روزهای اخیر.
    // ⚠️ جدا از قواعد تکرارشونده try/catch می‌شود: اگر تجمیع حضور بشکند،
    // نباید ساختِ کارهای خودکار در چرخه‌ی بعد هم متوقف بماند و برعکس.
    try {
      const closed = await closeStaleSessions();
      if (closed > 0) {
        console.log(`[worklist] ${closed} نشستِ بی‌ضربان بسته شد.`);
      }
      await aggregateRecentDays();
    } catch (e) {
      console.error("[worklist] تجمیع حضور شکست خورد:", e);
    }

    // معامله‌ی سفارش‌هایی که از مسیرِ بدون هوک پرداخت یا لغو شدند (فاز ۹)
    try {
      const { created: deals, voided } = await sweepDeals();
      if (deals + voided > 0) {
        console.log(`[worklist] جاروب معامله: ${deals} ساخته، ${voided} لغو شد.`);
      }
    } catch (e) {
      console.error("[worklist] جاروب معامله شکست خورد:", e);
    }

    // کار دوره‌ای سئو و یادآوری بررسی نتیجه.
    // ⚠️ جدا try/catch می‌شود، مثل بقیه: شکستن این نباید جلوی چرخه‌ی بعدیِ
    // حضور و معامله را بگیرد و برعکس.
    try {
      const { created, blocked, reminded } = await runSeoSweep();
      if (created + blocked + reminded > 0) {
        console.log(
          `[seo] جاروب: ${created} کار دوره‌ای ساخته، ${blocked} به‌خاطر کار باز رد، ${reminded} یادآوری بررسی.`,
        );
      }
    } catch (e) {
      console.error("[seo] جاروب سئو شکست خورد:", e);
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
