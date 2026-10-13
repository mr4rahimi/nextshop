/**
 * ثابت‌های راهنمای هوشمند پنل — docs/plans/admin-assistant.md
 *
 * بدون Prisma و بدون `use client` تا صفحه‌ی تنظیمات هم از آن بخواند.
 */

export const ASSISTANT_SETTING_ID = "default";

/** سقف پیش‌فرض پاسخ روزانه‌ی هر کارمند — برای پرسیدن روزمره کافی، برای سوءمصرف کم */
export const DEFAULT_DAILY_LIMIT = 30;

export const DEFAULT_ASSISTANT_MODEL = "gpt-4.1-mini";

/** چند پیام آخر گفتگو به مدل داده می‌شود — بیشتر از این فقط توکن می‌خورد */
export const HISTORY_MESSAGES = 12;

/** بیشترین دور «ابزار ← پاسخ» در یک سؤال؛ دور آخر بی‌ابزار است */
export const MAX_TOOL_ROUNDS = 5;

/** خروجی هر ابزار پیش از رفتن به مدل کوتاه می‌شود */
export const TOOL_RESULT_MAX_CHARS = 12_000;

export const MAX_MESSAGE_CHARS = 2_000;

/** مهلت کل یک پاسخ — در فاز ۰ قدم اول گاهی تا ۳۰ ثانیه طول کشید */
export const REQUEST_TIMEOUT_MS = 150_000;

/** فاصله‌ی نظر `: keepalive` در جریان SSE — زیر سقف ۶۰ ثانیه‌ی nginx */
export const KEEPALIVE_MS = 15_000;

/**
 * مدل‌هایی که در آزمون فاز ۰ (۱۴۰۵/۰۷/۲۱، `scripts/assistant-phase0.mjs`) ابزار را جریانی و
 * درست صدا زدند. مدلی که function calling بلد نیست فقط جواب کلی می‌دهد و هیچ داده‌ای نمی‌بیند.
 * قیمت: دلار برای یک میلیون توکن ورودی و خروجی، نرخ فهرست سازنده (تقریبی).
 */
export const ASSISTANT_MODELS: { value: string; label: string; price: [number, number] }[] = [
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini — ارزان و کافی (پیشنهادی)", price: [0.4, 1.6] },
  { value: "gpt-4.1", label: "GPT-4.1 — دقیق‌ترین در آزمون، ۵ برابر گران‌تر", price: [2, 8] },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash — پاسخ کوتاه، گاهی ماه شمسی را اشتباه می‌گوید", price: [0.3, 2.5] },
  { value: "gpt-4o-mini", label: "GPT-4o mini — ارزان‌ترین، دقت کمتر", price: [0.15, 0.6] },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — پاسخ مفصل با جدول، گران", price: [3, 15] },
];

export function estimateAssistantCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = ASSISTANT_MODELS.find((m) => m.value === model)?.price ?? [1, 4];
  return (inputTokens * p[0] + outputTokens * p[1]) / 1_000_000;
}
