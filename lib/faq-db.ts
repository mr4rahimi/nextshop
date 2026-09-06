import { Prisma } from "@prisma/client";
import { faqToJson } from "@/lib/faq";

/**
 * مقدار آماده‌ی نوشتن در ستون `Json?` پریزما.
 *
 * پریزما برای «خالی کردن» ستون nullable Json مقدار `Prisma.DbNull` می‌خواهد،
 * نه `null` جاوااسکریپتی. این تبدیل عمداً اینجاست و نه در `lib/faq.ts` —
 * آن فایل در کامپوننت‌های کلاینتی import می‌شود و نباید `@prisma/client` را
 * وارد باندل مرورگر کند.
 */
export function faqForPrisma(
  raw: unknown
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const items = faqToJson(raw);
  // `FaqItem[]` ساختارش با `InputJsonValue` یکی است ولی اینترفیس ایندکس‌سیگنچر
  // ندارد، پس TypeScript آن را نمی‌پذیرد. تبدیل اینجا امن است چون خروجی
  // `normalizeFaq()` فقط رشته‌های ساده دارد.
  return items ? (items as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
}
