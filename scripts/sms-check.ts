/**
 * تست درایور پیامک با پنل واقعی
 *
 *   pnpm sms:check                        بررسی پیکربندی و اعتبار (بدون هزینه)
 *   pnpm sms:check --sample               ارسال آزمایشی به شماره مالک حساب
 *   pnpm sms:check --to 09121112233       ارسال واقعی متن آزاد
 *   pnpm sms:check --pattern <code> --to 09121112233   ارسال با پترن
 *   pnpm sms:check --status 7723130       وضعیت یک درخواست ارسال
 *   pnpm sms:check --items 7723130        وضعیت تک‌تک گیرنده‌ها
 *   pnpm sms:check --inbox                صندوق ورودی (منشی پیامک)
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import { getProvider, loadSmsConfig } from "../lib/club/sms";
import { loadGuardSettings, isWithinAllowedHours } from "../lib/club/sms/guards";
import { countSmsParts, previewTemplate } from "../lib/club/sms/render";
import { normalizePhone } from "../lib/club/phone";
import type { SendRequestStatus } from "../lib/club/sms/types";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const value = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i > -1 ? args[i + 1] : undefined;
};

const STATUS_FA: Record<SendRequestStatus, string> = {
  init: "ایجاد شده",
  "pending-approval": "⏳ در انتظار تأیید اپراتور",
  "insufficient-balance": "❌ اعتبار ناکافی",
  cancelled: "❌ لغو شده",
  rejected: "❌ رد شده",
  "in-queue": "در صف ارسال",
  sent: "✅ ارسال شده",
};

async function main() {
  console.log("═══ بررسی درایور پیامک ═══\n");

  const config = await loadSmsConfig();
  const guards = await loadGuardSettings();
  const provider = getProvider();

  console.log("پیکربندی:");
  console.log(`   خط خدماتی:    ${config.serviceLine || "❌ تنظیم نشده"}`);
  console.log(`   خط تبلیغاتی:  ${config.marketingLine || "⚠️  تنظیم نشده"}`);
  console.log(`   متن لغو:      ${config.optOutText ?? "—"}`);
  console.log(`   فروشگاه:      ${config.storeName}`);
  console.log(
    `   ساعت مجاز:    ${guards.allowedHourStart} تا ${guards.allowedHourEnd}` +
      ` (${isWithinAllowedHours(guards) ? "✅ الان مجاز" : "⛔ خارج از بازه"})`
  );
  console.log(`   سقف ماهانه:   ${guards.monthlyCapPerUser} پیام\n`);

  const balance = await provider.getBalance();
  if (balance) {
    console.log(`✅ اعتبار: ${balance.amount.toLocaleString("fa-IR")} — حدود ${balance.count ?? "?"} پیامک\n`);
  } else {
    console.log("❌ خواندن اعتبار ناموفق\n");
  }

  // ── وضعیت درخواست ─────────────────────────────────────────────
  const statusId = value("status") ?? value("items");
  if (statusId) {
    const info = await provider.getSendRequest(Number(statusId));

    if (!info) {
      console.log(`❌ درخواست ${statusId} یافت نشد\n`);
    } else {
      console.log(`درخواست ارسال ${info.id}:`);
      console.log(`   وضعیت:  ${STATUS_FA[info.status] ?? info.status}`);
      console.log(`   نوع:    ${info.type}`);
      console.log(`   خط:     ${info.lineNumber ?? "—"}`);
      if (info.rejectedDue) console.log(`   دلیل رد: ${info.rejectedDue}`);

      if (info.counts) {
        const c = info.counts;
        console.log(`   گیرندگان: ${c.total}`);
        const rows: [string, number][] = [
          ["تحویل شده", c.delivered],
          ["ارسال شده", c.sent],
          ["در صف", c.inQueue],
          ["شروع نشده", c.notStarted],
          ["عدم تحویل", c.deliveryFailure],
          ["نامشخص", c.deliveryUndetermined],
          ["خطای ارسال", c.sendFailure],
          ["خطای سیستم", c.systemError],
          ["بلک‌لیست", c.blacklist],
        ];
        for (const [label, n] of rows) if (n > 0) console.log(`      ${label}: ${n}`);
      }
      console.log();
    }

    if (value("items")) {
      const items = await provider.getDeliveryItems(Number(statusId));
      console.log(`جزئیات ${items.length} گیرنده:`);
      for (const i of items) {
        console.log(`   ${i.mobile} → ${i.status}${i.error ? ` (${i.error})` : ""}`);
      }
      console.log();
    }
  }

  // ── صندوق ورودی ───────────────────────────────────────────────
  if (flag("inbox")) {
    const msgs = await provider.getInbox(1, 20);
    console.log(`صندوق ورودی: ${msgs.length} پیام`);
    for (const m of msgs) {
      console.log(`   #${m.id} از ${m.from} → «${m.text.slice(0, 60)}»`);
    }
    console.log();
  }

  // ── ارسال ─────────────────────────────────────────────────────
  const to = value("to");
  const patternCode = value("pattern");

  if (patternCode && to) {
    const phone = normalizePhone(to);
    if (!phone) return fail(`شماره نامعتبر: ${to}`);

    console.log(`ارسال با پترن ${patternCode} به ${phone}...`);
    const res = await provider.sendPattern(patternCode, phone, { name: "دوست" });
    report(res);
  } else if (to) {
    const phone = normalizePhone(to);
    if (!phone) return fail(`شماره نامعتبر: ${to}`);

    console.log(`ارسال متن آزاد به ${phone} روی خط خدماتی...`);
    console.log("⚠️  روی خط خدماتی، متن آزاد نیاز به تأیید اپراتور دارد\n");

    const res = await provider.sendKeywords(
      config.serviceLine,
      "سلام %name% عزیز، پیام آزمایشی باشگاه مشتریان",
      [{ mobile: phone, vars: { name: "دوست" } }]
    );
    report(res);
  } else if (flag("sample")) {
    const text = previewTemplate("سلام {name} عزیز، پیام آزمایشی از {store}", config.storeName);
    const parts = countSmsParts(text);
    console.log(`ارسال نمونه به مالک حساب — ${parts.chars} کاراکتر · ${parts.parts} بخش`);
    report(await provider.sendSample(config.serviceLine, text));
  }

  if (!statusId && !flag("inbox") && !flag("sample") && !to) {
    console.log("راهنما: --sample | --to <شماره> | --pattern <کد> --to <شماره>");
    console.log("        --status <شناسه> | --items <شناسه> | --inbox\n");
  }
}

function report(res: { ok: boolean; requestId?: number; requestStatus?: string; error?: string }) {
  if (!res.ok) {
    console.log(`   ❌ ${res.error}\n`);
    return;
  }
  console.log(`   ✅ ثبت شد — شناسه ${res.requestId}`);
  console.log(`   وضعیت: ${STATUS_FA[res.requestStatus as SendRequestStatus] ?? res.requestStatus}`);
  console.log(`   پیگیری: pnpm sms:check --items ${res.requestId}\n`);
}

function fail(msg: string) {
  console.error(`❌ ${msg}\n`);
  process.exit(1);
}

main()
  .catch((err) => {
    console.error("خطا:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });