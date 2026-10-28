import { prisma } from "@/lib/prisma";
import { isDemo } from "@/lib/demo";

/** اولین مقدار غیرتهی — رشته‌ی خالی و فاصله «تنظیم نشده» حساب می‌شود */
function pick(...vals: (string | null | undefined)[]): string | undefined {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return undefined;
}

async function getSmsConfig() {
  // دمو (docs/plans/demo.md): فقط کلید env برای کد ورود؛ تنظیمات پنل که هر بازدیدکننده
  // عوضش می‌کند نباید مسیر کد ورود را به جای دیگری ببرد
  const settings = isDemo() ? null : await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  return {
    // ⚠️ `??` کافی نیست: فیلدی که ادمین پر و بعد خالی کرده `""` است نه null و
    //    جلوی fallback را می‌گیرد. مقدار تهی باید مثل «تنظیم نشده» رفتار کند.
    apiKey:     pick(settings?.smsApiKey,     process.env.IRANPAYAMAK_API_KEY),
    lineNumber: pick(settings?.smsLineNumber, process.env.IRANPAYAMAK_LINE_NUMBER),
    enabled:    settings?.smsEnabled    ?? true,
    patterns: {
      otp:      pick(settings?.smsPatternOtp, process.env.IRANPAYAMAK_PATTERN_CODE),
      orderNew:      settings?.smsPatternOrderNew,
      orderPaid:     settings?.smsPatternOrderPaid,
      orderConfirm:  settings?.smsPatternOrderConfirm,
      orderPrepare:  settings?.smsPatternOrderPrepare,
      orderPack:     settings?.smsPatternOrderPack,
      orderSent:     settings?.smsPatternOrderSent,
      orderDelivered:settings?.smsPatternOrderDelivered,
      orderDone:     settings?.smsPatternOrderDone,
      orderCancel:   settings?.smsPatternOrderCancel,
    },
  };
}

/**
 * آیا پیامک پترنی واقعاً می‌رود؟ `sendPatternSms` در نبودِ تنظیمات بی‌صدا
 * برمی‌گردد؛ ارسال‌های خودکاری که «ارسال‌شده» ثبت می‌کنند (مثل درخواست نظر)
 * باید پیش از علامت‌زدن این را بپرسند.
 */
export async function getSmsReadiness(): Promise<{ ready: boolean; reason: string | null }> {
  const { apiKey, lineNumber, enabled } = await getSmsConfig();
  if (!enabled) return { ready: false, reason: "پیامک فروشگاه خاموش است" };
  if (!apiKey || !lineNumber) return { ready: false, reason: "کلید یا خط پیامک تنظیم نشده" };
  return { ready: true, reason: null };
}

export async function sendPatternSms(
  phone: string,
  patternCode: string,
  attributes: Record<string, string>
) {
  const { apiKey, lineNumber, enabled, patterns } = await getSmsConfig();

  // دمو: فقط کد ورود واقعاً می‌رود؛ پیامک سفارش و باشگاه به شماره‌های نمایشی هزینه‌ی واقعی دارد
  if (isDemo() && patternCode !== patterns.otp) {
    console.log(`[SMS demo] to ${phone} pattern ${patternCode}`, attributes);
    return;
  }

  if (!enabled) {
    console.log(`[SMS disabled] to ${phone} pattern ${patternCode}`, attributes);
    return;
  }

  if (!apiKey || !lineNumber || !patternCode) {
    console.warn("[SMS] تنظیمات پیامک ناقص است");
    return;
  }

  const res = await fetch("https://api.iranpayamak.com/ws/v1/sms/pattern", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      code: patternCode,
      recipient: phone,
      line_number: lineNumber,
      number_format: "english",
      attributes,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[SMS] خطا در ارسال:", data);
    throw new Error("خطا در ارسال پیامک");
  }
  console.log(`[SMS] ارسال شد به ${phone}:`, data);
}

export async function sendOtpSms(phone: string, code: string) {
  const { patterns } = await getSmsConfig();
  if (!patterns.otp) {
    console.warn("[SMS] کد پترن OTP تنظیم نشده");
    return;
  }
  await sendPatternSms(phone, patterns.otp, { code });
}

export type OrderSmsEvent =
  | "orderNew" | "orderPaid" | "orderConfirm" | "orderPrepare"
  | "orderPack" | "orderSent" | "orderDelivered" | "orderDone" | "orderCancel";

export async function sendOrderSms(
  phone: string,
  event: OrderSmsEvent,
  attributes: Record<string, string>
) {
  const { patterns } = await getSmsConfig();
  const patternCode = patterns[event];
  if (!patternCode) {
    console.log(`[SMS] پترن ${event} تنظیم نشده، پیامک ارسال نشد`);
    return;
  }
  await sendPatternSms(phone, patternCode, attributes);
}
