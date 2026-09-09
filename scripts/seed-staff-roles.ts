/**
 * ساخت نقش‌های پیش‌فرض کارتابل
 *
 *   pnpm tsx scripts/seed-staff-roles.ts
 *
 * اسکریپت idempotent است — نقش‌های موجود **بازنویسی نمی‌شوند** تا مجوزهایی
 * که مدیر دستی تنظیم کرده از بین نرود. فقط نقش‌های نبوده ساخته می‌شوند.
 *
 * تنها استثنا نقش سیستمیِ «مدیر» است: مجوزهایش همیشه به کاملِ روز به‌روز
 * می‌شود، وگرنه با افزودن هر مجوز تازه به کد، مدیر از آن بخش بیرون می‌ماند.
 *
 * ⚠️ اجرای این اسکریپت به هیچ کاربری نقش نمی‌دهد. تا وقتی مدیر عمداً از
 * پنل نقشی به کسی ندهد، همه‌ی ادمین‌ها دسترسی کاملشان را دارند.
 *
 * مستندات: docs/features/staff-worklist.md بخش ۱۲
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import { ALL_PERMISSIONS } from "../lib/permissions";

interface RoleSeed {
  slug: string;
  title: string;
  description: string;
  isSystem?: boolean;
  /** `"*"` یعنی همه‌ی مجوزها */
  permissions: string[] | "*";
}

const ROLES: RoleSeed[] = [
  {
    slug: "manager",
    title: "مدیر",
    description: "دسترسی کامل به همه‌ی بخش‌های کارتابل",
    isSystem: true,
    permissions: "*",
  },
  {
    slug: "supervisor",
    title: "سرپرست",
    description: "مدیریت کار و تماس تیم، بدون دسترسی به تنظیمات و نقش‌ها",
    permissions: [
      "WORK_VIEW_OWN", "WORK_VIEW_ALL", "WORK_CREATE", "WORK_EDIT_OWN",
      "WORK_EDIT_ALL", "WORK_ASSIGN",
      "CALL_VIEW_OWN", "CALL_VIEW_ALL", "CALL_LOG",
      "ORDER_CREATE",
      "STAFF_VIEW",
      "ATTENDANCE_VIEW_OWN", "ATTENDANCE_VIEW_ALL",
      "WORK_REPORT_VIEW", "WORK_REPORT_EXPORT",
      "SCORE_VIEW_OWN", "SCORE_VIEW_ALL",
    ],
  },
  {
    slug: "sales",
    title: "فروش",
    description: "ثبت تماس و سفارش، پیگیری مشتری",
    permissions: [
      "WORK_VIEW_OWN", "WORK_CREATE", "WORK_EDIT_OWN", "WORK_ASSIGN",
      "CALL_VIEW_OWN", "CALL_LOG",
      "ORDER_CREATE",
      "ATTENDANCE_VIEW_OWN",
      "SCORE_VIEW_OWN",
    ],
  },
  {
    slug: "support",
    title: "پشتیبانی",
    description: "پشتیبانی فنی، نصب دستگاه و گارانتی",
    permissions: [
      "WORK_VIEW_OWN", "WORK_CREATE", "WORK_EDIT_OWN", "WORK_ASSIGN",
      "CALL_VIEW_OWN", "CALL_LOG",
      "ATTENDANCE_VIEW_OWN",
      "SCORE_VIEW_OWN",
    ],
  },
  {
    slug: "content",
    title: "محتوا و سئو",
    description: "تولید محتوا، بنر، شبکه‌های اجتماعی و کارهای سئو",
    permissions: [
      "WORK_VIEW_OWN", "WORK_CREATE", "WORK_EDIT_OWN",
      "ATTENDANCE_VIEW_OWN",
      "SCORE_VIEW_OWN",
    ],
  },
  {
    slug: "procurement",
    title: "تدارکات",
    description: "استعلام قیمت، هماهنگی خرید و تأمین کالا",
    permissions: [
      "WORK_VIEW_OWN", "WORK_CREATE", "WORK_EDIT_OWN", "WORK_ASSIGN",
      "CALL_VIEW_OWN", "CALL_LOG",
      "ATTENDANCE_VIEW_OWN",
      "SCORE_VIEW_OWN",
    ],
  },
  {
    slug: "viewer",
    title: "ناظر",
    description: "فقط مشاهده‌ی گزارش‌ها، بدون هیچ نوشتنی",
    permissions: [
      "WORK_VIEW_OWN", "WORK_VIEW_ALL",
      "CALL_VIEW_OWN", "CALL_VIEW_ALL",
      "STAFF_VIEW",
      "ATTENDANCE_VIEW_OWN", "ATTENDANCE_VIEW_ALL",
      "WORK_REPORT_VIEW",
      "SCORE_VIEW_OWN", "SCORE_VIEW_ALL",
    ],
  },
];

async function main() {
  let created = 0;
  let refreshed = 0;
  let kept = 0;

  for (const [index, seed] of ROLES.entries()) {
    const permissions =
      seed.permissions === "*" ? ALL_PERMISSIONS : seed.permissions;

    // اعتبارسنجی: کلید ناشناخته در سید یعنی غلط تایپی، نه مجوز تازه
    const unknown = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (unknown.length) {
      throw new Error(`نقش «${seed.title}» مجوز ناشناخته دارد: ${unknown.join(", ")}`);
    }

    const existing = await prisma.staffRole.findUnique({
      where: { slug: seed.slug },
      select: { id: true, isSystem: true },
    });

    if (!existing) {
      await prisma.staffRole.create({
        data: {
          slug: seed.slug,
          title: seed.title,
          description: seed.description,
          permissions,
          isSystem: seed.isSystem ?? false,
          sortOrder: index,
        },
      });
      created++;
      console.log(`+ ساخته شد: ${seed.title} (${permissions.length} مجوز)`);
      continue;
    }

    // نقش سیستمی همیشه کامل می‌ماند؛ بقیه دست‌نخورده باقی می‌مانند
    if (seed.isSystem) {
      await prisma.staffRole.update({
        where: { id: existing.id },
        data: { permissions, isSystem: true, isActive: true },
      });
      refreshed++;
      console.log(`↻ به‌روز شد: ${seed.title} (${permissions.length} مجوز)`);
    } else {
      kept++;
      console.log(`= دست‌نخورده ماند: ${seed.title}`);
    }
  }

  console.log(`\nساخته‌شده ${created} · به‌روزشده ${refreshed} · دست‌نخورده ${kept}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
