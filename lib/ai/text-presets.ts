/**
 * نوشتن متن محصول با هوش مصنوعی — بخش مشترک مرورگر و سرور
 * docs/features/ai-product-text.md
 */

export type AiTextTone = "formal" | "friendly";

/** الگوی عنوان یک دسته — زیردسته‌ها اگر الگوی خودشان را نداشته باشند از والد می‌گیرند */
export interface AiTitleTemplate {
  categoryId: string;
  pattern: string;
  example: string;
}

/** بخش‌هایی که کاربر می‌تواند بخواهد یا نخواهد */
export type AiTextSection = "title" | "short" | "expert" | "features" | "specs" | "faq" | "seo";

export const AI_TEXT_SECTIONS: { value: AiTextSection; label: string }[] = [
  { value: "title", label: "عنوان محصول" },
  { value: "short", label: "توضیح کوتاه" },
  { value: "expert", label: "توضیحات فروشگاهی و مزایا" },
  { value: "features", label: "ویژگی‌های اصلی" },
  { value: "specs", label: "مشخصات فنی" },
  { value: "faq", label: "سوالات متداول" },
  { value: "seo", label: "سئو (عنوان، توضیح، کلمات)" },
];

/**
 * مدل‌های متنی پیشنهادی GapGPT که عکس هم می‌گیرند (مهر ۱۴۰۵).
 * قیمت دلار برای هر میلیون توکن (ورودی / خروجی) — نرخ فهرست سازنده، پس «تقریبی».
 */
export const AI_TEXT_MODELS: { value: string; label: string; price: [number, number] }[] = [
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini — سریع و ارزان (پیشنهادی)", price: [0.4, 1.6] },
  { value: "gpt-4.1", label: "GPT-4.1 — متن دقیق‌تر", price: [2, 8] },
  { value: "gpt-4o-mini", label: "GPT-4o mini — ارزان‌ترین", price: [0.15, 0.6] },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", price: [0.3, 2.5] },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — بهترین نثر، گران‌تر", price: [3, 15] },
];

export const DEFAULT_TEXT_MODEL = "gpt-4.1-mini";

export const DEFAULT_TITLE_PATTERN = "{نوع کالا} {برند} مدل {مدل} {ویژگی‌های کلیدی}";
export const DEFAULT_TITLE_EXAMPLES =
  "پرینتر لیزری اچ پی مدل M141w سه کاره\nپیراهن مردانه زارا مدل رم چهارخانه";

export const TONE_LABEL: Record<AiTextTone, string> = {
  formal: "رسمی و تخصصی",
  friendly: "صمیمی و فروشنده",
};

export const DEFAULT_BANNED_WORDS = "بهترین، ارزان‌ترین، اورجینال‌ترین، بی‌نظیر، تضمینی";

/** خروجی نهایی که به فرم محصول می‌رسد (بعد از تمیزکاری سرور) */
export interface AiTextResult {
  titles: string[];
  /** برندی که روی عکس/متن دیده شد — فقط وقتی برند فرم خالی بود */
  brandGuess: string | null;
  shortDescription: string;
  expertTitle: string;
  /** متن فروشگاهی + بخش «مزایا» در انتهایش، متن ساده با خط جدید */
  expertDescription: string;
  features: string[];
  specs: { specItemId: string; title: string; value: string; fromInput: boolean }[];
  faq: { q: string; a: string }[];
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  /** چیزهایی که کاربر باید چک کند */
  warnings: string[];
}

export interface AiTextUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function estimateCost(model: string, inT: number, outT: number): number {
  const p = AI_TEXT_MODELS.find(m => m.value === model)?.price ?? [1, 4];
  return (inT * p[0] + outT * p[1]) / 1_000_000;
}
