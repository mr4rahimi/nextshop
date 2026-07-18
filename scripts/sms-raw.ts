/**
 * چاپ پاسخ خام پنل ایران پیامک — برای کشف ساختار واقعی داده
 *
 * این اسکریپت هیچ تفسیری روی پاسخ انجام نمی‌دهد و JSON خام را نمایش می‌دهد.
 * هدف: تطبیق دقیق درایور با پاسخ واقعی، به‌جای حدس زدن نام فیلدها.
 *
 * اجرا:
 *   pnpm tsx scripts/sms-raw.ts                  # اعتبار + فهرست ارسال‌ها + صندوق ورودی
 *   pnpm tsx scripts/sms-raw.ts --id 407328      # جزئیات و آیتم‌های یک درخواست ارسال
 *   pnpm tsx scripts/sms-raw.ts --send 09xxxxxxxxx   # ارسال واقعی + پاسخ خام
 */

import "../lib/load-env";

const BASE = "https://api.iranpayamak.com";
const API_KEY = process.env.IRANPAYAMAK_API_KEY ?? "";
const LINE = process.env.IRANPAYAMAK_LINE_NUMBER ?? "";

const args = process.argv.slice(2);
const value = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i > -1 ? args[i + 1] : undefined;
};

async function dump(
  label: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown
) {
  console.log("\n" + "═".repeat(70));
  console.log(`▶ ${label}`);
  console.log(`  ${method} ${path}`);
  if (body) console.log(`  بدنه ارسالی: ${JSON.stringify(body, null, 2)}`);
  console.log("─".repeat(70));

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Api-Key": API_KEY,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const raw = await res.text();
    console.log(`  HTTP ${res.status}`);

    try {
      const json = JSON.parse(raw);
      console.log(JSON.stringify(json, null, 2).slice(0, 4000));
      return json;
    } catch {
      console.log(raw.slice(0, 2000));
      return null;
    }
  } catch (err) {
    console.log(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main() {
  if (!API_KEY) {
    console.error("❌ IRANPAYAMAK_API_KEY تنظیم نشده است");
    process.exit(1);
  }

  console.log(`خط پیش‌فرض: ${LINE}`);

  // ── ارسال واقعی ────────────────────────────────────────────────
  const sendTo = value("send");
  if (sendTo) {
    await dump("ارسال ساده (simple)", "POST", "/ws/v1/sms/simple", {
      line_number: LINE,
      number_format: "persian",
      text: "تست ساختار پاسخ - ارسال ساده",
      recipients: [sendTo],
    });

    await dump("ارسال کلیدواژه‌ای (keywords)", "POST", "/ws/v1/sms/keywords", {
      line_number: LINE,
      number_format: "persian",
      text: "سلام %name% عزیز، تست ساختار پاسخ",
      recipients: [{ mobile: sendTo, name: "مهدی" }],
    });
  }

  // ── اعتبار ─────────────────────────────────────────────────────
  await dump("اعتبار حساب", "GET", "/ws/v1/account/balance");

  // ── فهرست ارسال‌ها ─────────────────────────────────────────────
  // این مهم‌ترین بخش است: نام فیلد شناسه و ساختار صفحه‌بندی را نشان می‌دهد
  await dump(
    "فهرست درخواست‌های ارسال",
    "GET",
    "/ws/v1/send_request?page=1&limit=3"
  );

  // ── جزئیات یک ارسال ────────────────────────────────────────────
  const id = value("id");
  if (id) {
    await dump("جزئیات درخواست ارسال", "GET", `/ws/v1/send_request/${id}`);
    await dump(
      "آیتم‌های درخواست ارسال (وضعیت تحویل)",
      "GET",
      `/ws/v1/send_request/${id}/items?page=1&limit=5`
    );
  }

  // ── صندوق ورودی ────────────────────────────────────────────────
  await dump("صندوق ورودی", "GET", "/ws/v1/inbox?page=1&limit=5");

  console.log("\n" + "═".repeat(70));
  console.log("خروجی بالا را کامل کپی کنید تا درایور دقیق تنظیم شود.");
  console.log("═".repeat(70) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});