import { randomUUID } from "crypto";
import { normalizePhone } from "../phone";

/**
 * سفیر — ارسال پیام بله با «شماره تلفن»
 *
 * تفاوت بنیادی با API ربات: کاربر لازم نیست `/start` زده باشد. هر کسی که
 * حساب بله دارد با شماره‌اش پیام می‌گیرد. در عوض:
 *
 * - کلید جدا دارد (`api-access-key` از پنل کسب‌وکار بله)، نه توکن ربات
 * - هزینه‌دار است و از اعتبار حساب کسب‌وکاری کم می‌شود
 * - هر درخواست فقط یک شماره — متد دسته‌ای ندارد
 *
 * ⚠️ کاربری که حساب بله ندارد خطای `NotBaleUser` می‌دهد. این خطا **دائمی**
 *    است و باید ثبت شود، وگرنه هر کمپین دوباره برایش تلاش و هزینه می‌کند.
 */

const SAFIR_URL = "https://safir.bale.ai/api/v3/send_message";
const TIMEOUT = 15_000;

/** کدهای خطای سفیر — مستند رسمی */
export const SAFIR_ERRORS: Record<number, string> = {
  2: "خطای داخلی سرور بله",
  3: "بیش از حد مجاز پیام ارسال شده",
  4: "ورودی نامعتبر",
  8: "شماره اشتباه",
  17: "کاربر حساب بله ندارد",
  20: "اعتبار حساب کسب‌وکاری کافی نیست",
  21: "به محدودیت تعداد مخاطبین ربات رسیده‌اید",
};

/** خطاهایی که تکرار تلاش فایده ندارد — شناسه باید سوزانده شود */
const PERMANENT = new Set([8, 17, 21]);

export interface SafirResult {
  ok: boolean;
  messageId?: string;
  errorCode?: number;
  error?: string;
  /** تلاش دوباره برای این شماره بی‌فایده است */
  permanent: boolean;
}

/**
 * شماره به شکلی که سفیر می‌خواهد: `98` + ده رقم، بدون هیچ کاراکتر اضافه
 *
 * ⚠️ `09123456789` و `9123456789` هر دو رد می‌شوند. مستند رسمی صریح است.
 */
export function toSafirPhone(phone: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `98${normalized.slice(1)}`;
}

export async function sendViaSafir(input: {
  apiKey: string;
  botId: number;
  phone: string;
  text: string;
  /** برای تضمین عدم ارسال تکراری در صورت تکرار درخواست */
  requestId?: string;
  replyMarkup?: unknown;
}): Promise<SafirResult> {
  const phone = toSafirPhone(input.phone);
  if (!phone) {
    return { ok: false, error: "شماره نامعتبر است", permanent: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(SAFIR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-access-key": input.apiKey,
      },
      body: JSON.stringify({
        // ⚠️ بدون `request_id` تکرار درخواست یعنی پیام تکراری برای مشتری و
        //    هزینه‌ی دوباره. سفیر خودش بر اساس آن جلوی تکرار را می‌گیرد.
        request_id: input.requestId ?? randomUUID(),
        bot_id: input.botId,
        phone_number: phone,
        message_data: {
          message: {
            text: input.text,
            ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const body = (await res.json().catch(() => null)) as {
      message_id?: string;
      error_data?: { phone_number?: string; code?: number; description?: string }[] | null;
    } | null;

    if (!body) {
      return { ok: false, error: `پاسخ سفیر خوانده نشد (HTTP ${res.status})`, permanent: false };
    }

    const first = Array.isArray(body.error_data) ? body.error_data[0] : null;

    if (first?.code) {
      return {
        ok: false,
        errorCode: first.code,
        error: SAFIR_ERRORS[first.code] ?? first.description ?? `خطای ${first.code}`,
        permanent: PERMANENT.has(first.code),
      };
    }

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, permanent: res.status === 401 };
    }

    return { ok: true, ...(body.message_id ? { messageId: body.message_id } : {}), permanent: false };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "پاسخی از سفیر نرسید (timeout)" : "اتصال به سفیر برقرار نشد",
      permanent: false,
    };
  } finally {
    clearTimeout(timer);
  }
}
