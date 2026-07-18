/**
 * ساخت ClubProfile برای کاربران موجود
 *
 * اجرا (پیش‌نمایش بدون تغییر دیتابیس):
 *   pnpm tsx scripts/backfill-club-profiles.ts --dry
 *
 * اجرای واقعی:
 *   pnpm tsx scripts/backfill-club-profiles.ts
 *
 * نکته مهم: `smsConsent` برای همه `false` تنظیم می‌شود. این کاربران هرگز
 * رضایت صریح برای پیامک تبلیغاتی نداده‌اند و ارسال بدون رضایت هم غیرقانونی
 * است و هم ریسک مسدود شدن خط تبلیغاتی دارد. رضایت باید جداگانه گرفته شود.
 *
 * اسکریپت idempotent است — اجرای چندباره مشکلی ایجاد نمی‌کند.
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { normalizePhone } from "../lib/club/phone";

const DRY_RUN = process.argv.includes("--dry");
const BATCH = 500;

const PAID_STATUSES = [
  "PAID", "CONFIRMED", "PROCESSING", "PACKAGING",
  "SHIPPED", "DELIVERED", "COMPLETED",
] as const;

async function main() {
  console.log(
    `═══ ساخت پروفایل باشگاه برای کاربران موجود ${DRY_RUN ? "(پیش‌نمایش)" : ""} ═══\n`
  );

  const total = await prisma.user.count();
  const already = await prisma.clubProfile.count();
  const missing = await prisma.user.count({ where: { clubProfile: null } });

  console.log(`کل کاربران:        ${total}`);
  console.log(`پروفایل موجود:     ${already}`);
  console.log(`نیازمند ساخت:      ${missing}\n`);

  if (missing === 0) {
    console.log("✅ همه کاربران پروفایل دارند — کاری لازم نیست\n");
    return;
  }

  let created = 0;
  let skippedBadPhone = 0;
  let cursor: string | undefined;

  for (;;) {
    const users = await prisma.user.findMany({
      where: { clubProfile: null },
      select: { id: true, phone: true, createdAt: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (users.length === 0) break;
    cursor = users[users.length - 1].id;

    for (const u of users) {
      // شماره نامعتبر یعنی داده خراب — لاگ می‌شود ولی پروفایل ساخته می‌شود
      if (!normalizePhone(u.phone)) {
        skippedBadPhone++;
        console.warn(`⚠️  شماره نامعتبر برای کاربر ${u.id}: "${u.phone}"`);
      }

      if (DRY_RUN) {
        created++;
        continue;
      }

      // آمار خرید را همان لحظه محاسبه می‌کنیم
      const agg = await prisma.order.aggregate({
        where: { userId: u.id, status: { in: [...PAID_STATUSES] } },
        _sum: { grandTotal: true },
        _count: { _all: true },
        _max: { createdAt: true },
      });

      await prisma.clubProfile.create({
        data: {
          userId: u.id,
          source: "ONLINE",
          smsConsent: false, // ← عمدی: رضایت صریح گرفته نشده
          joinedAt: u.createdAt,
          totalSpent: agg._sum.grandTotal ?? 0n,
          orderCount: agg._count._all,
          lastPurchaseAt: agg._max.createdAt ?? null,
        },
      });

      created++;

      if (created % 100 === 0) {
        console.log(`   ... ${created} پروفایل ساخته شد`);
      }
    }
  }

  console.log(`\n${DRY_RUN ? "قابل ساخت" : "✅ ساخته شد"}: ${created}`);
  if (skippedBadPhone > 0) {
    console.log(`⚠️  شماره‌های نامعتبر: ${skippedBadPhone} (پروفایل ساخته شد، اما پیامک برایشان ارسال نمی‌شود)`);
  }

  if (DRY_RUN) {
    console.log("\nبرای اجرای واقعی، دستور را بدون --dry بزنید\n");
  } else {
    const withPurchase = await prisma.clubProfile.count({
      where: { orderCount: { gt: 0 } },
    });
    console.log(`\nخلاصه نهایی:`);
    console.log(`   کل اعضای باشگاه:      ${await prisma.clubProfile.count()}`);
    console.log(`   دارای حداقل یک خرید:  ${withPurchase}`);
    console.log(`   رضایت پیامک:          0 (باید جداگانه گرفته شود)\n`);
  }
}

main()
  .catch((err) => {
    console.error("خطا:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });