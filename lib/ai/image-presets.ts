/**
 * حالت‌های آماده‌ی «استودیو تصویر هوش مصنوعی» — docs/features/ai-product-image.md
 *
 * این فایل هم در مرورگر و هم روی سرور خوانده می‌شود؛ هیچ import سروری نیاید.
 *
 * برچسب فارسی است (برای کاربر)، پرامپت انگلیسی (مدل‌های تصویر با انگلیسی
 * نتیجه‌ی بهتری می‌دهند). هر پرامپت با `PRESERVE_RULE` تمام می‌شود — بدون آن
 * مدل گاهی لوگو، نوشته یا رنگ محصول را «زیباتر» می‌کند و این یعنی مرجوعی.
 */

export interface AiImagePreset {
  id: string;
  label: string;
  prompt: string;
  /** پس از ساخت، پیکسل‌های تقریباً سفید پس‌زمینه دقیقاً #FFFFFF شوند */
  whiteBg: boolean;
}

/** کیفیت‌های gpt-image — هزینه و زمان با کیفیت بالا می‌رود */
export type AiImageQuality = "low" | "medium" | "high";

export const AI_IMAGE_QUALITIES: { value: AiImageQuality; label: string; hint: string }[] = [
  { value: "low",    label: "پیش‌نمایش سریع", hint: "حدود ۲۰ ثانیه، ارزان‌ترین" },
  { value: "medium", label: "استاندارد",      hint: "حدود ۴۰ ثانیه، مناسب اکثر محصولات" },
  { value: "high",   label: "بالاترین کیفیت", hint: "تا ۲ دقیقه، گران‌تر" },
];

/** مدل‌هایی که عکس ورودی می‌گیرند. فعلاً در GapGPT فقط همین یکی — docs/features/ai-product-image.md */
export const AI_IMAGE_MODELS = [
  { value: "gpt-image-2", label: "GPT Image 2 (OpenAI)" },
] as const;

export const DEFAULT_IMAGE_MODEL = "gpt-image-2";

/** ضلع خروجی نهایی — مدل مربع ۱۰۲۴ می‌دهد و عمداً بزرگ‌ترش نمی‌کنیم (بزرگ‌نمایی جزئیات نمی‌سازد) */
export const AI_IMAGE_SIZE = 1024;

export const PRESERVE_RULE =
  " Keep the product exactly as it is in the photo: same shape, proportions, colors, materials, " +
  "logos, labels and any text. Do not add, remove or redesign any part of the product. " +
  "Square 1:1 composition, product centered and filling about 80% of the frame, sharp focus, " +
  "no watermark, no added text.";

export const DEFAULT_IMAGE_PRESETS: AiImagePreset[] = [
  {
    id: "white-studio",
    label: "عکس صنعتی — پس‌زمینه سفید",
    prompt:
      "Professional e-commerce studio product photo of this product on a pure white (#FFFFFF) " +
      "seamless background, soft even studio lighting, subtle natural contact shadow under the product.",
    whiteBg: true,
  },
  {
    id: "wood-table",
    label: "روی میز چوبی",
    prompt:
      "Lifestyle product photo of this product placed on a warm natural wooden table, " +
      "soft daylight from a window, shallow depth of field with a softly blurred cozy background.",
    whiteBg: false,
  },
  {
    id: "home",
    label: "در فضای خانه",
    prompt:
      "Lifestyle product photo of this product in a bright, modern, tidy home interior where it " +
      "would naturally be used, natural daylight, softly blurred background.",
    whiteBg: false,
  },
  {
    id: "in-hand",
    label: "در دست",
    prompt:
      "Lifestyle product photo of this product held naturally in a person's hand, " +
      "clean neutral background, soft natural light. Show only the hand, no face.",
    whiteBg: false,
  },
  {
    id: "minimal-color",
    label: "دکور مینیمال رنگی",
    prompt:
      "Minimal modern product photo of this product on a simple pedestal with a soft pastel " +
      "colored background that complements the product colors, gentle shadows, premium advertising look.",
    whiteBg: false,
  },
];

/** پرامپت نهایی که به مدل می‌رود */
export function buildImagePrompt(basePrompt: string): string {
  return basePrompt.trim() + PRESERVE_RULE;
}
