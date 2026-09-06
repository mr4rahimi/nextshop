/**
 * کلاینت مشترک Bot API
 *
 * بله عمداً کلون Bot API تلگرام است: همان متدها، همان شکل پاسخ
 * (`{ok, result}`)، همان مسیر `/bot<TOKEN>/<METHOD>`. پس یک کلاینت برای هر دو
 * کافی است و افزودن تلگرام فقط یک `apiBase` دیگر می‌خواهد.
 *
 * ⚠️ این فایل هیچ چیزی از دیتابیس یا `ClubChannel` نمی‌داند — فقط HTTP.
 *    منطق کانال در `bale.ts` است.
 */

export interface BotApiConfig {
  /** مثل `https://tapi.bale.ai` — بدون اسلش پایانی */
  apiBase: string;
  token: string;
  /** مسیر میانی برای API کسب‌وکاری بله: `business` */
  pathPrefix?: string;
  timeoutMs?: number;
}

export class BotApiError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NO_TOKEN"
      | "UNAUTHORIZED"
      | "BLOCKED"      // کاربر ربات را بلاک کرده یا چت را پاک کرده
      | "RATE_LIMIT"
      | "VALIDATION"
      | "UNREACHABLE"
      | "BAD_RESPONSE",
    readonly retryAfter?: number
  ) {
    super(message);
    this.name = "BotApiError";
  }
}

const DEFAULT_TIMEOUT = 15_000;

/**
 * فراخوانی یک متد
 *
 * ⚠️ خطای «کاربر ربات را بلاک کرده» از خطای شبکه جدا می‌شود. اولی یعنی آن
 *    شناسه دیگر معتبر نیست و باید `isActive:false` شود؛ دومی یعنی دوباره
 *    تلاش کن. یکی کردنشان یا شناسه‌های سالم را می‌سوزاند یا لیست را پر از
 *    شناسه‌های مرده نگه می‌دارد.
 */
export async function callBotApi<T = unknown>(
  cfg: BotApiConfig,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  if (!cfg.token) throw new BotApiError("توکن ربات ثبت نشده است", "NO_TOKEN");

  const prefix = cfg.pathPrefix ? `/${cfg.pathPrefix}` : "";
  const url = `${cfg.apiBase}${prefix}/bot${cfg.token}/${method}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? DEFAULT_TIMEOUT);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params ?? {}),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new BotApiError(
      aborted ? "پاسخی از سرور ربات نرسید (timeout)" : "اتصال به سرور ربات برقرار نشد",
      "UNREACHABLE"
    );
  } finally {
    clearTimeout(timer);
  }

  let body: { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } };
  try {
    body = await res.json();
  } catch {
    throw new BotApiError(`پاسخ ربات قابل خواندن نبود (HTTP ${res.status})`, "BAD_RESPONSE");
  }

  if (body?.ok && body.result !== undefined) return body.result;
  if (body?.ok) return undefined as T;

  const desc = body?.description ?? `HTTP ${res.status}`;

  if (res.status === 401) throw new BotApiError("توکن ربات پذیرفته نشد", "UNAUTHORIZED");
  if (res.status === 429) {
    throw new BotApiError("سقف نرخ ارسال پر شد", "RATE_LIMIT", body?.parameters?.retry_after);
  }
  if (res.status === 403 || /blocked|deactivated|kicked|chat not found/i.test(desc)) {
    throw new BotApiError("کاربر از ربات خارج شده است", "BLOCKED");
  }
  if (res.status === 400) throw new BotApiError(desc, "VALIDATION");

  throw new BotApiError(desc, "BAD_RESPONSE");
}

// ─── انواع مشترک ───────────────────────────────────────────────────

export interface BotUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface BotContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
}

export interface BotMessage {
  message_id: number;
  from?: BotUser;
  chat: { id: number; type: string; username?: string; first_name?: string; last_name?: string };
  date: number;
  text?: string;
  contact?: BotContact;
}

export interface BotUpdate {
  update_id: number;
  message?: BotMessage;
  callback_query?: { id: string; from: BotUser; data?: string; message?: BotMessage };
}

/** صفحه‌کلید «ارسال شماره تلفن» — تنها راه وصل کردن عضو ربات به پروفایل باشگاه */
export function contactKeyboard(label: string) {
  return {
    keyboard: [[{ text: label, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}
