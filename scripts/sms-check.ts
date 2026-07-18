/**
 * تست درایور پیامک با پنل واقعی
 *
 * بررسی اعتبار و خطوط (بدون ارسال، بدون هزینه):
 *   pnpm tsx scripts/sms-check.ts
 *
 * ارسال آزمایشی به شماره مالک حساب:
 *   pnpm tsx scripts/sms-check.ts --sample
 *
 * ارسال واقعی به یک شماره مشخص (نگهبان‌ها رد می‌شوند):
 *   pnpm tsx scripts/sms-check.ts --to 09121112233
 *
 * مشاهده وضعیت تحویل یک درخواست ارسال:
 *   pnpm tsx scripts/sms-check.ts --status 407328
 *
 * خواندن صندوق ورودی (منشی پیامک):
 *   pnpm tsx scripts/sms-check.ts --inbox
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import { getProvider, loadSmsConfig } from "../lib/club/sms";
import { loadGuardSettings, isWithinAllowedHours } from "../lib/club/sms/guards";
import { countSmsParts, previewTemplate } from "../lib/club/sms/render";
import { normalizePhone } from "../lib/club/phone";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : undefined;
};

const TEST_TEXT = "سلام {name} عزیز، این یک پیام آزمایشی از {store} است.";

async function main() {
  console.log("═══ بررسی درایور پیامک ═══\n");

  // ── پیکربندی ──────────────────────────────────────────────────
  const config = await loadSmsConfig();
  const guards = await loadGuardSettings();

  console.log("پیکربندی:");
  console.log(`   خط خدماتی:    ${config.serviceLine || "❌ تنظیم نشده"}`);
  console.log(`   خط تبلیغاتی:  ${config.marketingLine || "⚠️  تنظیم نشده"}`);
  console.log(`   متن لغو:      ${config.optOutText ?? "—"}`);
  console.log(`   فروشگاه:      ${config.storeName}`);
  console.log(
    `   ساعت مجاز:    ${guards.allowedHourStart} تا ${guards.allowedHourEnd}` +
      ` (${isWithinAllowedHours(guards) ? "✅ الان مجاز" : "⛔ الان خارج از بازه"})`
  );
  console.log(`   سقف ماهانه:   ${guards.monthlyCapPerUser} پیام\n`);

  if (!config.serviceLine) {
    console.error("❌ خط خدماتی تنظیم نشده — IRANPAYAMAK_LINE_NUMBER یا تنظیمات فروشگاه را بررسی کنید\n");
    process.exit(1);
  }

  const provider = getProvider();

  // ── اعتبار ────────────────────────────────────────────────────
  const balance = await provider.getBalance();
  if (balance) {
    console.log(`✅ اعتبار حساب: ${balance.amount.toLocaleString("fa-IR")}`);
    if (balance.count) console.log(`   تعداد پیامک: ${balance.count.toLocaleString("fa-IR")}`);
  } else {
    console.log("❌ خواندن اعتبار ناموفق — کلید API را بررسی کنید");
  }
  console.log();

  // ── تحلیل متن ─────────────────────────────────────────────────
  const rendered = previewTemplate(TEST_TEXT, config.storeName);
  const parts = countSmsParts(rendered);
  console.log("نمونه متن پس از جایگزینی متغیرها:");
  console.log(`   «${rendered}»`);
  console.log(
    `   ${parts.chars} کاراکتر · ${parts.parts} بخش · ${parts.unicode ? "فارسی" : "لاتین"}\n`
  );

  // ── وضعیت تحویل ───────────────────────────────────────────────
  const statusId = value("status");
  if (statusId) {
    console.log(`وضعیت تحویل درخواست ${statusId}:`);
    const items = await provider.getDeliveryItems(Number(statusId));

    if (items.length === 0) {
      console.log("   (موردی برنگشت)\n");
    } else {
      const counts = new Map<string, number>();
      for (const i of items) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
      for (const [status, n] of counts) console.log(`   ${status}: ${n}`);
      console.log();
    }
  }

  // ── صندوق ورودی ───────────────────────────────────────────────
  if (flag("inbox")) {
    console.log("صندوق ورودی (منشی پیامک):");
    const msgs = await provider.getInbox(1, 20);

    if (msgs.length === 0) {
      console.log("   (پیامی نیست)\n");
    } else {
      for (const m of msgs) {
        console.log(`   #${m.id} از ${m.from}: «${m.text.slice(0, 50)}»`);
      }
      console.log();
    }
  }

  // ── ارسال نمونه به مالک ───────────────────────────────────────
  if (flag("sample")) {
    console.log("ارسال آزمایشی به شماره مالک حساب...");
    const res = await provider.sendSample(config.serviceLine, rendered);
    console.log(
      res.ok
        ? `   ✅ ارسال شد — شناسه درخواست: ${res.requestId}\n`
        : `   ❌ ${res.error}\n`
    );
  }

  // ── ارسال واقعی ───────────────────────────────────────────────
  const to = value("to");
  if (to) {
    const phone = normalizePhone(to);
    if (!phone) {
      console.error(`❌ شماره نامعتبر: ${to}\n`);
      process.exit(1);
    }

    console.log(`ارسال واقعی به ${phone} روی خط خدماتی...`);
    const res = await provider.sendKeywords(config.serviceLine, "سلام %name% عزیز، پیام آزمایشی باشگاه مشتریان", [
      { mobile: phone, vars: { name: "دوست" } },
    ]);

    console.log(
      res.ok
        ? `   ✅ ارسال شد — شناسه درخواست: ${res.requestId}\n` +
            `   برای دیدن وضعیت: pnpm tsx scripts/sms-check.ts --status ${res.requestId}\n`
        : `   ❌ ${res.error}\n`
    );
  }

  if (!statusId && !flag("inbox") && !flag("sample") && !to) {
    console.log("راهنما: --sample | --to <شماره> | --status <شناسه> | --inbox\n");
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