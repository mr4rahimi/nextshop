/**
 * طرح پورسانت پیش‌فرض — یک قاعده: همه‌ی کالاها ۱۰٪
 *
 *   npx tsx scripts/seed-commission-plan.ts
 *
 * idempotent: اگر طرحی با همین عنوان باشد دست نمی‌خورد. ۱۰٪ فقط نقطه‌ی شروع
 * است و از «تنظیمات کارتابل ← طرح‌های پورسانت» قابل ویرایش است (بخش ۲۲.۵).
 * این اسکریپت طرح را به هیچ کارمندی وصل نمی‌کند.
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";

const TITLE = "طرح پایه";

async function main() {
  const existing = await prisma.staffCommissionPlan.findFirst({ where: { title: TITLE } });
  if (existing) {
    console.log(`= موجود: ${TITLE}`);
    return;
  }
  await prisma.staffCommissionPlan.create({
    data: { title: TITLE, rules: { create: [{ percent: 10 }] } },
  });
  console.log(`+ ساخته شد: ${TITLE} (همه‌ی کالاها ۱۰٪)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
