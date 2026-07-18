/**
 * ساخت قالب‌های پیش‌فرض باشگاه مشتریان
 *
 *   pnpm tsx scripts/seed-club-templates.ts
 *
 * اسکریپت idempotent است — قالب‌های موجود بازنویسی نمی‌شوند تا ویرایش‌های
 * ادمین از بین نرود. فقط قالب‌های نبوده ساخته می‌شوند.
 *
 * کدهای پترن به‌صورت پیش‌فرض پر می‌شوند ولی قالب‌ها **غیرفعال** ساخته
 * می‌شوند؛ بعد از تأیید پترن در پنل، از صفحه قالب‌ها فعالشان کنید.
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";

const TEMPLATES = [
  {
    key: "welcome",
    title: "خوش‌آمدگویی",
    kind: "TRANSACTIONAL" as const,
    mode: "PATTERN" as const,
    patternCode: "vO8hzQ0pbS",
    body: "%name% عزیز، به باشگاه مشتریان %store% خوش آمدید",
  },
  {
    key: "birthday",
    title: "تبریک تولد",
    kind: "TRANSACTIONAL" as const,
    mode: "PATTERN" as const,
    patternCode: "D5SglTqngw",
    body: "%name% عزیز، تولدت مبارک! هدیه شما از %store%: %code%",
  },
  {
    key: "dormant",
    title: "مشتری خوابیده (دلتنگ)",
    kind: "MARKETING" as const,
    mode: "PATTERN" as const,
    patternCode: "6la4HkEVqh",
    body: "%name% عزیز، دلمان برایتان تنگ شده. %store%",
  },
  {
    key: "points",
    title: "اطلاع امتیاز",
    kind: "TRANSACTIONAL" as const,
    mode: "PATTERN" as const,
    patternCode: "RPSUuvRK1t",
    body: "%name% عزیز، امتیاز فعلی شما در %store%: %points%",
  },
  {
    key: "campaign_general",
    title: "کمپین عمومی (نمونه)",
    kind: "MARKETING" as const,
    mode: "TEXT" as const,
    patternCode: null,
    body: "سلام {name} عزیز\nبه مناسبت ... تخفیف ویژه {store} فعال شد.",
  },
];

async function main() {
  console.log("═══ ساخت قالب‌های پیش‌فرض ═══\n");

  let created = 0;
  let skipped = 0;

  for (const t of TEMPLATES) {
    const exists = await prisma.smsTemplate.findUnique({ where: { key: t.key } });

    if (exists) {
      console.log(`⏭️  ${t.title} — از قبل وجود دارد`);
      skipped++;
      continue;
    }

    await prisma.smsTemplate.create({
      data: {
        key: t.key,
        title: t.title,
        kind: t.kind,
        mode: t.mode,
        patternCode: t.patternCode,
        body: t.body,
        // تا تأیید پترن در پنل، غیرفعال بماند
        isActive: false,
      },
    });

    console.log(`✅ ${t.title}${t.patternCode ? ` — پترن ${t.patternCode}` : ""}`);
    created++;
  }

  console.log(`\nساخته شد: ${created} · رد شد: ${skipped}`);
  console.log("\nهمه قالب‌ها غیرفعال ساخته شدند.");
  console.log("بعد از تأیید پترن‌ها در پنل، از /admin/club/templates فعالشان کنید.\n");
}

main()
  .catch((err) => {
    console.error("خطا:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });