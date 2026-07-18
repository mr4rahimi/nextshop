/**
 * تست دود فاز ۰ — بررسی می‌کند زیرساخت درست کار می‌کند
 *
 * اجرا:
 *   pnpm tsx scripts/club-smoke-test.ts
 *
 * پیش‌نیاز: کانتینر redis بالا باشد و پروسه worker در ترمینال دیگر اجرا شده باشد.
 */

import "dotenv/config";
import { pingRedis, redis } from "../lib/redis";
import { enqueueSmsBatch, closeQueues } from "../lib/club/queue";
import { normalizePhone, maskPhone, normalizePhoneList } from "../lib/club/phone";

const CASES: [string, string | null][] = [
  ["09123456789", "09123456789"],
  ["9123456789", "09123456789"],
  ["+989123456789", "09123456789"],
  ["00989123456789", "09123456789"],
  ["989123456789", "09123456789"],
  ["۰۹۱۲۳۴۵۶۷۸۹", "09123456789"],
  ["٠٩١٢٣٤٥٦٧٨٩", "09123456789"],
  ["0912 345 6789", "09123456789"],
  ["0912-345-6789", "09123456789"],
  ["0812345678", null],
  ["091234567", null],
  ["", null],
  ["سلام", null],
];

async function testPhone() {
  console.log("\n── تست نرمال‌سازی شماره ──");
  let failed = 0;

  for (const [input, expected] of CASES) {
    const actual = normalizePhone(input);
    const ok = actual === expected;
    if (!ok) failed++;
    console.log(
      `${ok ? "✅" : "❌"} "${input}" → ${actual ?? "null"}${ok ? "" : `  (انتظار: ${expected ?? "null"})`}`
    );
  }

  const { valid, invalid } = normalizePhoneList([
    "09123456789",
    "+989123456789", // تکراری با بالایی
    "0912345678",
  ]);
  const dedupOk = valid.length === 1 && invalid.length === 1;
  if (!dedupOk) failed++;
  console.log(`${dedupOk ? "✅" : "❌"} حذف تکراری: معتبر=${valid.length} نامعتبر=${invalid.length}`);
  console.log(`   ماسک: ${maskPhone("09123456789")}`);

  return failed;
}

async function testRedis() {
  console.log("\n── تست اتصال Redis ──");
  const ok = await pingRedis();
  console.log(`${ok ? "✅" : "❌"} PING → ${ok ? "PONG" : "بدون پاسخ"}`);
  return ok ? 0 : 1;
}

async function testQueue() {
  console.log("\n── تست صف ──");
  const jobId = `smoke:${Date.now()}`;

  const job = await enqueueSmsBatch(
    {
      templateKey: "smoke-test",
      text: "سلام %name% عزیز، این یک تست است",
      lineNumber: "0000000000",
      kind: "TRANSACTIONAL",
      recipients: [{ mobile: "09123456789", vars: { name: "مهدی" } }],
    },
    { jobId }
  );

  console.log(`✅ کار در صف قرار گرفت — id=${job.id}`);

  // تست جلوگیری از تکرار: افزودن دوباره با همان jobId
  const dup = await enqueueSmsBatch(
    {
      text: "تکراری",
      lineNumber: "0000000000",
      kind: "TRANSACTIONAL",
      recipients: [{ mobile: "09123456789" }],
    },
    { jobId }
  );

  const dedupOk = dup.id === job.id;
  console.log(`${dedupOk ? "✅" : "❌"} جلوگیری از کار تکراری با jobId یکسان`);
  console.log("   ↳ اگر worker در حال اجراست، باید لاگ [worker:sms] را ببینید");

  return dedupOk ? 0 : 1;
}

async function main() {
  console.log("═══ تست دود فاز ۰ — باشگاه مشتریان ═══");

  let failed = 0;
  failed += await testPhone();

  const redisFailed = await testRedis();
  failed += redisFailed;

  if (redisFailed === 0) {
    failed += await testQueue();
  } else {
    console.log("\n⚠️  تست صف رد شد چون Redis در دسترس نیست");
  }

  console.log(
    `\n${failed === 0 ? "🎉 همه تست‌ها موفق" : `⛔ ${failed} تست ناموفق`}\n`
  );

  await closeQueues();
  await redis.quit();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("خطا:", err);
  process.exit(1);
});
