/**
 * خطاهای شناسنامه‌دار موتور پیامک
 *
 * هدف: ادمین به‌جای «پاسخ نامعتبر است» بفهمد دقیقاً چه چیزی کم است و کجا
 * باید درستش کند. پیش از این هر خطایی — از کلید ثبت‌نشده تا ۴۰۱ — به یک
 * پیام مبهم تبدیل می‌شد.
 */

export type SmsErrorCode =
  /** کلید API نه در تنظیمات فروشگاه هست نه در متغیر محیطی */
  | "NO_API_KEY"
  /** کلید ثبت شده ولی پنل آن را نپذیرفت (۴۰۱/۴۰۳) */
  | "UNAUTHORIZED"
  /** کلید درست است ولی این قابلیت روی پکیج حساب فعال نیست (۴۰۳) */
  | "FORBIDDEN"
  /** پنل ورودی را نپذیرفت (۴۲۲) — پیام خود پنل بهترین توضیح است */
  | "VALIDATION"
  /** موردی که خواسته شد وجود ندارد (۴۰۴) */
  | "NOT_FOUND"
  /** پنل در دسترس نبود یا در زمان مجاز پاسخ نداد */
  | "UNREACHABLE"
  /** پاسخ رسید ولی ساختارش شناخته نشد */
  | "BAD_RESPONSE";

/** کد خطا → وضعیت HTTP مناسب برای پاسخ به ادمین */
export function httpStatusFor(code: SmsErrorCode): number {
  switch (code) {
    case "NO_API_KEY":
    case "VALIDATION":
      return 400;
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "UNREACHABLE":
      return 504;
    default:
      return 502;
  }
}

export class SmsApiError extends Error {
  constructor(
    readonly code: SmsErrorCode,
    message: string,
    /** مسیری که ادمین باید برای رفع آن برود */
    readonly fixUrl?: string
  ) {
    super(message);
    this.name = "SmsApiError";
  }
}

export function noApiKeyError(): SmsApiError {
  return new SmsApiError(
    "NO_API_KEY",
    "کلید API پنل پیامک ثبت نشده است. آن را در تنظیمات فروشگاه ← تنظیمات پیامکی وارد کنید.",
    "/admin/site-settings"
  );
}
