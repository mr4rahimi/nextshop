/**
 * قرارداد درایور پیامک
 *
 * هدف: منطق باشگاه هیچ‌وقت مستقیم با API یک پنل خاص حرف نزند. اگر نصب بعدی
 * این کدبیس پنل دیگری داشت، فقط یک کلاس جدید در `providers/` اضافه می‌شود.
 */

export interface SendResult {
  ok: boolean;
  /** شناسه درخواست ارسال در پنل — برای پیگیری وضعیت */
  requestId?: number;
  /**
   * وضعیت اولیه درخواست در پنل.
   * مهم: روی خطوط خدماتی، ارسال متن آزاد `pending-approval` می‌شود و تا
   * تأیید دستی ارسال نمی‌گردد. فقط پترن فوری ارسال می‌شود.
   */
  requestStatus?: SendRequestStatus;
  error?: string;
}

/** وضعیت کل درخواست ارسال */
export type SendRequestStatus =
  | "init"
  | "pending-approval"
  | "insufficient-balance"
  | "cancelled"
  | "rejected"
  | "in-queue"
  | "sent";

/** وضعیت یک گیرنده مشخص */
export type ProviderItemStatus =
  | "not-started"
  | "in-queue"
  | "sent"
  | "send-failure"
  | "delivered"
  | "delivery-failure"
  | "delivery-undetermined"
  | "system-error"
  | "blacklist";

/** آیا این وضعیت نهایی است و دیگر تغییر نمی‌کند؟ */
export function isTerminalRequestStatus(s: SendRequestStatus): boolean {
  return s === "sent" || s === "rejected" || s === "cancelled" || s === "insufficient-balance";
}

export function isTerminalItemStatus(s: ProviderItemStatus): boolean {
  return (
    s === "delivered" ||
    s === "delivery-failure" ||
    s === "send-failure" ||
    s === "system-error" ||
    s === "blacklist"
  );
}

export interface Recipient {
  mobile: string;
  /** متغیرهای شخصی این گیرنده — کلید بدون درصد، مثل { name: "مهدی" } */
  vars?: Record<string, string>;
}

export interface DeliveryItem {
  mobile: string;
  status: ProviderItemStatus;
  text?: string;
  error?: string | null;
  pages?: number;
}

/** شمارنده‌های آماده‌ی پنل — بدون نیاز به صفحه‌بندی آیتم‌ها */
export interface SendRequestCounts {
  total: number;
  notStarted: number;
  inQueue: number;
  sent: number;
  delivered: number;
  deliveryFailure: number;
  deliveryUndetermined: number;
  sendFailure: number;
  systemError: number;
  blacklist: number;
}

export interface SendRequestInfo {
  id: number;
  status: SendRequestStatus;
  type: string;
  lineNumber?: string;
  /** دلیل رد شدن — وقتی status = rejected */
  rejectedDue?: string | null;
  counts?: SendRequestCounts;
}

export interface InboxMessage {
  id: number;
  from: string;
  to?: string;
  text: string;
  receivedAt?: string;
}

export interface Balance {
  /** اعتبار ریالی/تومانی */
  amount: number;
  /** تعداد پیامک باقی‌مانده */
  count?: number;
}

export interface SmsProvider {
  readonly name: string;

  /** ارسال یک متن یکسان به چند گیرنده */
  sendSimple(
    lineNumber: string,
    text: string,
    recipients: string[],
    schedule?: string
  ): Promise<SendResult>;

  /**
   * ارسال شخصی‌سازی‌شده — یک درخواست، چند گیرنده، متغیر متفاوت برای هرکدام.
   * مسیر اصلی کمپین‌ها.
   */
  sendKeywords(
    lineNumber: string,
    text: string,
    recipients: Recipient[],
    schedule?: string
  ): Promise<SendResult>;

  /**
   * ارسال با الگوی تأییدشده — تنها روشی که روی خط خدماتی فوری ارسال می‌شود.
   * برای OTP و همه پیام‌های خودکار از این استفاده کنید.
   */
  sendPattern(
    patternCode: string,
    mobile: string,
    vars: Record<string, string>,
    lineNumber?: string
  ): Promise<SendResult>;

  /** ارسال آزمایشی به شماره مالک حساب */
  sendSample(lineNumber: string, text: string): Promise<SendResult>;

  /** اعتبار حساب */
  getBalance(): Promise<Balance | null>;

  /** وضعیت کلی یک درخواست ارسال به‌همراه شمارنده‌ها */
  getSendRequest(requestId: number): Promise<SendRequestInfo | null>;

  /** وضعیت تحویل تک‌تک گیرنده‌ها */
  getDeliveryItems(requestId: number): Promise<DeliveryItem[]>;

  /** پیام‌های دریافتی (منشی پیامک) — این پنل webhook ندارد و باید pull شود */
  getInbox(page?: number, limit?: number): Promise<InboxMessage[]>;

  /** هزینه تخمینی قبل از ارسال */
  estimateCost?(
    lineNumber: string,
    text: string,
    recipientCount: number
  ): Promise<number | null>;
}