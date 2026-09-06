"use client";

import { emptyFaqItem, FAQ_MAX_ITEMS, type FaqItem } from "@/lib/faq";

interface Props {
  items: FaqItem[];
  onChange: (items: FaqItem[]) => void;
  /** متن راهنمای بالای ادیتور */
  hint?: string;
}

/**
 * ویرایشگر سوالات متداول — مشترک بین دسته‌بندی و مطالب بلاگ.
 *
 * خروجی همان شکلی است که `normalizeFaq()` انتظار دارد: `{question, answer}`.
 * همان شکل `Product.faq` هم هست، پس هر سه جای سایت یک قرارداد دارند.
 */
export default function FaqEditor({ items, onChange, hint }: Props) {
  const add = () => onChange([...items, emptyFaqItem()]);

  const update = (i: number, key: keyof FaqItem, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const incomplete = items.filter(f => !f.question.trim() || !f.answer.trim()).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">سوالات متداول</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-6">
            {hint ??
              "این بخش در انتهای صفحه نمایش داده می‌شود و اسکیمای FAQPage را هم خودکار می‌سازد."}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={items.length >= FAQ_MAX_ITEMS}
          className="shrink-0 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold
                     hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          + افزودن سوال
        </button>
      </div>

      {incomplete > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-4 py-2.5 leading-6">
          {incomplete} ردیف ناقص است. ردیفی که سوال یا پاسخش خالی باشد ذخیره نمی‌شود —
          گوگل سوال بدون پاسخ را نامعتبر می‌داند.
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl px-5 py-8 text-center">
          هنوز سوالی اضافه نشده است.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 space-y-3 bg-white dark:bg-gray-900/40"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 tabular-nums">
                  {i + 1}
                </span>
                <input
                  value={item.question}
                  onChange={e => update(i, "question", e.target.value)}
                  placeholder="سوال — مثلاً: قیمت لیبل پرینتر از چند شروع می‌شود؟"
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                             bg-white dark:bg-gray-900 text-sm font-bold
                             text-gray-900 dark:text-white placeholder:font-normal"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`انتقال سوال ${i + 1} به بالا`}
                    className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    aria-label={`انتقال سوال ${i + 1} به پایین`}
                    className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`حذف سوال ${i + 1}`}
                    className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <textarea
                value={item.answer}
                onChange={e => update(i, "answer", e.target.value)}
                rows={3}
                placeholder="پاسخ — کوتاه، مستقیم و بدون تبلیغ. دو تا چهار جمله بهترین نتیجه را در گوگل می‌دهد."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-900 text-sm leading-7
                           text-gray-700 dark:text-gray-300"
              />
            </div>
          ))}
        </div>
      )}

      {items.length >= FAQ_MAX_ITEMS && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          به سقف {FAQ_MAX_ITEMS} سوال رسیدید.
        </p>
      )}
    </div>
  );
}
