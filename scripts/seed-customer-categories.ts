/**
 * سه دسته‌ی پیش‌فرض مشتری برای مهام‌پرینت
 *
 *   npx tsx scripts/seed-customer-categories.ts
 *
 * idempotent: دسته‌ی موجود (با همان نامک) دست نمی‌خورد تا تغییر نام یا رنگی
 * که مدیر داده از بین نرود. مستندات: docs/features/staff-worklist.md بخش ۲۱
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";

const CATEGORIES = [
  { slug: "organizational", title: "مشتریان ارگانی", color: "#8b5cf6" },
  { slug: "tehran", title: "مشتریان تهران", color: "#3b82f6" },
  { slug: "provincial", title: "مشتریان شهرستان", color: "#10b981" },
];

async function main() {
  for (const [i, c] of CATEGORIES.entries()) {
    const existing = await prisma.clubCustomerCategory.findUnique({ where: { slug: c.slug } });
    if (existing) {
      console.log(`= موجود: ${existing.title}`);
      continue;
    }
    await prisma.clubCustomerCategory.create({ data: { ...c, sortOrder: i } });
    console.log(`+ ساخته شد: ${c.title}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
