/**
 * قواعد تکرارشونده‌ی پیش‌فرض — کارهای روزانه‌ای که سیستم خودش می‌سازد.
 *
 *   pnpm tsx scripts/seed-recurring-rules.ts                      # = --preset=core
 *   pnpm tsx scripts/seed-recurring-rules.ts --preset=mahamprint  # + قیمت هر بازارگاه
 *
 * **قواعد به نقش بسته می‌شوند، نه به نام آدم‌ها.** سیدِ کدشده با نام یک
 * کارمند برای هیچ کسب‌وکار دیگری کار نمی‌کند و روزی که آن نفر عوض شود
 * می‌شکند. با نقش، مدیر از `/admin/worklist/roles` عضو را جابه‌جا می‌کند و
 * قاعده دست‌نخورده می‌ماند.
 *
 * قاعده‌ی روزانه در روز تعطیلِ `worklistWorkHours` کار نمی‌سازد — این از قبل
 * در زمان‌بند هست و اینجا کاری لازم ندارد.
 *
 * ⚠️ idempotent با عنوان: قاعده‌ای که عنوانش هست دوباره ساخته نمی‌شود، تا
 * ویرایش‌های مدیر (ساعت، سقف، نقش) از بین نرود.
 *
 * مستندات: docs/plans/business-config.md بخش ۵
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import type { StaffScheduleKind } from "@prisma/client";

type Preset = "core" | "mahamprint";

interface RuleSeed {
  title: string;
  /** slug نوع کار — از `seed-task-types.ts` */
  typeSlug: string;
  /** slug نقش — از `seed-staff-roles.ts`. کار گردشی بین اعضای این نقش پخش می‌شود */
  roleSlug: string;
  schedule: StaffScheduleKind;
  timeOfDay?: string;
  /** برای CUSTOMER_IDLE — هم شرط انتخاب است هم فاصله‌ی محافظ */
  idleDays?: number;
  maxPerRun?: number;
  /** بازارگاهی که این قاعده برایش ساخته می‌شود — روی کار نمی‌نشیند، فقط در عنوان */
  preset?: Preset;
}

const RULES: RuleSeed[] = [
  // ── هسته ────────────────────────────────────────────────────
  {
    title: "قیمت‌گذاری روزانه‌ی سایت",
    typeSlug: "site-pricing",
    roleSlug: "pricing",
    schedule: "DAILY",
    timeOfDay: "09:00",
    maxPerRun: 1,
  },
  {
    title: "ساخت بنر و موشن روزانه",
    typeSlug: "creative-design",
    roleSlug: "content",
    schedule: "DAILY",
    timeOfDay: "10:00",
    maxPerRun: 1,
  },
  {
    title: "انتشار در کانال‌ها و استوری",
    typeSlug: "social-post",
    roleSlug: "content",
    schedule: "DAILY",
    timeOfDay: "11:00",
    maxPerRun: 1,
  },
  {
    // تنها قاعده‌ای که به‌ازای هر مشتری ردیف می‌سازد، پس سقف دارد: اولین
    // اجرا هزاران نفر واجد شرایط دارد و بدون سقف، کارتابل یک نفر پر می‌شود.
    title: "تماس دوره‌ای با مشتری ثابت",
    typeSlug: "regular-customer-call",
    roleSlug: "sales",
    schedule: "CUSTOMER_IDLE",
    idleDays: 90,
    maxPerRun: 10,
  },

  // ── مهام‌پرینت: یک قاعده به‌ازای هر بازارگاه ─────────────────
  // چهار قاعده‌ی جدا، نه یک قاعده با چهار نتیجه: فقط این‌طور می‌شود پرسید
  // «دیجی‌کالا چند روز از سی روز بروز شد».
  {
    title: "قیمت‌گذاری پنل اسنپ‌شاپ",
    typeSlug: "marketplace-pricing",
    roleSlug: "pricing",
    schedule: "DAILY",
    timeOfDay: "09:30",
    maxPerRun: 1,
    preset: "mahamprint",
  },
  {
    title: "قیمت‌گذاری پنل تپسی‌شاپ",
    typeSlug: "marketplace-pricing",
    roleSlug: "pricing",
    schedule: "DAILY",
    timeOfDay: "09:35",
    maxPerRun: 1,
    preset: "mahamprint",
  },
  {
    title: "قیمت‌گذاری پنل دیجی‌کالا",
    typeSlug: "marketplace-pricing",
    roleSlug: "pricing",
    schedule: "DAILY",
    timeOfDay: "09:40",
    maxPerRun: 1,
    preset: "mahamprint",
  },
  {
    title: "قیمت‌گذاری پنل پیندو",
    typeSlug: "marketplace-pricing",
    roleSlug: "pricing",
    schedule: "DAILY",
    timeOfDay: "09:45",
    maxPerRun: 1,
    preset: "mahamprint",
  },
];

/** بازارگاه‌های پیش‌فرضِ مهام‌پرینت — هیچ‌کدام هنوز اتصال ندارند و دستی‌اند */
const PLATFORMS: Record<Preset, { key: string; label: string }[]> = {
  core: [],
  mahamprint: [
    { key: "snapp", label: "اسنپ‌شاپ" },
    { key: "tapsi", label: "تپسی‌شاپ" },
    { key: "digikala", label: "دیجی‌کالا" },
    { key: "pindo", label: "پیندو" },
  ],
};

function readPreset(): Preset {
  const arg = process.argv.find((a) => a.startsWith("--preset="));
  if (!arg) return "core";
  const value = arg.slice("--preset=".length);
  if (value === "core" || value === "mahamprint") return value;
  throw new Error(`پیش‌تنظیم ناشناخته: ${value} — core یا mahamprint`);
}

async function main() {
  const preset = readPreset();
  const selected = RULES.filter((r) => !r.preset || r.preset === preset);

  console.log(`پیش‌تنظیم: ${preset} · ${selected.length} قاعده\n`);

  let created = 0;
  let kept = 0;
  let skipped = 0;

  for (const seed of selected) {
    const [type, role, existing] = await Promise.all([
      prisma.staffTaskType.findUnique({ where: { slug: seed.typeSlug }, select: { id: true } }),
      prisma.staffRole.findUnique({ where: { slug: seed.roleSlug }, select: { id: true } }),
      prisma.staffRecurringRule.findFirst({ where: { title: seed.title }, select: { id: true } }),
    ]);

    if (existing) {
      kept++;
      continue;
    }
    // نوع کار یا نقش نبود: رد می‌شود و **می‌گوید چرا**. اجرای سید انواع کار
    // با پیش‌تنظیم دیگری، تنها دلیل رایج این حالت است.
    if (!type || !role) {
      skipped++;
      console.log(`! رد شد: ${seed.title} — ${!type ? `نوع کار ${seed.typeSlug}` : `نقش ${seed.roleSlug}`} پیدا نشد`);
      continue;
    }

    await prisma.staffRecurringRule.create({
      data: {
        typeId: type.id,
        title: seed.title,
        // ownerId خالی = گردشی بین اعضای نقش
        roleId: role.id,
        schedule: seed.schedule,
        timeOfDay: seed.timeOfDay ?? null,
        idleDays: seed.idleDays ?? null,
        maxPerRun: seed.maxPerRun ?? 20,
      },
    });
    created++;
    console.log(`+ ${seed.title}  [${seed.roleSlug}]`);
  }

  // فهرست بازارگاه‌ها — بدون آن، انتخابگر پلتفرمِ فرم ثبت کار خالی است
  const platforms = PLATFORMS[preset];
  if (platforms.length > 0) {
    const current = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { worklistPlatforms: true },
    });
    const existingList = Array.isArray(current?.worklistPlatforms) ? current.worklistPlatforms : [];
    if (existingList.length === 0) {
      await prisma.storeSettings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", worklistPlatforms: platforms },
        update: { worklistPlatforms: platforms },
      });
      console.log(`\n+ ${platforms.length} بازارگاه در تنظیمات کارتابل`);
    } else {
      console.log(`\n= فهرست بازارگاه‌ها از قبل تنظیم شده — دست نخورد`);
    }
  }

  console.log(`\nساخته‌شده ${created} · از قبل موجود ${kept} · رد شده ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
