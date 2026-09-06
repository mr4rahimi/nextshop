/**
 * سوالات متداول — منبع حقیقت مشترک.
 *
 * بدون `use client` تا سرور (رندر + اسکیما)، مسیرهای ادمین و کامپوننت‌های
 * کلاینتی همگی از یک نرمال‌سازی استفاده کنند. اگر هر کدام قاعده‌ی خودش را
 * داشته باشد، اسکیمای JSON-LD با چیزی که کاربر می‌بیند فرق می‌کند.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

/** بیشترین تعداد سوالی که ذخیره می‌شود — جلوی بدنه‌ی بی‌انتها را می‌گیرد. */
export const FAQ_MAX_ITEMS = 20;

export const FAQ_MAX_QUESTION = 300;
export const FAQ_MAX_ANSWER = 3000;

/**
 * هر ورودی‌ای (JSON دیتابیس، بدنه‌ی درخواست، فرم ادمین) را به آرایه‌ی تمیز
 * تبدیل می‌کند. ردیف‌های ناقص حذف می‌شوند — یک ردیف خالی در فرم ادمین نباید
 * به `Question` بدون پاسخ در اسکیما تبدیل شود؛ گوگل آن را نامعتبر می‌داند.
 */
export function normalizeFaq(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];

  const out: FaqItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;

    const question = typeof r.question === "string" ? r.question.trim() : "";
    const answer = typeof r.answer === "string" ? r.answer.trim() : "";
    if (!question || !answer) continue;

    out.push({
      question: question.slice(0, FAQ_MAX_QUESTION),
      answer: answer.slice(0, FAQ_MAX_ANSWER),
    });
    if (out.length >= FAQ_MAX_ITEMS) break;
  }
  return out;
}

/**
 * مقدار آماده‌ی نوشتن در ستون `Json`.
 *
 * آرایه‌ی خالی به `null` تبدیل می‌شود، نه `[]` — تا شرط‌های `faq &&` در
 * رندر و اسکیما یک معنی داشته باشند و ستون خالی واقعاً خالی بماند.
 */
export function faqToJson(raw: unknown): FaqItem[] | null {
  const items = normalizeFaq(raw);
  return items.length ? items : null;
}

/** یک ردیف خالی برای فرم‌های ادمین. */
export function emptyFaqItem(): FaqItem {
  return { question: "", answer: "" };
}
