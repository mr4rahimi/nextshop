/**
 * قرارداد درایور پیامک
 *
 * هدف: منطق باشگاه هیچ‌وقت مستقیم با API یک پنل خاص حرف نزند. اگر نصب بعدی
 * این کدبیس پنل دیگری داشت، فقط یک کلاس جدید در `providers/` اضافه می‌شود.
 */

export interface SendResult {
  ok: boolean;
  /** شناسه درخواست ارسال در پنل — برای پیگیری وضعیت تحویل */
  requestId?: number;
  error?: string;
}

export interface Recipient {
  mobile: string;
  /** متغیرهای شخصی این گیرنده — کلید بدون درصد، مثل { name: "مهدی" } */
  vars?: Record<string, string>;
}

/** وضعیت تحویل یک گیرنده — مقادیر خام پنل */
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

export interface DeliveryItem {
  mobile: string;
  status: ProviderItemStatus;
  cost?: number;
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
  /** تعداد پیامک باقی‌مانده در صورت وجود */
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
   * این مسیر اصلی کمپین‌هاست.
   */
  sendKeywords(
    lineNumber: string,
    text: string,
    recipients: Recipient[],
    schedule?: string
  ): Promise<SendResult>;

  /** ارسال با الگوی تأییدشده — برای OTP و پیام‌های تراکنشی */
  sendPattern(
    patternCode: string,
    mobile: string,
    vars: Record<string, string>
  ): Promise<SendResult>;

  /** ارسال آزمایشی به شماره مالک حساب */
  sendSample(lineNumber: string, text: string): Promise<SendResult>;

  /** اعتبار حساب */
  getBalance(): Promise<Balance | null>;

  /** وضعیت تحویل گیرنده‌های یک درخواست ارسال */
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