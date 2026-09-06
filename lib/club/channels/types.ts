import type { ClubChannel, SmsKind } from "@prisma/client";

/**
 * قرارداد یک کانال ارتباطی
 *
 * پیامک، تلگرام و بله همه این را پیاده می‌کنند. هدف: افزودن کانال جدید نباید
 * به تغییر موتور کمپین و اتوماسیون نیاز داشته باشد — فقط یک فایل تازه در
 * `lib/club/channels/` و یک ردیف در رجیستری.
 *
 * ⚠️ چیزی که عمداً اینجا نیست: خط ارسال، کد پترن، متن لغو. این‌ها مفاهیم
 *    پیامک‌اند و در `SmsChannel` می‌مانند. اگر به این قرارداد بیایند، کانال
 *    بعدی مجبور می‌شود فیلدهای بی‌معنی پر کند.
 */

export interface ChannelRecipient {
  profileId: string;
  /** شناسه‌ی گیرنده در این کانال — شماره موبایل، chat_id تلگرام، ... */
  destination: string;
  userId?: string | null;
  /** متغیرهای شخصی‌سازی متن */
  vars?: Record<string, string>;
}

export interface ChannelSendInput {
  kind: SmsKind;
  /** متن نهایی با نحو `{name}` — رندر شخصی‌سازی به عهده‌ی کانال است */
  text: string;
  recipients: ChannelRecipient[];
  /** داده‌ی مخصوص کانال — دکمه‌های تلگرام، کد پترن پیامک و ... */
  extra?: Record<string, unknown>;
}

export interface ChannelSendResult {
  ok: boolean;
  /** شناسه‌ی دسته در سمت ارائه‌دهنده، اگر داشته باشد */
  requestId?: number | string;
  sentCount: number;
  failedCount: number;
  error?: string;
  /**
   * گیرنده‌هایی که این کانال **هرگز** به آن‌ها نخواهد رسید — نه خطای گذرا
   *
   * ⚠️ فرقش با شکست معمولی حیاتی است: خطای شبکه یعنی «دوباره تلاش کن»، این
   *    یعنی «سراغ کانال بعدی برو». بدون این تفکیک، عضوی که حساب بله ندارد
   *    هیچ پیامی نمی‌گیرد در حالی که شماره‌اش و رضایت پیامکش موجود است.
   */
  permanentlyFailed?: { profileId: string; reason: string }[];
}

export interface MessageChannel {
  readonly channel: ClubChannel;
  readonly title: string;

  /**
   * آیا این کانال روی این نصب قابل استفاده است؟
   * مثلاً پیامک بدون کلید API، یا تلگرام بدون توکن ربات، در دسترس نیست.
   */
  isAvailable(): Promise<boolean>;

  /** هزینه‌ی تقریبی هر پیام (تومان) — برای مقایسه‌ی کانال‌ها. صفر یعنی رایگان */
  estimateUnitCost?(text: string): Promise<number>;

  send(input: ChannelSendInput): Promise<ChannelSendResult>;
}
