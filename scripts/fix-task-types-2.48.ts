/**
 * اصلاح انواع کارِ از قبل ساخته‌شده — نسخه‌ی ۲.۴۸.۰
 *
 *   pnpm tsx scripts/fix-task-types-2.48.ts
 *
 * **چرا اسکریپت جدا و نه سید؟** `seed-task-types.ts` عمداً نوعِ موجود را
 * بازنویسی نمی‌کند تا ویرایش‌های مدیر (وزن، نتیجه‌ها، SLA) از بین نرود. ولی
 * سه تغییر این نسخه روی سرورهایی لازم‌اند که قبلاً سید شده‌اند.
 *
 * هر اصلاح **مشروط** است: فقط وقتی اعمال می‌شود که مقدار هنوز همان پیش‌فرض
 * قدیمی باشد. اگر مدیر خودش عوضش کرده، دست نمی‌خورد و در خروجی گفته می‌شود.
 * پس اجرای دوباره‌اش بی‌خطر است.
 *
 * مستندات: docs/plans/business-config.md
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";

/** نتیجه‌های قدیمیِ قیمت‌گذاری بازارگاه — نام پلتفرم به‌جای نتیجه */
const OLD_MARKETPLACE_OUTCOMES = ["snapp", "tapsi", "digikala", "pindo"];

const NEW_MARKETPLACE_OUTCOMES = [
  { value: "updated", label: "بروز شد", isSuccess: true },
  { value: "no_change", label: "تغییری لازم نبود" },
  { value: "partial", label: "ناقص ماند" },
  { value: "blocked", label: "پنل در دسترس نبود" },
];

function outcomeValues(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((o) =>
    o && typeof o === "object" && typeof (o as { value?: unknown }).value === "string"
      ? [(o as { value: string }).value]
      : [],
  );
}

async function main() {
  const done: string[] = [];
  const untouched: string[] = [];

  // ── ۱. پیک تهران: سه‌ساعته ← دوساعته ─────────────────────────
  const courier = await prisma.staffTaskType.findUnique({
    where: { slug: "dispatch-courier" },
    select: { id: true, slaMinutes: true },
  });
  if (courier) {
    if (courier.slaMinutes === 180) {
      await prisma.staffTaskType.update({ where: { id: courier.id }, data: { slaMinutes: 120 } });
      done.push("پیک تهران: مهلت ۱۸۰ ← ۱۲۰ دقیقه");
    } else {
      untouched.push(`پیک تهران: مهلت ${courier.slaMinutes ?? "ندارد"} — دست‌کاری‌شده، دست نخورد`);
    }
  }

  // ── ۲. قیمت‌گذاری بازارگاه: پلتفرم بُعد شد، نه نتیجه ──────────
  const marketplace = await prisma.staffTaskType.findUnique({
    where: { slug: "marketplace-pricing" },
    select: { id: true, outcomes: true, needsPlatform: true, title: true },
  });
  if (marketplace) {
    const data: Prisma.StaffTaskTypeUpdateInput = {};
    if (!marketplace.needsPlatform) data.needsPlatform = true;

    const values = outcomeValues(marketplace.outcomes);
    const isOld =
      values.length === OLD_MARKETPLACE_OUTCOMES.length &&
      OLD_MARKETPLACE_OUTCOMES.every((v) => values.includes(v));
    if (isOld) {
      data.outcomes = NEW_MARKETPLACE_OUTCOMES as unknown as Prisma.InputJsonValue;
      data.title = "قیمت‌گذاری پنل بازارگاه";
    }

    if (Object.keys(data).length > 0) {
      await prisma.staffTaskType.update({ where: { id: marketplace.id }, data });
      done.push(
        `قیمت‌گذاری بازارگاه: انتخابگر پلتفرم${isOld ? " + نتیجه‌های تازه" : ""}`,
      );
    } else {
      untouched.push("قیمت‌گذاری بازارگاه: از قبل درست بود");
    }

    // ⚠️ کارهای ثبت‌شده‌ی قدیمی که نتیجه‌شان نام پلتفرم بود، **دست نمی‌خورند**.
    // نتیجه‌ی آن‌ها در گزارش با مقدار خام دیده می‌شود، نه برچسب. بازنویسی‌شان
    // یعنی گزارش پارسال جابه‌جا شود و این همان چیزی است که قرارداد کارتابل
    // ممنوع می‌کند.
    const legacy = await prisma.staffTask.count({
      where: { typeId: marketplace.id, outcome: { in: OLD_MARKETPLACE_OUTCOMES } },
    });
    if (legacy > 0) {
      console.log(
        `\nℹ ${legacy} کارِ قدیمیِ قیمت‌گذاری نتیجه‌شان نام پلتفرم است. عمداً` +
          ` دست نخوردند — گزارش گذشته جابه‌جا نمی‌شود.`,
      );
    }
  }

  // ── ۳. فاکتور رسمی: شماره‌ی مرجع ─────────────────────────────
  const invoice = await prisma.staffTaskType.findUnique({
    where: { slug: "invoice-official" },
    select: { id: true, needsRef: true },
  });
  if (invoice) {
    if (!invoice.needsRef) {
      await prisma.staffTaskType.update({
        where: { id: invoice.id },
        data: { needsRef: true, refLabel: "شماره فاکتور رسمی" },
      });
      done.push("فاکتور رسمی: فیلد شماره فاکتور");
    } else {
      untouched.push("فاکتور رسمی: از قبل شماره داشت");
    }
  }

  console.log("\n── اعمال شد ──");
  if (done.length === 0) console.log("(چیزی لازم نبود)");
  done.forEach((d) => console.log(`+ ${d}`));

  if (untouched.length > 0) {
    console.log("\n── دست نخورد ──");
    untouched.forEach((d) => console.log(`= ${d}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
