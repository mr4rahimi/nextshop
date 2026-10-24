/**
 * راه‌اندازی اولیه‌ی سایت تازه — بعد از اولین `prisma migrate deploy`
 *
 *   npx tsx scripts/setup-new-site.ts --check                     # فقط گزارش، بدون نوشتن
 *   npx tsx scripts/setup-new-site.ts 09xxxxxxxxx 'رمز-حداقل-۸'   # ادمین + رکوردهای singleton
 *
 * کارها (همه idempotent):
 *   ۱. رکورد singleton در `StoreSettings` و `IntegSettings` — بدون IntegSettings
 *      worker یکپارچه‌سازی ساکت می‌ماند (docs/guide/project-guide.md، خطای ۲)
 *   ۲. اولین ادمین با هش bcrypt — همان `hashPassword` در `lib/auth.ts`.
 *      کاربر موجود با همان شماره ADMIN می‌شود و رمزش عوض می‌شود.
 *
 * راهنمای کامل نصب سرور تازه: docs/guide/offline/install-guide.html
 */
import "../lib/load-env";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

// باید با BCRYPT_ROUNDS در lib/auth.ts یکی بماند
const BCRYPT_ROUNDS = 12;

async function report() {
  const [store, integ, admins] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { id: true } }),
    prisma.integSettings.findUnique({ where: { id: "singleton" }, select: { workerEnabled: true } }),
    prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
  ]);
  console.log(`StoreSettings: ${store ? "✅ هست" : "❌ نیست"}`);
  console.log(`IntegSettings: ${integ ? `✅ هست (worker ${integ.workerEnabled ? "روشن" : "خاموش"})` : "❌ نیست"}`);
  console.log(`ادمین فعال:    ${admins ? `✅ ${admins} نفر` : "❌ هیچ"}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--check") {
    await report();
    return;
  }

  const [phone, password] = args;
  if (!/^09\d{9}$/.test(phone ?? "") || !password || password.length < 8) {
    console.error("استفاده: npx tsx scripts/setup-new-site.ts 09xxxxxxxxx 'رمز-حداقل-۸-نویسه'");
    console.error("        npx tsx scripts/setup-new-site.ts --check");
    process.exit(1);
  }

  await prisma.storeSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  await prisma.integSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.upsert({
    where: { phone },
    update: { passwordHash, role: "ADMIN", isActive: true },
    create: { phone, passwordHash, role: "ADMIN", isActive: true },
  });
  console.log(`✅ ادمین: ${user.phone}\n`);

  await report();
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
