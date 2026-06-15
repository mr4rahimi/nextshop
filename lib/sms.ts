import { prisma } from "@/lib/prisma";

// ── دریافت تنظیمات پیامک از دیتابیس ──────────────────────────────────────────
async function getSmsConfig() {
  const settings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  return {
    apiKey:     settings?.smsApiKey     ?? process.env.IRANPAYAMAK_API_KEY,
    lineNumber: settings?.smsLineNumber ?? process.env.IRANPAYAMAK_LINE_NUMBER,
    enabled:    settings?.smsEnabled    ?? true,
    patterns: {
      otp:      settings?.smsPatternOtp          ?? process.env.IRANPAYAMAK_PATTERN_CODE,
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

// ── ارسال پیامک با پترن ────────────────────────────────────────────────────────
export async function sendPatternSms(
  phone: string,
  patternCode: string,
  attributes: Record<string, string>
) {
  const { apiKey, lineNumber, enabled } = await getSmsConfig();

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

// ── پیامک OTP ─────────────────────────────────────────────────────────────────
export async function sendOtpSms(phone: string, code: string) {
  const { patterns } = await getSmsConfig();
  if (!patterns.otp) {
    console.warn("[SMS] کد پترن OTP تنظیم نشده");
    return;
  }
  await sendPatternSms(phone, patterns.otp, { code });
}

// ── پیامک وضعیت سفارش ────────────────────────────────────────────────────────
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