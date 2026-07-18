/**
 * ساخت یا به‌روزرسانی حساب فروشنده
 *
 * اجرا:
 *   pnpm tsx scripts/create-seller.ts 09123456789 "رمزعبور" "نام" "نام خانوادگی"
 *
 * اگر کاربر با این شماره وجود داشته باشد، نقشش به SELLER تغییر می‌کند و
 * رمز عبور به‌روزرسانی می‌شود. اگر نباشد، ساخته می‌شود.
 *
 * ⚠️ اگر شماره متعلق به یک ADMIN باشد، اسکریپت متوقف می‌شود تا ناخواسته
 *    سطح دسترسی ادمین پایین نیاید.
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";
import { normalizePhone } from "../lib/club/phone";

async function main() {
  const [rawPhone, password, firstName, lastName] = process.argv.slice(2);

  if (!rawPhone || !password) {
    console.error(
      'استفاده: pnpm tsx scripts/create-seller.ts <شماره> <رمز> [نام] [نام خانوادگی]'
    );
    process.exit(1);
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    console.error(`❌ شماره نامعتبر: ${rawPhone}`);
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("❌ رمز عبور باید حداقل ۶ کاراکتر باشد");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, role: true },
  });

  if (existing?.role === "ADMIN") {
    console.error(
      "❌ این شماره متعلق به یک ادمین است. برای جلوگیری از کاهش سطح دسترسی، عملیات لغو شد."
    );
    console.error("   ادمین‌ها از قبل به بخش فروشنده دسترسی دارند.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      passwordHash,
      role: "SELLER",
      isActive: true,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    },
    create: {
      phone,
      passwordHash,
      role: "SELLER",
      isActive: true,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
    },
    select: { id: true, phone: true, firstName: true, lastName: true },
  });

  console.log(`\n✅ حساب فروشنده ${existing ? "به‌روزرسانی شد" : "ساخته شد"}`);
  console.log(`   شماره: ${user.phone}`);
  console.log(`   نام:   ${[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}`);
  console.log(`\n   ورود از: /seller/login\n`);
}

main()
  .catch((err) => {
    console.error("خطا:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });