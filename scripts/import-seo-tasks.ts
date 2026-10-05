/**
 * ثبت دسته‌جمعی کار سئو و کار محتوا از یک فایل JSON — برای خروجی ممیزی سئو
 *
 *   pnpm tsx scripts/import-seo-tasks.ts <file.json>            # فقط نمایش (پیش‌فرض)
 *   pnpm tsx scripts/import-seo-tasks.ts <file.json> --apply    # ثبت واقعی
 *
 * کارها **از مسیر همان سرویس‌های پنل** ساخته می‌شوند (`createSeoTask` و
 * `createContentTask`)، نه با insert مستقیم؛ پس رویداد «ثبت شد»، اعلان به مسئول
 * و لاگ فعالیت دقیقاً مثل ثبت از فرم ساخته می‌شود و نام سازنده همان کاربری است
 * که در فایل آمده.
 *
 * idempotent است: کاری که عنوانش (حذف‌نشده) از قبل هست ساخته نمی‌شود، پس اجرای
 * دوباره‌ی همان فایل کار تکراری نمی‌سازد.
 *
 * قالب فایل:
 * {
 *   "createdById": "<شناسه‌ی کاربر ثبت‌کننده>",
 *   "seoTasks": [{ "categoryKey": "REDIRECTS", "title": "…", "description": "…",
 *                  "pageUrls": "…", "assigneeId": "…", "priority": "HIGH",
 *                  "dueAt": "2026-10-05", "reviewAt": "2026-11-05", "checklist": ["…"] }],
 *   "contentTasks": [{ "title": "…", "primaryKeyword": "…", "relatedKeywords": "…",
 *                      "brief": "…", "writerId": "…", "publisherId": "…",
 *                      "priority": "NORMAL", "dueAt": "2026-10-12" }]
 * }
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵
 */

import "../lib/load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { ALL_PERMISSIONS, type StaffAccess } from "../lib/permissions";
import { createSeoTask, type CreateSeoTaskInput } from "../lib/marketing/seo-task-service";
import {
  createContentTask,
  type CreateContentTaskInput,
} from "../lib/marketing/content-task-service";

interface SeoTaskRow extends Omit<CreateSeoTaskInput, "categoryId"> {
  categoryKey: string;
}

interface ImportFile {
  createdById: string;
  seoTasks?: SeoTaskRow[];
  contentTasks?: CreateContentTaskInput[];
}

/** همان منطق `getStaffAccess`، بدون کوکی جلسه */
async function accessFor(userId: string): Promise<StaffAccess> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, role: { in: ["ADMIN", "SELLER"] } },
    select: { id: true, firstName: true, lastName: true, phone: true, role: true, staffRoleId: true },
  });
  if (!user) throw new Error(`کاربر ثبت‌کننده (${userId}) پیدا نشد یا کارمند نیست`);

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.phone || "بدون نام";
  const base = { userId: user.id, name, phone: user.phone, role: user.role };

  if (!user.staffRoleId) {
    const unrestricted = user.role === "ADMIN";
    return {
      ...base,
      roleId: null,
      roleTitle: null,
      permissions: unrestricted ? ALL_PERMISSIONS : [],
      isUnrestricted: unrestricted,
    };
  }
  const role = await prisma.staffRole.findUnique({
    where: { id: user.staffRoleId },
    select: { id: true, title: true, permissions: true, isActive: true },
  });
  return {
    ...base,
    roleId: user.staffRoleId,
    roleTitle: role?.title ?? null,
    permissions: role?.isActive ? role.permissions : [],
    isUnrestricted: false,
  };
}

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!file) throw new Error("مسیر فایل JSON را بدهید");

  const data = JSON.parse(readFileSync(file, "utf8")) as ImportFile;
  const access = await accessFor(data.createdById);
  console.log(`ثبت‌کننده: ${access.name}${apply ? "" : "  (نمایشی — برای ثبت --apply بدهید)"}`);

  const categories = await prisma.seoTaskCategory.findMany({
    where: { isActive: true },
    select: { id: true, key: true },
  });
  const catByKey = new Map(categories.map((c) => [c.key, c.id]));

  let created = 0;
  let skipped = 0;

  for (const row of data.seoTasks ?? []) {
    const { categoryKey, ...rest } = row;
    const categoryId = catByKey.get(categoryKey);
    if (!categoryId) throw new Error(`دسته‌ی «${categoryKey}» پیدا نشد (عنوان: ${row.title})`);

    const exists = await prisma.seoTask.findFirst({
      where: { title: row.title, deletedAt: null },
      select: { code: true },
    });
    if (exists) {
      console.log(`  = سئو ${exists.code} از قبل هست: ${row.title}`);
      skipped++;
      continue;
    }
    if (apply) {
      const t = await createSeoTask({ ...rest, categoryId }, access);
      console.log(`  + سئو ${t.code}: ${row.title}`);
    } else {
      console.log(`  + سئو [${categoryKey}] ${row.title}  (${row.checklist?.length ?? 0} بند)`);
    }
    created++;
  }

  for (const row of data.contentTasks ?? []) {
    const exists = await prisma.contentTask.findFirst({
      where: { title: row.title, deletedAt: null },
      select: { code: true },
    });
    if (exists) {
      console.log(`  = محتوا ${exists.code} از قبل هست: ${row.title}`);
      skipped++;
      continue;
    }
    if (apply) {
      const t = await createContentTask(row, access);
      console.log(`  + محتوا ${t.code}: ${row.title}`);
    } else {
      console.log(`  + محتوا ${row.title}  (کلمه: ${row.primaryKeyword ?? "—"})`);
    }
    created++;
  }

  console.log(`\n${apply ? "ثبت شد" : "ثبت می‌شود"}: ${created} · تکراری و ردشده: ${skipped}`);
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
